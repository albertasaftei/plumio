import { createSignal, createEffect, onMount } from "solid-js";

export type Theme = "light" | "dark";

const THEME_STORAGE_KEY = "plumio-theme";

// Create a signal for the theme state
const [theme, setTheme] = createSignal<Theme>("dark");

/**
 * Initialize theme from localStorage or system preference
 */
export function initializeTheme() {
  // Try to get theme from localStorage
  const savedTheme = localStorage.getItem(THEME_STORAGE_KEY) as Theme | null;

  if (savedTheme && (savedTheme === "light" || savedTheme === "dark")) {
    setTheme(savedTheme);
  } else {
    // Fall back to system preference
    const prefersDark = window.matchMedia(
      "(prefers-color-scheme: dark)",
    ).matches;
    setTheme(prefersDark ? "dark" : "light");
  }

  // Apply theme to document
  applyTheme(theme());
}

/**
 * Apply theme class to document root
 */
function applyTheme(newTheme: Theme) {
  const root = document.documentElement;

  if (newTheme === "dark") {
    root.classList.add("dark");
    root.classList.remove("light");
  } else {
    root.classList.add("light");
    root.classList.remove("dark");
  }
}

/**
 * Toggle between light and dark theme
 */
export function toggleTheme() {
  const newTheme = theme() === "dark" ? "light" : "dark";
  setTheme(newTheme);
  localStorage.setItem(THEME_STORAGE_KEY, newTheme);
  applyTheme(newTheme);
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
