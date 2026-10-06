"use client";
import { useState } from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import IconButton from "@mui/material/IconButton";
import Drawer from "@mui/material/Drawer";
import Dialog from "@mui/material/Dialog";
import Divider from "@mui/material/Divider";
import useMediaQuery from "@mui/material/useMediaQuery";
import Close from "@mui/icons-material/Close";
import ArrowBack from "@mui/icons-material/ArrowBack";
import OpenInNew from "@mui/icons-material/OpenInNew";
import ContentCopy from "@mui/icons-material/ContentCopy";
import Check from "@mui/icons-material/Check";
import Replay from "@mui/icons-material/Replay";
import { KIND_LABELS } from "@/lib/labels";
import { useData } from "./DataProvider";
import { AnalyzedBy, RelevanceMeter, SentimentTag, SourceAvatar, Tag, TopicTag, UrgencyTag } from "./bits";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <Box sx={{ mb: 2.5 }}>
      <Typography variant="overline" component="div" sx={{ color: "var(--md-on-surface-variant)", mb: 0.5 }}>
        {label}
      </Typography>
      {children}
    </Box>
  );
}

function Content() {
  const { mentions, selectedId, openMention, setStatus, toast } = useData();
  const [copied, setCopied] = useState(false);
  const m = mentions.find((x) => x.id === selectedId);
  if (!m) return null;
  const a = m.analysis;
  const tone =
    m.status === "done" ? "success" : a?.urgency === "high" ? "error" : a?.urgency === "medium" ? "warning" : "primary";

  const copyReply = async () => {
    if (!a?.suggestedReply) return;
    await navigator.clipboard.writeText(a.suggestedReply);
    setCopied(true);
    toast("Antwortvorschlag kopiert.");
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Box sx={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <Box sx={{ display: "flex", alignItems: "center", gap: 1, px: 1, py: 1, minHeight: 64 }}>
        <IconButton onClick={() => openMention(null)} aria-label="Schließen" sx={{ display: { xs: "inline-flex", md: "none" } }}>
          <ArrowBack />
        </IconButton>
        <Typography variant="h6" sx={{ flex: 1, pl: { md: 2 } }}>
          Details
        </Typography>
        <IconButton onClick={() => openMention(null)} aria-label="Schließen" sx={{ display: { xs: "none", md: "inline-flex" } }}>
          <Close />
        </IconButton>
      </Box>

      <Box sx={{ flex: 1, overflowY: "auto", px: 3, pb: 3 }}>
        <Box sx={{ display: "flex", gap: 1.5, alignItems: "center", mb: 2 }}>
          <SourceAvatar kind={m.kind} />
          <Box sx={{ minWidth: 0 }}>
            <Typography variant="subtitle2">{m.sourceLabel}</Typography>
            <Typography variant="caption" sx={{ color: "var(--md-on-surface-variant)" }}>
              {KIND_LABELS[m.kind]}
              {m.author ? ` · ${m.author}` : ""} ·{" "}
              {new Date(m.publishedAt).toLocaleString("de-DE", { dateStyle: "medium", timeStyle: "short" })}
            </Typography>
          </Box>
        </Box>

        <Typography variant="h6" component="h3" sx={{ mb: 1 }}>
          {m.title}
        </Typography>
        <Typography variant="body1" sx={{ color: "var(--md-on-surface-variant)", whiteSpace: "pre-line", mb: 2 }}>
          {m.content}
        </Typography>
        <Button
          variant="outlined"
          size="small"
          startIcon={<OpenInNew />}
          href={m.url}
          target="_blank"
          rel="noopener noreferrer"
          sx={{ mb: 3 }}
        >
          Originalquelle öffnen
        </Button>
        {m.isDemo ? (
          <Typography variant="caption" component="p" sx={{ color: "var(--md-on-surface-variant)", mt: -2, mb: 3 }}>
            Synthetischer Demo-Beitrag, Personen und Inhalte sind fiktiv.
          </Typography>
        ) : null}

        <Divider sx={{ mb: 2.5, borderColor: "var(--md-outline-variant)" }} />

        {a ? (
          <>
            <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 2 }}>
              <Typography variant="subtitle1">Analyse</Typography>
              <AnalyzedBy analysis={a} />
            </Box>

            {a.actionRequired ? (
              <Box
                sx={{
                  p: 2,
                  mb: 2.5,
                  borderRadius: 3,
                  bgcolor: `var(--md-${tone}-container)`,
                  color: `var(--md-on-${tone}-container)`,
                }}
              >
                <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1, flexWrap: "wrap" }}>
                  <Typography variant="subtitle2">{m.status === "open" ? "Handlungsbedarf" : "Erledigt"}</Typography>
                  {m.status === "open" ? <UrgencyTag urgency={a.urgency} /> : null}
                </Box>
                {a.actionReason ? <Typography variant="body2">{a.actionReason}</Typography> : null}
                {a.suggestedAction ? (
                  <Typography variant="body2" sx={{ mt: 1 }}>
                    <strong>Empfohlene Maßnahme:</strong> {a.suggestedAction}
                  </Typography>
                ) : null}
                <Button
                  size="small"
                  variant="contained"
                  startIcon={m.status === "open" ? <Check /> : <Replay />}
                  onClick={() => setStatus(m.id, m.status === "open" ? "done" : "open")}
                  sx={{
                    mt: 1.5,
                    bgcolor: `var(--md-on-${tone}-container)`,
                    color: `var(--md-${tone}-container)`,
                    "&:hover": { opacity: 0.9, bgcolor: `var(--md-on-${tone}-container)` },
                  }}
                >
                  {m.status === "open" ? "Als erledigt markieren" : "Wieder öffnen"}
                </Button>
              </Box>
            ) : null}

            <Field label="Kernaussage">
              <Typography variant="body2">{a.summary}</Typography>
            </Field>
            <Box sx={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 2 }}>
              <Field label="Stimmung">
                <SentimentTag sentiment={a.sentiment} />
              </Field>
              <Field label="Thema">
                <TopicTag topic={a.topic} />
              </Field>
            </Box>
            <Field label="Relevanz">
              <RelevanceMeter value={a.relevance} />
              <Typography variant="body2" sx={{ color: "var(--md-on-surface-variant)", mt: 0.5 }}>
                {a.relevanceReason}
              </Typography>
            </Field>

            {a.suggestedReply ? (
              <Field label="Antwortvorschlag">
                <Box sx={{ p: 2, borderRadius: 3, bgcolor: "var(--md-surface-container-highest)" }}>
                  <Typography variant="body2" sx={{ whiteSpace: "pre-line" }}>
                    {a.suggestedReply}
                  </Typography>
                  <Button size="small" startIcon={copied ? <Check /> : <ContentCopy />} onClick={copyReply} sx={{ mt: 1, ml: -1 }}>
                    {copied ? "Kopiert" : "Kopieren"}
                  </Button>
                </Box>
              </Field>
            ) : null}
            {m.isDemo ? null : <Tag outlined>Live-Quelle</Tag>}
          </>
        ) : (
          <Typography variant="body2">Analyse läuft …</Typography>
        )}
      </Box>
    </Box>
  );
}

/** M3 side sheet on desktop, full-screen dialog on mobile. */
export function MentionDetail() {
  const { selectedId, openMention } = useData();
  const desktop = useMediaQuery((t) => t.breakpoints.up("md"), { noSsr: true });
  const open = Boolean(selectedId);

  return desktop ? (
    <Drawer
      anchor="right"
      open={open}
      onClose={() => openMention(null)}
      slotProps={{ paper: { sx: { width: 440, borderRadius: "28px 0 0 28px", bgcolor: "var(--md-surface-container-low)" } } }}
    >
      <Content />
    </Drawer>
  ) : (
    <Dialog
      fullScreen
      open={open}
      onClose={() => openMention(null)}
      slotProps={{ paper: { sx: { borderRadius: 0, bgcolor: "var(--md-surface)" } } }}
    >
      <Content />
    </Dialog>
  );
}
