"use client";
import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import IconButton from "@mui/material/IconButton";
import InputBase from "@mui/material/InputBase";
import Skeleton from "@mui/material/Skeleton";
import LinearProgress from "@mui/material/LinearProgress";
import CircularProgress from "@mui/material/CircularProgress";
import ButtonBase from "@mui/material/ButtonBase";
import Tooltip from "@mui/material/Tooltip";
import { PieChart } from "@mui/x-charts/PieChart";
import Add from "@mui/icons-material/Add";
import Close from "@mui/icons-material/Close";
import Refresh from "@mui/icons-material/Refresh";
import AutoAwesome from "@mui/icons-material/AutoAwesome";
import { useData } from "@/components/DataProvider";
import { FilterBar } from "@/components/FilterBar";
import { BrandLogo } from "@/components/BrandBadge";
import { AnalyzedBy, compact, SectionTitle } from "@/components/bits";
import { useFilters } from "@/hooks/useFilters";
import { TOPIC_LABELS } from "@/lib/labels";
import type { BrandStats, CompetitorInsight } from "@/lib/types";

const COLORS = ["var(--md-primary)", "var(--md-tertiary)", "var(--md-warning)", "var(--md-secondary)"];

function Panel({ title, children, action }: { title: string; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <Box sx={{ p: { xs: 2, md: 2.5 }, borderRadius: 4, bgcolor: "var(--md-surface-container-low)", border: "1px solid var(--md-outline-variant)", minWidth: 0 }}>
      <SectionTitle action={action}>{title}</SectionTitle>
      {children}
    </Box>
  );
}

const isBusy = (b: BrandStats) => b.pending > 0 || b.job?.status === "running";

function ShareBars({ brands, value, format }: { brands: BrandStats[]; value: (b: BrandStats) => number; format: (b: BrandStats) => string }) {
  const max = Math.max(1, ...brands.map(value));
  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
      {brands.map((b, i) => (
        <Box key={b.slug}>
          <Box sx={{ display: "flex", justifyContent: "space-between", gap: 1, mb: 0.5 }}>
            <Typography variant="body2" sx={{ fontWeight: b.isOwn ? 600 : 400 }} noWrap>
              {b.name}
            </Typography>
            <Typography variant="body2" sx={{ color: "var(--md-on-surface-variant)", fontVariantNumeric: "tabular-nums", flexShrink: 0 }}>
              {format(b)}
            </Typography>
          </Box>
          <Box sx={{ height: 10, borderRadius: 5, bgcolor: "var(--md-surface-container-highest)", overflow: "hidden" }}>
            <Box sx={{ width: `${(value(b) / max) * 100}%`, height: "100%", bgcolor: COLORS[i % COLORS.length], borderRadius: 5, transition: "width .4s" }} />
          </Box>
        </Box>
      ))}
    </Box>
  );
}

function CompetitorView() {
  const { settings, toast } = useData();
  const { filters } = useFilters();
  const filterKey = JSON.stringify(filters);
  const [brands, setBrands] = useState<BrandStats[] | null>(null);
  const [maxCompetitors, setMaxCompetitors] = useState(3);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [input, setInput] = useState("");
  const [adding, setAdding] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [insight, setInsight] = useState<CompetitorInsight | null>(null);
  const [insightState, setInsightState] = useState<"idle" | "loading" | "done" | "error">("idle");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tickRef = useRef<() => void>(() => {});

  const load = useCallback(
    async (poll = false) => {
      const res = await fetch(`/api/competitors?filters=${encodeURIComponent(filterKey)}${poll ? "&poll=1" : ""}`, { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setBrands(data.brands);
      setMaxCompetitors(data.maxCompetitors);
      return data.brands as BrandStats[];
    },
    [filterKey],
  );

  // Keep polling while searches or analyses are running.
  const tick = useCallback(async () => {
    try {
      const list = await load(true);
      if (list.some(isBusy)) timer.current = setTimeout(() => tickRef.current(), 5000);
      else setRefreshing(false);
    } catch {
      timer.current = setTimeout(() => tickRef.current(), 8000);
    }
  }, [load]);

  useEffect(() => {
    tickRef.current = tick;
  }, [tick]);

  // Show stored data immediately, then advance running searches in the background.
  useEffect(() => {
    if (timer.current) clearTimeout(timer.current);
    const first = setTimeout(() => {
      load()
        .then((list) => {
          if (list.some(isBusy)) timer.current = setTimeout(() => tickRef.current(), 2000);
        })
        .catch(() => {
          timer.current = setTimeout(() => tickRef.current(), 3000);
        });
    }, 0);
    return () => {
      clearTimeout(first);
      if (timer.current) clearTimeout(timer.current);
    };
  }, [load, settings?.brand]);

  const busy = !brands || brands.some(isBusy);
  const competitorCount = (brands?.length ?? 1) - 1;

  const loaded = Boolean(brands);
  useEffect(() => {
    if (!loaded) return;
    fetch("/api/competitors", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "suggest" }) })
      .then((r) => r.json())
      .then((d) => setSuggestions(d.suggestions ?? []))
      .catch(() => {});
  }, [loaded, competitorCount, settings?.brand]);

  const loadInsight = useCallback(
    async (force = false) => {
      setInsightState("loading");
      try {
        const res = await fetch("/api/competitors/insight", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ filters: JSON.parse(filterKey), force }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error();
        setInsight(data.insight);
        setInsightState(data.insight ? "done" : "idle");
      } catch {
        setInsightState("error");
      }
    },
    [filterKey],
  );

  const ready = brands && brands.length > 1 && !busy;
  const statsKey = brands?.map((b) => `${b.slug}${b.mentions}${b.net}`).join("") ?? "";
  useEffect(() => {
    if (!ready) return;
    const t = setTimeout(() => loadInsight(), 0);
    return () => clearTimeout(t);
  }, [ready, statsKey, loadInsight]);

  const post = async (body: object) => {
    const res = await fetch("/api/competitors", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error ?? "Aktion fehlgeschlagen.");
    return data;
  };

  const add = async (name: string) => {
    const n = name.trim();
    if (n.length < 2 || adding) return;
    setAdding(n);
    try {
      await post({ action: "add", name: n });
      setInput("");
      setSuggestions((s) => s.filter((x) => x.toLowerCase() !== n.toLowerCase()));
      await load();
      toast(`${n} hinzugefügt. Mit „Vergleich aktualisieren“ werden die Daten gesucht.`);
    } catch (e) {
      toast(e instanceof Error ? e.message : "Hinzufügen fehlgeschlagen.");
    } finally {
      setAdding(null);
    }
  };

  const remove = async (slug: string) => {
    try {
      await post({ action: "remove", slug });
      await load();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Entfernen fehlgeschlagen.");
    }
  };

  const refresh = async () => {
    setRefreshing(true);
    try {
      await post({ action: "refresh" });
      if (timer.current) clearTimeout(timer.current);
      tick();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Aktualisierung fehlgeschlagen.");
      setRefreshing(false);
    }
  };

  const withData = brands?.filter((b) => b.mentions > 0) ?? [];
  const canAdd = competitorCount < maxCompetitors;

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: { xs: 2, md: 3 } }}>
      <Box sx={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 2, flexWrap: "wrap" }}>
        <Box>
          <Typography variant="h5" component="h1" sx={{ fontSize: { xs: 24, md: 28 } }}>
            Wettbewerb
          </Typography>
          <Typography variant="body2" sx={{ color: "var(--md-on-surface-variant)" }}>
            Share of Voice, Reichweite und Stimmung von {settings?.brand ?? "deiner Marke"} im Vergleich zu bis zu {maxCompetitors} Wettbewerbern.
          </Typography>
        </Box>
        <Button
          variant="contained"
          startIcon={refreshing || (busy && brands) ? <CircularProgress size={18} color="inherit" /> : <Refresh />}
          onClick={refresh}
          disabled={refreshing || competitorCount === 0}
        >
          Vergleich aktualisieren
        </Button>
      </Box>

      {/* Brands in the comparison */}
      <Panel title="Verglichene Marken">
        <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1, mb: canAdd ? 2 : 0 }}>
          {brands
            ? brands.map((b, i) => (
                <Box
                  key={b.slug}
                  sx={{
                    display: "flex",
                    alignItems: "center",
                    gap: 1,
                    pl: 0.75,
                    pr: b.isOwn ? 1.5 : 0.5,
                    height: 44,
                    borderRadius: 3,
                    border: `2px solid ${COLORS[i % COLORS.length]}`,
                    bgcolor: "var(--md-surface)",
                  }}
                >
                  <BrandLogo name={b.name} domain={b.domain} size={30} />
                  <Box sx={{ minWidth: 0 }}>
                    <Typography variant="body2" sx={{ fontWeight: 600, lineHeight: 1.2 }} noWrap>
                      {b.name}
                    </Typography>
                    <Typography variant="caption" sx={{ color: "var(--md-on-surface-variant)", lineHeight: 1.2, display: "block" }} noWrap>
                      {isBusy(b)
                        ? b.job?.status === "running"
                          ? "Suche läuft …"
                          : `Analyse läuft (${b.pending})`
                        : b.isOwn
                          ? "Eigene Marke"
                          : b.lastSearch
                            ? `Daten vom ${new Date(b.lastSearch).toLocaleDateString("de-DE")}`
                            : "Noch keine Daten"}
                    </Typography>
                  </Box>
                  {!b.isOwn ? (
                    <IconButton size="small" onClick={() => remove(b.slug)} aria-label={`${b.name} entfernen`}>
                      <Close fontSize="small" />
                    </IconButton>
                  ) : null}
                </Box>
              ))
            : [0, 1].map((i) => <Skeleton key={i} variant="rounded" width={160} height={44} sx={{ borderRadius: 3 }} />)}
        </Box>

        {canAdd ? (
          <>
            <Box
              component="form"
              onSubmit={(e) => {
                e.preventDefault();
                add(input);
              }}
              sx={{ display: "flex", alignItems: "center", gap: 1, height: 48, pl: 2, pr: 0.5, borderRadius: 6, bgcolor: "var(--md-surface-container-high)", maxWidth: 520 }}
            >
              <InputBase
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Wettbewerber hinzufügen, z. B. eine Marke aus derselben Branche"
                sx={{ flex: 1, fontSize: 15 }}
                inputProps={{ "aria-label": "Wettbewerber hinzufügen" }}
                disabled={Boolean(adding)}
              />
              <IconButton
                type="submit"
                disabled={input.trim().length < 2 || Boolean(adding)}
                aria-label="Hinzufügen"
                sx={{ bgcolor: "var(--md-primary)", color: "var(--md-on-primary)", "&:hover": { bgcolor: "var(--md-primary)" }, "&.Mui-disabled": { bgcolor: "var(--md-surface-container-highest)" } }}
              >
                {adding ? <CircularProgress size={18} color="inherit" /> : <Add />}
              </IconButton>
            </Box>
            {suggestions.length ? (
              <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1, mt: 1.5, alignItems: "center" }}>
                <Typography variant="caption" sx={{ color: "var(--md-on-surface-variant)", display: "inline-flex", alignItems: "center", gap: 0.5 }}>
                  <AutoAwesome sx={{ fontSize: 14 }} /> KI-Vorschläge
                </Typography>
                {suggestions.map((s) => (
                  <ButtonBase
                    key={s}
                    onClick={() => add(s)}
                    disabled={Boolean(adding)}
                    sx={{ height: 32, px: 1.5, gap: 0.5, borderRadius: 2, border: "1px solid var(--md-outline)", fontSize: 14, fontWeight: 500, color: "var(--md-on-surface-variant)", "&:hover": { bgcolor: "var(--md-surface-container-high)" } }}
                  >
                    <Add sx={{ fontSize: 18 }} />
                    {s}
                  </ButtonBase>
                ))}
              </Box>
            ) : null}
          </>
        ) : null}
      </Panel>

      {brands && competitorCount === 0 ? (
        <Box sx={{ py: 6, textAlign: "center", color: "var(--md-on-surface-variant)" }}>
          <Typography variant="subtitle1">Noch keine Wettbewerber</Typography>
          <Typography variant="body2">Füge oben bis zu {maxCompetitors} Wettbewerber hinzu und starte den Vergleich.</Typography>
        </Box>
      ) : null}

      {brands && competitorCount > 0 ? (
        <>
          <FilterBar />
          {busy ? <LinearProgress sx={{ mt: -1 }} /> : null}

          <Box sx={{ display: "grid", gridTemplateColumns: { xs: "minmax(0, 1fr)", lg: "repeat(3, minmax(0, 1fr))" }, gap: { xs: 2, md: 3 } }}>
            <Panel title="Share of Voice">
              {withData.length ? (
                <PieChart
                  height={240}
                  series={[
                    {
                      data: brands.map((b, i) => ({ id: b.slug, value: b.mentions, label: `${b.name} ${b.shareOfVoice} %`, color: COLORS[i % COLORS.length] })),
                      innerRadius: 60,
                      paddingAngle: 2,
                      cornerRadius: 6,
                      valueFormatter: (v) => `${v.value} Erwähnungen`,
                    },
                  ]}
                  slotProps={{ legend: { direction: "vertical", position: { vertical: "middle", horizontal: "end" } } }}
                />
              ) : (
                <Typography variant="body2" sx={{ color: "var(--md-on-surface-variant)" }}>
                  Noch keine Daten. Starte „Vergleich aktualisieren“.
                </Typography>
              )}
            </Panel>
            <Panel title="Share of Reach">
              <ShareBars brands={brands} value={(b) => b.reach} format={(b) => `${compact(b.reach)} · ${b.shareOfReach} %`} />
            </Panel>
            <Panel title="Stimmung">
              <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
                {brands.map((b) => {
                  const total = b.sentiment.positive + b.sentiment.neutral + b.sentiment.negative || 1;
                  return (
                    <Box key={b.slug}>
                      <Box sx={{ display: "flex", justifyContent: "space-between", mb: 0.5 }}>
                        <Typography variant="body2" sx={{ fontWeight: b.isOwn ? 600 : 400 }} noWrap>
                          {b.name}
                        </Typography>
                        <Typography variant="body2" sx={{ color: b.net >= 0 ? "var(--md-success)" : "var(--md-error)", fontWeight: 600 }}>
                          {b.net > 0 ? "+" : ""}
                          {b.net}
                        </Typography>
                      </Box>
                      <Tooltip title={`Positiv ${b.sentiment.positive} · Neutral ${b.sentiment.neutral} · Negativ ${b.sentiment.negative}`}>
                        <Box sx={{ display: "flex", height: 10, borderRadius: 5, overflow: "hidden", bgcolor: "var(--md-surface-container-highest)" }}>
                          <Box sx={{ width: `${(b.sentiment.positive / total) * 100}%`, bgcolor: "var(--md-success)" }} />
                          <Box sx={{ width: `${(b.sentiment.neutral / total) * 100}%`, bgcolor: "var(--md-outline)" }} />
                          <Box sx={{ width: `${(b.sentiment.negative / total) * 100}%`, bgcolor: "var(--md-error)" }} />
                        </Box>
                      </Tooltip>
                    </Box>
                  );
                })}
              </Box>
            </Panel>
          </Box>

          <Panel title="Kennzahlen im Vergleich">
            <Box sx={{ overflowX: "auto", mx: { xs: -2, md: 0 }, px: { xs: 2, md: 0 } }}>
              <Box component="table" sx={{ width: "100%", minWidth: 680, borderCollapse: "collapse", "& th, & td": { textAlign: "left", py: 1.25, px: 1, borderBottom: "1px solid var(--md-outline-variant)", fontSize: 14 }, "& th": { color: "var(--md-on-surface-variant)", fontWeight: 500, fontSize: 12 } }}>
                <thead>
                  <tr>
                    <th>Marke</th>
                    <th>Erwähnungen</th>
                    <th>Share of Voice</th>
                    <th>Reichweite</th>
                    <th>Interaktionen</th>
                    <th>Stimmungsindex</th>
                    <th>Top-Themen</th>
                  </tr>
                </thead>
                <tbody>
                  {brands.map((b, i) => (
                    <tr key={b.slug}>
                      <td>
                        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                          <Box sx={{ width: 10, height: 10, borderRadius: "50%", bgcolor: COLORS[i % COLORS.length], flexShrink: 0 }} />
                          <Typography variant="body2" sx={{ fontWeight: b.isOwn ? 600 : 400 }}>
                            {b.name}
                          </Typography>
                        </Box>
                      </td>
                      <td>{b.mentions}</td>
                      <td>{b.shareOfVoice} %</td>
                      <td>{compact(b.reach)}</td>
                      <td>{compact(b.interactions)}</td>
                      <td style={{ color: b.net >= 0 ? "var(--md-success)" : "var(--md-error)", fontWeight: 600 }}>
                        {b.net > 0 ? "+" : ""}
                        {b.net}
                      </td>
                      <td>{b.topTopics.map((t) => TOPIC_LABELS[t.topic]).join(", ") || "–"}</td>
                    </tr>
                  ))}
                </tbody>
              </Box>
            </Box>
          </Panel>

          <Box sx={{ p: { xs: 2.5, md: 3 }, borderRadius: 4, bgcolor: "var(--md-primary-container)", color: "var(--md-on-primary-container)" }}>
            <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1.5, flexWrap: "wrap" }}>
              <AutoAwesome fontSize="small" />
              <Typography variant="subtitle2" sx={{ flex: 1 }}>
                KI-Wettbewerbsanalyse
              </Typography>
              {insight && insightState === "done" ? <AnalyzedBy analysis={{ analyzedBy: "claude" }} /> : null}
              <Button size="small" startIcon={<Refresh />} onClick={() => loadInsight(true)} disabled={!ready || insightState === "loading"} sx={{ color: "inherit", minHeight: 32 }}>
                Neu erstellen
              </Button>
            </Box>
            {!ready ? (
              <Typography variant="body2">Die Analyse startet, sobald Suche und Bewertung aller Marken abgeschlossen sind.</Typography>
            ) : insightState === "loading" ? (
              <Box>
                <Skeleton variant="text" width="60%" height={36} sx={{ bgcolor: "rgba(127,127,127,.2)" }} />
                <Skeleton variant="text" sx={{ bgcolor: "rgba(127,127,127,.2)" }} />
                <Skeleton variant="text" width="80%" sx={{ bgcolor: "rgba(127,127,127,.2)" }} />
              </Box>
            ) : insight ? (
              <>
                <Typography variant="h6" component="p" sx={{ mb: 1, fontSize: { xs: 20, md: 22 } }}>
                  {insight.headline}
                </Typography>
                <Typography variant="body1" sx={{ mb: 2 }}>
                  {insight.summary}
                </Typography>
                <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "repeat(3, 1fr)" }, gap: 2 }}>
                  {[
                    { title: "Stärken", items: insight.strengths },
                    { title: "Schwächen", items: insight.weaknesses },
                    { title: "Chancen", items: insight.opportunities },
                  ].map((col) => (
                    <Box key={col.title}>
                      <Typography variant="overline" component="div" sx={{ opacity: 0.8 }}>
                        {col.title}
                      </Typography>
                      <Box component="ul" sx={{ m: 0, pl: 2.5 }}>
                        {col.items.map((p) => (
                          <Typography component="li" variant="body2" key={p} sx={{ mb: 0.5 }}>
                            {p}
                          </Typography>
                        ))}
                      </Box>
                    </Box>
                  ))}
                </Box>
              </>
            ) : insightState === "error" ? (
              <Typography variant="body2">Die Analyse konnte nicht erstellt werden. Bitte erneut versuchen.</Typography>
            ) : (
              <Typography variant="body2">Für eine Analyse braucht es Daten zu mindestens zwei Marken.</Typography>
            )}
          </Box>
        </>
      ) : null}
    </Box>
  );
}

export default function CompetitorPage() {
  return (
    <Suspense>
      <CompetitorView />
    </Suspense>
  );
}
