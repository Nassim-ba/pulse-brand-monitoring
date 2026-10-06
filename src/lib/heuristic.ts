import type { Analysis, Mention, RawMention, Settings, Summary, Topic } from "./types";
import { SENTIMENT_LABELS, TOPIC_LABELS, RELEVANCE_THRESHOLD } from "./labels";

/**
 * Rule-based fallback, used when no Anthropic API key is configured or the
 * API is unreachable. Keeps the product usable; results are labelled as such.
 */

const POSITIVE = [
  "super", "toll", "top", "klasse", "empfehle", "empfehlung", "zufrieden", "begeistert", "danke", "großartig",
  "professionell", "kompetent", "schnell", "erfolg", "gewinnt", "ausgezeichnet", "beste", "stark", "gelungen",
  "great", "excellent", "love", "recommend", "amazing", "awesome", "happy",
];
const NEGATIVE = [
  "schlecht", "enttäuscht", "enttäuschend", "katastrophe", "nie wieder", "abzocke", "unseriös", "unverschämt",
  "warte", "keine antwort", "beschwerde", "kündigung", "kündigen", "mangelhaft", "ärgerlich", "frech", "betrug",
  "insolvent", "insolvenz", "problem", "fehler", "chaos", "überfordert", "ignoriert", "warnung", "finger weg",
  "bad", "terrible", "scam", "worst", "awful", "disappointed",
];

const TOPIC_WORDS: Record<Exclude<Topic, "other">, string[]> = {
  employer: ["arbeitgeber", "bewerbung", "kollegen", "gehalt", "team", "ausbildung", "praktikum", "job", "stelle", "kununu", "chef", "mitarbeiter"],
  service: ["support", "service", "antwort", "erreichbar", "ansprechpartner", "hotline", "rückmeldung", "betreuung"],
  pricing: ["preis", "kosten", "rechnung", "vertrag", "kündigung", "teuer", "budget", "angebot"],
  product: ["kampagne", "leads", "projekt", "ergebnis", "strategie", "website", "leistung", "qualität"],
  company: ["übernahme", "standort", "umsatz", "geschäftsführ", "expansion", "eröffnet", "insolvenz", "pressemitteilung"],
  marketing: ["webinar", "event", "messe", "podcast", "linkedin", "video", "vlog", "newsletter"],
};

const count = (text: string, words: string[]) => words.reduce((n, w) => n + (text.includes(w) ? 1 : 0), 0);

export function heuristicAnalysis(m: RawMention, s: Settings): Analysis {
  const text = `${m.title} ${m.content}`.toLowerCase();
  const brandHits = count(text, [s.brand.toLowerCase(), ...s.keywords.map((k) => k.toLowerCase())]);
  const excluded = s.excludeKeywords.some((k) => text.includes(k.toLowerCase()));
  // Short brand token ("ATZ") as a whole word counts as a weaker signal.
  const token = s.brand.split(/\s+/)[0].toLowerCase();
  const tokenHit = token.length >= 2 && new RegExp(`(^|[^a-z0-9äöü])${token}([^a-z0-9äöü]|$)`).test(text);
  const relevance = excluded ? 10 : Math.min(95, brandHits > 0 ? 55 + brandHits * 10 : tokenHit ? 50 : 25);

  const pos = count(text, POSITIVE);
  const neg = count(text, NEGATIVE);
  const score = Math.max(-1, Math.min(1, (pos - neg) / 3));
  const sentiment = score > 0.15 ? "positive" : score < -0.15 ? "negative" : "neutral";

  let topic: Topic = "other";
  let best = 0;
  for (const [t, words] of Object.entries(TOPIC_WORDS) as [Topic, string[]][]) {
    const c = count(text, words);
    if (c > best) [topic, best] = [t, c];
  }

  const isQuestion = /\?/.test(m.content) && relevance >= RELEVANCE_THRESHOLD;
  const actionRequired = relevance >= RELEVANCE_THRESHOLD && (sentiment === "negative" || isQuestion);
  const urgency = !actionRequired ? "none" : neg >= 2 ? "high" : sentiment === "negative" ? "medium" : "low";

  return {
    relevance,
    relevanceReason: excluded
      ? "Enthält einen Ausschlussbegriff."
      : brandHits > 0
        ? "Marke wird namentlich erwähnt."
        : "Kein eindeutiger Markenbezug gefunden.",
    sentiment,
    sentimentScore: Math.round(score * 100) / 100,
    topic,
    actionRequired,
    urgency,
    actionReason: actionRequired
      ? sentiment === "negative"
        ? "Negative Erwähnung mit Markenbezug."
        : "Offene Frage an die Marke."
      : null,
    suggestedAction: actionRequired ? "Beitrag prüfen und zeitnah reagieren." : null,
    suggestedReply: null,
    summary: m.title.slice(0, 140),
    analyzedBy: "heuristic",
    analyzedAt: new Date().toISOString(),
  };
}

export function heuristicSummary(mentions: Mention[], brand: string): Summary {
  const analyzed = mentions.filter((m) => m.analysis);
  const n = analyzed.length;
  const by = (k: "positive" | "neutral" | "negative") => analyzed.filter((m) => m.analysis!.sentiment === k).length;
  const pct = (x: number) => (n ? Math.round((x / n) * 100) : 0);
  const topicCounts = new Map<Topic, number>();
  analyzed.forEach((m) => topicCounts.set(m.analysis!.topic, (topicCounts.get(m.analysis!.topic) ?? 0) + 1));
  const topTopics = [...topicCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3);
  const open = analyzed.filter((m) => m.analysis!.actionRequired && m.status === "open").length;
  const dominant = (["positive", "neutral", "negative"] as const).reduce((a, b) => (by(a) >= by(b) ? a : b));

  return {
    headline: n ? `Stimmung überwiegend ${SENTIMENT_LABELS[dominant].toLowerCase()}` : "Keine Erwähnungen im Zeitraum",
    summary: n
      ? `Im gewählten Zeitraum wurden ${n} relevante Erwähnungen zu ${brand} erfasst. ${pct(by("positive"))} % sind positiv, ${pct(by("neutral"))} % neutral und ${pct(by("negative"))} % negativ. ${open} Beiträge haben offenen Handlungsbedarf.`
      : "Für die aktuelle Auswahl liegen keine Erwähnungen vor.",
    keyPoints: topTopics.map(([t, c]) => `${TOPIC_LABELS[t]} ist mit ${c} Erwähnungen ein Schwerpunkt.`),
    recommendations: open ? [`${open} offene Beiträge mit Handlungsbedarf priorisiert abarbeiten.`] : [],
    generatedBy: "heuristic",
    generatedAt: new Date().toISOString(),
    mentionCount: n,
  };
}
