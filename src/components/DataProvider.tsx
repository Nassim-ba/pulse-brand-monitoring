"use client";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import Snackbar from "@mui/material/Snackbar";
import type { Mention, MentionStatus, SearchJob, Settings } from "@/lib/types";

interface Meta {
  aiEnabled: boolean;
  apifyEnabled: boolean;
  storageMode: "postgres" | "memory";
  brands: { slug: string; name: string }[];
  job: SearchJob | null;
  lastRefresh: string | null;
  aiError: { message: string; at: string } | null;
}

interface DataContextValue {
  mentions: Mention[];
  settings: Settings | null;
  meta: Meta | null;
  loading: boolean;
  refreshing: boolean;
  error: string | null;
  reload: () => Promise<void>;
  refresh: () => Promise<void>;
  search: (brand: string) => Promise<void>;
  switchBrand: (slug: string) => Promise<void>;
  job: SearchJob | null;
  /** Mentions still waiting for their analysis. */
  pending: number;
  setStatus: (id: string, status: MentionStatus) => Promise<void>;
  saveSettings: (s: Settings) => Promise<boolean>;
  toast: (message: string) => void;
  selectedId: string | null;
  openMention: (id: string | null) => void;
}

const DataContext = createContext<DataContextValue | null>(null);

export function useData() {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error("useData must be used inside DataProvider");
  return ctx;
}

export function DataProvider({ children }: { children: React.ReactNode }) {
  const [mentions, setMentions] = useState<Mention[]>([]);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [meta, setMeta] = useState<Meta | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [job, setJob] = useState<SearchJob | null>(null);
  const pollTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pollRef = useRef<() => void>(() => {});
  const pendingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const reload = useCallback(async () => {
    try {
      const res = await fetch("/api/mentions", { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Fehler beim Laden");
      setMentions(data.mentions);
      setSettings(data.settings);
      setMeta(data.meta);
      setJob(data.meta.job);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Fehler beim Laden");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial data load
    reload();
  }, [reload]);

  // Poll a running search until all sources are done, then reload the data.
  const poll = useCallback(async () => {
    try {
      const res = await fetch("/api/search", { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      const next: SearchJob | null = data.job;
      setJob(next);
      await reload();
      if (next?.status === "running") {
        pollTimer.current = setTimeout(() => pollRef.current(), 5000);
      } else {
        setRefreshing(false);
        if (next) {
          const total = Object.values(next.sources).reduce((n, x) => n + (x.count ?? 0), 0);
          setMessage(total ? `Suche abgeschlossen, ${total} Beiträge gefunden und analysiert.` : "Suche abgeschlossen, keine Beiträge gefunden.");
        }
      }
    } catch {
      pollTimer.current = setTimeout(() => pollRef.current(), 8000);
    }
  }, [reload]);

  useEffect(() => {
    pollRef.current = poll;
  }, [poll]);

  // While analyses run in the background, fetch again until every mention has one.
  const pending = useMemo(() => mentions.filter((m) => !m.analysis).length, [mentions]);
  useEffect(() => {
    if (pendingTimer.current) clearTimeout(pendingTimer.current);
    if (pending > 0 && job?.status !== "running") pendingTimer.current = setTimeout(reload, 4000);
    return () => {
      if (pendingTimer.current) clearTimeout(pendingTimer.current);
    };
  }, [pending, mentions, job?.status, reload]);

  useEffect(() => () => {
    if (pollTimer.current) clearTimeout(pollTimer.current);
  }, []);

  // Resume polling if a search was already running when the page was opened.
  useEffect(() => {
    if (job?.status === "running" && !pollTimer.current) {
      setRefreshing(true);
      pollTimer.current = setTimeout(poll, 3000);
    }
  }, [job?.status, poll]);

  const runSearch = useCallback(
    async (brand?: string) => {
      setRefreshing(true);
      if (pollTimer.current) clearTimeout(pollTimer.current);
      pollTimer.current = null;
      try {
        const res = await fetch("/api/search", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(brand ? { brand } : {}),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Suche fehlgeschlagen");
        setJob(data.job);
        setLoading(true);
        await reload();
        if (data.job.status === "running") pollTimer.current = setTimeout(poll, 4000);
        else setRefreshing(false);
      } catch (e) {
        setMessage(e instanceof Error ? e.message : "Suche fehlgeschlagen");
        setRefreshing(false);
      }
    },
    [reload, poll],
  );

  const refresh = useCallback(() => runSearch(), [runSearch]);
  const search = useCallback((brand: string) => runSearch(brand), [runSearch]);

  const switchBrand = useCallback(
    async (slug: string) => {
      if (pollTimer.current) clearTimeout(pollTimer.current);
      pollTimer.current = null;
      setRefreshing(false);
      setLoading(true);
      await fetch("/api/brands", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ slug }) });
      await reload();
    },
    [reload],
  );

  const setStatus = useCallback(async (id: string, status: MentionStatus) => {
    setMentions((prev) => prev.map((m) => (m.id === id ? { ...m, status } : m)));
    const res = await fetch(`/api/mentions/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    if (!res.ok) {
      setMentions((prev) => prev.map((m) => (m.id === id ? { ...m, status: status === "done" ? "open" : "done" } : m)));
      setMessage("Status konnte nicht gespeichert werden.");
      return;
    }
    setMessage(status === "done" ? "Als erledigt markiert." : "Wieder geöffnet.");
  }, []);

  const saveSettings = useCallback(
    async (s: Settings) => {
      const res = await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(s),
      });
      if (!res.ok) {
        setMessage("Einstellungen ungültig. Bitte Eingaben prüfen.");
        return false;
      }
      setLoading(true);
      await reload();
      setMessage("Einstellungen gespeichert.");
      return true;
    },
    [reload],
  );

  const value = useMemo<DataContextValue>(
    () => ({
      mentions,
      settings,
      meta,
      loading,
      refreshing,
      error,
      reload,
      refresh,
      search,
      switchBrand,
      job,
      pending,
      setStatus,
      saveSettings,
      toast: setMessage,
      selectedId,
      openMention: setSelectedId,
    }),
    [mentions, settings, meta, loading, refreshing, error, reload, refresh, search, switchBrand, job, pending, setStatus, saveSettings, selectedId],
  );

  return (
    <DataContext.Provider value={value}>
      {children}
      <Snackbar
        open={Boolean(message)}
        message={message}
        autoHideDuration={4000}
        onClose={() => setMessage(null)}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
        sx={{ bottom: { xs: 96, md: 24 } }}
      />
    </DataContext.Provider>
  );
}
