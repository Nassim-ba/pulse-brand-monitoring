import "server-only";
import { createHash } from "node:crypto";
import { XMLParser } from "fast-xml-parser";
import { brandSlug } from "./filters";
import type { RawMention, Settings } from "./types";

/**
 * Live sources that work without API keys. In production these would be
 * replaced or complemented by licensed APIs (social listening, review portals).
 */

const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: "@_" });
const TIMEOUT_MS = 8000;

export const mentionId = (url: string) => createHash("sha1").update(url).digest("hex").slice(0, 16);

const stripHtml = (s: string) =>
  s
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();

async function fetchText(url: string): Promise<string> {
  const res = await fetch(url, {
    headers: { "User-Agent": "Mozilla/5.0 (compatible; PulseBrandMonitor/1.0)" },
    signal: AbortSignal.timeout(TIMEOUT_MS),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`${url} → HTTP ${res.status}`);
  return res.text();
}

function buildQuery(s: Settings): string {
  const terms = (s.keywords.length ? s.keywords : [s.brand]).map((k) => `"${k}"`).join(" OR ");
  const excludes = s.excludeKeywords.map((k) => `-"${k}"`).join(" ");
  return `${terms} ${excludes}`.trim();
}

type RssItem = { title?: string; link?: string; description?: string; pubDate?: string; source?: string | { "#text"?: string } };

function rssItems(xml: string): RssItem[] {
  const doc = parser.parse(xml);
  const items = doc?.rss?.channel?.item ?? [];
  return Array.isArray(items) ? items : [items];
}

async function googleNews(s: Settings): Promise<RawMention[]> {
  const q = encodeURIComponent(buildQuery(s));
  const xml = await fetchText(`https://news.google.com/rss/search?q=${q}&hl=de&gl=DE&ceid=DE:de`);
  return rssItems(xml).map((it) => {
    const publisher = typeof it.source === "string" ? it.source : it.source?.["#text"];
    const title = stripHtml(String(it.title ?? ""));
    return {
      id: mentionId(`${brandSlug(s.brand)}:${String(it.link)}`),
      brand: brandSlug(s.brand),
      source: "google-news",
      sourceLabel: publisher ? `Google News · ${publisher}` : "Google News",
      kind: "news" as const,
      title,
      content: stripHtml(String(it.description ?? "")) || title,
      url: String(it.link),
      author: publisher ?? null,
      publishedAt: new Date(it.pubDate ?? Date.now()).toISOString(),
      isDemo: false,
    };
  });
}

async function bingNews(s: Settings): Promise<RawMention[]> {
  const q = encodeURIComponent(buildQuery(s));
  const xml = await fetchText(`https://www.bing.com/news/search?q=${q}&format=rss&setlang=de`);
  return rssItems(xml)
    .filter((it) => it.link && it.title)
    .map((it) => {
      // Bing wraps links in a redirect; the real URL sits in the "url" param.
      let url = String(it.link);
      try {
        const real = new URL(url).searchParams.get("url");
        if (real) url = real;
      } catch {}
      const title = stripHtml(String(it.title));
      return {
        id: mentionId(`${brandSlug(s.brand)}:${url}`),
        brand: brandSlug(s.brand),
        source: "bing-news",
        sourceLabel: "Bing News",
        kind: "news" as const,
        title,
        content: stripHtml(String(it.description ?? "")) || title,
        url,
        author: null,
        publishedAt: new Date(it.pubDate ?? Date.now()).toISOString(),
        isDemo: false,
      };
    });
}

async function hackerNews(s: Settings): Promise<RawMention[]> {
  const q = encodeURIComponent(`"${s.brand}"`);
  const res = await fetch(`https://hn.algolia.com/api/v1/search_by_date?query=${q}&tags=(story,comment)&hitsPerPage=20&advancedSyntax=true`, {
    signal: AbortSignal.timeout(TIMEOUT_MS),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Hacker News → HTTP ${res.status}`);
  const data = (await res.json()) as {
    hits: { objectID: string; title?: string; story_title?: string; comment_text?: string; story_text?: string; url?: string; author: string; created_at: string }[];
  };
  return data.hits.map((h) => {
    const url = `https://news.ycombinator.com/item?id=${h.objectID}`;
    const title = h.title ?? h.story_title ?? "Kommentar auf Hacker News";
    return {
      id: mentionId(`${brandSlug(s.brand)}:${url}`),
      brand: brandSlug(s.brand),
      source: "hacker-news",
      sourceLabel: "Hacker News",
      kind: "forum" as const,
      title: stripHtml(title),
      content: stripHtml(h.comment_text ?? h.story_text ?? title).slice(0, 1200),
      url,
      author: h.author,
      publishedAt: new Date(h.created_at).toISOString(),
      isDemo: false,
    };
  });
}

export interface FetchResult {
  mentions: RawMention[];
  errors: string[];
}

export async function fetchLiveMentions(s: Settings): Promise<FetchResult> {
  const jobs: [string, () => Promise<RawMention[]>][] = [];
  if (s.sources.googleNews) jobs.push(["Google News", () => googleNews(s)]);
  if (s.sources.bingNews) jobs.push(["Bing News", () => bingNews(s)]);
  if (s.sources.hackerNews) jobs.push(["Hacker News", () => hackerNews(s)]);

  const results = await Promise.allSettled(jobs.map(([, fn]) => fn()));
  const errors: string[] = [];
  const seen = new Set<string>();
  const mentions: RawMention[] = [];
  const excludes = s.excludeKeywords.map((k) => k.toLowerCase());
  const terms = [s.brand, ...s.keywords].map((k) => k.toLowerCase());

  results.forEach((r, i) => {
    if (r.status === "rejected") {
      errors.push(`${jobs[i][0]} nicht erreichbar`);
      return;
    }
    for (const m of r.value) {
      const text = `${m.title} ${m.content}`.toLowerCase();
      if (excludes.some((e) => text.includes(e))) continue;
      // Hacker News matches loosely; keep only items that contain a search term.
      if (m.source === "hacker-news" && !terms.some((t) => text.includes(t))) continue;
      // Deduplicate by id and by near-identical title across news sources.
      const titleKey = m.title.toLowerCase().replace(/\s+-\s+[^-]+$/, "").slice(0, 80);
      if (seen.has(m.id) || seen.has(titleKey)) continue;
      seen.add(m.id);
      seen.add(titleKey);
      mentions.push(m);
    }
  });

  return { mentions: mentions.slice(0, 40), errors };
}
