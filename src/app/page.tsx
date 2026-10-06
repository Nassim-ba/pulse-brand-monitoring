"use client";
import { useMemo, useState } from "react";
import Link from "next/link";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import Skeleton from "@mui/material/Skeleton";
import { BarChart } from "@mui/x-charts/BarChart";
import { PieChart } from "@mui/x-charts/PieChart";
import ArrowForward from "@mui/icons-material/ArrowForward";
import TrendingUp from "@mui/icons-material/TrendingUp";
import TrendingDown from "@mui/icons-material/TrendingDown";
import { useData } from "@/components/DataProvider";
import { SummaryCard } from "@/components/SummaryCard";
import { MentionCard } from "@/components/MentionCard";
import { SegmentedButton } from "@/components/SegmentedButton";
import { SectionTitle, SENTIMENT_COLORS } from "@/components/bits";
import { applyFilters, byUrgency } from "@/lib/filters";
import { KIND_LABELS, RELEVANCE_THRESHOLD, SENTIMENT_LABELS, TOPIC_LABELS } from "@/lib/labels";
import { SENTIMENTS, SOURCE_KINDS, TOPICS, type Mention, type MentionFilters } from "@/lib/types";

type Range = "7d" | "30d" | "90d";
const RANGES: { value: Range; label: string; days: number }[] = [
  { value: "7d", label: "7 Tage", days: 7 },
  { value: "30d", label: "30 Tage", days: 30 },
  { value: "90d", label: "90 Tage", days: 90 },
];

function Kpi({
  label,
  value,
  hint,
  trend,
  tone = "default",
}: {
  label: string;
  value: string | number;
  hint?: string;
  trend?: number | null;
  tone?: "default" | "error";
}) {
  return (
    <Box
      sx={{
        p: 2.5,
        borderRadius: 4,
        bgcolor: tone === "error" ? "var(--md-error-container)" : "var(--md-surface-container)",
        color: tone === "error" ? "var(--md-on-error-container)" : "var(--md-on-surface)",
        minWidth: 0,
      }}
    >
      <Typography variant="body2" sx={{ opacity: 0.85 }}>
        {label}
      </Typography>
      <Box sx={{ display: "flex", alignItems: "baseline", gap: 1, mt: 0.5 }}>
        <Typography sx={{ fontSize: { xs: 32, md: 40 }, lineHeight: 1.1, fontWeight: 400, fontVariantNumeric: "tabular-nums" }}>
          {value}
        </Typography>
        {trend != null && trend !== 0 ? (
          <Box sx={{ display: "inline-flex", alignItems: "center", gap: 0.25, fontSize: 13, fontWeight: 500, color: trend > 0 ? "var(--md-success)" : "var(--md-error)" }}>
            {trend > 0 ? <TrendingUp sx={{ fontSize: 18 }} /> : <TrendingDown sx={{ fontSize: 18 }} />}
            {trend > 0 ? "+" : ""}
            {trend}
          </Box>
        ) : null}
      </Box>
      {hint ? (
        <Typography variant="caption" sx={{ opacity: 0.8, display: "block", mt: 0.5 }}>
          {hint}
        </Typography>
      ) : null}
    </Box>
  );
}

function Panel({ title, children, action }: { title: string; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <Box sx={{ p: { xs: 2, md: 2.5 }, borderRadius: 4, bgcolor: "var(--md-surface-container-low)", border: "1px solid var(--md-outline-variant)", minWidth: 0 }}>
      <SectionTitle action={action}>{title}</SectionTitle>
      {children}
    </Box>
  );
}

const netSentiment = (list: Mention[]) => {
  const a = list.filter((m) => m.analysis);
  if (!a.length) return 0;
  const pos = a.filter((m) => m.analysis!.sentiment === "positive").length;
  const neg = a.filter((m) => m.analysis!.sentiment === "negative").length;
  return Math.round(((pos - neg) / a.length) * 100);
};

export default function Dashboard() {
  const { mentions, loading, error, meta } = useData();
  const [range, setRange] = useState<Range>("30d");
  const [now] = useState(() => Date.now());
  const rangeDef = RANGES.find((r) => r.value === range)!;
  const filters: MentionFilters = useMemo(() => ({ range }), [range]);

  const stats = useMemo(() => {
    const current = applyFilters(mentions, filters);
    const since = now - rangeDef.days * 86_400_000;
    const prevSince = since - rangeDef.days * 86_400_000;
    const previous = applyFilters(mentions, {}).filter((m) => {
      const t = new Date(m.publishedAt).getTime();
      return t >= prevSince && t < since;
    });
    const irrelevant = mentions.filter(
      (m) => m.analysis && m.analysis.relevance < RELEVANCE_THRESHOLD && new Date(m.publishedAt).getTime() >= since,
    );
    const actions = current.filter((m) => m.analysis?.actionRequired && m.status === "open").sort(byUrgency);

    // Timeline buckets: days for ≤ 30 days, weeks for 90 days.
    const bucketDays = rangeDef.days > 30 ? 7 : 1;
    const bucketCount = Math.ceil(rangeDef.days / bucketDays);
    const buckets = Array.from({ length: bucketCount }, (_, i) => {
      const end = now - (bucketCount - 1 - i) * bucketDays * 86_400_000;
      const d = new Date(end);
      return {
        label: d.toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit" }),
        start: end - bucketDays * 86_400_000,
        end,
        positive: 0,
        neutral: 0,
        negative: 0,
      };
    });
    for (const m of current) {
      const t = new Date(m.publishedAt).getTime();
      const b = buckets.find((x) => t > x.start && t <= x.end);
      if (b && m.analysis) b[m.analysis.sentiment]++;
    }

    const topics = TOPICS.map((t) => ({ topic: t, count: current.filter((m) => m.analysis?.topic === t).length }))
      .filter((x) => x.count > 0)
      .sort((a, b) => b.count - a.count);
    const kinds = SOURCE_KINDS.map((k) => ({ kind: k, count: current.filter((m) => m.kind === k).length })).filter((x) => x.count > 0);

    return { current, previous, irrelevant, actions, buckets, topics, kinds };
  }, [mentions, filters, rangeDef.days, now]);

  if (error) {
    return (
      <Box sx={{ py: 8, textAlign: "center" }}>
        <Typography variant="h6">Daten konnten nicht geladen werden</Typography>
        <Typography variant="body2" sx={{ color: "var(--md-on-surface-variant)" }}>
          {error}
        </Typography>
      </Box>
    );
  }

  const net = netSentiment(stats.current);
  const high = stats.actions.filter((m) => m.analysis?.urgency === "high").length;

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: { xs: 2, md: 3 } }}>
      <Box sx={{ display: "flex", alignItems: { xs: "flex-start", sm: "center" }, justifyContent: "space-between", gap: 2, flexDirection: { xs: "column", sm: "row" } }}>
        <Box>
          <Typography variant="h5" component="h1" sx={{ fontSize: { xs: 24, md: 28 } }}>
            Übersicht
          </Typography>
          <Typography variant="body2" sx={{ color: "var(--md-on-surface-variant)" }}>
            {meta?.lastRefresh
              ? `Zuletzt aktualisiert ${new Date(meta.lastRefresh).toLocaleString("de-DE", { dateStyle: "short", timeStyle: "short" })}`
              : "Live-Quellen noch nicht abgefragt, Aktualisieren startet die Suche"}
          </Typography>
        </Box>
        <SegmentedButton ariaLabel="Zeitraum" value={range} onChange={setRange} options={RANGES} />
      </Box>

      {loading ? (
        <Box sx={{ display: "grid", gridTemplateColumns: { xs: "repeat(2, minmax(0, 1fr))", lg: "repeat(4, minmax(0, 1fr))" }, gap: 2 }}>
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} variant="rounded" height={120} sx={{ borderRadius: 4 }} />
          ))}
        </Box>
      ) : (
        <Box sx={{ display: "grid", gridTemplateColumns: { xs: "repeat(2, minmax(0, 1fr))", lg: "repeat(4, minmax(0, 1fr))" }, gap: { xs: 1.5, md: 2 } }}>
          <Kpi
            label="Relevante Erwähnungen"
            value={stats.current.length}
            trend={stats.current.length - stats.previous.length}
            hint={`Vorperiode: ${stats.previous.length}`}
          />
          <Kpi
            label="Stimmungsindex"
            value={`${net > 0 ? "+" : ""}${net}`}
            trend={net - netSentiment(stats.previous)}
            hint="Anteil positiv minus negativ, in %"
          />
          <Kpi
            label="Offener Handlungsbedarf"
            value={stats.actions.length}
            hint={high ? `${high} mit hoher Dringlichkeit` : "Keine hohe Dringlichkeit"}
            tone={high ? "error" : "default"}
          />
          <Kpi
            label="Von der KI aussortiert"
            value={stats.irrelevant.length}
            hint="Verwechslungen und Fremdtreffer"
          />
        </Box>
      )}

      <SummaryCard filters={filters} scopeLabel={`Letzte ${rangeDef.label}`} />

      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "minmax(0, 1fr)", lg: "minmax(0, 2fr) minmax(0, 1fr)" }, gap: { xs: 2, md: 3 } }}>
        <Panel title="Verlauf nach Stimmung">
          {loading ? (
            <Skeleton variant="rounded" height={260} />
          ) : (
            <BarChart
              height={260}
              xAxis={[{ scaleType: "band", data: stats.buckets.map((b) => b.label), tickLabelStyle: { fontSize: 11 } }]}
              yAxis={[{ tickMinStep: 1, width: 32 }]}
              series={SENTIMENTS.map((s) => ({
                data: stats.buckets.map((b) => b[s]),
                label: SENTIMENT_LABELS[s],
                stack: "total",
                color: SENTIMENT_COLORS[s].solid,
              }))}
              borderRadius={4}
              margin={{ left: 0, right: 8, top: 8, bottom: 0 }}
              slotProps={{ legend: { position: { vertical: "top", horizontal: "end" } } }}
            />
          )}
        </Panel>
        <Panel title="Quellen">
          {loading ? (
            <Skeleton variant="rounded" height={260} />
          ) : (
            <PieChart
              height={260}
              series={[
                {
                  data: stats.kinds.map((k, i) => ({
                    id: k.kind,
                    value: k.count,
                    label: KIND_LABELS[k.kind],
                    color: ["var(--md-primary)", "var(--md-tertiary)", "var(--md-secondary)", "var(--md-outline)"][i % 4],
                  })),
                  innerRadius: 56,
                  paddingAngle: 3,
                  cornerRadius: 6,
                },
              ]}
              slotProps={{ legend: { direction: "horizontal", position: { vertical: "bottom", horizontal: "center" } } }}
            />
          )}
        </Panel>
      </Box>

      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "minmax(0, 1fr)", lg: "repeat(2, minmax(0, 1fr))" }, gap: { xs: 2, md: 3 } }}>
        <Panel title="Themen">
          {loading ? (
            <Skeleton variant="rounded" height={260} />
          ) : (
            <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
              {stats.topics.map((t) => {
                const max = stats.topics[0]?.count ?? 1;
                const list = stats.current.filter((m) => m.analysis?.topic === t.topic);
                const neg = list.filter((m) => m.analysis?.sentiment === "negative").length;
                return (
                  <Box key={t.topic} component={Link} href={`/erwaehnungen?topic=${t.topic}`} sx={{ textDecoration: "none", color: "inherit" }}>
                    <Box sx={{ display: "flex", justifyContent: "space-between", mb: 0.5 }}>
                      <Typography variant="body2">{TOPIC_LABELS[t.topic]}</Typography>
                      <Typography variant="body2" sx={{ color: "var(--md-on-surface-variant)", fontVariantNumeric: "tabular-nums" }}>
                        {t.count}
                        {neg ? ` · ${neg} negativ` : ""}
                      </Typography>
                    </Box>
                    <Box sx={{ height: 8, borderRadius: 4, bgcolor: "var(--md-surface-container-highest)", overflow: "hidden", display: "flex" }}>
                      <Box sx={{ width: `${((t.count - neg) / max) * 100}%`, bgcolor: "var(--md-primary)" }} />
                      <Box sx={{ width: `${(neg / max) * 100}%`, bgcolor: "var(--md-error)" }} />
                    </Box>
                  </Box>
                );
              })}
              {!stats.topics.length ? <Typography variant="body2">Keine Daten im Zeitraum.</Typography> : null}
            </Box>
          )}
        </Panel>
        <Panel
          title="Dringend"
          action={
            <Button size="small" endIcon={<ArrowForward />} component={Link} href="/handlungsbedarf">
              Alle
            </Button>
          }
        >
          <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
            {loading
              ? [0, 1].map((i) => <Skeleton key={i} variant="rounded" height={110} sx={{ borderRadius: 3 }} />)
              : stats.actions.slice(0, 3).map((m) => <MentionCard key={m.id} mention={m} showAction />)}
            {!loading && !stats.actions.length ? (
              <Typography variant="body2" sx={{ color: "var(--md-on-surface-variant)" }}>
                Kein offener Handlungsbedarf. 🎉
              </Typography>
            ) : null}
          </Box>
        </Panel>
      </Box>
    </Box>
  );
}
