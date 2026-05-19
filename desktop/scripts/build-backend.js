"use strict";

/**
 * Bundles the Hono backend into a single CJS file for use by the Electron
 * utility process.  better-sqlite3 is left as an external `require()` call
 * so it can be rebuilt against Electron's Node ABI by @electron/rebuild.
 * bcryptjs is pure JS and gets bundled normally.
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
    external: ["better-sqlite3"],
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
        // is found from app.asar.unpacked/node_modules/ in packaged
        // builds on both macOS and Windows, without relying on NODE_PATH being
        // read correctly by the utility process.
        "(function () {",
        '  const _mod = require("module");',
        '  const _np = require("path").resolve(__dirname, "..", "node_modules");',
        "  if (!_mod.globalPaths.includes(_np)) _mod.globalPaths.unshift(_np);",
        "})();",
        // Top-level crash handler: catches any uncaught startup error and writes
        // a crash log to CRASH_LOG_PATH (set by the main process) so the error
        // dialog can display the real reason instead of just "exit code 1".
        "process.once('uncaughtException', function (_crashErr) {",
        "  var _msg = _crashErr && _crashErr.stack ? _crashErr.stack : String(_crashErr);",
        "  try { process.stderr.write('[backend-crash] ' + _msg + '\\n'); } catch(_) {}",
        "  if (process.env.CRASH_LOG_PATH) {",
        "    try { require('fs').writeFileSync(process.env.CRASH_LOG_PATH, _msg); } catch(_) {}",
        "  }",
        "  process.exit(1);",
        "});",
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
