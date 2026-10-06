"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import IconButton from "@mui/material/IconButton";
import Tooltip from "@mui/material/Tooltip";
import Fab from "@mui/material/Fab";
import Badge from "@mui/material/Badge";
import CircularProgress from "@mui/material/CircularProgress";
import { useColorScheme } from "@mui/material/styles";
import DashboardOutlined from "@mui/icons-material/SpaceDashboardOutlined";
import Dashboard from "@mui/icons-material/SpaceDashboard";
import ForumOutlined from "@mui/icons-material/ForumOutlined";
import Forum from "@mui/icons-material/Forum";
import FlagOutlined from "@mui/icons-material/FlagOutlined";
import Flag from "@mui/icons-material/Flag";
import TuneOutlined from "@mui/icons-material/TuneOutlined";
import Tune from "@mui/icons-material/Tune";
import Refresh from "@mui/icons-material/Refresh";
import DarkMode from "@mui/icons-material/DarkModeOutlined";
import LightMode from "@mui/icons-material/LightModeOutlined";
import { useData } from "./DataProvider";
import { MentionDetail } from "./MentionDetail";
import { PulseLogo } from "./PulseLogo";

const NAV = [
  { href: "/", label: "Übersicht", icon: DashboardOutlined, activeIcon: Dashboard },
  { href: "/erwaehnungen", label: "Erwähnungen", icon: ForumOutlined, activeIcon: Forum },
  { href: "/handlungsbedarf", label: "Handlungsbedarf", shortLabel: "Aufgaben", icon: FlagOutlined, activeIcon: Flag },
  { href: "/einstellungen", label: "Einstellungen", icon: TuneOutlined, activeIcon: Tune },
];

function useOpenActions() {
  const { mentions } = useData();
  return mentions.filter((m) => m.analysis?.actionRequired && m.status === "open" && m.analysis.relevance >= 40).length;
}

function ThemeToggle() {
  const { mode, systemMode, setMode } = useColorScheme();
  const resolved = mode === "system" ? systemMode : mode;
  if (!resolved) return <Box sx={{ width: 40 }} />;
  const next = resolved === "dark" ? "light" : "dark";
  return (
    <Tooltip title={next === "dark" ? "Dunkles Design" : "Helles Design"}>
      <IconButton onClick={() => setMode(next)} aria-label="Design wechseln">
        {resolved === "dark" ? <LightMode /> : <DarkMode />}
      </IconButton>
    </Tooltip>
  );
}

function RefreshButton() {
  const { refresh, refreshing } = useData();
  return (
    <Tooltip title="Neue Erwähnungen suchen">
      <span>
        <IconButton onClick={refresh} disabled={refreshing} aria-label="Neue Erwähnungen suchen">
          {refreshing ? <CircularProgress size={20} /> : <Refresh />}
        </IconButton>
      </span>
    </Tooltip>
  );
}

const isActive = (pathname: string, href: string) => (href === "/" ? pathname === "/" : pathname.startsWith(href));

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { settings, refresh, refreshing } = useData();
  const openActions = useOpenActions();

  // Source preview pages render without the app chrome.
  if (pathname.startsWith("/quelle/")) return <>{children}</>;

  return (
    <Box sx={{ display: "flex", minHeight: "100dvh", bgcolor: "var(--md-surface)" }}>
      {/* Navigation rail (≥ 900 px) */}
      <Box
        component="nav"
        aria-label="Hauptnavigation"
        sx={{
          display: { xs: "none", md: "flex" },
          flexDirection: "column",
          alignItems: "center",
          width: 88,
          flexShrink: 0,
          position: "sticky",
          top: 0,
          height: "100dvh",
          py: 2,
          gap: 1.5,
          bgcolor: "var(--md-surface)",
        }}
      >
        <Box sx={{ mb: 1 }}>
          <PulseLogo size={36} />
        </Box>
        <Tooltip title="Neue Erwähnungen suchen" placement="right">
          <Fab size="medium" onClick={refresh} disabled={refreshing} aria-label="Neue Erwähnungen suchen" sx={{ mb: 3 }}>
            {refreshing ? <CircularProgress size={22} /> : <Refresh />}
          </Fab>
        </Tooltip>
        {NAV.map((item) => {
          const active = isActive(pathname, item.href);
          const Icon = active ? item.activeIcon : item.icon;
          return (
            <Box
              key={item.href}
              component={Link}
              href={item.href}
              aria-current={active ? "page" : undefined}
              sx={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 0.5,
                textDecoration: "none",
                color: active ? "var(--md-on-surface)" : "var(--md-on-surface-variant)",
                width: 80,
                "&:hover .indicator": { bgcolor: active ? undefined : "var(--md-surface-container-highest)" },
              }}
            >
              <Box
                className="indicator"
                sx={{
                  width: 56,
                  height: 32,
                  borderRadius: 16,
                  display: "grid",
                  placeItems: "center",
                  bgcolor: active ? "var(--md-secondary-container)" : "transparent",
                  color: active ? "var(--md-on-secondary-container)" : "inherit",
                  transition: "background-color .2s",
                }}
              >
                <Badge color="error" badgeContent={item.href === "/handlungsbedarf" ? openActions : 0} max={99}>
                  <Icon fontSize="small" />
                </Badge>
              </Box>
              <Typography variant="caption" sx={{ fontWeight: active ? 700 : 500, textAlign: "center", lineHeight: "16px" }}>
                {item.shortLabel ?? item.label}
              </Typography>
            </Box>
          );
        })}
      </Box>

      <Box sx={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column" }}>
        {/* Top app bar */}
        <Box
          component="header"
          sx={{
            position: "sticky",
            top: 0,
            zIndex: 10,
            display: "flex",
            alignItems: "center",
            gap: 1,
            px: { xs: 2, md: 3 },
            height: 64,
            bgcolor: "var(--md-surface)",
            borderBottom: { xs: "1px solid var(--md-outline-variant)", md: "none" },
          }}
        >
          <Box sx={{ display: { xs: "block", md: "none" } }}>
            <PulseLogo size={28} />
          </Box>
          <Box sx={{ minWidth: 0, flex: 1 }}>
            <Typography variant="caption" sx={{ color: "var(--md-on-surface-variant)", display: "block", lineHeight: 1.2 }}>
              Pulse · Brand Monitoring
            </Typography>
            <Typography variant="h6" noWrap sx={{ lineHeight: 1.25, fontSize: { xs: 18, md: 22 } }}>
              {settings?.brand ?? " "}
            </Typography>
          </Box>
          <Box sx={{ display: { xs: "block", md: "none" } }}>
            <RefreshButton />
          </Box>
          <ThemeToggle />
        </Box>

        <Box component="main" sx={{ flex: 1, px: { xs: 2, md: 3 }, pt: { xs: 2, md: 1 }, pb: { xs: 13, md: 4 }, maxWidth: 1440, width: "100%", mx: "auto" }}>
          {children}
        </Box>
      </Box>

      {/* Navigation bar (< 900 px) */}
      <Box
        component="nav"
        aria-label="Hauptnavigation"
        sx={{
          display: { xs: "flex", md: "none" },
          position: "fixed",
          bottom: 0,
          left: 0,
          right: 0,
          zIndex: 20,
          height: 80,
          pb: "env(safe-area-inset-bottom)",
          bgcolor: "var(--md-surface-container)",
          justifyContent: "space-around",
          alignItems: "center",
        }}
      >
        {NAV.map((item) => {
          const active = isActive(pathname, item.href);
          const Icon = active ? item.activeIcon : item.icon;
          return (
            <Box
              key={item.href}
              component={Link}
              href={item.href}
              aria-current={active ? "page" : undefined}
              sx={{
                flex: 1,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 0.5,
                textDecoration: "none",
                color: active ? "var(--md-on-surface)" : "var(--md-on-surface-variant)",
                WebkitTapHighlightColor: "transparent",
              }}
            >
              <Box
                sx={{
                  width: 64,
                  height: 32,
                  borderRadius: 16,
                  display: "grid",
                  placeItems: "center",
                  bgcolor: active ? "var(--md-secondary-container)" : "transparent",
                  color: active ? "var(--md-on-secondary-container)" : "inherit",
                  transition: "background-color .2s",
                }}
              >
                <Badge color="error" badgeContent={item.href === "/handlungsbedarf" ? openActions : 0} max={99}>
                  <Icon />
                </Badge>
              </Box>
              <Typography variant="caption" sx={{ fontWeight: active ? 700 : 500 }}>
                {item.shortLabel ?? item.label}
              </Typography>
            </Box>
          );
        })}
      </Box>

      <MentionDetail />
    </Box>
  );
}
