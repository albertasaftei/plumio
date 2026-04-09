import { defineConfig } from "@solidjs/start/config";
import UnoCSS from "unocss/vite";

const ATLASKIT_PACKAGES = [
  "@atlaskit/pragmatic-drag-and-drop",
  "@atlaskit/pragmatic-drag-and-drop-hitbox",
];

export default defineConfig({
  vite: {
    plugins: [UnoCSS()],
    ssr: {
      noExternal: ATLASKIT_PACKAGES,
    },
  },
  server: {
    externals: {
      inline: ATLASKIT_PACKAGES,
    },
  },
});
