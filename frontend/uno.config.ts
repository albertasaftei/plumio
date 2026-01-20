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
      neutral: {
        950: "#0a0a0a",
      },
    },
  },
});
