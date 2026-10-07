"use client";
import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import TextField from "@mui/material/TextField";
import Button from "@mui/material/Button";
import Tabs from "@mui/material/Tabs";
import Tab from "@mui/material/Tab";
import Alert from "@mui/material/Alert";
import CircularProgress from "@mui/material/CircularProgress";
import { PulseMark } from "@/components/PulseLogo";

function LoginView() {
  const params = useSearchParams();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/auth/${mode}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(mode === "register" ? { name, email, password } : { email, password }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Das hat nicht geklappt.");
      // Only follow internal paths after signing in.
      const next = params.get("next");
      window.location.href = next && next.startsWith("/") && !next.startsWith("//") ? next : "/";
    } catch (err) {
      setError(err instanceof Error ? err.message : "Das hat nicht geklappt.");
      setBusy(false);
    }
  };

  return (
    <Box sx={{ minHeight: "100dvh", display: "grid", placeItems: "center", px: 2, py: 4, bgcolor: "var(--md-surface)" }}>
      <Box sx={{ width: "100%", maxWidth: 440 }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, mb: 3, justifyContent: "center" }}>
          <PulseMark size={48} />
          <Box>
            <Typography sx={{ fontSize: 28, fontWeight: 600, lineHeight: 1.1, letterSpacing: -0.4 }}>Pulse</Typography>
            <Typography variant="caption" sx={{ color: "var(--md-on-surface-variant)", letterSpacing: 0.5 }}>
              Brand Monitoring
            </Typography>
          </Box>
        </Box>

        <Box sx={{ p: { xs: 3, sm: 4 }, borderRadius: 7, bgcolor: "var(--md-surface-container-low)", border: "1px solid var(--md-outline-variant)" }}>
          <Typography variant="h5" component="h1" sx={{ mb: 0.5 }}>
            {mode === "login" ? "Anmelden" : "Konto erstellen"}
          </Typography>
          <Typography variant="body2" sx={{ color: "var(--md-on-surface-variant)", mb: 2 }}>
            {mode === "login"
              ? "Melde dich an, um deine Marken und Suchen zu sehen."
              : "Deine Marken, Wettbewerber und Bearbeitungsstände bleiben in deinem eigenen Bereich."}
          </Typography>

          <Tabs
            value={mode}
            onChange={(_, v) => {
              setMode(v);
              setError(null);
            }}
            variant="fullWidth"
            sx={{ mb: 3, borderBottom: "1px solid var(--md-outline-variant)" }}
          >
            <Tab value="login" label="Anmelden" />
            <Tab value="register" label="Registrieren" />
          </Tabs>

          <Box component="form" onSubmit={submit} sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
            {mode === "register" ? (
              <TextField label="Name" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" required />
            ) : null}
            <TextField label="E-Mail" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" required />
            <TextField
              label="Passwort"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete={mode === "login" ? "current-password" : "new-password"}
              helperText={mode === "register" ? "Mindestens 8 Zeichen" : undefined}
              required
            />
            {error ? <Alert severity="error">{error}</Alert> : null}
            <Button type="submit" variant="contained" size="large" disabled={busy} sx={{ mt: 1, minHeight: 48 }}>
              {busy ? <CircularProgress size={22} color="inherit" /> : mode === "login" ? "Anmelden" : "Konto erstellen"}
            </Button>
          </Box>
        </Box>
      </Box>
    </Box>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginView />
    </Suspense>
  );
}
