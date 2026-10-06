export const SENTIMENTS = ["positive", "neutral", "negative"] as const;
export type Sentiment = (typeof SENTIMENTS)[number];

export const TOPICS = [
  "product",
  "service",
  "employer",
  "pricing",
  "company",
  "marketing",
  "other",
] as const;
export type Topic = (typeof TOPICS)[number];

export const URGENCIES = ["none", "low", "medium", "high"] as const;
export type Urgency = (typeof URGENCIES)[number];

export const SOURCE_KINDS = ["news", "review", "social", "forum"] as const;
export type SourceKind = (typeof SOURCE_KINDS)[number];

export type MentionStatus = "open" | "done";

export interface Analysis {
  relevance: number; // 0–100
  relevanceReason: string;
  sentiment: Sentiment;
  sentimentScore: number; // -1 … 1
  topic: Topic;
  actionRequired: boolean;
  urgency: Urgency;
  actionReason: string | null;
  suggestedAction: string | null;
  suggestedReply: string | null;
  summary: string;
  analyzedBy: "claude" | "heuristic";
  analyzedAt: string;
}

export interface RawMention {
  id: string;
  brand: string;
  source: string; // e.g. "google-news"
  sourceLabel: string; // e.g. "Google News"
  kind: SourceKind;
  title: string;
  content: string;
  url: string;
  author: string | null;
  publishedAt: string; // ISO
  isDemo: boolean;
}

export interface Mention extends RawMention {
  fetchedAt: string;
  analysis: Analysis | null;
  status: MentionStatus;
}

export interface Settings {
  brand: string;
  keywords: string[];
  excludeKeywords: string[];
  context: string;
  sources: {
    googleNews: boolean;
    bingNews: boolean;
    hackerNews: boolean;
  };
  demoData: boolean;
}

export interface Summary {
  headline: string;
  summary: string;
  keyPoints: string[];
  recommendations: string[];
  generatedBy: "claude" | "heuristic";
  generatedAt: string;
  mentionCount: number;
}

export interface MentionFilters {
  q?: string;
  sentiments?: Sentiment[];
  topics?: Topic[];
  sources?: string[];
  minRelevance?: number;
  range?: "7d" | "30d" | "90d" | "all";
  actionOnly?: boolean;
  includeIrrelevant?: boolean;
}
