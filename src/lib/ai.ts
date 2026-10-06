import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";
import { heuristicAnalysis, heuristicSummary } from "./heuristic";
import { TOPIC_LABELS } from "./labels";
import { SENTIMENTS, TOPICS, URGENCIES, type Analysis, type Mention, type RawMention, type Settings, type Summary } from "./types";

const MODEL = process.env.ANTHROPIC_MODEL ?? "claude-haiku-4-5";
const BATCH_SIZE = 12;
const PARALLEL = 4;

export const aiEnabled = Boolean(process.env.ANTHROPIC_API_KEY);
const client = aiEnabled ? new Anthropic() : null;

/** Last API error of this invocation, persisted by the service layer for diagnostics. */
export const aiStatus: { lastError: string | null; ok: boolean } = { lastError: null, ok: false };

function describeError(err: unknown): string {
  if (err instanceof Anthropic.APIError) return `${err.status ?? ""} ${err.message}`.trim().slice(0, 300);
  return err instanceof Error ? err.message.slice(0, 300) : String(err).slice(0, 300);
}

// ---------- Mention analysis ----------

const AnalysisItem = z.object({
  id: z.string(),
  relevance: z.number().describe("0 bis 100. Wie sicher ist die Erwähnung wirklich die überwachte Marke?"),
  relevance_reason: z.string().describe("Ein kurzer Satz, warum die Relevanz so bewertet wurde."),
  sentiment: z.enum(SENTIMENTS),
  sentiment_score: z.number().describe("-1 (sehr negativ) bis 1 (sehr positiv)"),
  topic: z.enum(TOPICS),
  action_required: z.boolean(),
  urgency: z.enum(URGENCIES),
  action_reason: z.string().nullable().describe("Warum Handlungsbedarf besteht, sonst null."),
  suggested_action: z.string().nullable().describe("Konkrete nächste Maßnahme für das Team, sonst null."),
  suggested_reply: z
    .string()
    .nullable()
    .describe("Öffentliche Antwort im Namen der Marke, nur wenn eine Antwort sinnvoll ist, sonst null."),
  summary: z.string().describe("Kernaussage des Beitrags in einem Satz, maximal 140 Zeichen."),
});

const AnalysisBatch = z.object({ results: z.array(AnalysisItem) });

function analysisSystemPrompt(s: Settings): string {
  const topics = TOPICS.map((t) => `- ${t}: ${TOPIC_LABELS[t]}`).join("\n");
  return `Du bist Analyst für Brand Monitoring und bewertest Online-Erwähnungen für das Kommunikationsteam einer Marke.

Überwachte Marke: ${s.brand}
Suchbegriffe: ${s.keywords.join(", ")}
Kontext zur Marke: ${s.context}

Bewerte jede Erwähnung einzeln:

Relevanz: Geht es tatsächlich um diese Marke? Namensgleichheiten (andere Firmen, Abkürzungen mit anderer Bedeutung) bekommen unter 20. Beiläufige Nennungen 40 bis 60. Beiträge, die sich klar um die Marke drehen, 70 bis 100.

Stimmung: Die Haltung gegenüber der Marke, nicht die allgemeine Tonlage des Textes. Ironie und Sarkasmus beachten.

Thema, genau eines aus:
${topics}

Handlungsbedarf besteht, wenn das Team reagieren sollte: unbeantwortete Beschwerden, Kritik mit Reichweite, direkte Fragen an die Marke, rechtliche oder Reputationsrisiken, Falschinformationen, aber auch Chancen wie Anfragen von Interessenten oder Lob, auf das man öffentlich eingehen sollte. Irrelevante Beiträge haben nie Handlungsbedarf.
Dringlichkeit: high bei Reputationsrisiko oder viraler Kritik, medium bei Beschwerden und offenen Fragen, low bei Chancen ohne Zeitdruck, none ohne Handlungsbedarf.

Antwortvorschläge: freundlich, professionell, lösungsorientiert, in der Sprache des Beitrags, keine leeren Floskeln, keine Gedankenstriche. Bei Bewertungen und Social Media duzen oder siezen wie der Verfasser.

Alle Texte auf Deutsch. Gib für jede Eingabe genau ein Ergebnis mit derselben id zurück.`;
}

function formatMention(m: RawMention): string {
  return [
    `<mention id="${m.id}">`,
    `Quelle: ${m.sourceLabel} (${m.kind})`,
    m.author ? `Autor: ${m.author}` : null,
    `Datum: ${m.publishedAt.slice(0, 10)}`,
    `Titel: ${m.title}`,
    `Text: ${m.content.slice(0, 1500)}`,
    `</mention>`,
  ]
    .filter(Boolean)
    .join("\n");
}

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

async function analyzeBatch(batch: RawMention[], s: Settings): Promise<Map<string, Analysis>> {
  const out = new Map<string, Analysis>();
  const response = await client!.messages.parse({
    model: MODEL,
    max_tokens: 12000,
    system: analysisSystemPrompt(s),
    messages: [{ role: "user", content: batch.map(formatMention).join("\n\n") }],
    output_config: { format: zodOutputFormat(AnalysisBatch) },
  });
  const now = new Date().toISOString();
  for (const r of response.parsed_output?.results ?? []) {
    const relevance = Math.round(clamp(r.relevance, 0, 100));
    const actionRequired = r.action_required && relevance >= 40;
    out.set(r.id, {
      relevance,
      relevanceReason: r.relevance_reason,
      sentiment: r.sentiment,
      sentimentScore: clamp(r.sentiment_score, -1, 1),
      topic: r.topic,
      actionRequired,
      urgency: actionRequired ? (r.urgency === "none" ? "low" : r.urgency) : "none",
      actionReason: actionRequired ? r.action_reason : null,
      suggestedAction: actionRequired ? r.suggested_action : null,
      suggestedReply: actionRequired ? r.suggested_reply : null,
      summary: r.summary,
      analyzedBy: "claude",
      analyzedAt: now,
    });
  }
  return out;
}

/** Analyses mentions with Claude; falls back to rules per batch on any failure. */
export async function analyzeMentions(items: RawMention[], s: Settings): Promise<Map<string, Analysis>> {
  const result = new Map<string, Analysis>();
  const batches: RawMention[][] = [];
  for (let i = 0; i < items.length; i += BATCH_SIZE) batches.push(items.slice(i, i + BATCH_SIZE));

  for (let i = 0; i < batches.length; i += PARALLEL) {
    await Promise.all(
      batches.slice(i, i + PARALLEL).map(async (batch) => {
        let analyzed = new Map<string, Analysis>();
        if (client) {
          try {
            analyzed = await analyzeBatch(batch, s);
            aiStatus.ok = true;
          } catch (err) {
            aiStatus.lastError = describeError(err);
            console.error("Claude analysis failed, using heuristic fallback:", err);
          }
        }
        for (const m of batch) result.set(m.id, analyzed.get(m.id) ?? heuristicAnalysis(m, s));
      }),
    );
  }
  return result;
}

// ---------- Summary ----------

const SummarySchema = z.object({
  headline: z.string().describe("Lage in maximal 8 Wörtern."),
  summary: z.string().describe("3 bis 4 Sätze Lagebericht für die Geschäftsführung."),
  key_points: z.array(z.string()).describe("3 bis 5 zentrale Beobachtungen, je ein Satz."),
  recommendations: z.array(z.string()).describe("1 bis 3 konkrete Handlungsempfehlungen."),
});

export async function summarize(mentions: Mention[], s: Settings, scopeLabel: string): Promise<Summary> {
  const analyzed = mentions.filter((m) => m.analysis);
  if (!client || analyzed.length === 0) return heuristicSummary(analyzed, s.brand);

  const lines = analyzed
    .slice(0, 80)
    .map((m) => {
      const a = m.analysis!;
      return `- [${m.publishedAt.slice(0, 10)} | ${m.sourceLabel} | ${a.sentiment} | ${TOPIC_LABELS[a.topic]}${a.actionRequired ? ` | Handlungsbedarf ${a.urgency}${m.status === "done" ? " (erledigt)" : ""}` : ""}] ${a.summary}`;
    })
    .join("\n");

  try {
    const response = await client.messages.parse({
      model: MODEL,
      max_tokens: 4000,
      system: `Du schreibst prägnante Lageberichte zum Brand Monitoring für ${s.brand}. Kontext: ${s.context}
Schreibe sachlich, konkret und auf Deutsch. Nenne Zahlen und Muster, keine Allgemeinplätze. Keine Gedankenstriche.`,
      messages: [
        {
          role: "user",
          content: `Zeitraum/Filter: ${scopeLabel}\nAnzahl Erwähnungen: ${analyzed.length}\n\nAnalysierte Erwähnungen:\n${lines}`,
        },
      ],
      output_config: { format: zodOutputFormat(SummarySchema) },
    });
    const p = response.parsed_output;
    aiStatus.ok = Boolean(p);
    if (!p) throw new Error(`No parsed output (stop_reason: ${response.stop_reason})`);
    return {
      headline: p.headline,
      summary: p.summary,
      keyPoints: p.key_points,
      recommendations: p.recommendations,
      generatedBy: "claude",
      generatedAt: new Date().toISOString(),
      mentionCount: analyzed.length,
    };
  } catch (err) {
    aiStatus.lastError = describeError(err);
    console.error("Claude summary failed, using heuristic fallback:", err);
    return heuristicSummary(analyzed, s.brand);
  }
}
