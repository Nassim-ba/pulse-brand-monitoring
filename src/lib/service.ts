import "server-only";
import { after } from "next/server";
import { aiEnabled, aiStatus, analyzeMentions, askAboutMentions, compareBrands, generateProfile, suggestCompetitorNames, summarize, type AskTurn } from "./ai";
import { APIFY_SOURCES, apifyEnabled, fetchResults, runState, startRun } from "./apify";
import { basicProfile } from "./defaults";
import { validateBrandInput } from "./validate";
import { applyFilters, brandSlug, byDate, byReach, byRelevance, interactions, reach } from "./filters";
import { fetchLiveMentions } from "./sources";
import { store, storageMode } from "./store";
import { SENTIMENTS, TOPICS, type Analysis, type BrandStats, type CompetitorInsight, type Mention, type MentionFilters, type SearchJob, type Settings, type Summary } from "./types";
import { TOPIC_LABELS } from "./labels";

const SEARCH_COOLDOWN_MS = 10 * 60_000; // per brand
const DAILY_SEARCH_LIMIT = 30; // protects the Apify/Claude budget of the public app

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
 * Loads the mentions of the active brand and makes sure everything gets analysed. With
 * `background`, the response is not held up: analysis runs after it is sent and
 * the client picks up the results on its next fetch.
 */
export async function loadMentions({ background = false, slug }: { background?: boolean; slug?: string } = {}): Promise<{
  settings: Settings;
  mentions: Mention[];
}> {
  const settings = slug ? await store.getProfile(slug) : await store.getSettings();
  if (!settings) throw new Error(`Unknown brand ${slug}`);
  const brand = brandSlug(settings.brand);

  let mentions = await store.listMentions(brand);
  if (background) {
    if (mentions.some((m) => !m.analysis || m.analysis.analyzedBy === "heuristic")) {
      after(() => analyzePending(settings, mentions).catch((err) => console.error("Background analysis failed:", err)));
    }
  } else {
    const results = await analyzePending(settings, mentions);
    mentions = mentions.map((m) => (results.has(m.id) ? { ...m, analysis: results.get(m.id)! } : m));
  }
  return { settings, mentions };
}

// ---------- Brand search ----------

/** Profiles from before logo support get the official name and domain filled in once. */
async function backfillProfile(settings: Settings): Promise<Settings> {
  if (settings.domain) return settings;
  const refreshed = await generateProfile(settings.brand);
  await recordAiStatus();
  return refreshed?.isBrand && brandSlug(refreshed.brand) === brandSlug(settings.brand)
    ? { ...settings, brand: refreshed.brand, domain: refreshed.domain }
    : settings;
}

export class LimitError extends Error {}
export class NotBrandError extends Error {}

/** Validates the input and returns the brand's profile, creating it via Claude for new brands. */
async function resolveProfile(input: string): Promise<Settings> {
  const name = input.trim().replace(/\s+/g, " ").slice(0, 60);
  const invalid = validateBrandInput(name);
  if (invalid) throw new NotBrandError(invalid);

  const known = await store.getProfile(brandSlug(name));
  if (known) return backfillProfile(known);

  const profile = await generateProfile(name);
  await recordAiStatus();
  if (profile && !profile.isBrand) throw new NotBrandError(`„${name}“ ist keine erkennbare Marke. ${profile.reason}`);
  if (!profile) return basicProfile(name);
  const { brand, domain, keywords, excludeKeywords, hashtags, context } = profile;
  // The canonical name may map to an already known brand ("adiddas" → "Adidas").
  return (await store.getProfile(brandSlug(brand))) ?? { ...basicProfile(brand), brand, domain, keywords, excludeKeywords, hashtags, context };
}

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
export async function startSearch(brandName?: string, { activate = true }: { activate?: boolean } = {}): Promise<SearchJob> {
  const settings = await resolveProfile(brandName ?? (await store.getSettings()).brand);
  // Competitor searches must not switch the monitored brand.
  if (activate) await store.saveSettings(settings);
  else await store.saveProfile(settings);
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
export async function pollSearch(slugParam?: string): Promise<SearchJob | null> {
  const settings = slugParam ? await store.getProfile(slugParam) : await store.getSettings();
  if (!settings) return null;
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
  await loadMentions({ slug }); // analyse what came in
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

// ---------- Ask Pulse ----------

const DAILY_QUESTION_LIMIT = 150;
const MAX_CONTEXT_MENTIONS = 120;

export interface AskResult {
  answer: string;
  sources: { n: number; id: string; title: string; sourceLabel: string; url: string }[];
  basedOn: number;
}

export async function ask(question: string, history: AskTurn[], filters: MentionFilters): Promise<AskResult> {
  if (!aiEnabled) throw new LimitError("Frag Pulse braucht die KI-Anbindung, die gerade nicht aktiv ist.");
  const day = new Date().toISOString().slice(0, 10);
  const used = (await store.getKv<number>(`questions:${day}`)) ?? 0;
  if (used >= DAILY_QUESTION_LIMIT) throw new LimitError("Tageslimit für Fragen erreicht. Bitte morgen erneut versuchen.");
  await store.setKv(`questions:${day}`, used + 1);

  const { settings, mentions } = await loadMentions({ background: true });
  // Most relevant first, then newest, so the context stays within budget.
  const scoped = applyFilters(mentions, filters)
    .filter((m) => m.analysis)
    .sort(byRelevance)
    .slice(0, MAX_CONTEXT_MENTIONS)
    .sort(byDate);
  if (!scoped.length) {
    return { answer: "Für die aktuelle Auswahl liegen noch keine analysierten Erwähnungen vor. Starte eine Suche oder passe die Filter an.", sources: [], basedOn: 0 };
  }

  try {
    const result = await askAboutMentions(question, history, scoped, settings);
    await recordAiStatus();
    if (!result) throw new Error("Keine Antwort erhalten");
    return {
      answer: result.answer,
      sources: result.cited.map((n) => {
        const m = scoped[n - 1];
        return { n, id: m.id, title: m.analysis?.summary ?? m.title, sourceLabel: m.sourceLabel, url: m.url };
      }),
      basedOn: scoped.length,
    };
  } catch (err) {
    aiStatus.lastError = err instanceof Error ? err.message.slice(0, 300) : String(err);
    await recordAiStatus();
    throw err;
  }
}

// ---------- Competitor comparison ----------

const MAX_COMPETITORS = 3;

async function comparisonBrands(): Promise<{ own: Settings; competitors: Settings[] }> {
  const own = await store.getSettings();
  const competitors = (
    await Promise.all((own.competitors ?? []).map((slug) => store.getProfile(slug)))
  ).filter((p): p is Settings => Boolean(p));
  return { own, competitors };
}

export async function suggestCompetitors(): Promise<string[]> {
  const { own, competitors } = await comparisonBrands();
  const cached = await store.getKv<string[]>(`suggestions:${brandSlug(own.brand)}`);
  const names = cached ?? (await suggestCompetitorNames(own));
  await recordAiStatus();
  if (!cached && names.length) await store.setKv(`suggestions:${brandSlug(own.brand)}`, names);
  const taken = new Set([brandSlug(own.brand), ...competitors.map((c) => brandSlug(c.brand))]);
  return names.filter((n) => !taken.has(brandSlug(n)));
}

export async function addCompetitor(name: string): Promise<void> {
  const own = await store.getSettings();
  const list = own.competitors ?? [];
  if (list.length >= MAX_COMPETITORS) throw new LimitError(`Es lassen sich höchstens ${MAX_COMPETITORS} Wettbewerber vergleichen.`);
  const profile = await resolveProfile(name);
  const slug = brandSlug(profile.brand);
  if (slug === brandSlug(own.brand)) throw new NotBrandError("Das ist die überwachte Marke selbst.");
  await store.saveProfile(profile);
  if (!list.includes(slug)) await store.saveSettings({ ...own, competitors: [...list, slug] });
}

export async function removeCompetitor(slug: string): Promise<void> {
  const own = await store.getSettings();
  await store.saveSettings({ ...own, competitors: (own.competitors ?? []).filter((s) => s !== slug) });
}

/** Starts (or reuses) searches for the monitored brand and all competitors. */
export async function refreshComparison(): Promise<void> {
  const { own, competitors } = await comparisonBrands();
  for (const brand of [own, ...competitors]) {
    await startSearch(brand.brand, { activate: false });
  }
}

/** Advances the searches of all compared brands. */
export async function pollComparison(): Promise<void> {
  const { own, competitors } = await comparisonBrands();
  await Promise.all([own, ...competitors].map((b) => pollSearch(brandSlug(b.brand))));
}

function statsFor(settings: Settings, mentions: Mention[], filters: MentionFilters, isOwn: boolean, job: SearchJob | null, lastSearch: string | null) {
  const scoped = applyFilters(mentions, filters).filter((m) => m.analysis);
  const sentiment = Object.fromEntries(SENTIMENTS.map((s) => [s, scoped.filter((m) => m.analysis!.sentiment === s).length])) as BrandStats["sentiment"];
  const net = scoped.length ? Math.round(((sentiment.positive - sentiment.negative) / scoped.length) * 100) : 0;
  const topTopics = TOPICS.map((t) => ({ topic: t, count: scoped.filter((m) => m.analysis!.topic === t).length }))
    .filter((x) => x.count)
    .sort((a, b) => b.count - a.count)
    .slice(0, 3);
  const platformMap = new Map<string, number>();
  scoped.forEach((m) => platformMap.set(m.sourceLabel.split(" · ")[0], (platformMap.get(m.sourceLabel.split(" · ")[0]) ?? 0) + 1));
  return {
    scoped,
    stats: {
      slug: brandSlug(settings.brand),
      name: settings.brand,
      domain: settings.domain,
      isOwn,
      mentions: scoped.length,
      shareOfVoice: 0,
      reach: scoped.reduce((n, m) => n + reach(m), 0),
      shareOfReach: 0,
      interactions: scoped.reduce((n, m) => n + interactions(m), 0),
      sentiment,
      net,
      topTopics,
      platforms: [...platformMap].map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count),
      pending: mentions.filter((m) => !m.analysis).length,
      lastSearch,
      job,
    } satisfies BrandStats,
  };
}

async function collectComparison(filters: MentionFilters) {
  const { own, competitors } = await comparisonBrands();
  const rows = await Promise.all(
    [own, ...competitors].map(async (b, i) => {
      const slug = brandSlug(b.brand);
      const { mentions } = await loadMentions({ background: true, slug });
      const job = await store.getKv<SearchJob>(jobKey(slug));
      const lastSearch = await store.getKv<string>(`lastRefresh:${slug}`);
      return statsFor(b, mentions, filters, i === 0, job, lastSearch);
    }),
  );
  const totalMentions = rows.reduce((n, r) => n + r.stats.mentions, 0);
  const totalReach = rows.reduce((n, r) => n + r.stats.reach, 0);
  for (const r of rows) {
    r.stats.shareOfVoice = totalMentions ? Math.round((r.stats.mentions / totalMentions) * 1000) / 10 : 0;
    r.stats.shareOfReach = totalReach ? Math.round((r.stats.reach / totalReach) * 1000) / 10 : 0;
  }
  return { own, rows };
}

export async function getComparison(filters: MentionFilters): Promise<{ brands: BrandStats[]; maxCompetitors: number }> {
  const { rows } = await collectComparison(filters);
  return { brands: rows.map((r) => r.stats), maxCompetitors: MAX_COMPETITORS };
}

export async function getCompetitorInsight(filters: MentionFilters, force = false): Promise<CompetitorInsight | null> {
  const { own, rows } = await collectComparison(filters);
  if (rows.length < 2 || rows.some((r) => r.stats.pending > 0)) return null;
  const key = `insight:${brandSlug(own.brand)}:${rows.map((r) => `${r.stats.slug}-${r.stats.mentions}-${r.stats.reach}-${r.stats.net}`).join(",")}:${JSON.stringify(filters)}`.slice(0, 1500);
  if (!force) {
    const cached = await store.getKv<CompetitorInsight>(key);
    if (cached) return cached;
  }
  const input = rows.map(({ stats: s, scoped }) => ({
    name: s.name + (s.isOwn ? " (eigene Marke)" : ""),
    stats: `Relevante Erwähnungen ${s.mentions}, Share of Voice ${s.shareOfVoice} %, Reichweite ${s.reach}, Share of Reach ${s.shareOfReach} %, Interaktionen ${s.interactions}, Stimmung positiv ${s.sentiment.positive} / neutral ${s.sentiment.neutral} / negativ ${s.sentiment.negative}, Stimmungsindex ${s.net}, Top-Themen ${s.topTopics.map((t) => `${TOPIC_LABELS[t.topic]} (${t.count})`).join(", ") || "keine"}, Plattformen ${s.platforms.map((p) => `${p.name} ${p.count}`).join(", ") || "keine"}`,
    samples: [...scoped].sort(byReach).slice(0, 8).map((m) => `[${m.sourceLabel.split(" · ")[0]}, ${m.analysis!.sentiment}] ${m.analysis!.summary}`),
  }));
  try {
    const result = await compareBrands(own.brand, input);
    await recordAiStatus();
    if (!result) return null;
    const insight = { ...result, generatedAt: new Date().toISOString() };
    await store.setKv(key, insight);
    return insight;
  } catch (err) {
    aiStatus.lastError = err instanceof Error ? err.message.slice(0, 300) : String(err);
    await recordAiStatus();
    return null;
  }
}
