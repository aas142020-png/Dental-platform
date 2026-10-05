/**
 * Neutral placeholder tokens. No brand decided yet.
 * Components must use semantic names (surface, text, accent), never raw values,
 * so a brand palette and a dark theme can be swapped in without touching components.
 * The same object is consumable by a future React Native app.
 */
export const color = {
  light: {
    surface: "#FFFFFF",
    surfaceMuted: "#F4F5F7",
    border: "#D9DCE1",
    text: "#1A1D23",
    textMuted: "#5B616E",
    accent: "#2F5D8C",
    accentContrast: "#FFFFFF",
    warning: "#9A5B00",
    danger: "#B3261E",
    success: "#2E7D4F",
  },
  // Defined for compatibility only. Dark mode is not enabled in Sprint 1.
  dark: {
    surface: "#14161A",
    surfaceMuted: "#1D2026",
    border: "#30343C",
    text: "#ECEEF1",
    textMuted: "#A3A9B5",
    accent: "#8DB4DE",
    accentContrast: "#0E1A27",
    warning: "#E0A84A",
    danger: "#F2867E",
    success: "#7CC79A",
  },
} as const;

export const space = { 0: 0, 1: 4, 2: 8, 3: 12, 4: 16, 5: 24, 6: 32, 7: 48, 8: 64 } as const;
export const radius = { sm: 4, md: 8, lg: 12 } as const;
export const breakpoint = { tablet: 768, desktop: 1280 } as const;
export const touchTarget = 44;
