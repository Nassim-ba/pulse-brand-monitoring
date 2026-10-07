"use client";
import { useState } from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import LinearProgress from "@mui/material/LinearProgress";
import CircularProgress from "@mui/material/CircularProgress";
import IconButton from "@mui/material/IconButton";
import Tooltip from "@mui/material/Tooltip";
import CheckCircle from "@mui/icons-material/CheckCircle";
import ErrorOutline from "@mui/icons-material/ErrorOutlineOutlined";
import RemoveCircleOutline from "@mui/icons-material/RemoveCircleOutlineOutlined";
import Close from "@mui/icons-material/Close";
import HourglassEmpty from "@mui/icons-material/HourglassEmpty";
import { useData } from "./DataProvider";

/** Shows the progress of the running brand search per source. */
export function SearchProgress() {
  const { job, pending, preparing } = useData();
  const [dismissed, setDismissed] = useState<string | null>(null);
  const [openedAt] = useState(() => Date.now());
  if (preparing) {
    return (
      <Box sx={{ borderRadius: 4, bgcolor: "var(--md-surface-container)", overflow: "hidden", mb: 2 }}>
        <LinearProgress />
        <Box sx={{ p: 2 }}>
          <Typography variant="subtitle2">Suche nach „{preparing}“ wird vorbereitet</Typography>
          <Typography variant="body2" sx={{ color: "var(--md-on-surface-variant)" }}>
            Claude prüft die Marke und erstellt das Suchprofil, danach starten News, Google, Instagram und TikTok.
          </Typography>
        </Box>
      </Box>
    );
  }
  if ((!job || dismissed === job.id) && pending > 0) {
    return (
      <Box sx={{ borderRadius: 4, bgcolor: "var(--md-surface-container)", overflow: "hidden", mb: 2 }}>
        <LinearProgress />
        <Typography variant="body2" sx={{ p: 2 }}>
          Claude analysiert {pending} neue {pending === 1 ? "Beitrag" : "Beiträge"} auf Relevanz, Stimmung, Thema und Handlungsbedarf …
        </Typography>
      </Box>
    );
  }
  if (!job || dismissed === job.id) return null;
  // Older finished searches are not worth the space.
  if (job.status === "done" && openedAt - new Date(job.startedAt).getTime() > 15 * 60_000) return null;
  const running = job.status === "running";
  // Finished searches stay visible until dismissed, so results can be traced to sources.
  const entries = Object.entries(job.sources);

  return (
    <Box sx={{ borderRadius: 4, bgcolor: "var(--md-surface-container)", overflow: "hidden", mb: 2 }}>
      {running || pending > 0 ? <LinearProgress /> : null}
      <Box sx={{ p: 2, display: "flex", gap: 2, alignItems: "flex-start" }}>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography variant="subtitle2">
            {running ? `Suche nach „${job.brandName}“ läuft` : `Suche nach „${job.brandName}“ abgeschlossen`}
          </Typography>
          <Typography variant="body2" sx={{ color: "var(--md-on-surface-variant)", mb: 1.5 }}>
            {!running && pending > 0
              ? `Claude analysiert noch ${pending} ${pending === 1 ? "Beitrag" : "Beiträge"} …`
              : running
              ? "Social-Media-Quellen brauchen ein bis zwei Minuten. Neue Beiträge erscheinen automatisch und werden sofort analysiert."
              : `Gestartet ${new Date(job.startedAt).toLocaleString("de-DE", { dateStyle: "short", timeStyle: "short" })}`}
          </Typography>
          <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1 }}>
            {entries.map(([key, s]) => (
              <Tooltip key={key} title={s.note ?? ""} disableHoverListener={!s.note}>
                <Box
                  sx={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 0.75,
                    height: 32,
                    px: 1.5,
                    borderRadius: 2,
                    border: "1px solid var(--md-outline-variant)",
                    fontSize: 13,
                    fontWeight: 500,
                    color: s.status === "skipped" ? "var(--md-on-surface-variant)" : "var(--md-on-surface)",
                    "& svg": { fontSize: 18 },
                  }}
                >
                  {s.status === "running" ? <CircularProgress size={14} /> : null}
                  {s.status === "queued" ? <HourglassEmpty sx={{ color: "var(--md-on-surface-variant)" }} /> : null}
                  {s.status === "done" ? <CheckCircle sx={{ color: "var(--md-success)" }} /> : null}
                  {s.status === "error" ? <ErrorOutline sx={{ color: "var(--md-error)" }} /> : null}
                  {s.status === "skipped" ? <RemoveCircleOutline /> : null}
                  {s.label}
                  {s.status === "done" ? ` · ${s.count ?? 0} gefunden` : ""}
                  {s.status === "queued" ? " · wartet" : ""}
                  {s.status === "skipped" ? " · aus" : ""}
                </Box>
              </Tooltip>
            ))}
          </Box>
        </Box>
        {!running ? (
          <IconButton size="small" onClick={() => setDismissed(job.id)} aria-label="Ausblenden">
            <Close fontSize="small" />
          </IconButton>
        ) : null}
      </Box>
    </Box>
  );
}
