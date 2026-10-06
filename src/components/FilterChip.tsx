"use client";
import { useState } from "react";
import ButtonBase from "@mui/material/ButtonBase";
import Menu from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";
import Checkbox from "@mui/material/Checkbox";
import ListItemText from "@mui/material/ListItemText";
import Check from "@mui/icons-material/Check";
import ArrowDropDown from "@mui/icons-material/ArrowDropDown";

const chipSx = (selected: boolean) => ({
  height: 32,
  px: 1.5,
  gap: 0.5,
  borderRadius: 2,
  flexShrink: 0,
  fontSize: 14,
  fontWeight: 500,
  letterSpacing: 0.1,
  whiteSpace: "nowrap" as const,
  border: selected ? "1px solid transparent" : "1px solid var(--md-outline)",
  bgcolor: selected ? "var(--md-secondary-container)" : "transparent",
  color: selected ? "var(--md-on-secondary-container)" : "var(--md-on-surface-variant)",
  "&:hover": { bgcolor: selected ? "var(--md-secondary-container)" : "var(--md-surface-container-high)" },
  "& svg": { fontSize: 18 },
});

/** M3 filter chip that toggles a boolean. */
export function ToggleChip({ label, selected, onToggle }: { label: string; selected: boolean; onToggle: () => void }) {
  return (
    <ButtonBase onClick={onToggle} aria-pressed={selected} sx={chipSx(selected)}>
      {selected ? <Check /> : null}
      {label}
    </ButtonBase>
  );
}

/** M3 filter chip with a dropdown menu (multi- or single-select). */
export function MenuChip<T extends string>({
  label,
  options,
  selected,
  onChange,
  multiple = true,
}: {
  label: string;
  options: { value: T; label: string }[];
  selected: T[];
  onChange: (v: T[]) => void;
  multiple?: boolean;
}) {
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const active = selected.length > 0;
  const text = !active
    ? label
    : selected.length === 1
      ? options.find((o) => o.value === selected[0])?.label ?? label
      : `${label} · ${selected.length}`;

  return (
    <>
      <ButtonBase onClick={(e) => setAnchor(e.currentTarget)} aria-haspopup="menu" sx={chipSx(active)}>
        {active ? <Check /> : null}
        {text}
        <ArrowDropDown />
      </ButtonBase>
      <Menu
        anchorEl={anchor}
        open={Boolean(anchor)}
        onClose={() => setAnchor(null)}
        slotProps={{ paper: { sx: { borderRadius: 1, bgcolor: "var(--md-surface-container)", minWidth: 220 } } }}
      >
        {options.map((o) => {
          const isSel = selected.includes(o.value);
          return (
            <MenuItem
              key={o.value}
              dense
              onClick={() => {
                if (multiple) onChange(isSel ? selected.filter((v) => v !== o.value) : [...selected, o.value]);
                else {
                  onChange(isSel ? [] : [o.value]);
                  setAnchor(null);
                }
              }}
            >
              {multiple ? <Checkbox size="small" checked={isSel} sx={{ p: 0.5, mr: 1 }} /> : null}
              <ListItemText primary={o.label} />
              {!multiple && isSel ? <Check fontSize="small" /> : null}
            </MenuItem>
          );
        })}
      </Menu>
    </>
  );
}
