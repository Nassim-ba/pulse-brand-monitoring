import { RELEVANCE_THRESHOLD } from "./labels";
import type { Mention, MentionFilters, Urgency } from "./types";

const RANGE_DAYS: Record<string, number> = { "7d": 7, "30d": 30, "90d": 90 };

export function applyFilters(mentions: Mention[], f: MentionFilters): Mention[] {
  const q = f.q?.trim().toLowerCase();
  const days = f.range ? RANGE_DAYS[f.range] : undefined;
  const since = days ? Date.now() - days * 86_400_000 : undefined;
  const minRelevance = f.includeIrrelevant ? 0 : Math.max(f.minRelevance ?? 0, RELEVANCE_THRESHOLD);

  return mentions.filter((m) => {
    const a = m.analysis;
    if (a && a.relevance < minRelevance) return false;
    if (since && new Date(m.publishedAt).getTime() < since) return false;
    if (f.sentiments?.length && (!a || !f.sentiments.includes(a.sentiment))) return false;
    if (f.topics?.length && (!a || !f.topics.includes(a.topic))) return false;
    if (f.sources?.length && !f.sources.includes(m.source)) return false;
    if (f.actionOnly && !(a?.actionRequired && m.status === "open")) return false;
    if (q) {
      const hay = `${m.title} ${m.content} ${m.author ?? ""} ${a?.summary ?? ""}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });
}

const URGENCY_RANK: Record<Urgency, number> = { high: 3, medium: 2, low: 1, none: 0 };

export function byUrgency(a: Mention, b: Mention): number {
  const ua = URGENCY_RANK[a.analysis?.urgency ?? "none"];
  const ub = URGENCY_RANK[b.analysis?.urgency ?? "none"];
  if (ua !== ub) return ub - ua;
  return new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime();
}

export function byDate(a: Mention, b: Mention): number {
  return new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime();
}

export function byRelevance(a: Mention, b: Mention): number {
  return (b.analysis?.relevance ?? 0) - (a.analysis?.relevance ?? 0) || byDate(a, b);
}

export function brandSlug(brand: string): string {
  return (
    brand
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "") || "brand"
  );
}
