"use client";
import { Suspense, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import InputBase from "@mui/material/InputBase";
import IconButton from "@mui/material/IconButton";
import Button from "@mui/material/Button";
import Skeleton from "@mui/material/Skeleton";
import Collapse from "@mui/material/Collapse";
import Search from "@mui/icons-material/Search";
import Close from "@mui/icons-material/Close";
import AutoAwesome from "@mui/icons-material/AutoAwesome";
import FilterAltOff from "@mui/icons-material/FilterAltOff";
import { useData } from "@/components/DataProvider";
import { MentionCard } from "@/components/MentionCard";
import { MenuChip, ToggleChip } from "@/components/FilterChip";
import { SummaryCard } from "@/components/SummaryCard";
import { applyFilters, byDate, byRelevance, byUrgency } from "@/lib/filters";
import { SENTIMENT_LABELS, TOPIC_LABELS } from "@/lib/labels";
import { SENTIMENTS, TOPICS, type MentionFilters, type Sentiment, type Topic } from "@/lib/types";

type Sort = "date" | "relevance" | "urgency";
const SORTS: { value: Sort; label: string }[] = [
  { value: "date", label: "Neueste zuerst" },
  { value: "relevance", label: "Relevanteste zuerst" },
  { value: "urgency", label: "Dringendste zuerst" },
];
const RANGES = [
  { value: "7d", label: "Letzte 7 Tage" },
  { value: "30d", label: "Letzte 30 Tage" },
  { value: "90d", label: "Letzte 90 Tage" },
] as const;

const list = (v: string | null) => (v ? v.split(",").filter(Boolean) : []);

function MentionsView() {
  const { mentions, loading } = useData();
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const [showSummary, setShowSummary] = useState(false);

  const filters: MentionFilters = useMemo(
    () => ({
      q: params.get("q") ?? "",
      sentiments: list(params.get("sentiment")) as Sentiment[],
      topics: list(params.get("topic")) as Topic[],
      sources: list(params.get("source")),
      range: (params.get("range") as MentionFilters["range"]) ?? "all",
      actionOnly: params.get("action") === "1",
      includeIrrelevant: params.get("irrelevant") === "1",
    }),
    [params],
  );
  const sort = (params.get("sort") as Sort) ?? "date";

  const update = (patch: Record<string, string | string[] | boolean | null>) => {
    const next = new URLSearchParams(params.toString());
    for (const [k, v] of Object.entries(patch)) {
      const val = Array.isArray(v) ? v.join(",") : typeof v === "boolean" ? (v ? "1" : "") : (v ?? "");
      if (val) next.set(k, val);
      else next.delete(k);
    }
    const qs = next.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  };

  const sourceOptions = useMemo(() => {
    const map = new Map<string, string>();
    mentions.forEach((m) => map.set(m.source, m.sourceLabel.split(" · ")[0]));
    return [...map].map(([value, label]) => ({ value, label })).sort((a, b) => a.label.localeCompare(b.label));
  }, [mentions]);

  const results = useMemo(() => {
    const sorter = sort === "relevance" ? byRelevance : sort === "urgency" ? byUrgency : byDate;
    return applyFilters(mentions, filters).sort(sorter);
  }, [mentions, filters, sort]);

  const activeCount =
    (filters.sentiments?.length ? 1 : 0) +
    (filters.topics?.length ? 1 : 0) +
    (filters.sources?.length ? 1 : 0) +
    (filters.range !== "all" ? 1 : 0) +
    (filters.actionOnly ? 1 : 0) +
    (filters.includeIrrelevant ? 1 : 0) +
    (filters.q ? 1 : 0);

  const scopeLabel = activeCount ? `Aktuelle Auswahl (${results.length})` : "Alle Erwähnungen";

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
      <Typography variant="h5" component="h1" sx={{ fontSize: { xs: 24, md: 28 } }}>
        Erwähnungen
      </Typography>

      {/* M3 search bar */}
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          gap: 1,
          height: 56,
          px: 2,
          borderRadius: 7,
          bgcolor: "var(--md-surface-container-high)",
          maxWidth: 720,
        }}
      >
        <Search sx={{ color: "var(--md-on-surface-variant)" }} />
        <InputBase
          placeholder="In Erwähnungen suchen"
          value={filters.q}
          onChange={(e) => update({ q: e.target.value })}
          sx={{ flex: 1, fontSize: 16 }}
          inputProps={{ "aria-label": "In Erwähnungen suchen" }}
        />
        {filters.q ? (
          <IconButton size="small" onClick={() => update({ q: null })} aria-label="Suche leeren">
            <Close />
          </IconButton>
        ) : null}
      </Box>

      {/* Filter chips, horizontally scrollable on small screens */}
      <Box
        sx={{
          display: "flex",
          gap: 1,
          overflowX: "auto",
          pb: 0.5,
          mx: { xs: -2, md: 0 },
          px: { xs: 2, md: 0 },
          scrollbarWidth: "none",
          "&::-webkit-scrollbar": { display: "none" },
          flexWrap: { md: "wrap" },
        }}
      >
        <ToggleChip label="Handlungsbedarf" selected={!!filters.actionOnly} onToggle={() => update({ action: !filters.actionOnly })} />
        <MenuChip
          label="Stimmung"
          options={SENTIMENTS.map((s) => ({ value: s, label: SENTIMENT_LABELS[s] }))}
          selected={filters.sentiments ?? []}
          onChange={(v) => update({ sentiment: v })}
        />
        <MenuChip
          label="Thema"
          options={TOPICS.map((t) => ({ value: t, label: TOPIC_LABELS[t] }))}
          selected={filters.topics ?? []}
          onChange={(v) => update({ topic: v })}
        />
        <MenuChip label="Quelle" options={sourceOptions} selected={filters.sources ?? []} onChange={(v) => update({ source: v })} />
        <MenuChip
          label="Zeitraum"
          multiple={false}
          options={[...RANGES]}
          selected={filters.range && filters.range !== "all" ? [filters.range] : []}
          onChange={(v) => update({ range: v[0] ?? null })}
        />
        <MenuChip
          label="Sortierung"
          multiple={false}
          options={SORTS}
          selected={sort !== "date" ? [sort] : []}
          onChange={(v) => update({ sort: v[0] ?? null })}
        />
        <ToggleChip
          label="Aussortierte zeigen"
          selected={!!filters.includeIrrelevant}
          onToggle={() => update({ irrelevant: !filters.includeIrrelevant })}
        />
      </Box>

      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 1, flexWrap: "wrap" }}>
        <Typography variant="body2" sx={{ color: "var(--md-on-surface-variant)" }}>
          {loading ? "Lädt …" : `${results.length} ${results.length === 1 ? "Erwähnung" : "Erwähnungen"}`}
        </Typography>
        <Box sx={{ display: "flex", gap: 1 }}>
          {activeCount ? (
            <Button size="small" startIcon={<FilterAltOff />} onClick={() => router.replace(pathname, { scroll: false })}>
              Filter zurücksetzen
            </Button>
          ) : null}
          <Button
            size="small"
            variant={showSummary ? "contained" : "outlined"}
            startIcon={<AutoAwesome />}
            onClick={() => setShowSummary((s) => !s)}
          >
            Zusammenfassen
          </Button>
        </Box>
      </Box>

      <Collapse in={showSummary} unmountOnExit>
        <SummaryCard filters={filters} scopeLabel={scopeLabel} />
      </Collapse>

      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "minmax(0, 1fr)", lg: "repeat(2, minmax(0, 1fr))" }, gap: 1.5, alignItems: "start" }}>
        {loading
          ? Array.from({ length: 6 }, (_, i) => <Skeleton key={i} variant="rounded" height={140} sx={{ borderRadius: 3 }} />)
          : results.map((m) => <MentionCard key={m.id} mention={m} />)}
      </Box>

      {!loading && !results.length ? (
        <Box sx={{ py: 8, textAlign: "center", color: "var(--md-on-surface-variant)" }}>
          <Typography variant="subtitle1">Keine Erwähnungen gefunden</Typography>
          <Typography variant="body2">Filter anpassen oder zurücksetzen.</Typography>
        </Box>
      ) : null}
    </Box>
  );
}

export default function MentionsPage() {
  return (
    <Suspense>
      <MentionsView />
    </Suspense>
  );
}
