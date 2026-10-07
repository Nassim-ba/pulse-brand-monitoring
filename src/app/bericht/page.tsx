"use client";
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useData } from "@/components/DataProvider";
import { PulseMark } from "@/components/PulseLogo";
import { BrandLogo } from "@/components/BrandBadge";
import { useFilters } from "@/hooks/useFilters";
import { applyFilters, byReach, byUrgency, reach } from "@/lib/filters";
import { RELEVANCE_THRESHOLD, SENTIMENT_LABELS, TOPIC_LABELS, URGENCY_LABELS } from "@/lib/labels";
import { SENTIMENTS, TOPICS, type Summary } from "@/lib/types";
import { downloadElementAsPdf } from "@/lib/pdf";

/*
 * Print-optimised management report. Uses a fixed light palette so the PDF
 * looks the same regardless of the app's colour scheme.
 */
const C = {
  ink: "#191c20",
  muted: "#5b5e66",
  line: "#d9dbe3",
  soft: "#f3f4f9",
  primary: "#415f91",
  primarySoft: "#d6e3ff",
  positive: "#2e6b3a",
  neutral: "#8e9099",
  negative: "#ba1a1a",
  negativeSoft: "#ffdad6",
};

const RANGE_LABELS: Record<string, string> = { "7d": "Letzte 7 Tage", "30d": "Letzte 30 Tage", "90d": "Letzte 90 Tage", all: "Gesamter Zeitraum" };
const nf = new Intl.NumberFormat("de-DE");

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section data-pdf-block style={{ marginTop: 22, breakInside: "avoid" }}>
      <h2 style={{ fontSize: 13, fontWeight: 700, letterSpacing: 0.6, textTransform: "uppercase", color: C.primary, margin: "0 0 8px" }}>{title}</h2>
      {children}
    </section>
  );
}

function Kpi({ label, value, hint, alert }: { label: string; value: string; hint?: string; alert?: boolean }) {
  return (
    <div style={{ flex: "1 1 120px", padding: "10px 12px", borderRadius: 10, background: alert ? C.negativeSoft : C.soft, minWidth: 0 }}>
      <div style={{ fontSize: 11, color: C.muted }}>{label}</div>
      <div style={{ fontSize: 24, fontWeight: 500, color: alert ? C.negative : C.ink, marginTop: 2 }}>{value}</div>
      {hint ? <div style={{ fontSize: 10, color: C.muted, marginTop: 2 }}>{hint}</div> : null}
    </div>
  );
}

function ReportView() {
  const { settings, mentions, loading, pending } = useData();
  const { filters } = useFilters();
  const params = useSearchParams();
  const [summary, setSummary] = useState<Summary | null>(null);
  const [summaryState, setSummaryState] = useState<"loading" | "done" | "error">("loading");
  const [now] = useState(() => new Date());
  const filterKey = JSON.stringify(filters);
  const range = filters.range ?? "all";

  const data = useMemo(() => {
    const current = applyFilters(mentions, filters);
    const analysed = current.filter((m) => m.analysis);
    const count = (s: string) => analysed.filter((m) => m.analysis!.sentiment === s).length;
    const sentiments = SENTIMENTS.map((s) => ({ s, n: count(s), pct: analysed.length ? Math.round((count(s) / analysed.length) * 100) : 0 }));
    const topics = TOPICS.map((t) => ({
      t,
      n: analysed.filter((m) => m.analysis!.topic === t).length,
      neg: analysed.filter((m) => m.analysis!.topic === t && m.analysis!.sentiment === "negative").length,
    }))
      .filter((x) => x.n)
      .sort((a, b) => b.n - a.n);
    const actions = analysed.filter((m) => m.analysis!.actionRequired && m.status === "open").sort(byUrgency);
    const top = analysed.filter((m) => reach(m) > 0).sort(byReach).slice(0, 5);
    const totalReach = analysed.reduce((n, m) => n + reach(m), 0);
    const irrelevant = applyFilters(mentions, { ...filters, includeIrrelevant: true }).filter((m) => m.analysis && m.analysis.relevance < RELEVANCE_THRESHOLD).length;
    const net = analysed.length ? sentiments[0].pct - sentiments[2].pct : 0;
    const platforms = new Map<string, number>();
    analysed.forEach((m) => platforms.set(m.sourceLabel.split(" · ")[0], (platforms.get(m.sourceLabel.split(" · ")[0]) ?? 0) + 1));
    return { current, analysed, sentiments, topics, actions, top, totalReach, irrelevant, net, platforms: [...platforms].sort((a, b) => b[1] - a[1]) };
  }, [mentions, filters]);

  useEffect(() => {
    if (loading || pending > 0) return;
    let cancelled = false;
    fetch("/api/summary", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ filters: JSON.parse(filterKey), scopeLabel: RANGE_LABELS[range] }),
    })
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d) => {
        if (cancelled) return;
        setSummary(d.summary);
        setSummaryState("done");
      })
      .catch(() => !cancelled && setSummaryState("error"));
    return () => {
      cancelled = true;
    };
  }, [loading, pending, filterKey, range]);

  const ready = !loading && pending === 0 && summaryState !== "loading";
  const sheetRef = useRef<HTMLElement>(null);
  const [exporting, setExporting] = useState(false);
  const autoDownload = useRef(params.get("download") === "1");

  const download = useCallback(async () => {
    if (!sheetRef.current || !settings) return;
    setExporting(true);
    try {
      const name = settings.brand.replace(/[^\p{L}\p{N}]+/gu, "-").replace(/^-|-$/g, "");
      await downloadElementAsPdf(sheetRef.current, `Pulse-Report_${name}_${now.toISOString().slice(0, 10)}.pdf`);
    } finally {
      setExporting(false);
    }
  }, [settings, now]);

  // Opened via "Report als PDF": download as soon as the report is complete.
  useEffect(() => {
    if (ready && autoDownload.current) {
      autoDownload.current = false;
      // Give logos and fonts a moment to render.
      const t = setTimeout(download, 600);
      return () => clearTimeout(t);
    }
  }, [ready, download]);

  const backParams = new URLSearchParams(params.toString());
  backParams.delete("download");
  const filterNotes = [
    filters.sources?.length ? `Plattformen: ${filters.sources.length} ausgewählt` : null,
    filters.sentiments?.length ? `Stimmung: ${filters.sentiments.map((s) => SENTIMENT_LABELS[s]).join(", ")}` : null,
    filters.topics?.length ? `Themen: ${filters.topics.map((t) => TOPIC_LABELS[t]).join(", ")}` : null,
    filters.actionOnly ? "Nur Handlungsbedarf" : null,
  ].filter(Boolean);

  return (
    <div style={{ background: "#e8e9ef", minHeight: "100dvh", padding: "16px 12px 40px", fontFamily: "var(--font-roboto-flex), Roboto, Arial, sans-serif", color: C.ink }}>
      <style>{`
        @page { size: A4; margin: 14mm; }
        @media screen and (max-width: 640px) {
          .two-col { grid-template-columns: 1fr !important; }
          .sheet { padding: 20px 16px !important; }
        }
        .pdf-capture .two-col { grid-template-columns: 1fr 1fr !important; }
        .sheet.pdf-capture { padding: 28px 32px !important; }
        @media print {
          html, body { background: #fff !important; }
          .no-print { display: none !important; }
          .sheet { box-shadow: none !important; margin: 0 !important; padding: 0 !important; max-width: none !important; border-radius: 0 !important; }
          .report-root { background: #fff !important; padding: 0 !important; }
          * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        }
      `}</style>

      <div className="no-print" style={{ maxWidth: 820, margin: "0 auto 12px", display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
        <Link href={backParams.toString() ? `/?${backParams}` : "/"} style={{ color: C.primary, fontWeight: 500, fontSize: 14, textDecoration: "none", marginRight: "auto" }}>
          ← Zurück zu Pulse
        </Link>
        <span style={{ fontSize: 13, color: C.muted }}>
          {!ready ? "Bericht wird erstellt …" : exporting ? "PDF wird erzeugt …" : "Bericht ist bereit."}
        </span>
        <button
          onClick={() => window.print()}
          disabled={!ready}
          style={{ border: `1px solid ${C.neutral}`, borderRadius: 100, padding: "9px 18px", fontSize: 14, fontWeight: 500, background: "transparent", color: C.primary, cursor: ready ? "pointer" : "default" }}
        >
          Drucken
        </button>
        <button
          onClick={download}
          disabled={!ready || exporting}
          style={{
            border: 0,
            borderRadius: 100,
            padding: "10px 22px",
            fontSize: 14,
            fontWeight: 500,
            cursor: ready && !exporting ? "pointer" : "default",
            background: ready && !exporting ? C.primary : "#c4c6d0",
            color: "#fff",
          }}
        >
          {exporting ? "Wird erzeugt …" : "PDF herunterladen"}
        </button>
      </div>

      <article ref={sheetRef} className="sheet" style={{ maxWidth: 820, margin: "0 auto", background: "#fff", borderRadius: 12, padding: "28px 32px", boxShadow: "0 2px 10px rgba(0,0,0,.12)" }}>
        <header data-pdf-block style={{ display: "flex", alignItems: "center", gap: 14, borderBottom: `2px solid ${C.primary}`, paddingBottom: 14 }}>
          {settings ? <BrandLogo name={settings.brand} domain={settings.domain} size={48} /> : null}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 11, color: C.muted, letterSpacing: 0.6, textTransform: "uppercase" }}>Brand-Monitoring-Report</div>
            <h1 style={{ fontSize: 26, fontWeight: 500, margin: "2px 0 0" }}>{settings?.brand ?? "…"}</h1>
            <div style={{ fontSize: 12, color: C.muted, marginTop: 2 }}>
              {RANGE_LABELS[range]} · erstellt am {now.toLocaleDateString("de-DE", { day: "2-digit", month: "long", year: "numeric" })}
              {filterNotes.length ? ` · ${filterNotes.join(" · ")}` : ""}
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6, color: C.muted, fontSize: 12 }}>
            <PulseMark size={26} />
            <span style={{ fontWeight: 600, color: C.ink }}>Pulse</span>
          </div>
        </header>

        <Section title="Kennzahlen">
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <Kpi label="Relevante Erwähnungen" value={nf.format(data.analysed.length)} />
            <Kpi label="Stimmungsindex" value={`${data.net > 0 ? "+" : ""}${data.net}`} hint="positiv minus negativ, in %" />
            <Kpi label="Reichweite" value={nf.format(data.totalReach)} hint="Aufrufe und Publikum" />
            <Kpi
              label="Offener Handlungsbedarf"
              value={nf.format(data.actions.length)}
              hint={`${data.actions.filter((m) => m.analysis?.urgency === "high").length} mit hoher Dringlichkeit`}
              alert={data.actions.some((m) => m.analysis?.urgency === "high")}
            />
            <Kpi label="Aussortiert" value={nf.format(data.irrelevant)} hint="Verwechslungen" />
          </div>
        </Section>

        <Section title="Lagebericht">
          {summaryState === "loading" ? (
            <p style={{ fontSize: 13, color: C.muted }}>Der KI-Lagebericht wird erstellt …</p>
          ) : summary ? (
            <div style={{ background: C.primarySoft, borderRadius: 10, padding: "12px 14px" }}>
              <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 6 }}>{summary.headline}</div>
              <p style={{ fontSize: 13, lineHeight: 1.55, margin: 0 }}>{summary.summary}</p>
              <div className="two-col" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginTop: 10 }}>
                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: C.primary, marginBottom: 4 }}>BEOBACHTUNGEN</div>
                  <ul style={{ margin: 0, paddingLeft: 16, fontSize: 12, lineHeight: 1.5 }}>
                    {summary.keyPoints.map((p) => (
                      <li key={p}>{p}</li>
                    ))}
                  </ul>
                </div>
                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: C.primary, marginBottom: 4 }}>EMPFEHLUNGEN</div>
                  <ul style={{ margin: 0, paddingLeft: 16, fontSize: 12, lineHeight: 1.5 }}>
                    {summary.recommendations.map((p) => (
                      <li key={p}>{p}</li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          ) : (
            <p style={{ fontSize: 13, color: C.muted }}>Der Lagebericht konnte nicht erstellt werden.</p>
          )}
        </Section>

        <div className="two-col" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
          <Section title="Stimmung">
            <div style={{ display: "flex", height: 14, borderRadius: 7, overflow: "hidden", background: C.soft }}>
              {data.sentiments.map(({ s, pct }) => (
                <div key={s} style={{ width: `${pct}%`, background: C[s] }} />
              ))}
            </div>
            <div style={{ display: "flex", gap: 14, marginTop: 6, fontSize: 12 }}>
              {data.sentiments.map(({ s, n, pct }) => (
                <span key={s}>
                  <span style={{ display: "inline-block", width: 8, height: 8, borderRadius: 4, background: C[s], marginRight: 5 }} />
                  {SENTIMENT_LABELS[s]} {pct} % ({n})
                </span>
              ))}
            </div>
            <div style={{ marginTop: 12, fontSize: 12, color: C.muted }}>
              Quellen: {data.platforms.map(([p, n]) => `${p} ${n}`).join(" · ") || "keine"}
            </div>
          </Section>
          <Section title="Themen">
            {data.topics.slice(0, 6).map(({ t, n, neg }) => (
              <div key={t} style={{ marginBottom: 6 }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12 }}>
                  <span>{TOPIC_LABELS[t]}</span>
                  <span style={{ color: C.muted }}>
                    {n}
                    {neg ? ` · ${neg} negativ` : ""}
                  </span>
                </div>
                <div style={{ display: "flex", height: 6, borderRadius: 3, overflow: "hidden", background: C.soft, marginTop: 2 }}>
                  <div style={{ width: `${((n - neg) / (data.topics[0]?.n || 1)) * 100}%`, background: C.primary }} />
                  <div style={{ width: `${(neg / (data.topics[0]?.n || 1)) * 100}%`, background: C.negative }} />
                </div>
              </div>
            ))}
          </Section>
        </div>

        <Section title={`Offener Handlungsbedarf (${data.actions.length})`}>
          {data.actions.length ? (
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
              <thead>
                <tr style={{ textAlign: "left", color: C.muted }}>
                  <th style={{ padding: "4px 6px", borderBottom: `1px solid ${C.line}`, width: 70 }}>Dringlichkeit</th>
                  <th style={{ padding: "4px 6px", borderBottom: `1px solid ${C.line}` }}>Beitrag</th>
                  <th style={{ padding: "4px 6px", borderBottom: `1px solid ${C.line}` }}>Empfohlene Maßnahme</th>
                </tr>
              </thead>
              <tbody>
                {data.actions.slice(0, 10).map((m) => (
                  <tr key={m.id} data-pdf-block style={{ verticalAlign: "top", breakInside: "avoid" }}>
                    <td style={{ padding: "6px", borderBottom: `1px solid ${C.line}`, fontWeight: 600, color: m.analysis?.urgency === "high" ? C.negative : C.ink }}>
                      {URGENCY_LABELS[m.analysis!.urgency]}
                    </td>
                    <td style={{ padding: "6px", borderBottom: `1px solid ${C.line}` }}>
                      <div style={{ color: C.muted, fontSize: 11 }}>
                        {m.sourceLabel.split(" · ")[0]} · {new Date(m.publishedAt).toLocaleDateString("de-DE")}
                      </div>
                      <a href={m.url} style={{ color: C.ink, textDecoration: "none" }}>
                        {m.analysis?.summary ?? m.title}
                      </a>
                    </td>
                    <td style={{ padding: "6px", borderBottom: `1px solid ${C.line}`, color: C.muted }}>{m.analysis?.suggestedAction ?? m.analysis?.actionReason}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p style={{ fontSize: 13, color: C.muted }}>Kein offener Handlungsbedarf.</p>
          )}
          {data.actions.length > 10 ? <p style={{ fontSize: 11, color: C.muted }}>Weitere {data.actions.length - 10} Beiträge in Pulse.</p> : null}
        </Section>

        <Section title="Reichweitenstärkste Beiträge">
          {data.top.length ? (
            data.top.map((m, i) => (
              <div key={m.id} data-pdf-block style={{ display: "flex", gap: 10, padding: "6px 0", borderBottom: `1px solid ${C.line}`, fontSize: 12, breakInside: "avoid" }}>
                <span style={{ fontWeight: 700, color: C.primary, width: 14 }}>{i + 1}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <a href={m.url} style={{ color: C.ink, textDecoration: "none" }}>
                    {m.analysis?.summary ?? m.title}
                  </a>
                  <div style={{ color: C.muted, fontSize: 11 }}>
                    {m.sourceLabel.split(" · ")[0]}
                    {m.author ? ` · ${m.author}` : ""} · {SENTIMENT_LABELS[m.analysis!.sentiment]}
                  </div>
                </div>
                <span style={{ color: C.muted, whiteSpace: "nowrap" }}>{nf.format(reach(m))} Reichweite</span>
              </div>
            ))
          ) : (
            <p style={{ fontSize: 13, color: C.muted }}>Keine Beiträge mit Reichweitendaten.</p>
          )}
        </Section>

        <footer data-pdf-block style={{ marginTop: 24, paddingTop: 10, borderTop: `1px solid ${C.line}`, fontSize: 10, color: C.muted, display: "flex", justifyContent: "space-between", gap: 8 }}>
          <span>Erstellt mit Pulse · KI-Analyse durch Claude (Anthropic) · Daten aus News, Google, Instagram und TikTok</span>
          <span>{data.analysed.length} analysierte Erwähnungen</span>
        </footer>
      </article>
    </div>
  );
}

export default function ReportPage() {
  return (
    <Suspense>
      <ReportView />
    </Suspense>
  );
}
