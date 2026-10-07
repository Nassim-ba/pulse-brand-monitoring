"use client";
import { Suspense, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import Skeleton from "@mui/material/Skeleton";
import ButtonBase from "@mui/material/ButtonBase";
import { BarChart } from "@mui/x-charts/BarChart";
import { PieChart } from "@mui/x-charts/PieChart";
import ArrowForward from "@mui/icons-material/ArrowForward";
import PictureAsPdf from "@mui/icons-material/PictureAsPdfOutlined";
import TrendingUp from "@mui/icons-material/TrendingUp";
import TrendingDown from "@mui/icons-material/TrendingDown";
import Visibility from "@mui/icons-material/VisibilityOutlined";
import FavoriteBorder from "@mui/icons-material/FavoriteBorder";
import ChatBubbleOutline from "@mui/icons-material/ChatBubbleOutlineOutlined";
import { useData } from "@/components/DataProvider";
import { SummaryCard } from "@/components/SummaryCard";
import { MentionCard } from "@/components/MentionCard";
import { FilterBar } from "@/components/FilterBar";
import { SectionTitle, SENTIMENT_COLORS, SentimentTag, SourceAvatar, compact } from "@/components/bits";
import { useFilters } from "@/hooks/useFilters";
import { applyFilters, byReach, byUrgency, interactions, reach } from "@/lib/filters";
import { KIND_LABELS, RELEVANCE_THRESHOLD, SENTIMENT_LABELS, TOPIC_LABELS } from "@/lib/labels";
import { SENTIMENTS, SOURCE_KINDS, TOPICS, type Mention } from "@/lib/types";

const RANGE_DAYS: Record<string, number> = { "7d": 7, "30d": 30, "90d": 90 };
const RANGE_LABELS: Record<string, string> = { "7d": "Letzte 7 Tage", "30d": "Letzte 30 Tage", "90d": "Letzte 90 Tage", all: "Gesamter Zeitraum" };
const PLATFORM_COLORS = ["var(--md-primary)", "var(--md-tertiary)", "var(--md-secondary)", "var(--md-outline)", "var(--md-success)", "var(--md-warning)"];

function Kpi({
  label,
  value,
  hint,
  trend,
  tone = "default",
  wide = false,
}: {
  label: string;
  value: string | number;
  hint?: string;
  trend?: number | null;
  tone?: "default" | "error";
  wide?: boolean;
}) {
  return (
    <Box
      sx={{
        gridColumn: wide ? { xs: "1 / -1", lg: "auto" } : undefined,
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
      <Box sx={{ display: "flex", alignItems: "baseline", gap: 1, mt: 0.5, flexWrap: "wrap" }}>
        <Typography sx={{ fontSize: { xs: 30, md: 36 }, lineHeight: 1.1, fontWeight: 400, fontVariantNumeric: "tabular-nums" }}>{value}</Typography>
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

const platformOf = (m: Mention) => m.sourceLabel.split(" · ")[0];

function Stat({ icon, value }: { icon: React.ReactNode; value: number }) {
  return (
    <Box sx={{ display: "inline-flex", gap: 0.5, alignItems: "center", fontSize: 12 }}>
      {icon} {compact(value)}
    </Box>
  );
}

function TopPost({ m }: { m: Mention }) {
  const { openMention } = useData();
  const x = m.metrics ?? {};
  return (
    <ButtonBase
      onClick={() => openMention(m.id)}
      sx={{ display: "flex", gap: 1.5, alignItems: "flex-start", textAlign: "left", width: "100%", p: 1, borderRadius: 3, "&:hover": { bgcolor: "var(--md-surface-container-high)" } }}
    >
      <SourceAvatar kind={m.kind} size={36} />
      <Box sx={{ minWidth: 0, flex: 1 }}>
        <Typography variant="caption" sx={{ color: "var(--md-on-surface-variant)" }} noWrap component="div">
          {platformOf(m)}
          {m.author ? ` · ${m.author}` : ""}
        </Typography>
        <Typography variant="body2" sx={{ fontWeight: 500 }} noWrap>
          {m.analysis?.summary ?? m.title}
        </Typography>
        <Box sx={{ display: "flex", gap: 1.5, mt: 0.5, alignItems: "center", flexWrap: "wrap", color: "var(--md-on-surface-variant)", "& svg": { fontSize: 15 } }}>
          {m.analysis ? <SentimentTag sentiment={m.analysis.sentiment} /> : null}
          {x.views != null ? <Stat icon={<Visibility />} value={x.views} /> : null}
          {x.likes != null ? <Stat icon={<FavoriteBorder />} value={x.likes} /> : null}
          {x.comments != null ? <Stat icon={<ChatBubbleOutline />} value={x.comments} /> : null}
        </Box>
      </Box>
    </ButtonBase>
  );
}

function ReportButton() {
  const params = useSearchParams();
  const qs = params.toString();
  return (
    <Button variant="outlined" startIcon={<PictureAsPdf />} component={Link} href={qs ? `/bericht?${qs}` : "/bericht"}>
      Report als PDF
    </Button>
  );
}

function DashboardView() {
  const { mentions, loading, error, meta } = useData();
  const { filters } = useFilters();
  const [now] = useState(() => Date.now());
  const range = filters.range ?? "all";
  const days = RANGE_DAYS[range];

  const stats = useMemo(() => {
    const current = applyFilters(mentions, filters);
    const previous = days
      ? applyFilters(mentions, { ...filters, range: "all" }).filter((m) => {
          const t = new Date(m.publishedAt).getTime();
          return t >= now - 2 * days * 86_400_000 && t < now - days * 86_400_000;
        })
      : null;
    const irrelevant = applyFilters(mentions, { ...filters, includeIrrelevant: true }).filter(
      (m) => m.analysis && m.analysis.relevance < RELEVANCE_THRESHOLD,
    );
    const actions = current.filter((m) => m.analysis?.actionRequired && m.status === "open").sort(byUrgency);

    // Timeline: daily up to 30 days, weekly otherwise ("all" spans the data, max 26 weeks).
    const oldest = current.reduce((t, m) => Math.min(t, new Date(m.publishedAt).getTime()), now);
    const spanDays = days ?? Math.min(182, Math.max(28, Math.ceil((now - oldest) / 86_400_000) + 1));
    const bucketDays = spanDays > 30 ? 7 : 1;
    const bucketCount = Math.ceil(spanDays / bucketDays);
    const buckets = Array.from({ length: bucketCount }, (_, i) => {
      const end = now - (bucketCount - 1 - i) * bucketDays * 86_400_000;
      return {
        label: new Date(end).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit" }),
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

    const withReach = current.filter((m) => reach(m) > 0);
    const totalReach = withReach.reduce((n, m) => n + reach(m), 0);
    const topPosts = [...withReach].sort(byReach).slice(0, 5);
    const platformMap = new Map<string, number>();
    for (const m of withReach) platformMap.set(platformOf(m), (platformMap.get(platformOf(m)) ?? 0) + interactions(m));
    const platforms = [...platformMap].map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);

    return { current, previous, irrelevant, actions, buckets, topics, kinds, totalReach, topPosts, platforms };
  }, [mentions, filters, days, now]);

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
  const narrowed = filters.sources?.length || filters.sentiments?.length || filters.topics?.length || filters.actionOnly;
  const scopeLabel = RANGE_LABELS[range] + (narrowed ? ", gefiltert" : "");

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: { xs: 2, md: 3 } }}>
      <Box sx={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 2, flexWrap: "wrap" }}>
      <Box>
        <Typography variant="h5" component="h1" sx={{ fontSize: { xs: 24, md: 28 } }}>
          Übersicht
        </Typography>
        <Typography variant="body2" sx={{ color: "var(--md-on-surface-variant)" }}>
          {meta?.lastRefresh
            ? `Zuletzt gesucht ${new Date(meta.lastRefresh).toLocaleString("de-DE", { dateStyle: "short", timeStyle: "short" })}`
            : "Noch keine Live-Suche, Aktualisieren startet die Suche"}
        </Typography>
      </Box>
        <ReportButton />
      </Box>

      <FilterBar />

      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "repeat(2, minmax(0, 1fr))", lg: "repeat(5, minmax(0, 1fr))" }, gap: { xs: 1.5, md: 2 } }}>
        {loading ? (
          [0, 1, 2, 3, 4].map((i) => <Skeleton key={i} variant="rounded" height={120} sx={{ borderRadius: 4 }} />)
        ) : (
          <>
            <Kpi
              label="Relevante Erwähnungen"
              value={stats.current.length}
              trend={stats.previous ? stats.current.length - stats.previous.length : null}
              hint={stats.previous ? `Vorperiode: ${stats.previous.length}` : "Alle Zeiträume"}
            />
            <Kpi
              label="Stimmungsindex"
              value={`${net > 0 ? "+" : ""}${net}`}
              trend={stats.previous ? net - netSentiment(stats.previous) : null}
              hint="Anteil positiv minus negativ, in %"
            />
            <Kpi label="Reichweite" value={compact(stats.totalReach)} hint="Aufrufe und Publikum der Beiträge" />
            <Kpi
              label="Offener Handlungsbedarf"
              value={stats.actions.length}
              hint={high ? `${high} mit hoher Dringlichkeit` : "Keine hohe Dringlichkeit"}
              tone={high ? "error" : "default"}
            />
            <Kpi label="Von der KI aussortiert" value={stats.irrelevant.length} hint="Verwechslungen und Fremdtreffer" wide />
          </>
        )}
      </Box>

      <SummaryCard filters={filters} scopeLabel={scopeLabel} />

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
        <Panel title="Quellenarten">
          {loading ? (
            <Skeleton variant="rounded" height={260} />
          ) : (
            <PieChart
              height={260}
              series={[
                {
                  data: stats.kinds.map((k, i) => ({ id: k.kind, value: k.count, label: KIND_LABELS[k.kind], color: PLATFORM_COLORS[i % PLATFORM_COLORS.length] })),
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
        <Panel
          title="Top-Beiträge nach Reichweite"
          action={
            <Button size="small" endIcon={<ArrowForward />} component={Link} href="/erwaehnungen?sort=reach">
              Alle
            </Button>
          }
        >
          <Box sx={{ display: "flex", flexDirection: "column", gap: 0.5 }}>
            {loading ? (
              <Skeleton variant="rounded" height={240} />
            ) : stats.topPosts.length ? (
              stats.topPosts.map((m) => <TopPost key={m.id} m={m} />)
            ) : (
              <Typography variant="body2" sx={{ color: "var(--md-on-surface-variant)" }}>
                Noch keine Social-Media-Beiträge mit Reichweitendaten.
              </Typography>
            )}
          </Box>
        </Panel>
        <Panel title="Engagement nach Plattform">
          {loading ? (
            <Skeleton variant="rounded" height={240} />
          ) : stats.platforms.length ? (
            <BarChart
              height={Math.max(160, 48 * stats.platforms.length + 60)}
              layout="horizontal"
              yAxis={[{ scaleType: "band", data: stats.platforms.map((p) => p.name), width: 110, tickLabelStyle: { fontSize: 12 } }]}
              xAxis={[{ valueFormatter: (v: number | null) => compact(v ?? 0) }]}
              series={[
                {
                  data: stats.platforms.map((p) => p.value),
                  label: "Interaktionen (Likes, Kommentare, Shares)",
                  color: "var(--md-primary)",
                  valueFormatter: (v: number | null) => compact(v ?? 0),
                },
              ]}
              borderRadius={4}
              margin={{ left: 0, right: 16, top: 8, bottom: 0 }}
              slotProps={{ legend: { position: { vertical: "top", horizontal: "start" } } }}
            />
          ) : (
            <Typography variant="body2" sx={{ color: "var(--md-on-surface-variant)" }}>
              Noch keine Engagement-Daten.
            </Typography>
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
                const neg = stats.current.filter((m) => m.analysis?.topic === t.topic && m.analysis.sentiment === "negative").length;
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
              {!stats.topics.length ? <Typography variant="body2">Keine Daten für diese Auswahl.</Typography> : null}
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

export default function Dashboard() {
  return (
    <Suspense>
      <DashboardView />
    </Suspense>
  );
}
