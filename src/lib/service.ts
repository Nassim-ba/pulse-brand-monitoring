import "server-only";
import { aiEnabled, aiStatus, analyzeMentions, summarize } from "./ai";
import { demoMentions } from "./demo-data";
import { applyFilters, brandSlug } from "./filters";
import { fetchLiveMentions } from "./sources";
import { store, storageMode } from "./store";
import type { Mention, MentionFilters, Settings, Summary } from "./types";

const REFRESH_COOLDOWN_MS = 60_000;

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
    const seeded = await store.getKv<boolean>(`seeded:${brand}`);
    if (!seeded) {
      await store.insertMentions(demoMentions(brand));
      await store.setKv(`seeded:${brand}`, true);
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

export interface RefreshResult {
  fetched: number;
  inserted: number;
  errors: string[];
  cooldown?: number;
}

export async function refresh(): Promise<RefreshResult> {
  const settings = await store.getSettings();
  const brand = brandSlug(settings.brand);
  const last = await store.getKv<number>(`refresh:${brand}`);
  if (last && Date.now() - last < REFRESH_COOLDOWN_MS) {
    return { fetched: 0, inserted: 0, errors: [], cooldown: Math.ceil((REFRESH_COOLDOWN_MS - (Date.now() - last)) / 1000) };
  }
  await store.setKv(`refresh:${brand}`, Date.now());

  const { mentions, errors } = await fetchLiveMentions(settings);
  const inserted = await store.insertMentions(mentions);
  await store.setKv(`lastRefresh:${brand}`, new Date().toISOString());
  return { fetched: mentions.length, inserted, errors };
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
    storageMode,
    lastRefresh: await store.getKv<string>(`lastRefresh:${brandSlug(settings.brand)}`),
    aiError: aiEnabled ? await store.getKv<AiError>("aiError") : null,
  };
}
