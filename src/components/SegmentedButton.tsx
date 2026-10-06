"use client";
import Box from "@mui/material/Box";
import ButtonBase from "@mui/material/ButtonBase";
import Check from "@mui/icons-material/Check";

/** M3 single-select segmented button. */
export function SegmentedButton<T extends string>({
  value,
  onChange,
  options,
  ariaLabel,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string }[];
  ariaLabel: string;
}) {
  return (
    <Box
      role="radiogroup"
      aria-label={ariaLabel}
      sx={{ display: "inline-flex", border: "1px solid var(--md-outline)", borderRadius: 100, overflow: "hidden", height: 40 }}
    >
      {options.map((o, i) => {
        const selected = o.value === value;
        return (
          <ButtonBase
            key={o.value}
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(o.value)}
            sx={{
              px: { xs: 1.5, sm: 2 },
              gap: 0.5,
              fontSize: 14,
              fontWeight: 500,
              letterSpacing: 0.1,
              color: selected ? "var(--md-on-secondary-container)" : "var(--md-on-surface)",
              bgcolor: selected ? "var(--md-secondary-container)" : "transparent",
              borderLeft: i ? "1px solid var(--md-outline)" : "none",
              "&:hover": { bgcolor: selected ? "var(--md-secondary-container)" : "var(--md-surface-container-high)" },
              "& svg": { fontSize: 18 },
            }}
          >
            {selected ? <Check /> : null}
            {o.label}
          </ButtonBase>
        );
      })}
    </Box>
  );
}
