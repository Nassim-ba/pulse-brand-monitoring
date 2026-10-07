import "server-only";
import { after } from "next/server";
import { aiEnabled, aiStatus, analyzeMentions, generateProfile, summarize } from "./ai";
import { APIFY_SOURCES, apifyEnabled, fetchResults, runState, startRun } from "./apify";
import { basicProfile } from "./defaults";
import { validateBrandInput } from "./validate";
import { demoMentions } from "./demo-data";
import { applyFilters, brandSlug } from "./filters";
import { fetchLiveMentions } from "./sources";
import { store, storageMode } from "./store";
import type { Analysis, Mention, MentionFilters, SearchJob, Settings, Summary } from "./types";

const SEARCH_COOLDOWN_MS = 10 * 60_000; // per brand
const DAILY_SEARCH_LIMIT = 30; // protects the Apify/Claude budget on the public demo
const DEMO_VERSION = 2;

export class CooldownError extends Error {}

interface AiError {
  message: string;
  at: string;
}

async function recordAiStatus() {
  if (aiStatus.lastError) {
    await store.setKv<AiError>("aiError", { message: aiStatus.lastError, at: new Date().toISOString() });
  } else if (aiStatus.ok) {
    await store.setKv<AiError | null>("aiError", null);
  }
  aiStatus.lastError = null;
  aiStatus.ok = false;
}

const ANALYSIS_LOCK_MS = 90_000;

/** Analyses mentions without (Claude) analysis. A lock keeps parallel requests from doing the same work twice. */
async function analyzePending(settings: Settings, mentions: Mention[]): Promise<Map<string, Analysis>> {
  const slug = brandSlug(settings.brand);
  // Rule-based results are retried with Claude once the API is reachable again, at most every 10 minutes.
  const aiError = aiEnabled ? await store.getKv<AiError>("aiError") : null;
  const retryAi = aiEnabled && (!aiError || Date.now() - new Date(aiError.at).getTime() > 10 * 60_000);
  const pending = mentions.filter((m) => !m.analysis || (retryAi && m.analysis.analyzedBy === "heuristic"));
  if (!pending.length) return new Map();

  const lock = await store.getKv<number>(`analyzing:${slug}`);
  if (lock && Date.now() - lock < ANALYSIS_LOCK_MS) return new Map();
  await store.setKv(`analyzing:${slug}`, Date.now());
  try {
    const results = await analyzeMentions(pending, settings);
    await Promise.all([...results].map(([id, a]) => store.saveAnalysis(id, a)));
    await recordAiStatus();
    return results;
  } finally {
    await store.setKv(`analyzing:${slug}`, 0);
  }
}

/**
 * Seeds demo data (if enabled) and makes sure everything gets analysed. With
 * `background`, the response is not held up: analysis runs after it is sent and
 * the client picks up the results on its next fetch.
 */
export async function loadMentions({ background = false } = {}): Promise<{ settings: Settings; mentions: Mention[] }> {
  const settings = await store.getSettings();
  const brand = brandSlug(settings.brand);

  if (settings.demoData && brand === "atz-group") {
    const seeded = await store.getKv<number | boolean>(`seeded:${brand}`);
    if (seeded !== DEMO_VERSION) {
      if (seeded) await store.deleteDemo(brand); // reseed when the demo set changed
      await store.insertMentions(demoMentions(brand));
      await store.setKv(`seeded:${brand}`, DEMO_VERSION);
    }
  }

  let mentions = await store.listMentions(brand);
  if (background) {
    if (mentions.some((m) => !m.analysis || m.analysis.analyzedBy === "heuristic")) {
      after(() => analyzePending(settings, mentions).catch((err) => console.error("Background analysis failed:", err)));
    }
  } else {
    const results = await analyzePending(settings, mentions);
    mentions = mentions.map((m) => (results.has(m.id) ? { ...m, analysis: results.get(m.id)! } : m));
  }
  if (!settings.demoData) mentions = mentions.filter((m) => !m.isDemo);
  return { settings, mentions };
}

// ---------- Brand search ----------

/** Profiles from before logo support get the official name and domain filled in once. */
async function backfillProfile(settings: Settings): Promise<Settings> {
  if (settings.domain || settings.demoData) return settings;
  const refreshed = await generateProfile(settings.brand);
  await recordAiStatus();
  return refreshed?.isBrand && brandSlug(refreshed.brand) === brandSlug(settings.brand)
    ? { ...settings, brand: refreshed.brand, domain: refreshed.domain }
    : settings;
}

export class LimitError extends Error {}
export class NotBrandError extends Error {}



const jobKey = (slug: string) => `job:${slug}`;
const isActive = (st: string) => st === "running" || st === "queued";

type JobEntry = SearchJob["sources"][string];

/**
 * Starts an Apify run for one source. When the account's concurrency limit is
 * reached the source stays queued and is retried on the next poll.
 */
async function tryStart(src: (typeof APIFY_SOURCES)[number], settings: Settings, entry: JobEntry): Promise<void> {
  try {
    const { runId, datasetId } = await startRun(src, settings);
    Object.assign(entry, { status: "running", runId, datasetId, note: undefined });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (/concurrent-runs-limit|rate-limit|429/.test(message)) {
      Object.assign(entry, { status: "queued", note: "Wartet auf einen freien Apify-Slot" });
      return;
    }
    console.error(`Apify start failed (${src.key}):`, err);
    Object.assign(entry, { status: "error", note: `Start fehlgeschlagen. ${message.replace(/\s+/g, " ").slice(0, 160)}` });
  }
}

/**
 * Starts a search for a brand: creates the profile (via Claude for new brands),
 * fetches news synchronously and starts the Apify runs, which are polled later.
 */
export async function startSearch(brandName?: string): Promise<SearchJob> {
  const current = await store.getSettings();
  const name = (brandName ?? current.brand).trim().replace(/\s+/g, " ").slice(0, 60);
  const invalid = validateBrandInput(name);
  if (invalid) throw new NotBrandError(invalid);

  let settings = await store.getProfile(brandSlug(name));
  if (!settings) {
    const profile = await generateProfile(name);
    await recordAiStatus();
    if (profile && !profile.isBrand) throw new NotBrandError(`„${name}“ ist keine erkennbare Marke. ${profile.reason}`);
    if (profile?.isBrand) {
      const { brand, domain, keywords, excludeKeywords, hashtags, context } = profile;
      const fields = { brand, domain, keywords, excludeKeywords, hashtags, context };
      // The canonical name may map to an already known brand ("adiddas" → "Adidas").
      settings = (await store.getProfile(brandSlug(fields.brand))) ?? { ...basicProfile(fields.brand), ...fields };
    } else {
      settings = basicProfile(name);
    }
  } else {
    settings = await backfillProfile(settings);
  }
  await store.saveSettings(settings);
  const slug = brandSlug(settings.brand);
  const existing = await store.getKv<SearchJob>(jobKey(slug));

  // Recent or running searches are reused instead of paying again. Sources that
  // failed are retried, so a search always ends up covering every enabled source.
  if (existing && (existing.status === "running" || Date.now() - new Date(existing.startedAt).getTime() < SEARCH_COOLDOWN_MS)) {
    const failed = APIFY_SOURCES.filter((src) => existing.sources[src.key]?.status === "error" && settings.sources[src.key] && apifyEnabled);
    if (failed.length) {
      await Promise.all(failed.map((src) => tryStart(src, settings, existing.sources[src.key])));
      existing.status = Object.values(existing.sources).some((x) => isActive(x.status)) ? "running" : "done";
      await store.setKv(jobKey(slug), existing);
    }
    return existing;
  }

  const day = new Date().toISOString().slice(0, 10);
  const used = (await store.getKv<number>(`searches:${day}`)) ?? 0;
  if (used >= DAILY_SEARCH_LIMIT) throw new LimitError("Tageslimit für Suchen erreicht. Bitte morgen erneut versuchen.");
  await store.setKv(`searches:${day}`, used + 1);

  const job: SearchJob = {
    id: `${slug}-${Date.now()}`,
    brand: slug,
    brandName: settings.brand,
    startedAt: new Date().toISOString(),
    status: "running",
    sources: {},
  };

  // News feeds answer within seconds.
  const news = await fetchLiveMentions(settings);
  await store.insertMentions(news.mentions);
  job.sources.news = {
    label: "News (Google, Bing, Hacker News)",
    status: news.errors.length && !news.mentions.length ? "error" : "done",
    count: news.mentions.length,
    note: news.errors.join(", ") || undefined,
  };

  await Promise.all(
    APIFY_SOURCES.map(async (src) => {
      if (!settings.sources[src.key]) {
        job.sources[src.key] = { label: src.label, status: "skipped", note: "In den Einstellungen deaktiviert" };
      } else if (!apifyEnabled) {
        job.sources[src.key] = { label: src.label, status: "skipped", note: "Kein Apify-Token hinterlegt" };
      } else {
        job.sources[src.key] = { label: src.label, status: "queued" };
        await tryStart(src, settings, job.sources[src.key]);
      }
    }),
  );

  job.status = Object.values(job.sources).some((x) => isActive(x.status)) ? "running" : "done";
  await store.setKv(jobKey(slug), job);
  await store.setKv(`lastRefresh:${slug}`, job.startedAt);
  return job;
}

/** Checks running Apify runs, imports finished results and analyses them. */
export async function pollSearch(): Promise<SearchJob | null> {
  const settings = await store.getSettings();
  const slug = brandSlug(settings.brand);
  const job = await store.getKv<SearchJob>(jobKey(slug));
  if (!job || job.status === "done") return job;

  // Give up on runs that hang far beyond their own timeout.
  const stale = Date.now() - new Date(job.startedAt).getTime() > 6 * 60_000;

  await Promise.all(
    APIFY_SOURCES.map(async (src) => {
      const entry = job.sources[src.key];
      if (entry?.status === "queued") {
        if (stale) Object.assign(entry, { status: "error", note: "Kein freier Apify-Slot, bitte erneut suchen" });
        else await tryStart(src, settings, entry);
        return;
      }
      if (!entry || entry.status !== "running" || !entry.runId || !entry.datasetId) return;
      try {
        const state = await runState(entry.runId);
        if (state === "running") {
          if (stale) Object.assign(entry, { status: "error", note: "Zeitüberschreitung" });
          return;
        }
        // Failed runs may still have partial results.
        const items = await fetchResults(src, entry.datasetId, settings);
        const excludes = settings.excludeKeywords.map((k) => k.toLowerCase());
        const kept = items.filter((m) => !excludes.some((e) => `${m.title} ${m.content}`.toLowerCase().includes(e)));
        await store.insertMentions(kept);
        // Count what the source found; concurrent polls may insert the same rows.
        Object.assign(entry, {
          status: state === "failed" && !items.length ? "error" : "done",
          count: kept.length,
          note: state === "failed" ? "Lauf abgebrochen" : undefined,
        });
      } catch (err) {
        console.error(`Apify poll failed (${src.key}):`, err);
        if (stale) Object.assign(entry, { status: "error", note: "Abruf fehlgeschlagen" });
      }
    }),
  );

  if (!Object.values(job.sources).some((x) => isActive(x.status))) job.status = "done";
  await store.setKv(jobKey(slug), job);
  await loadMentions(); // analyse what came in
  return job;
}

export async function switchBrand(slug: string): Promise<boolean> {
  const profile = await store.getProfile(slug);
  if (!profile) return false;
  await store.saveSettings(await backfillProfile(profile));
  return true;
}

export async function getSummary(filters: MentionFilters, scopeLabel: string, force = false): Promise<Summary> {
  const { settings, mentions } = await loadMentions({ background: true });
  const scoped = applyFilters(mentions, filters);
  const key = `summary:${brandSlug(settings.brand)}:${scoped
    .map((m) => `${m.id}${m.status[0]}${m.analysis?.analyzedBy[0] ?? "-"}`)
    .sort()
    .join(",")}`.slice(0, 2000);
  if (!force) {
    const cached = await store.getKv<Summary>(key);
    if (cached) return cached;
  }
  const summary = await summarize(scoped, settings, scopeLabel);
  await recordAiStatus();
  // Only cache real AI summaries, so a temporary outage doesn't stick.
  if (summary.generatedBy === "claude") await store.setKv(key, summary);
  return summary;
}

export async function reanalyzeAll(): Promise<number> {
  const settings = await store.getSettings();
  const last = await store.getKv<number>("reanalyze");
  if (last && Date.now() - last < 5 * 60_000) throw new CooldownError("Neuanalyse ist nur alle 5 Minuten möglich.");
  await store.setKv("reanalyze", Date.now());
  const mentions = await store.listMentions(brandSlug(settings.brand));
  const results = await analyzeMentions(mentions, settings);
  await Promise.all([...results].map(([id, a]) => store.saveAnalysis(id, a)));
  await recordAiStatus();
  return results.size;
}

export async function getMeta() {
  const settings = await store.getSettings();
  return {
    aiEnabled,
    apifyEnabled,
    storageMode,
    brands: await store.listBrands(),
    job: await store.getKv<SearchJob>(jobKey(brandSlug(settings.brand))),
    lastRefresh: await store.getKv<string>(`lastRefresh:${brandSlug(settings.brand)}`),
    aiError: aiEnabled ? await store.getKv<AiError>("aiError") : null,
  };
}
