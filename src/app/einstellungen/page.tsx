"use client";
import { useEffect, useState } from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import TextField from "@mui/material/TextField";
import Button from "@mui/material/Button";
import Switch from "@mui/material/Switch";
import Chip from "@mui/material/Chip";
import CircularProgress from "@mui/material/CircularProgress";
import Save from "@mui/icons-material/Save";
import RestartAlt from "@mui/icons-material/RestartAlt";
import AutoAwesome from "@mui/icons-material/AutoAwesome";
import Storage from "@mui/icons-material/Storage";
import Hub from "@mui/icons-material/Hub";
import { useData } from "@/components/DataProvider";
import { SectionTitle } from "@/components/bits";
import { DEFAULT_SETTINGS as ATZ_DEFAULTS } from "@/lib/defaults";
import type { Settings } from "@/lib/types";

function Card({ children }: { children: React.ReactNode }) {
  return (
    <Box sx={{ p: { xs: 2, md: 3 }, borderRadius: 4, bgcolor: "var(--md-surface-container-low)", border: "1px solid var(--md-outline-variant)" }}>
      {children}
    </Box>
  );
}

function TermsInput({ label, helper, value, onChange }: { label: string; helper: string; value: string[]; onChange: (v: string[]) => void }) {
  const [draft, setDraft] = useState("");
  const add = () => {
    const parts = draft.split(",").map((s) => s.trim()).filter((s) => s.length >= 2 && !value.includes(s));
    if (parts.length) onChange([...value, ...parts].slice(0, 15));
    setDraft("");
  };
  return (
    <Box>
      <TextField
        fullWidth
        label={label}
        helperText={helper}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === ",") {
            e.preventDefault();
            add();
          }
        }}
        onBlur={add}
      />
      <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1, mt: 1 }}>
        {value.map((k) => (
          <Chip key={k} label={k} variant="outlined" onDelete={() => onChange(value.filter((x) => x !== k))} />
        ))}
      </Box>
    </Box>
  );
}

function SwitchRow({ label, hint, checked, onChange }: { label: string; hint?: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <Box component="label" sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 2, py: 1, cursor: "pointer" }}>
      <Box>
        <Typography variant="body1">{label}</Typography>
        {hint ? (
          <Typography variant="body2" sx={{ color: "var(--md-on-surface-variant)" }}>
            {hint}
          </Typography>
        ) : null}
      </Box>
      <Switch checked={checked} onChange={(e) => onChange(e.target.checked)} />
    </Box>
  );
}

export default function SettingsPage() {
  const { settings, meta, saveSettings, reload, toast } = useData();
  const [form, setForm] = useState<Settings | null>(settings);
  const [saving, setSaving] = useState(false);
  const [reanalyzing, setReanalyzing] = useState(false);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- sync form once settings arrive
    if (settings && (!form || form.brand !== settings.brand)) setForm(settings);
  }, [settings, form]);

  if (!form) return null;
  const set = <K extends keyof Settings>(k: K, v: Settings[K]) => setForm({ ...form, [k]: v });

  const save = async (s: Settings) => {
    setSaving(true);
    const ok = await saveSettings(s);
    if (ok) setForm(s);
    setSaving(false);
  };

  const reanalyze = async () => {
    setReanalyzing(true);
    const res = await fetch("/api/reanalyze", { method: "POST" });
    const data = await res.json().catch(() => ({}));
    if (res.ok) {
      await reload();
      toast(`${data.count} Erwähnungen neu analysiert.`);
    } else toast(data.error ?? "Neuanalyse fehlgeschlagen.");
    setReanalyzing(false);
  };

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: { xs: 2, md: 3 }, maxWidth: 880 }}>
      <Box>
        <Typography variant="h5" component="h1" sx={{ fontSize: { xs: 24, md: 28 } }}>
          Einstellungen
        </Typography>
        <Typography variant="body2" sx={{ color: "var(--md-on-surface-variant)" }}>
          Welche Marke Pulse überwacht und wie Pulse sie einordnet.
        </Typography>
      </Box>

      <Card>
        <SectionTitle>Marke</SectionTitle>
        <Typography variant="body2" sx={{ color: "var(--md-on-surface-variant)", mt: -1, mb: 2 }}>
          Das Suchprofil einer Marke teilen sich alle, die sie überwachen. So wird jede Marke nur einmal gesucht und analysiert. Deine aktive Marke,
          Wettbewerber und Bearbeitungsstände bleiben persönlich.
        </Typography>
        <Box sx={{ display: "flex", flexDirection: "column", gap: 2.5 }}>
          <TextField
            label="Markenname"
            value={form.brand}
            slotProps={{ input: { readOnly: true } }}
            helperText="Eine andere Marke startest du über die Suche oben."
          />
          <TermsInput
            label="Suchbegriffe hinzufügen"
            helper="Mit Enter oder Komma bestätigen. Diese Begriffe werden in den Live-Quellen gesucht."
            value={form.keywords}
            onChange={(v) => set("keywords", v)}
          />
          <TermsInput
            label="Ausschlussbegriffe hinzufügen"
            helper="Treffer mit diesen Begriffen werden verworfen."
            value={form.excludeKeywords}
            onChange={(v) => set("excludeKeywords", v)}
          />
          <TermsInput
            label="Instagram-Hashtags hinzufügen"
            helper="Ohne #. Diese Hashtags durchsucht der Instagram-Scraper."
            value={form.hashtags}
            onChange={(v) => set("hashtags", v.map((h) => h.replace(/[^\p{L}\p{N}_]/gu, "")).filter((h) => h.length >= 2).slice(0, 5))}
          />
          <TextField
            label="Kontext für die KI"
            helperText="Was macht die Marke, was ist nicht gemeint? Hilft Pulse, Verwechslungen zu erkennen."
            multiline
            minRows={3}
            value={form.context}
            onChange={(e) => set("context", e.target.value)}
          />
        </Box>
      </Card>

      <Card>
        <SectionTitle>Datenquellen</SectionTitle>
        <SwitchRow label="Google News" hint="Nachrichtenartikel, live" checked={form.sources.googleNews} onChange={(v) => set("sources", { ...form.sources, googleNews: v })} />
        <SwitchRow label="Bing News" hint="Nachrichtenartikel, live" checked={form.sources.bingNews} onChange={(v) => set("sources", { ...form.sources, bingNews: v })} />
        <SwitchRow label="Hacker News" hint="Tech-Community, live" checked={form.sources.hackerNews} onChange={(v) => set("sources", { ...form.sources, hackerNews: v })} />
        <SwitchRow label="Google Suche" hint="Organische Suchergebnisse über Apify" checked={form.sources.googleSearch} onChange={(v) => set("sources", { ...form.sources, googleSearch: v })} />
        <SwitchRow label="Instagram" hint="Posts zu den Hashtags inklusive Likes und Kommentaren, über Apify" checked={form.sources.instagram} onChange={(v) => set("sources", { ...form.sources, instagram: v })} />
        <SwitchRow label="TikTok" hint="Videos zur Marke inklusive Aufrufen und Engagement, über Apify" checked={form.sources.tiktok} onChange={(v) => set("sources", { ...form.sources, tiktok: v })} />
      </Card>

      <Box sx={{ display: "flex", gap: 1.5, flexWrap: "wrap" }}>
        <Button variant="contained" startIcon={saving ? <CircularProgress size={18} color="inherit" /> : <Save />} disabled={saving} onClick={() => save(form)}>
          Speichern
        </Button>
        <Button variant="outlined" startIcon={<RestartAlt />} disabled={saving} onClick={() => save(ATZ_DEFAULTS)}>
          Zurück zu ATZ Group
        </Button>
      </Box>

      <Card>
        <SectionTitle>System</SectionTitle>
        <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
          <Box sx={{ display: "flex", gap: 1.5, alignItems: "flex-start" }}>
            <AutoAwesome sx={{ color: "var(--md-tertiary)", mt: 0.25 }} />
            <Box sx={{ flex: 1 }}>
              <Typography variant="body1">{meta?.aiEnabled ? "KI-Analyse aktiv" : "Regelbasierter Modus"}</Typography>
              <Typography variant="body2" sx={{ color: "var(--md-on-surface-variant)" }}>
                {meta?.aiEnabled
                  ? "Pulse bewertet Relevanz, Stimmung, Thema und Handlungsbedarf und schreibt Antwortvorschläge und Lageberichte."
                  : "Kein API-Schlüssel hinterlegt. Pulse nutzt eine regelbasierte Analyse als Rückfallebene."}
              </Typography>
              {meta?.aiError ? (
                <Typography variant="body2" sx={{ color: "var(--md-error)", mt: 0.5, wordBreak: "break-word" }}>
                  Letzter KI-Fehler ({new Date(meta.aiError.at).toLocaleString("de-DE", { dateStyle: "short", timeStyle: "short" })}): {meta.aiError.message}
                </Typography>
              ) : null}
            </Box>
          </Box>
          <Box sx={{ display: "flex", gap: 1.5, alignItems: "flex-start" }}>
            <Storage sx={{ color: "var(--md-tertiary)", mt: 0.25 }} />
            <Box sx={{ flex: 1 }}>
              <Typography variant="body1">{meta?.storageMode === "postgres" ? "Postgres-Datenbank" : "Arbeitsspeicher"}</Typography>
              <Typography variant="body2" sx={{ color: "var(--md-on-surface-variant)" }}>
                {meta?.storageMode === "postgres"
                  ? "Erwähnungen, Analysen und Status werden dauerhaft gespeichert."
                  : "Daten liegen nur im Arbeitsspeicher und gehen beim Neustart verloren."}
              </Typography>
            </Box>
          </Box>
          <Box sx={{ display: "flex", gap: 1.5, alignItems: "flex-start" }}>
            <Hub sx={{ color: "var(--md-tertiary)", mt: 0.25 }} />
            <Box sx={{ flex: 1 }}>
              <Typography variant="body1">{meta?.apifyEnabled ? "Social-Media-Scraping aktiv" : "Social-Media-Scraping inaktiv"}</Typography>
              <Typography variant="body2" sx={{ color: "var(--md-on-surface-variant)" }}>
                {meta?.apifyEnabled
                  ? "Instagram, TikTok und die Google-Suche werden über Apify abgefragt. Pro Quelle und Suche höchstens 20 Ergebnisse."
                  : "Kein Apify-Token hinterlegt. Pulse sucht nur in den News-Quellen."}
              </Typography>
            </Box>
          </Box>
          <Box>
            <Button variant="outlined" startIcon={reanalyzing ? <CircularProgress size={18} /> : <AutoAwesome />} disabled={reanalyzing || !meta?.aiEnabled} onClick={reanalyze}>
              Alle Erwähnungen neu analysieren
            </Button>
          </Box>
        </Box>
      </Card>
    </Box>
  );
}
