"use client";
import { createTheme } from "@mui/material/styles";

/**
 * MUI theme mapped onto Material Design 3: M3 color roles, shape scale
 * (full-rounded buttons, 12–28 px containers), type scale and state layers.
 */

const v = (name: string) => `var(--md-${name})`;

export const theme = createTheme({
  cssVariables: { colorSchemeSelector: "class" },
  colorSchemes: {
    light: {
      palette: {
        primary: { main: "#415f91", contrastText: "#ffffff" },
        secondary: { main: "#565f71" },
        error: { main: "#ba1a1a" },
        success: { main: "#2e6b3a" },
        warning: { main: "#7c5800" },
        background: { default: "#f9f9ff", paper: "#f9f9ff" },
        text: { primary: "#191c20", secondary: "#44474e" },
        divider: "#c4c6d0",
      },
    },
    dark: {
      palette: {
        primary: { main: "#aac7ff", contrastText: "#0a305f" },
        secondary: { main: "#bec6dc" },
        error: { main: "#ffb4ab" },
        success: { main: "#96d59b" },
        warning: { main: "#f0bf6c" },
        background: { default: "#111318", paper: "#111318" },
        text: { primary: "#e2e2e9", secondary: "#c4c6d0" },
        divider: "#44474e",
      },
    },
  },
  shape: { borderRadius: 4 }, // sx multiples: 2 = 8px, 3 = 12px, 4 = 16px, 7 = 28px
  typography: {
    fontFamily: "var(--font-roboto-flex), Roboto, system-ui, sans-serif",
    // M3 type scale
    h1: { fontSize: 57, lineHeight: "64px", fontWeight: 400, letterSpacing: -0.25 },
    h2: { fontSize: 45, lineHeight: "52px", fontWeight: 400 },
    h3: { fontSize: 36, lineHeight: "44px", fontWeight: 400 },
    h4: { fontSize: 32, lineHeight: "40px", fontWeight: 400 },
    h5: { fontSize: 28, lineHeight: "36px", fontWeight: 400 },
    h6: { fontSize: 22, lineHeight: "28px", fontWeight: 400 },
    subtitle1: { fontSize: 16, lineHeight: "24px", fontWeight: 500, letterSpacing: 0.15 },
    subtitle2: { fontSize: 14, lineHeight: "20px", fontWeight: 500, letterSpacing: 0.1 },
    body1: { fontSize: 16, lineHeight: "24px", letterSpacing: 0.5 },
    body2: { fontSize: 14, lineHeight: "20px", letterSpacing: 0.25 },
    caption: { fontSize: 12, lineHeight: "16px", letterSpacing: 0.4 },
    button: { fontSize: 14, lineHeight: "20px", fontWeight: 500, letterSpacing: 0.1, textTransform: "none" },
    overline: { fontSize: 11, lineHeight: "16px", fontWeight: 500, letterSpacing: 0.5, textTransform: "none" },
  },
  components: {
    MuiButton: {
      defaultProps: { disableElevation: true },
      styleOverrides: {
        root: { borderRadius: 100, paddingInline: 24, minHeight: 40 },
        sizeSmall: { paddingInline: 16, minHeight: 32 },
        outlined: { borderColor: v("outline") },
      },
    },
    MuiIconButton: { styleOverrides: { root: { borderRadius: 100 } } },
    MuiFab: {
      styleOverrides: {
        root: {
          borderRadius: 16,
          boxShadow: "0 1px 3px 1px rgba(0,0,0,.15), 0 1px 2px rgba(0,0,0,.3)",
          backgroundColor: v("primary-container"),
          color: v("on-primary-container"),
          textTransform: "none",
          "&:hover": { backgroundColor: v("primary-container"), filter: "brightness(0.96)" },
        },
      },
    },
    MuiCard: {
      defaultProps: { elevation: 0 },
      styleOverrides: { root: { borderRadius: 12, backgroundColor: v("surface-container-low"), backgroundImage: "none" } },
    },
    MuiPaper: { styleOverrides: { root: { backgroundImage: "none" } } },
    MuiChip: {
      styleOverrides: {
        root: { borderRadius: 8, fontWeight: 500, letterSpacing: 0.1 },
        outlined: { borderColor: v("outline-variant") },
      },
    },
    MuiDialog: {
      styleOverrides: { paper: { borderRadius: 28, backgroundColor: v("surface-container-high") } },
    },
    MuiDrawer: {
      styleOverrides: { paper: { backgroundColor: v("surface-container-low"), borderColor: v("outline-variant") } },
    },
    MuiTextField: { defaultProps: { variant: "outlined" } },
    MuiOutlinedInput: {
      styleOverrides: {
        root: { borderRadius: 4 },
        notchedOutline: { borderColor: v("outline") },
      },
    },
    MuiTooltip: {
      styleOverrides: {
        tooltip: { backgroundColor: v("inverse-surface"), color: v("inverse-on-surface"), fontSize: 12, borderRadius: 4 },
      },
    },
    MuiSnackbarContent: {
      styleOverrides: {
        root: { backgroundColor: v("inverse-surface"), color: v("inverse-on-surface"), borderRadius: 4 },
      },
    },
    MuiLinearProgress: { styleOverrides: { root: { borderRadius: 4, height: 4 } } },
    MuiSwitch: {
      styleOverrides: {
        root: { width: 64, height: 40, padding: 6 },
        switchBase: {
          padding: 10,
          "&.Mui-checked": { transform: "translateX(24px)", color: v("on-primary") },
          "&.Mui-checked + .MuiSwitch-track": { backgroundColor: v("primary"), opacity: 1 },
        },
        thumb: { width: 20, height: 20, boxShadow: "none" },
        track: { borderRadius: 14, backgroundColor: v("surface-container-highest"), border: `2px solid ${v("outline")}`, opacity: 1 },
      },
    },
  },
});
