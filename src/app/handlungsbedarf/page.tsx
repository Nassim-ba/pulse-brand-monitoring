"use client";
import { useMemo, useState } from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Tabs from "@mui/material/Tabs";
import Tab from "@mui/material/Tab";
import Skeleton from "@mui/material/Skeleton";
import { useData } from "@/components/DataProvider";
import { MentionCard } from "@/components/MentionCard";
import { applyFilters, byUrgency } from "@/lib/filters";
import { URGENCY_LABELS } from "@/lib/labels";
import type { Urgency } from "@/lib/types";

const GROUPS: Urgency[] = ["high", "medium", "low"];

export default function ActionsPage() {
  const { mentions, loading } = useData();
  const [tab, setTab] = useState<"open" | "done">("open");

  const { open, done } = useMemo(() => {
    const all = applyFilters(mentions, {}).filter((m) => m.analysis?.actionRequired).sort(byUrgency);
    return { open: all.filter((m) => m.status === "open"), done: all.filter((m) => m.status === "done") };
  }, [mentions]);

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
      <Box>
        <Typography variant="h5" component="h1" sx={{ fontSize: { xs: 24, md: 28 } }}>
          Handlungsbedarf
        </Typography>
        <Typography variant="body2" sx={{ color: "var(--md-on-surface-variant)" }}>
          Von Pulse markierte Beiträge, auf die das Team reagieren sollte, nach Dringlichkeit sortiert.
        </Typography>
      </Box>

      <Tabs
        value={tab}
        onChange={(_, v) => setTab(v)}
        sx={{ borderBottom: "1px solid var(--md-outline-variant)", "& .MuiTabs-indicator": { height: 3, borderRadius: "3px 3px 0 0" } }}
      >
        <Tab value="open" label={`Offen (${open.length})`} sx={{ fontWeight: 500 }} />
        <Tab value="done" label={`Erledigt (${done.length})`} sx={{ fontWeight: 500 }} />
      </Tabs>

      {loading ? (
        Array.from({ length: 3 }, (_, i) => <Skeleton key={i} variant="rounded" height={150} sx={{ borderRadius: 3 }} />)
      ) : tab === "open" ? (
        open.length ? (
          GROUPS.map((g) => {
            const items = open.filter((m) => m.analysis?.urgency === g);
            if (!items.length) return null;
            return (
              <Box key={g}>
                <Typography variant="subtitle2" sx={{ mb: 1, color: "var(--md-on-surface-variant)" }}>
                  Dringlichkeit {URGENCY_LABELS[g].toLowerCase()} · {items.length}
                </Typography>
                <Box sx={{ display: "grid", gridTemplateColumns: { xs: "minmax(0, 1fr)", lg: "repeat(2, minmax(0, 1fr))" }, gap: 1.5, alignItems: "start" }}>
                  {items.map((m) => (
                    <MentionCard key={m.id} mention={m} showAction />
                  ))}
                </Box>
              </Box>
            );
          })
        ) : (
          <Box sx={{ py: 8, textAlign: "center", color: "var(--md-on-surface-variant)" }}>
            <Typography variant="subtitle1">Alles erledigt 🎉</Typography>
            <Typography variant="body2">Aktuell gibt es keinen offenen Handlungsbedarf.</Typography>
          </Box>
        )
      ) : (
        <Box sx={{ display: "grid", gridTemplateColumns: { xs: "minmax(0, 1fr)", lg: "repeat(2, minmax(0, 1fr))" }, gap: 1.5, alignItems: "start" }}>
          {done.map((m) => (
            <MentionCard key={m.id} mention={m} />
          ))}
          {!done.length ? (
            <Typography variant="body2" sx={{ color: "var(--md-on-surface-variant)" }}>
              Noch nichts erledigt.
            </Typography>
          ) : null}
        </Box>
      )}
    </Box>
  );
}
