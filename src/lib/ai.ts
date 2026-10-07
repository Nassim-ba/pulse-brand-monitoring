import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";
import { heuristicAnalysis, heuristicSummary } from "./heuristic";
import { TOPIC_LABELS } from "./labels";
import { SENTIMENTS, TOPICS, URGENCIES, type Analysis, type CompetitorInsight, type Mention, type RawMention, type Settings, type Summary } from "./types";

const MODEL = process.env.ANTHROPIC_MODEL ?? "claude-haiku-4-5";
const BATCH_SIZE = 12;
const PARALLEL = 4;

export const aiEnabled = Boolean(process.env.ANTHROPIC_API_KEY);
const workspaceId = process.env.ANTHROPIC_WORKSPACE_ID;
const client = aiEnabled
  ? new Anthropic(workspaceId ? { defaultHeaders: { "anthropic-workspace-id": workspaceId } } : {})
  : null;

/** Last API error of this invocation, persisted by the service layer for diagnostics. */
export const aiStatus: { lastError: string | null; ok: boolean } = { lastError: null, ok: false };

function describeError(err: unknown): string {
  if (err instanceof Anthropic.APIError) return `${err.status ?? ""} ${err.message}`.trim().slice(0, 300);
  return err instanceof Error ? err.message.slice(0, 300) : String(err).slice(0, 300);
}

// ---------- Mention analysis ----------

const AnalysisItem = z.object({
  id: z.string(),
  title: z.string().describe("Der Titel der Eingabe, exakt übernommen. Dient zur Kontrolle der Zuordnung."),
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

Handlungsbedarf: Sei streng. Markiere nur Beiträge, bei denen das Team konkret etwas tun muss oder eine klare Chance verpasst, wenn es nichts tut. Das sind
- unbeantwortete Beschwerden und Kritik an Leistung, Service oder Abrechnung,
- direkte Fragen an die Marke (Bewerbung, Preise, Leistungen),
- Reputations- oder Rechtsrisiken (Falschinformationen, Gerüchte, Datenschutzvorwürfe),
- konkrete Geschäftschancen (Interessenten suchen einen Anbieter).
Kein Handlungsbedarf bei Lob, Erfahrungsberichten ohne Frage, Eigenbeiträgen von Mitarbeitenden, Branchenberichten und neutraler Berichterstattung, auch wenn eine Reaktion nett wäre. Irrelevante Beiträge haben nie Handlungsbedarf. In einem typischen Datensatz trifft Handlungsbedarf auf höchstens ein Drittel der Beiträge zu.
Reichweite: Wenn Aufrufe, Likes oder Follower angegeben sind, gewichte Kritik mit großer Reichweite dringlicher als Kritik mit kleiner Reichweite.
Dringlichkeit: high bei Reputationsrisiko, Falschinformation, Datenschutz- oder Rechtsthemen und Kritik mit Reichweite. medium bei Beschwerden und offenen Fragen an die Marke. low bei Geschäftschancen ohne Zeitdruck. none ohne Handlungsbedarf.

Antwortvorschläge: freundlich, professionell, lösungsorientiert, in der Sprache des Beitrags, keine leeren Floskeln, keine Gedankenstriche, keine Platzhalter wie [Name]. Unterschreibe nicht mit einem Namen. Bei Bewertungen und Social Media duzen oder siezen wie der Verfasser.

Alle Texte auf Deutsch. Gib für jede Eingabe genau ein Ergebnis zurück, in derselben Reihenfolge, mit derselben id und dem exakt übernommenen Titel. Bewerte jede Erwähnung nur anhand ihres eigenen Textes.`;
}

const formatMetrics = (x: NonNullable<RawMention["metrics"]>) =>
  [
    x.views != null ? `${x.views} Aufrufe` : null,
    x.likes != null ? `${x.likes} Likes` : null,
    x.comments != null ? `${x.comments} Kommentare` : null,
    x.shares != null ? `${x.shares} Shares` : null,
    x.followers != null ? `${x.followers} Follower des Autors` : null,
  ]
    .filter(Boolean)
    .join(", ");

function formatMention(m: RawMention, index: number): string {
  return [
    `<mention id="m${index + 1}">`,
    `Quelle: ${m.sourceLabel} (${m.kind})`,
    m.author ? `Autor: ${m.author}` : null,
    `Datum: ${m.publishedAt.slice(0, 10)}`,
    m.metrics ? `Reichweite: ${formatMetrics(m.metrics)}` : null,
    `Titel: ${m.title}`,
    `Text: ${m.content.slice(0, 1500)}`,
    `</mention>`,
  ]
    .filter(Boolean)
    .join("\n");
}

/** Removes dash-style asides and placeholder brackets the model sometimes produces. */
const clean = (t: string | null) =>
  t === null
    ? null
    : t
        .replace(/\s*[–—]\s*/g, ", ")
        .replace(/\s*\[[^\]]{1,30}\]/g, "")
        .replace(/,\s*,/g, ",")
        .trim();

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
  // Map results back by title first (robust against swapped ids), then by batch index.
  const norm = (t: string) => t.toLowerCase().replace(/\s+/g, " ").trim();
  const byTitle = new Map(batch.map((m) => [norm(m.title), m.id]));
  for (const r of response.parsed_output?.results ?? []) {
    const indexId = batch[Number(r.id.replace(/\D/g, "")) - 1]?.id;
    const id = byTitle.get(norm(r.title)) ?? indexId;
    if (!id || out.has(id)) continue;
    const relevance = Math.round(clamp(r.relevance, 0, 100));
    const actionRequired = r.action_required && relevance >= 40;
    out.set(id, {
      relevance,
      relevanceReason: clean(r.relevance_reason)!,
      sentiment: r.sentiment,
      sentimentScore: clamp(r.sentiment_score, -1, 1),
      topic: r.topic,
      actionRequired,
      urgency: actionRequired ? (r.urgency === "none" ? "low" : r.urgency) : "none",
      actionReason: actionRequired ? clean(r.action_reason) : null,
      suggestedAction: actionRequired ? clean(r.suggested_action) : null,
      suggestedReply: actionRequired ? clean(r.suggested_reply) : null,
      summary: clean(r.summary)!,
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
      headline: clean(p.headline)!,
      summary: clean(p.summary)!,
      keyPoints: p.key_points.map((x) => clean(x)!),
      recommendations: p.recommendations.map((x) => clean(x)!),
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

// ---------- Brand profile ----------

const ProfileSchema = z.object({
  is_brand: z
    .boolean()
    .describe("true nur, wenn die Eingabe eine Marke, ein Unternehmen, ein Produkt, eine Organisation oder ein Verein ist."),
  rejection_reason: z.string().nullable().describe("Kurze Begründung auf Deutsch, falls is_brand false ist, sonst null."),
  brand_name: z.string().describe("Offizielle Schreibweise der Marke, z. B. Porsche statt porsche."),
  domain: z.string().nullable().describe("Offizielle Website-Domain ohne https und Pfad, z. B. porsche.com. null, wenn unbekannt."),
  keywords: z
    .array(z.string())
    .describe("3 bis 7 spezifische Suchbegriffe: Markenname, gängige Kurzform, Domain, Produkt- oder Divisionsnamen. Keine allgemeinen Wörter oder Städtenamen allein."),
  exclude_keywords: z.array(z.string()).describe("0 bis 5 Begriffe, die auf Verwechslungen hinweisen."),
  hashtags: z.array(z.string()).describe("1 bis 3 Instagram-Hashtags ohne #, nur Buchstaben und Ziffern."),
  context: z.string().describe("2 bis 3 Sätze: Was macht die Marke, Branche, Sitz. Danach, welche gleichnamigen Dinge nicht gemeint sind."),
});

export type BrandProfile =
  | { isBrand: false; reason: string }
  | ({ isBrand: true } & Pick<Settings, "brand" | "domain" | "keywords" | "excludeKeywords" | "hashtags" | "context">);

/** Checks that the input is a brand and lets Claude draft its monitoring profile. */
export async function generateProfile(input: string): Promise<BrandProfile | null> {
  if (!client) return null;
  try {
    const response = await client.messages.parse({
      model: MODEL,
      max_tokens: 1500,
      system: `Du richtest Brand Monitoring ein. Prüfe zuerst, ob die Eingabe eine Marke ist.
Marken sind Unternehmen, Produkte, Organisationen, Vereine, Institutionen und Medien, auch kleine oder regionale.
Keine Marken sind Allgemeinbegriffe (Auto, Wetter, Liebe), Sätze und Fragen, Tastaturgetippe und Unsinn, Beleidigungen sowie Namen von Privatpersonen.
Bekannte Tippfehler einer Marke korrigierst du (Adiddas wird Adidas).
Ist es eine Marke, erstelle ein Suchprofil. Wenn du die Marke nicht sicher kennst, bleib allgemein und erfinde keine Fakten. Antworte auf Deutsch, ohne Gedankenstriche.`,
      messages: [{ role: "user", content: `Eingabe: ${input}` }],
      output_config: { format: zodOutputFormat(ProfileSchema) },
    });
    const p = response.parsed_output;
    if (!p) return null;
    aiStatus.ok = true;
    if (!p.is_brand) return { isBrand: false, reason: clean(p.rejection_reason) ?? "Keine erkennbare Marke." };
    const tidy = (list: string[], max: number) => [...new Set(list.map((x) => x.trim()).filter((x) => x.length >= 2 && x.length <= 60))].slice(0, max);
    const brand = p.brand_name.trim().slice(0, 60) || input;
    const domain = p.domain?.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/.*$/, "");
    return {
      isBrand: true,
      brand,
      domain: domain && /^[a-z0-9.-]+\.[a-z]{2,}$/.test(domain) ? domain : undefined,
      keywords: tidy([brand, ...p.keywords], 8),
      excludeKeywords: tidy(p.exclude_keywords, 5),
      hashtags: tidy(p.hashtags.map((h) => h.replace(/[^\p{L}\p{N}_]/gu, "")), 3),
      context: clean(p.context)!.slice(0, 1500),
    };
  } catch (err) {
    aiStatus.lastError = describeError(err);
    return null;
  }
}

// ---------- Ask Pulse ----------

const AnswerSchema = z.object({
  answer: z
    .string()
    .describe("Antwort auf Deutsch in 2 bis 6 Sätzen oder einer kurzen Liste mit Bindestrichen. Belege Aussagen mit Quellenverweisen wie [3]."),
  cited: z.array(z.number()).describe("Nummern der Erwähnungen, auf die sich die Antwort stützt, nach Wichtigkeit sortiert, höchstens 6."),
});

export interface AskTurn {
  role: "user" | "assistant";
  content: string;
}

/** Answers a question about the given mentions, citing them by number. */
export async function askAboutMentions(
  question: string,
  history: AskTurn[],
  mentions: Mention[],
  s: Settings,
): Promise<{ answer: string; cited: number[] } | null> {
  if (!client) return null;
  const lines = mentions
    .map((m, i) => {
      const a = m.analysis;
      return [
        `[${i + 1}] ${m.publishedAt.slice(0, 10)} | ${m.sourceLabel}${m.author ? ` | ${m.author}` : ""}`,
        a ? `${a.sentiment} | ${TOPIC_LABELS[a.topic]} | Relevanz ${a.relevance}${a.actionRequired ? ` | Handlungsbedarf ${a.urgency}${m.status === "done" ? " (erledigt)" : ""}` : ""}` : null,
        m.metrics ? `Reichweite: ${formatMetrics(m.metrics)}` : null,
        `Titel: ${m.title}`,
        `Text: ${m.content.slice(0, 500)}`,
      ]
        .filter(Boolean)
        .join("\n");
    })
    .join("\n\n");

  const response = await client.messages.parse({
    model: MODEL,
    max_tokens: 2000,
    system: [
      {
        type: "text",
        text: `Du bist Pulse, ein Analyst für Brand Monitoring. Du beantwortest Fragen des Kommunikationsteams zur Marke ${s.brand} ausschließlich auf Basis der unten aufgeführten Erwähnungen.
Kontext zur Marke: ${s.context}

Regeln:
- Stütze jede Aussage auf die Erwähnungen und verweise mit [Nummer] darauf.
- Wenn die Erwähnungen die Frage nicht beantworten, sag das ehrlich, statt zu raten.
- Nenne Zahlen, Plattformen und Reichweiten, wenn sie die Antwort stärken.
- Schreib knapp und konkret, ohne Gedankenstriche, ohne Überschriften.
- Fragen ohne Bezug zur Marke oder zum Monitoring lehnst du freundlich ab.

Erwähnungen:
${lines}`,
        cache_control: { type: "ephemeral" },
      },
    ],
    messages: [...history.slice(-6), { role: "user", content: question }],
    output_config: { format: zodOutputFormat(AnswerSchema) },
  });
  const p = response.parsed_output;
  if (!p) return null;
  aiStatus.ok = true;
  const valid = [...new Set(p.cited.filter((n) => Number.isInteger(n) && n >= 1 && n <= mentions.length))].slice(0, 6);
  return { answer: clean(p.answer)!, cited: valid };
}

// ---------- Competitors ----------

const SuggestionSchema = z.object({
  competitors: z.array(z.string()).describe("3 bis 5 direkte Wettbewerber, nur offizielle Markennamen."),
});

/** Lets Claude name direct competitors of a brand. */
export async function suggestCompetitorNames(s: Settings): Promise<string[]> {
  if (!client) return [];
  try {
    const response = await client.messages.parse({
      model: MODEL,
      max_tokens: 500,
      system:
        "Du nennst direkte Wettbewerber einer Marke für einen Brand-Monitoring-Vergleich: Unternehmen im selben Markt und in derselben Region, die Kunden als Alternative sehen. Nenne nur Marken, die du sicher kennst. Wenn du keine sicher kennst, gib eine leere Liste zurück.",
      messages: [{ role: "user", content: `Marke: ${s.brand}\nKontext: ${s.context}` }],
      output_config: { format: zodOutputFormat(SuggestionSchema) },
    });
    aiStatus.ok = true;
    return (response.parsed_output?.competitors ?? []).map((c) => c.trim()).filter((c) => c.length >= 2 && c.length <= 60).slice(0, 5);
  } catch (err) {
    aiStatus.lastError = describeError(err);
    return [];
  }
}

const InsightSchema = z.object({
  headline: z.string().describe("Kernaussage des Vergleichs in maximal 10 Wörtern."),
  summary: z.string().describe("3 bis 4 Sätze: Wie steht die eigene Marke im Vergleich da? Mit Zahlen."),
  strengths: z.array(z.string()).describe("2 bis 3 Stärken der eigenen Marke gegenüber den Wettbewerbern."),
  weaknesses: z.array(z.string()).describe("2 bis 3 Schwächen oder Lücken gegenüber den Wettbewerbern."),
  opportunities: z.array(z.string()).describe("2 bis 3 konkrete Chancen oder Maßnahmen für Marketing und Kommunikation."),
});

export async function compareBrands(
  own: string,
  rows: { name: string; stats: string; samples: string[] }[],
): Promise<Omit<CompetitorInsight, "generatedAt"> | null> {
  if (!client) return null;
  const body = rows.map((r) => `## ${r.name}\n${r.stats}\nBeispiele:\n${r.samples.map((x) => `- ${x}`).join("\n")}`).join("\n\n");
  const response = await client.messages.parse({
    model: MODEL,
    max_tokens: 2500,
    system: `Du bist Marketing-Analyst und vergleichst die Online-Wahrnehmung von ${own} mit Wettbewerbern auf Basis von Brand-Monitoring-Daten. Share of Voice ist der Anteil an allen relevanten Erwähnungen, Share of Reach der Anteil an der gesamten Reichweite. Bewerte aus Sicht von ${own}. Schreib konkret, mit Zahlen, auf Deutsch, ohne Gedankenstriche. Beachte, dass kleine Stichproben nur begrenzt aussagekräftig sind, und sag das, wenn es relevant ist.`,
    messages: [{ role: "user", content: body }],
    output_config: { format: zodOutputFormat(InsightSchema) },
  });
  const p = response.parsed_output;
  if (!p) return null;
  aiStatus.ok = true;
  return {
    headline: clean(p.headline)!,
    summary: clean(p.summary)!,
    strengths: p.strengths.map((x) => clean(x)!),
    weaknesses: p.weaknesses.map((x) => clean(x)!),
    opportunities: p.opportunities.map((x) => clean(x)!),
  };
}
