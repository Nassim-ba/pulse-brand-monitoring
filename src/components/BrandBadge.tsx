"use client";
import { useState } from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Skeleton from "@mui/material/Skeleton";
import { useData } from "./DataProvider";

/** Logo of the monitored brand via its domain's icon, with an initials fallback. */
export function BrandLogo({ name, domain, size = 40 }: { name: string; domain?: string; size?: number }) {
  const [failed, setFailed] = useState<string | null>(null);
  const src = domain ? `https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=128` : null;
  const initials = name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");

  return (
    <Box
      sx={{
        width: size,
        height: size,
        flexShrink: 0,
        borderRadius: 2.5,
        overflow: "hidden",
        display: "grid",
        placeItems: "center",
        bgcolor: src && failed !== src ? "#fff" : "var(--md-tertiary-container)",
        color: "var(--md-on-tertiary-container)",
        border: "1px solid var(--md-outline-variant)",
        fontWeight: 600,
        fontSize: size * 0.38,
      }}
    >
      {src && failed !== src ? (
        // eslint-disable-next-line @next/next/no-img-element -- external favicon service, no optimisation needed
        <img src={src} alt={`Logo ${name}`} width={size * 0.7} height={size * 0.7} onError={() => setFailed(src)} style={{ objectFit: "contain" }} />
      ) : (
        initials
      )}
    </Box>
  );
}

/** Shows which brand is currently monitored. */
export function BrandBadge() {
  const { settings } = useData();
  if (!settings) {
    return (
      <Box sx={{ display: "flex", alignItems: "center", gap: 1.25 }}>
        <Skeleton variant="rounded" width={40} height={40} />
        <Skeleton variant="text" width={110} />
      </Box>
    );
  }
  return (
    <Box sx={{ display: "flex", alignItems: "center", gap: 1.25, minWidth: 0 }} aria-label={`Überwachte Marke: ${settings.brand}`}>
      <BrandLogo name={settings.brand} domain={settings.domain} />
      <Box sx={{ minWidth: 0 }}>
        <Typography variant="caption" component="div" sx={{ color: "var(--md-on-surface-variant)", lineHeight: 1.2 }}>
          Überwachte Marke
        </Typography>
        <Typography variant="subtitle1" component="div" noWrap sx={{ lineHeight: 1.3, fontSize: { xs: 16, md: 17 } }}>
          {settings.brand}
        </Typography>
      </Box>
    </Box>
  );
}
