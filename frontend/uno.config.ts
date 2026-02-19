import { defineConfig } from "unocss";
import presetWind from "@unocss/preset-wind4";
import presetIcons from "@unocss/preset-icons";
import presetTypography from "@unocss/preset-typography";

export default defineConfig({
  presets: [
    presetWind(),
    presetTypography(),
    presetIcons({
      collections: {
        carbon: () =>
          import("@iconify-json/carbon/icons.json").then((i) => i.default),
      },
    }),
  ],
  darkMode: "class", // Enable class-based dark mode
  theme: {
    colors: {
      // Brand colors
      primary: {
        DEFAULT: "#2a9d8f",
        dark: "#21867a",
        light: "#3dbaa8",
      },

      // Neutral/Gray scale (dark theme)
      neutral: {
        950: "#0a0a0a", // Darkest background
        900: "#171717", // Main background, editor
        850: "#1a1a1a", // Slightly lighter
        800: "#262626", // Cards, containers
        750: "#2d2d2d", // Hover states
        700: "#404040", // Borders, dividers
        600: "#525252",
        500: "#737373",
        400: "#a3a3a3", // Secondary text
        300: "#d4d4d4",
        200: "#e5e5e5", // Main text
        100: "#f5f5f5", // Headings, emphasis
        50: "#fafafa",
      },

      // Accent colors for folders/files
      accent: {
        red: {
          DEFAULT: "#ef4444",
          bg: "rgba(239, 68, 68, 0.15)",
        },
        orange: {
          DEFAULT: "#f97316",
          bg: "rgba(249, 115, 22, 0.15)",
        },
        yellow: {
          DEFAULT: "#eab308",
          bg: "rgba(234, 179, 8, 0.15)",
        },
        green: {
          DEFAULT: "#22c55e",
          bg: "rgba(34, 197, 94, 0.15)",
        },
        blue: {
          DEFAULT: "#3b82f6",
          bg: "rgba(59, 130, 246, 0.15)",
        },
        purple: {
          DEFAULT: "#a855f7",
          bg: "rgba(168, 85, 247, 0.15)",
        },
        pink: {
          DEFAULT: "#ec4899",
          bg: "rgba(236, 72, 153, 0.15)",
        },
      },

      // Status/feedback colors
      success: {
        DEFAULT: "#22c55e",
        light: "#4ade80",
        dark: "#16a34a",
      },
      error: {
        DEFAULT: "#ef4444",
        light: "#f87171",
        dark: "#dc2626",
      },
      warning: {
        DEFAULT: "#eab308",
        light: "#facc15",
        dark: "#ca8a04",
      },
      info: {
        DEFAULT: "#3b82f6",
        light: "#60a5fa",
        dark: "#2563eb",
      },

      // Link color
      link: {
        DEFAULT: "#60a5fa",
        hover: "#93c5fd",
      },
    },
    font: {
      sans: "Inter, sans-serif",
    },
  },
});
