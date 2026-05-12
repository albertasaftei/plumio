"use strict";

/**
 * Bundles the Hono backend into a single CJS file for use by the Electron
 * utility process.  Native modules (better-sqlite3, bcrypt) are left as
 * external `require()` calls so they can be rebuilt against Electron's Node
 * ABI by @electron/rebuild.
 *
 * Also copies schema.sql into dist/ so the bundle's __dirname-relative read
 * of "schema.sql" resolves correctly at runtime.
 */

const esbuild = require("esbuild");
const { copyFileSync, mkdirSync } = require("fs");
const { join } = require("path");

const root = join(__dirname, "..");
const backendSrc = join(root, "..", "backend", "src");

mkdirSync(join(root, "dist"), { recursive: true });

esbuild
  .build({
    entryPoints: [join(backendSrc, "index.ts")],
    bundle: true,
    platform: "node",
    format: "cjs",
    outfile: join(root, "dist", "backend.cjs"),
    // Leave native modules as external — they are installed in desktop/node_modules/
    // and rebuilt for Electron's Node ABI by @electron/rebuild.
    external: ["better-sqlite3", "bcrypt"],
    tsconfig: join(root, "..", "backend", "tsconfig.json"),
    logLevel: "info",
    // import.meta.url is an ESM-only feature.  When esbuild bundles ESM → CJS
    // it does NOT auto-shim it, so we inject a single definition at the top of
    // the bundle and replace every `import.meta.url` occurrence with it.
    banner: {
      js: [
        // Shim import.meta.url for ESM→CJS bundles
        'const __esm_import_meta_url = require("url").pathToFileURL(__filename).href;',
        // Inject the unpacked node_modules into Node's global module search
        // paths BEFORE any require() call runs.  This ensures better-sqlite3
        // and bcrypt are found from app.asar.unpacked/node_modules/ in packaged
        // builds on both macOS and Windows, without relying on NODE_PATH being
        // read correctly by the utility process.
        "(function () {",
        '  const _mod = require("module");',
        '  const _np = require("path").resolve(__dirname, "..", "node_modules");',
        "  if (!_mod.globalPaths.includes(_np)) _mod.globalPaths.unshift(_np);",
        "})();",
      ].join("\n"),
    },
    define: {
      "import.meta.url": "__esm_import_meta_url",
    },
  })
  .then(() => {
    // schema.sql is read at runtime via fs.readFileSync(__dirname + '/schema.sql')
    // so it must live beside backend.cjs in dist/.
    copyFileSync(
      join(backendSrc, "db", "schema.sql"),
      join(root, "dist", "schema.sql"),
    );
    console.log("✅  Backend bundle ready at dist/backend.cjs");
  })
  .catch((err) => {
    console.error("❌  Backend bundle failed:", err.message);
    process.exit(1);
  });
