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
  theme: {
    colors: {
      primary: "#2a9d8f",
      neutral: {
        950: "#0a0a0a",
      },
    },
    font: {
      sans: "Inter, sans-serif",
    },
  },
});
