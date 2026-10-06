import "server-only";
import { brandSlug } from "./filters";
import { mentionId } from "./sources";
import type { RawMention, Settings } from "./types";

/**
 * Social media and Google web search via Apify actors. Runs are started
 * asynchronously (they take 30–120 s) and polled by the search job.
 */

const API = "https://api.apify.com/v2";
const token = process.env.APIFY_TOKEN;
export const apifyEnabled = Boolean(token);

const RESULTS_PER_SOURCE = 20;
const MAX_CHARGE_USD = 0.25; // hard cost cap per run

export interface ApifySource {
  key: "instagram" | "tiktok" | "googleSearch";
  label: string;
  actor: string;
  input: (s: Settings) => Record<string, unknown>;
  map: (item: Record<string, unknown>, s: Settings) => RawMention | null;
}

const str = (v: unknown) => (typeof v === "string" ? v : "");
const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : undefined);
const firstLine = (t: string, max = 110) => {
  const line = t.split("\n").find((l) => l.trim()) ?? "";
  return line.length > max ? `${line.slice(0, max - 1)}…` : line;
};

export const APIFY_SOURCES: ApifySource[] = [
  {
    key: "instagram",
    label: "Instagram",
    actor: "apify~instagram-hashtag-scraper",
    input: (s) => ({
      hashtags: (s.hashtags.length ? s.hashtags : [s.brand]).slice(0, 2),
      resultsType: "posts",
      resultsLimit: Math.ceil(RESULTS_PER_SOURCE / Math.max(1, Math.min(2, s.hashtags.length))),
    }),
    map: (it, s) => {
      const url = str(it.url) || (it.shortCode ? `https://www.instagram.com/p/${str(it.shortCode)}/` : "");
      const caption = str(it.caption);
      if (!url || !caption) return null;
      const comments = Array.isArray(it.latestComments)
        ? (it.latestComments as { text?: string }[])
            .map((c) => c.text)
            .filter(Boolean)
            .slice(0, 3)
        : [];
      return {
        id: mentionId(`${brandSlug(s.brand)}:${url}`),
        brand: brandSlug(s.brand),
        source: "instagram",
        sourceLabel: "Instagram",
        kind: "social",
        title: firstLine(caption) || "Instagram-Beitrag",
        content: (caption + (comments.length ? `\n\nKommentare:\n${comments.map((c) => `„${c}“`).join("\n")}` : "")).slice(0, 2000),
        url,
        author: it.ownerUsername ? `@${str(it.ownerUsername)}` : null,
        publishedAt: new Date(str(it.timestamp) || Date.now()).toISOString(),
        isDemo: false,
        metrics: {
          likes: num(it.likesCount),
          comments: num(it.commentsCount),
          views: num(it.videoViewCount) ?? num(it.videoPlayCount),
        },
      };
    },
  },
  {
    key: "tiktok",
    label: "TikTok",
    actor: "clockworks~tiktok-scraper",
    input: (s) => ({
      searchQueries: [s.brand],
      resultsPerPage: RESULTS_PER_SOURCE,
      searchSection: "/video",
      shouldDownloadVideos: false,
      shouldDownloadCovers: false,
      shouldDownloadSlideshowImages: false,
      shouldDownloadAvatars: false,
    }),
    map: (it, s) => {
      const url = str(it.webVideoUrl);
      const text = str(it.text);
      if (!url) return null;
      const author = it.authorMeta as { name?: string; fans?: number } | undefined;
      return {
        id: mentionId(`${brandSlug(s.brand)}:${url}`),
        brand: brandSlug(s.brand),
        source: "tiktok",
        sourceLabel: "TikTok",
        kind: "social",
        title: firstLine(text) || "TikTok-Video",
        content: text.slice(0, 2000) || "TikTok-Video ohne Beschreibung",
        url,
        author: author?.name ? `@${author.name}` : null,
        publishedAt: new Date(str(it.createTimeISO) || (num(it.createTime) ?? Date.now() / 1000) * 1000).toISOString(),
        isDemo: false,
        metrics: {
          likes: num(it.diggCount),
          comments: num(it.commentCount),
          views: num(it.playCount),
          shares: num(it.shareCount),
          followers: num(author?.fans),
        },
      };
    },
  },
  {
    key: "googleSearch",
    label: "Google Suche",
    actor: "apify~google-search-scraper",
    input: (s) => ({
      queries: `"${s.brand}"`,
      maxPagesPerQuery: 2,
      countryCode: "de",
      languageCode: "de",
      saveHtmlToKeyValueStore: false,
    }),
    // One dataset item per results page; organic results are expanded in mapPage().
    map: () => null,
  },
];

/** Google returns one item per SERP page, each holding many organic results. */
function mapGooglePage(page: Record<string, unknown>, s: Settings): RawMention[] {
  const results = (page.organicResults as Record<string, unknown>[] | undefined) ?? [];
  return results
    .filter((r) => str(r.url))
    .map((r) => {
      const url = str(r.url);
      let host = "";
      try {
        host = new URL(url).hostname.replace(/^www\./, "");
      } catch {}
      return {
        id: mentionId(`${brandSlug(s.brand)}:${url}`),
        brand: brandSlug(s.brand),
        source: "google-search",
        sourceLabel: host ? `Google Suche · ${host}` : "Google Suche",
        kind: /kununu|trustpilot|glassdoor|provenexpert|google\.com\/maps/.test(host)
          ? ("review" as const)
          : /instagram|tiktok|facebook|linkedin|youtube|x\.com|twitter|reddit/.test(host)
            ? ("social" as const)
            : ("news" as const),
        title: str(r.title),
        content: str(r.description) || str(r.title),
        url,
        author: host || null,
        publishedAt: r.date && !Number.isNaN(Date.parse(str(r.date))) ? new Date(str(r.date)).toISOString() : new Date().toISOString(),
        isDemo: false,
      };
    });
}

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...(init?.headers ?? {}) },
    cache: "no-store",
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) throw new Error(`Apify ${res.status}: ${(await res.text()).slice(0, 200)}`);
  return res.json() as Promise<T>;
}

export async function startRun(source: ApifySource, s: Settings): Promise<{ runId: string; datasetId: string }> {
  const { data } = await api<{ data: { id: string; defaultDatasetId: string } }>(
    `/acts/${source.actor}/runs?timeout=240&maxTotalChargeUsd=${MAX_CHARGE_USD}`,
    { method: "POST", body: JSON.stringify(source.input(s)) },
  );
  return { runId: data.id, datasetId: data.defaultDatasetId };
}

export type RunState = "running" | "succeeded" | "failed";

export async function runState(runId: string): Promise<RunState> {
  const { data } = await api<{ data: { status: string } }>(`/actor-runs/${runId}`);
  if (data.status === "SUCCEEDED") return "succeeded";
  if (["FAILED", "ABORTED", "TIMED-OUT"].includes(data.status)) return "failed";
  return "running";
}

export async function fetchResults(source: ApifySource, datasetId: string, s: Settings): Promise<RawMention[]> {
  const items = await api<Record<string, unknown>[]>(`/datasets/${datasetId}/items?clean=true&limit=60`);
  const mapped = source.key === "googleSearch" ? items.flatMap((p) => mapGooglePage(p, s)) : items.map((it) => source.map(it, s));
  const seen = new Set<string>();
  return mapped.filter((m): m is RawMention => {
    if (!m || seen.has(m.id)) return false;
    seen.add(m.id);
    return true;
  });
}
