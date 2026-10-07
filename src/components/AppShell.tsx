"use client";
import Link from "next/link";
import { Suspense } from "react";
import { usePathname, useSearchParams } from "next/navigation";
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
import { PulseMark } from "./PulseLogo";
import { BrandBadge } from "./BrandBadge";
import { BrandSearch } from "./BrandSearch";
import { SearchProgress } from "./SearchProgress";

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


/** Filter query params are carried along between dashboard and lists. */
function WithQuery({ render }: { render: (qs: string) => React.ReactNode }) {
  const params = useSearchParams();
  const qs = params.toString();
  return <>{render(qs ? `?${qs}` : "")}</>;
}

function RailItems({ qs }: { qs: string }) {
  const pathname = usePathname();
  const openActions = useOpenActions();
  return (
    <>
        {NAV.map((item) => {
          const active = isActive(pathname, item.href);
          const Icon = active ? item.activeIcon : item.icon;
          return (
            <Box
              key={item.href}
              component={Link}
              href={item.href === "/einstellungen" ? item.href : item.href + qs}
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
    </>
  );
}

function BarItems({ qs }: { qs: string }) {
  const pathname = usePathname();
  const openActions = useOpenActions();
  return (
    <>
        {NAV.map((item) => {
          const active = isActive(pathname, item.href);
          const Icon = active ? item.activeIcon : item.icon;
          return (
            <Box
              key={item.href}
              component={Link}
              href={item.href === "/einstellungen" ? item.href : item.href + qs}
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
    </>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const { refresh, refreshing } = useData();

  // Source preview pages render without the app chrome.

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
          <Box component={Link} href="/" aria-label="Zur Übersicht" sx={{ display: "block", lineHeight: 0 }}>
            <PulseMark size={40} />
          </Box>
        </Box>
        <Tooltip title="Neue Erwähnungen suchen" placement="right">
          <Fab size="medium" onClick={refresh} disabled={refreshing} aria-label="Neue Erwähnungen suchen" sx={{ mb: 3 }}>
            {refreshing ? <CircularProgress size={22} /> : <Refresh />}
          </Fab>
        </Tooltip>
        <Suspense fallback={<RailItems qs="" />}>
          <WithQuery render={(qs) => <RailItems qs={qs} />} />
        </Suspense>
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
            height: 72,
            bgcolor: "var(--md-surface)",
            borderBottom: { xs: "1px solid var(--md-outline-variant)", md: "none" },
          }}
        >
          <Box component={Link} href="/" aria-label="Zur Übersicht" sx={{ display: { xs: "block", md: "none" }, lineHeight: 0 }}>
            <PulseMark size={36} />
          </Box>
          <Box
            component={Link}
            href="/"
            aria-label="Zur Übersicht"
            sx={{ display: { xs: "none", md: "flex" }, flexDirection: "column", textDecoration: "none", flex: "0 0 auto", mr: 2 }}
          >
            <Box component="span" sx={{ fontSize: 22, fontWeight: 600, letterSpacing: -0.4, color: "var(--md-on-surface)", lineHeight: 1.1 }}>
              Pulse
            </Box>
            <Box component="span" sx={{ fontSize: 11, fontWeight: 500, letterSpacing: 0.5, color: "var(--md-on-surface-variant)", lineHeight: 1.3 }}>
              Brand Monitoring
            </Box>
          </Box>
          <Box sx={{ display: { xs: "none", md: "flex" }, flex: 1, justifyContent: "center", px: 2, minWidth: 0 }}>
            <BrandSearch />
          </Box>
          <Box sx={{ flex: { xs: 1, md: "0 1 auto" }, minWidth: 0, ml: { xs: 0.5, md: 0 } }}>
            <BrandBadge />
          </Box>
          <Box sx={{ display: { xs: "block", md: "none" } }}>
            <RefreshButton />
          </Box>
          <ThemeToggle />
        </Box>

        <Box component="main" sx={{ flex: 1, px: { xs: 2, md: 3 }, pt: { xs: 2, md: 1 }, pb: { xs: 13, md: 4 }, maxWidth: 1440, width: "100%", mx: "auto" }}>
          <Box sx={{ display: { xs: "block", md: "none" }, mb: 2 }}>
            <BrandSearch />
          </Box>
          <SearchProgress />
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
        <Suspense fallback={<BarItems qs="" />}>
          <WithQuery render={(qs) => <BarItems qs={qs} />} />
        </Suspense>
      </Box>

      <MentionDetail />
    </Box>
  );
}
