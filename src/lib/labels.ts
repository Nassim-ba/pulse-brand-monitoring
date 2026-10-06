import type { Sentiment, SourceKind, Topic, Urgency } from "./types";

export const TOPIC_LABELS: Record<Topic, string> = {
  product: "Leistung & Produkt",
  service: "Kundenservice",
  employer: "Arbeitgeber & Karriere",
  pricing: "Preis & Vertrag",
  company: "Unternehmensnews",
  marketing: "Marketing & Kampagnen",
  other: "Sonstiges",
};

export const SENTIMENT_LABELS: Record<Sentiment, string> = {
  positive: "Positiv",
  neutral: "Neutral",
  negative: "Negativ",
};

export const URGENCY_LABELS: Record<Urgency, string> = {
  none: "Kein Bedarf",
  low: "Niedrig",
  medium: "Mittel",
  high: "Hoch",
};

export const KIND_LABELS: Record<SourceKind, string> = {
  news: "News",
  review: "Bewertung",
  social: "Social Media",
  forum: "Forum",
};

/** Minimum relevance for a mention to count as "relevant". */
export const RELEVANCE_THRESHOLD = 40;
