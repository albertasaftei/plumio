import { createSignal } from "solid-js";

export type Theme =
  | "dark"
  | "light"
  | "sepia"
  | "nord"
  | "dracula"
  | "catppuccin"
  | "github"
  | "github-dark"
  | "nightowl"
  | "matcha";

/** Polarity determines which UnoCSS `dark:`/`light:` variants apply */
export type ThemePolarity = "dark" | "light";

export interface ThemeMeta {
  label: string;
  polarity: ThemePolarity;
  /** Preview swatches: [bg, surface, accent] */
  swatches: [string, string, string];
}

export const THEME_META: Record<Theme, ThemeMeta> = {
  light: {
    label: "Plumio Light",
    polarity: "light",
    swatches: ["#f5f5f5", "#ffffff", "#2a9d8f"],
  },
  sepia: {
    label: "Sepia",
    polarity: "light",
    swatches: ["#f4ecd8", "#fdf6e3", "#b5651d"],
  },
  github: {
    label: "GitHub",
    polarity: "light",
    swatches: ["#ffffff", "#f6f8fa", "#0969da"],
  },
  matcha: {
    label: "Matcha",
    polarity: "light",
    swatches: ["#f4f7f4", "#eef4ee", "#4a7c59"],
  },
  dark: {
    label: "Plumio Dark",
    polarity: "dark",
    swatches: ["#0a0a0a", "#171717", "#2a9d8f"],
  },
  nord: {
    label: "Nord",
    polarity: "dark",
    swatches: ["#2e3440", "#3b4252", "#88c0d0"],
  },
  dracula: {
    label: "Dracula",
    polarity: "dark",
    swatches: ["#1e1f29", "#282a36", "#bd93f9"],
  },
  catppuccin: {
    label: "Catppuccin",
    polarity: "dark",
    swatches: ["#1e1e2e", "#313244", "#cba6f7"],
  },
  "github-dark": {
    label: "GitHub Dark",
    polarity: "dark",
    swatches: ["#0d1117", "#161b22", "#58a6ff"],
  },
  nightowl: {
    label: "Night Owl",
    polarity: "dark",
    swatches: ["#011627", "#01223a", "#7fdbca"],
  },
};

const ALL_THEME_CLASSES: Theme[] = [
  "dark",
  "light",
  "sepia",
  "nord",
  "dracula",
  "catppuccin",
  "github",
  "github-dark",
  "nightowl",
  "matcha",
];
const VALID_THEMES = new Set<string>(ALL_THEME_CLASSES);

const THEME_STORAGE_KEY = "plumio-theme";

// Create a signal for the theme state
const [theme, setTheme] = createSignal<Theme>("dark");

/**
 * Initialize theme from localStorage or system preference
 */
export function initializeTheme() {
  const savedTheme = localStorage.getItem(THEME_STORAGE_KEY);

  if (savedTheme && VALID_THEMES.has(savedTheme)) {
    setTheme(savedTheme as Theme);
  } else {
    const prefersDark = window.matchMedia(
      "(prefers-color-scheme: dark)",
    ).matches;
    setTheme(prefersDark ? "dark" : "light");
  }

  applyTheme(theme());
}

/**
 * Apply theme classes to document root.
 * Always ensures both a polarity class (dark/light) and—when needed—
 * the theme-specific class are present on <html>, so UnoCSS variants
 * (dark: / light:) keep working across all themes.
 */
function applyTheme(newTheme: Theme) {
  const root = document.documentElement;
  const { polarity } = THEME_META[newTheme];

  // Remove all known theme + polarity classes
  root.classList.remove(...ALL_THEME_CLASSES, "dark", "light");

  // Apply base polarity so UnoCSS variants work
  root.classList.add(polarity);

  // Apply theme-specific class for custom CSS variable overrides
  if (newTheme !== "dark" && newTheme !== "light") {
    root.classList.add(newTheme);
  }
}

/**
 * Set a specific theme
 */
export function setThemeValue(newTheme: Theme) {
  setTheme(newTheme);
  localStorage.setItem(THEME_STORAGE_KEY, newTheme);
  applyTheme(newTheme);
}

/**
 * Get current theme value
 */
export function getTheme() {
  return theme();
}

/**
 * Get theme signal for reactive updates
 */
export function useTheme() {
  return [theme, setThemeValue] as const;
}
