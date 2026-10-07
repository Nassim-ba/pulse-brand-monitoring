"use client";
import { Fragment, Suspense, useEffect, useRef, useState } from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import InputBase from "@mui/material/InputBase";
import IconButton from "@mui/material/IconButton";
import ButtonBase from "@mui/material/ButtonBase";
import CircularProgress from "@mui/material/CircularProgress";
import Tooltip from "@mui/material/Tooltip";
import AutoAwesome from "@mui/icons-material/AutoAwesome";
import ArrowUpward from "@mui/icons-material/ArrowUpward";
import RestartAlt from "@mui/icons-material/RestartAlt";
import { useData } from "@/components/DataProvider";
import { FilterBar } from "@/components/FilterBar";
import { useFilters } from "@/hooks/useFilters";

interface Source {
  n: number;
  id: string;
  title: string;
  sourceLabel: string;
  url: string;
}

interface Message {
  role: "user" | "assistant";
  content: string;
  sources?: Source[];
  basedOn?: number;
  error?: boolean;
}

const SUGGESTIONS = [
  "Was sind gerade die größten Risiken für unsere Reputation?",
  "Auf welche Beiträge sollten wir zuerst reagieren und warum?",
  "Worüber wird auf TikTok und Instagram gesprochen?",
  "Was loben Kunden und Mitarbeitende besonders?",
];

/** Renders the answer text and turns [n] references into clickable chips. */
function AnswerText({ text, sources }: { text: string; sources: Source[] }) {
  const { openMention } = useData();
  const byN = new Map(sources.map((s) => [s.n, s]));
  const parts = text.split(/(\[\d+(?:,\s*\d+)*\])/g);
  return (
    <Typography variant="body1" component="div" sx={{ whiteSpace: "pre-line" }}>
      {parts.map((part, i) => {
        const match = part.match(/^\[(\d+(?:,\s*\d+)*)\]$/);
        if (!match) return <Fragment key={i}>{part}</Fragment>;
        return match[1].split(/,\s*/).map((num) => {
          const src = byN.get(Number(num));
          return (
            <Tooltip key={`${i}-${num}`} title={src ? `${src.sourceLabel}: ${src.title}` : ""}>
              <ButtonBase
                onClick={() => src && openMention(src.id)}
                disabled={!src}
                sx={{
                  mx: 0.25,
                  px: 0.75,
                  height: 20,
                  borderRadius: 1.5,
                  fontSize: 12,
                  fontWeight: 600,
                  verticalAlign: "text-top",
                  bgcolor: "var(--md-primary-container)",
                  color: "var(--md-on-primary-container)",
                }}
              >
                {num}
              </ButtonBase>
            </Tooltip>
          );
        });
      })}
    </Typography>
  );
}

function AskView() {
  const { settings, openMention } = useData();
  const { filters, activeCount } = useFilters();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  const brand = settings?.brand ?? "";

  // A new brand starts a new conversation.
  const [chatBrand, setChatBrand] = useState(brand);
  if (brand !== chatBrand) {
    setChatBrand(brand);
    setMessages([]);
  }

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, busy]);

  const send = async (question: string) => {
    const q = question.trim();
    if (q.length < 3 || busy) return;
    const history = messages.filter((m) => !m.error).map(({ role, content }) => ({ role, content }));
    setMessages((prev) => [...prev, { role: "user", content: q }]);
    setInput("");
    setBusy(true);
    try {
      const res = await fetch("/api/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: q, history, filters }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setMessages((prev) => [...prev, { role: "assistant", content: data.answer, sources: data.sources, basedOn: data.basedOn }]);
    } catch (e) {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: e instanceof Error && e.message ? e.message : "Das hat nicht geklappt. Bitte erneut versuchen.", error: true },
      ]);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 2, maxWidth: 900, minHeight: { md: "calc(100dvh - 120px)" } }}>
      <Box sx={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 1 }}>
        <Box>
          <Typography variant="h5" component="h1" sx={{ fontSize: { xs: 24, md: 28 } }}>
            Frag Pulse
          </Typography>
          <Typography variant="body2" sx={{ color: "var(--md-on-surface-variant)" }}>
            Stell Fragen zu den Erwähnungen von {brand || "deiner Marke"}. Jede Antwort verweist auf die Beiträge, auf denen sie beruht.
          </Typography>
        </Box>
        {messages.length ? (
          <Tooltip title="Neues Gespräch">
            <IconButton onClick={() => setMessages([])} aria-label="Neues Gespräch">
              <RestartAlt />
            </IconButton>
          </Tooltip>
        ) : null}
      </Box>

      <FilterBar />
      {activeCount ? (
        <Typography variant="caption" sx={{ color: "var(--md-on-surface-variant)", mt: -1 }}>
          Pulse antwortet nur auf Basis der gefilterten Erwähnungen.
        </Typography>
      ) : null}

      <Box sx={{ flex: 1, display: "flex", flexDirection: "column", gap: 2 }}>
        {!messages.length ? (
          <Box sx={{ display: "grid", gridTemplateColumns: { xs: "minmax(0, 1fr)", sm: "repeat(2, minmax(0, 1fr))" }, gap: 1.5, mt: 1 }}>
            {SUGGESTIONS.map((s) => (
              <ButtonBase
                key={s}
                onClick={() => send(s)}
                sx={{
                  justifyContent: "flex-start",
                  textAlign: "left",
                  gap: 1.5,
                  p: 2,
                  borderRadius: 4,
                  border: "1px solid var(--md-outline-variant)",
                  bgcolor: "var(--md-surface-container-low)",
                  "&:hover": { bgcolor: "var(--md-surface-container-high)" },
                }}
              >
                <AutoAwesome sx={{ color: "var(--md-tertiary)", fontSize: 20 }} />
                <Typography variant="body2">{s}</Typography>
              </ButtonBase>
            ))}
          </Box>
        ) : null}

        {messages.map((m, i) =>
          m.role === "user" ? (
            <Box
              key={i}
              sx={{
                alignSelf: "flex-end",
                maxWidth: "85%",
                px: 2,
                py: 1.25,
                borderRadius: "20px 20px 4px 20px",
                bgcolor: "var(--md-primary)",
                color: "var(--md-on-primary)",
              }}
            >
              <Typography variant="body1">{m.content}</Typography>
            </Box>
          ) : (
            <Box key={i} sx={{ display: "flex", gap: 1.5, alignItems: "flex-start", maxWidth: "100%" }}>
              <Box
                sx={{
                  width: 32,
                  height: 32,
                  borderRadius: "50%",
                  flexShrink: 0,
                  display: "grid",
                  placeItems: "center",
                  bgcolor: m.error ? "var(--md-error-container)" : "var(--md-tertiary-container)",
                  color: m.error ? "var(--md-on-error-container)" : "var(--md-on-tertiary-container)",
                }}
              >
                <AutoAwesome sx={{ fontSize: 18 }} />
              </Box>
              <Box sx={{ minWidth: 0, flex: 1, p: 2, borderRadius: "4px 20px 20px 20px", bgcolor: "var(--md-surface-container)" }}>
                {m.error ? <Typography variant="body1">{m.content}</Typography> : <AnswerText text={m.content} sources={m.sources ?? []} />}
                {m.sources?.length ? (
                  <Box sx={{ mt: 1.5, display: "flex", flexDirection: "column", gap: 0.5 }}>
                    <Typography variant="overline" sx={{ color: "var(--md-on-surface-variant)" }}>
                      Quellen
                    </Typography>
                    {m.sources.map((s) => (
                      <ButtonBase
                        key={s.n}
                        onClick={() => openMention(s.id)}
                        sx={{ justifyContent: "flex-start", textAlign: "left", gap: 1, py: 0.5, px: 0.5, mx: -0.5, borderRadius: 2, "&:hover": { bgcolor: "var(--md-surface-container-highest)" } }}
                      >
                        <Box
                          component="span"
                          sx={{ minWidth: 20, height: 20, borderRadius: 1.5, fontSize: 12, fontWeight: 600, display: "grid", placeItems: "center", bgcolor: "var(--md-primary-container)", color: "var(--md-on-primary-container)" }}
                        >
                          {s.n}
                        </Box>
                        <Typography variant="body2" noWrap sx={{ minWidth: 0 }}>
                          <Box component="span" sx={{ color: "var(--md-on-surface-variant)" }}>
                            {s.sourceLabel.split(" · ")[0]}:
                          </Box>{" "}
                          {s.title}
                        </Typography>
                      </ButtonBase>
                    ))}
                  </Box>
                ) : null}
                {m.basedOn ? (
                  <Typography variant="caption" component="div" sx={{ color: "var(--md-on-surface-variant)", mt: 1 }}>
                    Grundlage: {m.basedOn} analysierte Erwähnungen
                  </Typography>
                ) : null}
              </Box>
            </Box>
          ),
        )}
        {busy ? (
          <Box sx={{ display: "flex", gap: 1.5, alignItems: "center", color: "var(--md-on-surface-variant)" }}>
            <CircularProgress size={20} />
            <Typography variant="body2">Pulse wertet die Erwähnungen aus …</Typography>
          </Box>
        ) : null}
        <div ref={endRef} />
      </Box>

      {/* Composer, sticky above the mobile navigation bar */}
      <Box
        component="form"
        onSubmit={(e) => {
          e.preventDefault();
          send(input);
        }}
        sx={{
          position: "sticky",
          bottom: { xs: 88, md: 16 },
          display: "flex",
          alignItems: "center",
          gap: 1,
          pl: 2.5,
          pr: 0.75,
          minHeight: 56,
          borderRadius: 7,
          bgcolor: "var(--md-surface-container-high)",
          boxShadow: "0 2px 6px 2px rgba(0,0,0,.15), 0 1px 2px rgba(0,0,0,.3)",
        }}
      >
        <InputBase
          value={input}
          onChange={(e) => setInput(e.target.value.slice(0, 500))}
          placeholder={`Frage zu ${brand || "der Marke"} stellen`}
          sx={{ flex: 1, fontSize: 16, py: 1 }}
          multiline
          maxRows={4}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              send(input);
            }
          }}
          inputProps={{ "aria-label": "Frage stellen" }}
        />
        <IconButton
          type="submit"
          disabled={busy || input.trim().length < 3}
          aria-label="Frage senden"
          sx={{ bgcolor: "var(--md-primary)", color: "var(--md-on-primary)", "&:hover": { bgcolor: "var(--md-primary)" }, "&.Mui-disabled": { bgcolor: "var(--md-surface-container-highest)" } }}
        >
          <ArrowUpward />
        </IconButton>
      </Box>
    </Box>
  );
}

export default function AskPage() {
  return (
    <Suspense>
      <AskView />
    </Suspense>
  );
}
