import "server-only";
import { aiEnabled, aiStatus, analyzeMentions, generateProfile, summarize } from "./ai";
import { APIFY_SOURCES, apifyEnabled, fetchResults, runState, startRun } from "./apify";
import { basicProfile } from "./defaults";
import { demoMentions } from "./demo-data";
import { applyFilters, brandSlug } from "./filters";
import { fetchLiveMentions } from "./sources";
import { store, storageMode } from "./store";
import type { Mention, MentionFilters, SearchJob, Settings, Summary } from "./types";

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

/** Seeds demo data (if enabled) and analyses everything that has no analysis yet. */
export async function loadMentions(): Promise<{ settings: Settings; mentions: Mention[] }> {
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
  // Analyse new mentions. Rule-based results are retried with Claude once the API is
  // reachable again, at most every 10 minutes.
  const aiError = aiEnabled ? await store.getKv<AiError>("aiError") : null;
  const retryAi = aiEnabled && (!aiError || Date.now() - new Date(aiError.at).getTime() > 10 * 60_000);
  const pending = mentions.filter((m) => !m.analysis || (retryAi && m.analysis.analyzedBy === "heuristic"));
  if (pending.length) {
    const results = await analyzeMentions(pending, settings);
    await Promise.all([...results].map(([id, a]) => store.saveAnalysis(id, a)));
    await recordAiStatus();
    mentions = mentions.map((m) => (results.has(m.id) ? { ...m, analysis: results.get(m.id)! } : m));
  }
  if (!settings.demoData) mentions = mentions.filter((m) => !m.isDemo);
  return { settings, mentions };
}

// ---------- Brand search ----------

export class LimitError extends Error {}

const jobKey = (slug: string) => `job:${slug}`;

/**
 * Starts a search for a brand: creates the profile (via Claude for new brands),
 * fetches news synchronously and starts the Apify runs, which are polled later.
 */
export async function startSearch(brandName?: string): Promise<SearchJob> {
  const current = await store.getSettings();
  const name = (brandName ?? current.brand).trim().slice(0, 60);
  const slug = brandSlug(name);

  const existing = await store.getKv<SearchJob>(jobKey(slug));
  let settings = await store.getProfile(slug);
  if (!settings) {
    const profile = await generateProfile(name);
    await recordAiStatus();
    settings = { ...basicProfile(name), ...(profile ?? {}) };
  }
  await store.saveSettings(settings);

  // Recent or running searches are reused instead of paying again.
  if (existing && (existing.status === "running" || Date.now() - new Date(existing.startedAt).getTime() < SEARCH_COOLDOWN_MS)) {
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
  const inserted = await store.insertMentions(news.mentions);
  job.sources.news = {
    label: "News (Google, Bing, Hacker News)",
    status: news.errors.length && !news.mentions.length ? "error" : "done",
    count: inserted,
    note: news.errors.join(", ") || undefined,
  };

  await Promise.all(
    APIFY_SOURCES.map(async (src) => {
      if (!settings.sources[src.key]) {
        job.sources[src.key] = { label: src.label, status: "skipped", note: "In den Einstellungen deaktiviert" };
      } else if (!apifyEnabled) {
        job.sources[src.key] = { label: src.label, status: "skipped", note: "Kein Apify-Token hinterlegt" };
      } else {
        try {
          const { runId, datasetId } = await startRun(src, settings);
          job.sources[src.key] = { label: src.label, status: "running", runId, datasetId };
        } catch (err) {
          console.error(`Apify start failed (${src.key}):`, err);
          const detail = err instanceof Error ? err.message.replace(/\s+/g, " ").slice(0, 160) : "";
          job.sources[src.key] = { label: src.label, status: "error", note: `Start fehlgeschlagen. ${detail}`.trim() };
        }
      }
    }),
  );

  job.status = Object.values(job.sources).some((x) => x.status === "running") ? "running" : "done";
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
        const inserted = await store.insertMentions(kept);
        Object.assign(entry, {
          status: state === "failed" && !items.length ? "error" : "done",
          count: inserted,
          note: state === "failed" ? "Lauf abgebrochen" : undefined,
        });
      } catch (err) {
        console.error(`Apify poll failed (${src.key}):`, err);
        if (stale) Object.assign(entry, { status: "error", note: "Abruf fehlgeschlagen" });
      }
    }),
  );

  if (!Object.values(job.sources).some((x) => x.status === "running")) job.status = "done";
  await store.setKv(jobKey(slug), job);
  await loadMentions(); // analyse what came in
  return job;
}

export async function switchBrand(slug: string): Promise<boolean> {
  const profile = await store.getProfile(slug);
  if (!profile) return false;
  await store.saveSettings(profile);
  return true;
}

export async function getSummary(filters: MentionFilters, scopeLabel: string, force = false): Promise<Summary> {
  const { settings, mentions } = await loadMentions();
  const scoped = applyFilters(mentions, filters);
  const key = `summary:${brandSlug(settings.brand)}:${scoped
    .map((m) => `${m.id}${m.status[0]}`)
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
