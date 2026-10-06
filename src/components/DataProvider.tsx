"use client";
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import Snackbar from "@mui/material/Snackbar";
import type { Mention, MentionStatus, Settings } from "@/lib/types";

interface Meta {
  aiEnabled: boolean;
  storageMode: "postgres" | "memory";
  lastRefresh: string | null;
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

  const reload = useCallback(async () => {
    try {
      const res = await fetch("/api/mentions", { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Fehler beim Laden");
      setMentions(data.mentions);
      setSettings(data.settings);
      setMeta(data.meta);
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

  const refresh = useCallback(async () => {
    setRefreshing(true);
    try {
      const res = await fetch("/api/refresh", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      if (data.cooldown) {
        setMessage(`Bitte ${data.cooldown} Sekunden warten, bevor erneut gesucht wird.`);
      } else {
        await reload();
        const errs = data.errors?.length ? ` (${data.errors.join(", ")})` : "";
        setMessage(
          data.inserted > 0
            ? `${data.inserted} neue Erwähnungen gefunden und analysiert${errs}.`
            : `Keine neuen Erwähnungen gefunden${errs}.`,
        );
      }
    } catch {
      setMessage("Aktualisierung fehlgeschlagen. Bitte später erneut versuchen.");
    } finally {
      setRefreshing(false);
    }
  }, [reload]);

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
      setStatus,
      saveSettings,
      toast: setMessage,
      selectedId,
      openMention: setSelectedId,
    }),
    [mentions, settings, meta, loading, refreshing, error, reload, refresh, setStatus, saveSettings, selectedId],
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
