"use client";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Tooltip from "@mui/material/Tooltip";
import SentimentSatisfiedAlt from "@mui/icons-material/SentimentSatisfiedAlt";
import SentimentNeutral from "@mui/icons-material/SentimentNeutral";
import SentimentDissatisfied from "@mui/icons-material/SentimentDissatisfied";
import Newspaper from "@mui/icons-material/NewspaperOutlined";
import StarOutline from "@mui/icons-material/StarBorder";
import Groups from "@mui/icons-material/GroupsOutlined";
import QuestionAnswer from "@mui/icons-material/QuestionAnswerOutlined";
import AutoAwesome from "@mui/icons-material/AutoAwesome";
import Rule from "@mui/icons-material/Rule";
import { KIND_LABELS, SENTIMENT_LABELS, TOPIC_LABELS, URGENCY_LABELS } from "@/lib/labels";
import type { Analysis, Sentiment, SourceKind, Topic, Urgency } from "@/lib/types";

export const SENTIMENT_COLORS: Record<Sentiment, { bg: string; fg: string; solid: string }> = {
  positive: { bg: "var(--md-success-container)", fg: "var(--md-on-success-container)", solid: "var(--md-success)" },
  neutral: { bg: "var(--md-surface-container-highest)", fg: "var(--md-on-surface-variant)", solid: "var(--md-outline)" },
  negative: { bg: "var(--md-error-container)", fg: "var(--md-on-error-container)", solid: "var(--md-error)" },
};

const SENTIMENT_ICONS = { positive: SentimentSatisfiedAlt, neutral: SentimentNeutral, negative: SentimentDissatisfied };

/** Small, non-interactive M3 "assist chip"-style label. */
export function Tag({
  children,
  bg = "transparent",
  fg = "var(--md-on-surface-variant)",
  outlined = false,
  icon,
}: {
  children: React.ReactNode;
  bg?: string;
  fg?: string;
  outlined?: boolean;
  icon?: React.ReactNode;
}) {
  return (
    <Box
      component="span"
      sx={{
        display: "inline-flex",
        alignItems: "center",
        gap: 0.5,
        height: 24,
        px: 1,
        borderRadius: 2,
        bgcolor: bg,
        color: fg,
        border: outlined ? "1px solid var(--md-outline-variant)" : "none",
        fontSize: 12,
        fontWeight: 500,
        letterSpacing: 0.3,
        whiteSpace: "nowrap",
        "& svg": { fontSize: 16 },
      }}
    >
      {icon}
      {children}
    </Box>
  );
}

export function SentimentTag({ sentiment }: { sentiment: Sentiment }) {
  const c = SENTIMENT_COLORS[sentiment];
  const Icon = SENTIMENT_ICONS[sentiment];
  return (
    <Tag bg={c.bg} fg={c.fg} icon={<Icon />}>
      {SENTIMENT_LABELS[sentiment]}
    </Tag>
  );
}

export function TopicTag({ topic }: { topic: Topic }) {
  return <Tag outlined>{TOPIC_LABELS[topic]}</Tag>;
}

const URGENCY_COLORS: Record<Urgency, { bg: string; fg: string }> = {
  high: { bg: "var(--md-error)", fg: "var(--md-surface)" },
  medium: { bg: "var(--md-warning-container)", fg: "var(--md-on-warning-container)" },
  low: { bg: "var(--md-primary-container)", fg: "var(--md-on-primary-container)" },
  none: { bg: "transparent", fg: "var(--md-on-surface-variant)" },
};

export function UrgencyTag({ urgency }: { urgency: Urgency }) {
  const c = URGENCY_COLORS[urgency];
  return (
    <Tag bg={c.bg} fg={c.fg}>
      Dringlichkeit {URGENCY_LABELS[urgency].toLowerCase()}
    </Tag>
  );
}

export function RelevanceMeter({ value, compact = false }: { value: number; compact?: boolean }) {
  const color = value >= 70 ? "var(--md-primary)" : value >= 40 ? "var(--md-secondary)" : "var(--md-outline)";
  return (
    <Tooltip title={`Relevanz ${value} von 100`}>
      <Box sx={{ display: "inline-flex", alignItems: "center", gap: 0.75 }} aria-label={`Relevanz ${value} von 100`}>
        <Box sx={{ width: compact ? 36 : 56, height: 4, borderRadius: 2, bgcolor: "var(--md-surface-container-highest)", overflow: "hidden" }}>
          <Box sx={{ width: `${value}%`, height: "100%", bgcolor: color, borderRadius: 2 }} />
        </Box>
        <Typography variant="caption" sx={{ color: "var(--md-on-surface-variant)", fontVariantNumeric: "tabular-nums" }}>
          {value}
        </Typography>
      </Box>
    </Tooltip>
  );
}

const KIND_ICONS: Record<SourceKind, typeof Newspaper> = {
  news: Newspaper,
  review: StarOutline,
  social: Groups,
  forum: QuestionAnswer,
};

export function SourceAvatar({ kind, size = 40 }: { kind: SourceKind; size?: number }) {
  const Icon = KIND_ICONS[kind];
  return (
    <Tooltip title={KIND_LABELS[kind]}>
      <Box
        sx={{
          width: size,
          height: size,
          borderRadius: "50%",
          flexShrink: 0,
          display: "grid",
          placeItems: "center",
          bgcolor: "var(--md-secondary-container)",
          color: "var(--md-on-secondary-container)",
        }}
      >
        <Icon sx={{ fontSize: size * 0.5 }} />
      </Box>
    </Tooltip>
  );
}

export function AnalyzedBy({ analysis }: { analysis: Pick<Analysis, "analyzedBy"> }) {
  return analysis.analyzedBy === "claude" ? (
    <Tag bg="var(--md-tertiary-container)" fg="var(--md-on-tertiary-container)" icon={<AutoAwesome />}>
      KI-Analyse
    </Tag>
  ) : (
    <Tag outlined icon={<Rule />}>
      Regelbasiert
    </Tag>
  );
}

const rtf = new Intl.RelativeTimeFormat("de", { numeric: "auto" });

export function relativeTime(iso: string): string {
  const diff = (new Date(iso).getTime() - Date.now()) / 1000;
  const abs = Math.abs(diff);
  if (abs < 3600) return rtf.format(Math.round(diff / 60), "minute");
  if (abs < 86400) return rtf.format(Math.round(diff / 3600), "hour");
  if (abs < 86400 * 30) return rtf.format(Math.round(diff / 86400), "day");
  return new Date(iso).toLocaleDateString("de-DE", { day: "2-digit", month: "short", year: "numeric" });
}

export function SectionTitle({ children, action }: { children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 1, mb: 1.5, minHeight: 40 }}>
      <Typography variant="subtitle1" component="h2" sx={{ fontSize: 16 }}>
        {children}
      </Typography>
      {action}
    </Box>
  );
}
