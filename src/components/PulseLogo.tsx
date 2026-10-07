import Box from "@mui/material/Box";

/** Pulse mark: a radar sweep with a pulse line, on an M3 primary container. */
export function PulseMark({ size = 36 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" role="img" aria-label="Pulse">
      <rect width="48" height="48" rx="14" fill="var(--md-primary)" />
      <circle cx="24" cy="24" r="15" fill="none" stroke="var(--md-on-primary)" strokeOpacity=".28" strokeWidth="2" />
      <circle cx="24" cy="24" r="8.5" fill="none" stroke="var(--md-on-primary)" strokeOpacity=".45" strokeWidth="2" />
      <path
        d="M7 25h8.5l3.2-7.5 5.6 15 4-10.5 2.4 3H41"
        fill="none"
        stroke="var(--md-on-primary)"
        strokeWidth="3.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="41" cy="25" r="2.6" fill="var(--md-on-primary)" />
    </svg>
  );
}

/** Mark plus wordmark. */
export function PulseLogo({ size = 36, wordmark = true }: { size?: number; wordmark?: boolean }) {
  return (
    <Box sx={{ display: "inline-flex", alignItems: "center", gap: 1.25 }}>
      <PulseMark size={size} />
      {wordmark ? (
        <Box sx={{ display: "flex", flexDirection: "column", lineHeight: 1 }}>
          <Box component="span" sx={{ fontSize: 20, fontWeight: 600, letterSpacing: -0.3, color: "var(--md-on-surface)", lineHeight: 1.1 }}>
            Pulse
          </Box>
          <Box component="span" sx={{ fontSize: 11, fontWeight: 500, letterSpacing: 0.4, color: "var(--md-on-surface-variant)", lineHeight: 1.3 }}>
            Brand Monitoring
          </Box>
        </Box>
      ) : null}
    </Box>
  );
}
