"use client";
import { Suspense, useMemo, useState } from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import Skeleton from "@mui/material/Skeleton";
import Collapse from "@mui/material/Collapse";
import AutoAwesome from "@mui/icons-material/AutoAwesome";
import { useData } from "@/components/DataProvider";
import { MentionCard } from "@/components/MentionCard";
import { FilterBar } from "@/components/FilterBar";
import { SummaryCard } from "@/components/SummaryCard";
import { useFilters } from "@/hooks/useFilters";
import { applyFilters, byDate, byReach, byRelevance, byUrgency } from "@/lib/filters";

const SORTERS = { date: byDate, relevance: byRelevance, urgency: byUrgency, reach: byReach };

function MentionsView() {
  const { mentions, loading } = useData();
  const { filters, sort, activeCount } = useFilters();
  const [showSummary, setShowSummary] = useState(false);

  const results = useMemo(() => applyFilters(mentions, filters).sort(SORTERS[sort] ?? byDate), [mentions, filters, sort]);
  const scopeLabel = activeCount ? `Aktuelle Auswahl (${results.length})` : "Alle Erwähnungen";

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
      <Typography variant="h5" component="h1" sx={{ fontSize: { xs: 24, md: 28 } }}>
        Erwähnungen
      </Typography>

      <FilterBar withSearch withSort />

      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 1, flexWrap: "wrap" }}>
        <Typography variant="body2" sx={{ color: "var(--md-on-surface-variant)" }}>
          {loading ? "Lädt …" : `${results.length} ${results.length === 1 ? "Erwähnung" : "Erwähnungen"}`}
        </Typography>
        <Button size="small" variant={showSummary ? "contained" : "outlined"} startIcon={<AutoAwesome />} onClick={() => setShowSummary((s) => !s)}>
          Zusammenfassen
        </Button>
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
