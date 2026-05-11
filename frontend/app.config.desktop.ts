import { defineConfig } from "@solidjs/start/config";
import UnoCSS from "unocss/vite";

const ATLASKIT_PACKAGES = [
  "@atlaskit/pragmatic-drag-and-drop",
  "@atlaskit/pragmatic-drag-and-drop-hitbox",
];

// SPA/static build — no server-side rendering.
// Used by the Electron desktop wrapper; the Hono backend runs as a separate
// child process and is discovered at runtime via window.__plumio__.backendUrl.
export default defineConfig({
  ssr: false,
  vite: {
    plugins: [UnoCSS()],
    ssr: {
      noExternal: ATLASKIT_PACKAGES,
    },
  },
  server: {
    preset: "static",
    externals: {
      inline: ATLASKIT_PACKAGES,
    },
  },
});
