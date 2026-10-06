"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import Skeleton from "@mui/material/Skeleton";
import AutoAwesome from "@mui/icons-material/AutoAwesome";
import Refresh from "@mui/icons-material/Refresh";
import type { MentionFilters, Summary } from "@/lib/types";
import { useData } from "./DataProvider";
import { AnalyzedBy } from "./bits";

export function SummaryCard({ filters, scopeLabel }: { filters: MentionFilters; scopeLabel: string }) {
  const { mentions, loading: dataLoading } = useData();
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const requestId = useRef(0);
  const filterKey = JSON.stringify(filters);
  const statusKey = mentions.map((m) => m.status[0]).join("");

  const load = useCallback(
    async (force = false) => {
      const id = ++requestId.current;
      setLoading(true);
      setError(false);
      try {
        const res = await fetch("/api/summary", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ filters: JSON.parse(filterKey), scopeLabel, force }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error();
        if (id === requestId.current) setSummary(data.summary);
      } catch {
        if (id === requestId.current) setError(true);
      } finally {
        if (id === requestId.current) setLoading(false);
      }
    },
    [filterKey, scopeLabel],
  );

  useEffect(() => {
    if (dataLoading) return;
    const t = setTimeout(() => load(), 400); // debounce while filters change
    return () => clearTimeout(t);
  }, [load, dataLoading, statusKey]);

  return (
    <Box
      sx={{
        p: { xs: 2.5, md: 3 },
        borderRadius: 4,
        bgcolor: "var(--md-primary-container)",
        color: "var(--md-on-primary-container)",
      }}
    >
      <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1.5, flexWrap: "wrap" }}>
        <AutoAwesome fontSize="small" />
        <Typography variant="subtitle2" sx={{ flex: 1 }}>
          KI-Lagebericht · {scopeLabel}
        </Typography>
        {summary && !loading ? <AnalyzedBy analysis={{ analyzedBy: summary.generatedBy }} /> : null}
        <Button
          size="small"
          startIcon={<Refresh />}
          onClick={() => load(true)}
          disabled={loading}
          sx={{ color: "inherit", minHeight: 32 }}
        >
          Neu erstellen
        </Button>
      </Box>

      {loading || dataLoading ? (
        <Box>
          <Skeleton variant="text" width="60%" height={36} sx={{ bgcolor: "rgba(127,127,127,.2)" }} />
          <Skeleton variant="text" sx={{ bgcolor: "rgba(127,127,127,.2)" }} />
          <Skeleton variant="text" sx={{ bgcolor: "rgba(127,127,127,.2)" }} />
          <Skeleton variant="text" width="80%" sx={{ bgcolor: "rgba(127,127,127,.2)" }} />
        </Box>
      ) : error ? (
        <Typography variant="body2">Der Lagebericht konnte nicht erstellt werden. Bitte erneut versuchen.</Typography>
      ) : summary ? (
        <>
          <Typography variant="h6" component="p" sx={{ mb: 1, fontSize: { xs: 20, md: 22 } }}>
            {summary.headline}
          </Typography>
          <Typography variant="body1" sx={{ mb: summary.keyPoints.length ? 2 : 0 }}>
            {summary.summary}
          </Typography>
          <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" }, gap: 2 }}>
            {summary.keyPoints.length ? (
              <Box>
                <Typography variant="overline" component="div" sx={{ opacity: 0.8 }}>
                  Beobachtungen
                </Typography>
                <Box component="ul" sx={{ m: 0, pl: 2.5 }}>
                  {summary.keyPoints.map((p) => (
                    <Typography component="li" variant="body2" key={p} sx={{ mb: 0.5 }}>
                      {p}
                    </Typography>
                  ))}
                </Box>
              </Box>
            ) : null}
            {summary.recommendations.length ? (
              <Box>
                <Typography variant="overline" component="div" sx={{ opacity: 0.8 }}>
                  Empfehlungen
                </Typography>
                <Box component="ul" sx={{ m: 0, pl: 2.5 }}>
                  {summary.recommendations.map((p) => (
                    <Typography component="li" variant="body2" key={p} sx={{ mb: 0.5 }}>
                      {p}
                    </Typography>
                  ))}
                </Box>
              </Box>
            ) : null}
          </Box>
        </>
      ) : null}
    </Box>
  );
}
