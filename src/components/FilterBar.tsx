"use client";
import { useMemo } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import InputBase from "@mui/material/InputBase";
import IconButton from "@mui/material/IconButton";
import Search from "@mui/icons-material/Search";
import Close from "@mui/icons-material/Close";
import FilterAltOff from "@mui/icons-material/FilterAltOff";
import { useFilters, type Sort } from "@/hooks/useFilters";
import { SENTIMENT_LABELS, TOPIC_LABELS } from "@/lib/labels";
import { SENTIMENTS, TOPICS } from "@/lib/types";
import { useData } from "./DataProvider";
import { MenuChip, ToggleChip } from "./FilterChip";

const RANGES = [
  { value: "7d", label: "Letzte 7 Tage" },
  { value: "30d", label: "Letzte 30 Tage" },
  { value: "90d", label: "Letzte 90 Tage" },
];
const RELEVANCE = [
  { value: "70", label: "Relevanz ab 70" },
  { value: "0", label: "Inkl. aussortierte" },
];
const SORTS: { value: Sort; label: string }[] = [
  { value: "relevance", label: "Relevanteste zuerst" },
  { value: "urgency", label: "Dringendste zuerst" },
  { value: "reach", label: "Größte Reichweite zuerst" },
];

export function FilterBar({ withSearch = false, withSort = false }: { withSearch?: boolean; withSort?: boolean }) {
  const { mentions } = useData();
  const { filters, sort, rel, update, reset, activeCount } = useFilters();

  const sourceOptions = useMemo(() => {
    const map = new Map<string, string>();
    mentions.forEach((m) => map.set(m.source, m.sourceLabel.split(" · ")[0] + (m.isDemo ? " (Demo)" : "")));
    return [...map].map(([value, label]) => ({ value, label })).sort((a, b) => a.label.localeCompare(b.label));
  }, [mentions]);

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
      {withSearch ? (
        <Box sx={{ display: "flex", alignItems: "center", gap: 1, height: 56, px: 2, borderRadius: 7, bgcolor: "var(--md-surface-container-high)", maxWidth: 720 }}>
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
      ) : null}

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
          alignItems: "center",
        }}
      >
        <MenuChip
          label="Zeitraum"
          multiple={false}
          options={RANGES}
          selected={filters.range && filters.range !== "all" ? [filters.range] : []}
          onChange={(v) => update({ range: v[0] ?? null })}
        />
        <MenuChip label="Plattform" options={sourceOptions} selected={filters.sources ?? []} onChange={(v) => update({ source: v })} />
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
        <MenuChip label="Relevanz" multiple={false} options={RELEVANCE} selected={rel ? [rel] : []} onChange={(v) => update({ rel: v[0] ?? null })} />
        <ToggleChip label="Nur Handlungsbedarf" selected={!!filters.actionOnly} onToggle={() => update({ action: !filters.actionOnly })} />
        {withSort ? (
          <MenuChip label="Neueste zuerst" multiple={false} options={SORTS} selected={sort !== "date" ? [sort] : []} onChange={(v) => update({ sort: v[0] ?? null })} />
        ) : null}
        {activeCount ? (
          <Button size="small" startIcon={<FilterAltOff />} onClick={reset} sx={{ flexShrink: 0 }}>
            Zurücksetzen
          </Button>
        ) : null}
      </Box>
    </Box>
  );
}
