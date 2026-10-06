"use client";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import ButtonBase from "@mui/material/ButtonBase";
import IconButton from "@mui/material/IconButton";
import Tooltip from "@mui/material/Tooltip";
import OpenInNew from "@mui/icons-material/OpenInNew";
import PriorityHigh from "@mui/icons-material/PriorityHigh";
import CheckCircle from "@mui/icons-material/CheckCircle";
import type { Mention } from "@/lib/types";
import { useData } from "./DataProvider";
import { RelevanceMeter, SentimentTag, SourceAvatar, Tag, TopicTag, relativeTime, UrgencyTag } from "./bits";

export function MentionCard({ mention, showAction = false }: { mention: Mention; showAction?: boolean }) {
  const { openMention } = useData();
  const a = mention.analysis;
  const needsAction = a?.actionRequired && mention.status === "open";
  const accent = a?.urgency === "high" ? "var(--md-error)" : a?.urgency === "medium" ? "var(--md-warning)" : "var(--md-primary)";

  return (
    <Box
      sx={{
        position: "relative",
        borderRadius: 3,
        bgcolor: "var(--md-surface-container-low)",
        border: "1px solid",
        borderColor: needsAction ? "transparent" : "var(--md-outline-variant)",
        outline: needsAction ? `2px solid ${accent}` : "none",
        outlineOffset: -2,
        transition: "box-shadow .15s",
        "&:hover": { boxShadow: "0 1px 2px rgba(0,0,0,.3), 0 1px 3px 1px rgba(0,0,0,.15)" },
      }}
    >
      <ButtonBase
        onClick={() => openMention(mention.id)}
        sx={{ display: "block", width: "100%", textAlign: "left", p: 2, borderRadius: 3 }}
        aria-label={`Details: ${mention.title}`}
      >
        <Box sx={{ display: "flex", gap: 1.5, alignItems: "flex-start" }}>
          <SourceAvatar kind={mention.kind} />
          <Box sx={{ minWidth: 0, flex: 1, pr: 4 }}>
            <Typography variant="caption" sx={{ color: "var(--md-on-surface-variant)", display: "block" }} noWrap>
              {mention.sourceLabel}
              {mention.author && mention.author !== mention.sourceLabel ? ` · ${mention.author}` : ""} · {relativeTime(mention.publishedAt)}
            </Typography>
            <Typography variant="subtitle2" sx={{ fontSize: 15, mt: 0.25 }}>
              {mention.title}
            </Typography>
            <Typography
              variant="body2"
              sx={{
                color: "var(--md-on-surface-variant)",
                mt: 0.5,
                display: "-webkit-box",
                WebkitLineClamp: 2,
                WebkitBoxOrient: "vertical",
                overflow: "hidden",
              }}
            >
              {a?.summary && a.summary !== mention.title ? a.summary : mention.content}
            </Typography>
            <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.75, mt: 1.25, alignItems: "center" }}>
              {a ? (
                <>
                  {needsAction && showAction ? <UrgencyTag urgency={a.urgency} /> : null}
                  {needsAction && !showAction ? (
                    <Tag bg="var(--md-error-container)" fg="var(--md-on-error-container)" icon={<PriorityHigh />}>
                      Handlungsbedarf
                    </Tag>
                  ) : null}
                  {a.actionRequired && mention.status === "done" ? (
                    <Tag bg="var(--md-success-container)" fg="var(--md-on-success-container)" icon={<CheckCircle />}>
                      Erledigt
                    </Tag>
                  ) : null}
                  <SentimentTag sentiment={a.sentiment} />
                  <TopicTag topic={a.topic} />
                  {mention.isDemo ? <Tag outlined>Demo</Tag> : null}
                  <Box sx={{ ml: "auto" }}>
                    <RelevanceMeter value={a.relevance} compact />
                  </Box>
                </>
              ) : (
                <Typography variant="caption">Wird analysiert …</Typography>
              )}
            </Box>
            {showAction && a?.actionReason ? (
              <Typography variant="body2" sx={{ mt: 1.25, color: "var(--md-on-surface)" }}>
                <strong>Warum:</strong> {a.actionReason}
              </Typography>
            ) : null}
          </Box>
        </Box>
      </ButtonBase>
      <Tooltip title="Originalquelle öffnen">
        <IconButton
          component="a"
          href={mention.url}
          target="_blank"
          rel="noopener noreferrer"
          size="small"
          aria-label="Originalquelle öffnen"
          sx={{ position: "absolute", top: 8, right: 8, color: "var(--md-on-surface-variant)" }}
        >
          <OpenInNew fontSize="small" />
        </IconButton>
      </Tooltip>
    </Box>
  );
}
