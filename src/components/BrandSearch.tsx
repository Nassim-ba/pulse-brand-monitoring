"use client";
import { useState } from "react";
import Box from "@mui/material/Box";
import Autocomplete from "@mui/material/Autocomplete";
import InputBase from "@mui/material/InputBase";
import Typography from "@mui/material/Typography";
import Search from "@mui/icons-material/Search";
import History from "@mui/icons-material/History";
import ArrowForward from "@mui/icons-material/ArrowForward";
import IconButton from "@mui/material/IconButton";
import { brandSlug } from "@/lib/filters";
import { useData } from "./DataProvider";

/** M3 search bar: enter a brand to start monitoring it, or pick a recently searched one. */
export function BrandSearch() {
  const { meta, search, switchBrand, refreshing, settings } = useData();
  const [value, setValue] = useState("");
  const brands = meta?.brands ?? [];

  const submit = async (input: string) => {
    const name = input.trim();
    if (name.length < 2) return;
    setValue("");
    (document.activeElement as HTMLElement | null)?.blur();
    const known = brands.find((b) => b.slug === brandSlug(name));
    if (known && known.slug !== brandSlug(settings?.brand ?? "")) await switchBrand(known.slug);
    else await search(name);
  };

  return (
    <Autocomplete
      freeSolo
      options={brands.map((b) => b.name)}
      value={null}
      inputValue={value}
      onInputChange={(_, v, reason) => setValue(reason === "reset" ? "" : v)}
      blurOnSelect
      onChange={(_, v) => typeof v === "string" && submit(v)}
      disabled={refreshing}
      filterOptions={(opts, s) => opts.filter((o) => o.toLowerCase().includes(s.inputValue.toLowerCase()))}
      slotProps={{ paper: { sx: { borderRadius: 4, bgcolor: "var(--md-surface-container-high)", mt: 0.5 } } }}
      renderOption={({ key, ...props }, option) => (
        <Box component="li" key={key} {...props} sx={{ gap: 1.5 }}>
          <History fontSize="small" sx={{ color: "var(--md-on-surface-variant)" }} />
          <Typography variant="body2">{option}</Typography>
        </Box>
      )}
      sx={{ width: "100%", maxWidth: 560 }}
      renderInput={(params) => (
        <Box
          ref={params.slotProps.input.ref}
          sx={{
            display: "flex",
            alignItems: "center",
            gap: 1,
            height: 48,
            pl: 2,
            pr: 0.5,
            borderRadius: 6,
            bgcolor: "var(--md-surface-container-high)",
            "&:focus-within": { bgcolor: "var(--md-surface-container-highest)" },
          }}
        >
          <Search sx={{ color: "var(--md-on-surface-variant)" }} />
          <InputBase
            inputProps={{ ...params.slotProps.htmlInput, "aria-label": "Marke suchen und analysieren" }}
            placeholder={refreshing ? "Suche läuft …" : "Marke suchen und analysieren"}
            sx={{ flex: 1, fontSize: 16 }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && value.trim()) {
                e.preventDefault();
                submit(value);
              }
            }}
          />
          {value.trim().length >= 2 ? (
            <IconButton onClick={() => submit(value)} aria-label="Suche starten" sx={{ bgcolor: "var(--md-primary)", color: "var(--md-on-primary)", "&:hover": { bgcolor: "var(--md-primary)" } }}>
              <ArrowForward fontSize="small" />
            </IconButton>
          ) : null}
        </Box>
      )}
    />
  );
}
