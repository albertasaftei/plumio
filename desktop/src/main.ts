import {
  app,
  BrowserWindow,
  ipcMain,
  protocol,
  net as electronNet,
  utilityProcess,
  Menu,
  dialog,
} from "electron";
import type { UtilityProcess } from "electron";
import path from "path";
import fs from "fs";
import crypto from "crypto";
import { pathToFileURL } from "url";
import nodeNet from "net";

const isDev = !app.isPackaged;

// ── Path helpers ──────────────────────────────────────────────────────────────

/**
 * In a packaged app, asarUnpack'd files live at app.asar.unpacked/ rather than
 * inside the asar virtual filesystem.  Processes spawned via utilityProcess
 * have no asar support, so we must hand them the real, unpacked path.
 */
function getUnpackedPath(...parts: string[]): string {
  // app.getAppPath() returns the path to app.asar with NO trailing separator,
  // e.g. "/path/to/resources/app.asar" or "C:\path\to\resources\app.asar".
  // Replace the trailing "app.asar" with "app.asar.unpacked" so utilityProcess
  // can load the real file on disk (asar interception does not apply there).
  const base = app.getAppPath().replace(/app\.asar$/, "app.asar.unpacked");
  return path.join(base, ...parts);
}

// backend.cjs and schema.sql sit next to the compiled main.js in dist/
const backendEntry = isDev
  ? path.join(__dirname, "backend.cjs")
  : getUnpackedPath("dist", "backend.cjs");

// The SPA is served from the frontend's static build output
const spaDir = isDev
  ? path.join(__dirname, "..", "..", "frontend", ".output", "public")
  : path.join(process.resourcesPath, "frontend");

// The connect screen (mirrors mobile/dist-cap/ — platform-specific storage
// adapter is the only difference)
const connectDir = isDev
  ? path.join(__dirname, "..", "connect")
  : path.join(process.resourcesPath, "connect");

// ── Desktop config ────────────────────────────────────────────────────────────
// Persists the user's mode choice (local or remote) across launches.
// Mirrors mobile's Capacitor Preferences but stored as a JSON file in userData.

interface DesktopConfig {
  mode: "local" | "remote";
  remoteUrl?: string;
}

function getConfigPath(): string {
  return path.join(app.getPath("userData"), "desktop-config.json");
}

function readConfig(): DesktopConfig | null {
  try {
    const raw = fs.readFileSync(getConfigPath(), "utf-8");
    return JSON.parse(raw) as DesktopConfig;
  } catch {
    return null;
  }
}

function writeConfig(config: DesktopConfig): void {
  const configPath = getConfigPath();
  fs.mkdirSync(path.dirname(configPath), { recursive: true });
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2), {
    encoding: "utf-8",
    mode: 0o600,
  });
}

function clearConfig(): void {
  try {
    fs.rmSync(getConfigPath());
  } catch {
    // already gone — fine
  }
}

// ── Port helpers ──────────────────────────────────────────────────────────────

function findFreePort(start: number): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = nodeNet.createServer();
    server.listen(start, "127.0.0.1", () => {
      const { port } = server.address() as { port: number };
      server.close(() => resolve(port));
    });
    server.on("error", () => {
      findFreePort(start + 1).then(resolve, reject);
    });
  });
}

async function waitForBackend(
  port: number,
  retries = 60,
  delayMs = 500,
): Promise<boolean> {
  for (let i = 0; i < retries; i++) {
    // If the process already exited, stop waiting immediately
    if (backendExited) return false;
    try {
      const res = await fetch(`http://127.0.0.1:${port}/api/health`);
      if (res.ok) return true;
    } catch {
      // not ready yet — keep polling
    }
    await new Promise((r) => setTimeout(r, delayMs));
  }
  return false;
}

// ── Persistent JWT secret ─────────────────────────────────────────────────────

function getOrCreateSecret(userData: string): string {
  const secretFile = path.join(userData, ".desktop-secret");
  if (fs.existsSync(secretFile)) {
    return fs.readFileSync(secretFile, "utf-8").trim();
  }
  const secret = crypto.randomBytes(64).toString("hex");
  fs.mkdirSync(userData, { recursive: true });
  // mode 0o600: owner read/write only
  fs.writeFileSync(secretFile, secret, { mode: 0o600 });
  return secret;
}

// ── State ─────────────────────────────────────────────────────────────────────

let backendPort = 47147;
let backendProcess: UtilityProcess | null = null;
let backendExited = false;
let mainWindow: BrowserWindow | null = null;
let currentConfig: DesktopConfig | null = null;

// Must be called before app.whenReady()
protocol.registerSchemesAsPrivileged([
  {
    scheme: "app",
    privileges: {
      secure: true,
      standard: true,
      supportFetchAPI: true,
      corsEnabled: true,
    },
  },
]);

// ── Backend ───────────────────────────────────────────────────────────────────

// Resolve the unpacked node_modules path — used for NODE_PATH and pre-flight checks
const unpackedNodeModules = isDev
  ? path.join(__dirname, "..", "node_modules")
  : getUnpackedPath("node_modules");

function preflightCheck(): string[] {
  const missing: string[] = [];
  if (!fs.existsSync(backendEntry)) {
    missing.push(`Backend bundle: ${backendEntry}`);
  }
  const schemaPath = path.join(path.dirname(backendEntry), "schema.sql");
  if (!fs.existsSync(schemaPath)) {
    missing.push(`Schema file: ${schemaPath}`);
  }
  // Check that the better-sqlite3 native binary exists
  const bsq3Binding = path.join(
    unpackedNodeModules,
    "better-sqlite3",
    "build",
    "Release",
    "better_sqlite3.node",
  );
  if (!fs.existsSync(bsq3Binding)) {
    missing.push(`better-sqlite3 native binding: ${bsq3Binding}`);
  }
  return missing;
}

async function startBackend(): Promise<void> {
  const userData = app.getPath("userData");

  // ── Pre-flight: verify all required files exist ───────────────────────────
  const missing = preflightCheck();
  if (missing.length > 0) {
    const detail = missing.map((m) => `  • ${m}`).join("\n");
    console.error(
      `[desktop] Pre-flight check failed — missing files:\n${detail}`,
    );
    dialog.showErrorBox(
      "Plumio — Missing Files",
      "The following required files were not found in the packaged app:\n\n" +
        detail +
        "\n\nThis usually means the build did not complete correctly.\n" +
        "Please re-download Plumio or report this issue.",
    );
    throw new Error(`Preflight check failed — missing files:\n${detail}`);
  }

  backendPort = await findFreePort(47147);

  // Path for the backend to write crash diagnostics to
  const crashLogPath = path.join(userData, "backend-crash.log");

  // Inherit the parent process environment so that native modules can find
  // their DLLs/dylibs via PATH, and so that OS-level env vars like TEMP/TMP
  // (Windows) and HOME (macOS/Linux) are available.
  const parentEnv = Object.fromEntries(
    Object.entries(process.env).filter(([, v]) => v !== undefined),
  ) as Record<string, string>;

  const env: Record<string, string> = {
    ...parentEnv,
    BACKEND_INTERNAL_PORT: String(backendPort),
    DB_PATH: path.join(userData, "data", "plumio.db"),
    DOCUMENTS_PATH: path.join(userData, "documents"),
    JWT_SECRET: getOrCreateSecret(userData),
    NODE_ENV: "production",
    // Tell the backend bundle where to write crash diagnostics
    CRASH_LOG_PATH: crashLogPath,
    // Set NODE_PATH so require() can find native modules in the unpacked dir.
    // This is the standard mechanism — more reliable than module.globalPaths.
    NODE_PATH: unpackedNodeModules,
  };

  console.log("[desktop] Backend entry:", backendEntry);
  console.log("[desktop] NODE_PATH:", unpackedNodeModules);

  backendExited = false;

  // Collect backend output for diagnostics
  let backendOutput = "";
  backendProcess = utilityProcess.fork(backendEntry, [], {
    serviceName: "plumio-backend",
    env,
    stdio: "pipe",
  });

  backendProcess.stdout?.on("data", (d: Buffer) => {
    const line = d.toString().trim();
    backendOutput += line + "\n";
    console.log("[backend]", line);
  });
  backendProcess.stderr?.on("data", (d: Buffer) => {
    const line = d.toString().trim();
    backendOutput += line + "\n";
    console.error("[backend]", line);
  });

  backendProcess.on("exit", (code) => {
    backendExited = true;
    if (code !== 0) {
      console.error(`[desktop] Backend exited with code ${code}`);
    }
  });

  const healthy = await waitForBackend(backendPort);

  if (healthy) {
    console.log("[desktop] Backend is healthy on port", backendPort);
    return;
  }

  // Backend did NOT become healthy — diagnose why
  let crashDetail = "";
  try {
    if (fs.existsSync(crashLogPath)) {
      crashDetail = fs.readFileSync(crashLogPath, "utf-8").trim();
    }
  } catch {
    // ignore read errors
  }

  // Write a full diagnostic log for troubleshooting
  const diagLines = [
    `Timestamp: ${new Date().toISOString()}`,
    `Backend exited: ${backendExited}`,
    `Backend entry: ${backendEntry}`,
    `Backend entry exists: ${fs.existsSync(backendEntry)}`,
    `NODE_PATH: ${unpackedNodeModules}`,
    `NODE_PATH exists: ${fs.existsSync(unpackedNodeModules)}`,
    `Port: ${backendPort}`,
    `Crash log: ${crashDetail || "(none)"}`,
    `--- Backend output ---`,
    backendOutput || "(no output captured)",
  ];
  const diagPath = path.join(userData, "backend-diagnostic.log");
  try {
    fs.writeFileSync(diagPath, diagLines.join("\n"), "utf-8");
  } catch {
    // best effort
  }

  const errorParts: string[] = [];
  if (backendExited) {
    errorParts.push("The embedded backend process exited unexpectedly.", "");
  } else {
    errorParts.push(
      "The embedded backend process did not respond within 30 seconds.",
      "",
    );
  }

  if (crashDetail) {
    errorParts.push("Error:", crashDetail, "");
  } else if (backendOutput.trim()) {
    const lastLines = backendOutput.trim().split("\n").slice(-10).join("\n");
    errorParts.push("Backend output:", lastLines, "");
  } else {
    errorParts.push("No backend output was captured.", "");
  }

  errorParts.push(`Full diagnostic log: ${diagPath}`);

  dialog.showErrorBox(
    "Plumio — Backend Failed to Start",
    errorParts.join("\n"),
  );

  const reason = backendExited
    ? "Backend process exited unexpectedly"
    : "Backend startup timed out after 30 s";
  throw new Error(reason);
}

// ── Startup routing ─────────────────────────────────────────────────────────
// Decides which URL to load based on saved config.
// Safe to call more than once (e.g. macOS activate): startBackend() is skipped
// when a backend process is already running.

async function applyStartupRouting(): Promise<void> {
  if (currentConfig?.mode === "remote" && currentConfig.remoteUrl) {
    // Remote mode: navigate directly to the saved server — no local backend needed.
    console.log(`[desktop] Remote mode → ${currentConfig.remoteUrl}`);
    mainWindow?.loadURL(currentConfig.remoteUrl);
  } else {
    // Local mode OR first launch: ensure the embedded backend is running.
    if (!backendProcess) {
      try {
        await startBackend();
      } catch {
        // startBackend already showed an error dialog; don't load the SPA.
        return;
      }
    }
    if (currentConfig?.mode === "local") {
      mainWindow?.loadURL("app://plumio/");
    } else {
      // First launch — show connect screen.
      mainWindow?.loadURL("app://plumio/connect/");
    }
  }
}

// ── Window ────────────────────────────────────────────────────────────────────

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
    show: false,
  });

  mainWindow.once("ready-to-show", () => {
    mainWindow?.show();
  });

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

// ── Application menu ──────────────────────────────────────────────────────────

function buildMenu(): void {
  const changeServer = {
    label: "Change Server…",
    accelerator: "CmdOrCtrl+Shift+S",
    click: () => {
      clearConfig();
      currentConfig = null;
      mainWindow?.loadURL("app://plumio/connect/?change=1");
    },
  };

  const template: Electron.MenuItemConstructorOptions[] =
    process.platform === "darwin"
      ? [
          {
            label: app.name,
            submenu: [
              { role: "about" },
              { type: "separator" },
              changeServer,
              { type: "separator" },
              { role: "hide" },
              { role: "hideOthers" },
              { role: "unhide" },
              { type: "separator" },
              { role: "quit" },
            ],
          },
          { role: "editMenu" },
          { role: "viewMenu" },
          { role: "windowMenu" },
        ]
      : [
          {
            label: "File",
            submenu: [changeServer, { type: "separator" }, { role: "quit" }],
          },
          { role: "editMenu" },
          { role: "viewMenu" },
        ];

  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

// ── App lifecycle ─────────────────────────────────────────────────────────────

app.whenReady().then(async () => {
  currentConfig = readConfig();
  buildMenu();

  // ── IPC handlers ──────────────────────────────────────────────────────────

  // Synchronous reads — called from preload before the page renders.
  ipcMain.on("get-mode", (event) => {
    event.returnValue = currentConfig?.mode ?? null;
  });

  ipcMain.on("get-remote-url", (event) => {
    event.returnValue = currentConfig?.remoteUrl ?? null;
  });

  // Always return the local backend URL; the preload decides whether to use it.
  ipcMain.on("get-backend-url", (event) => {
    event.returnValue = `http://127.0.0.1:${backendPort}`;
  });

  // Async actions — called from the connect screen.

  ipcMain.on("connect-to-server", (_event, url: string) => {
    let parsed: URL;
    try {
      parsed = new URL(url);
    } catch {
      console.warn("[desktop] connect-to-server: invalid URL rejected:", url);
      return;
    }
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      console.warn(
        "[desktop] connect-to-server: non-http(s) protocol rejected:",
        parsed.protocol,
      );
      return;
    }
    const cleanUrl = url.replace(/\/+$/, "");
    writeConfig({ mode: "remote", remoteUrl: cleanUrl });
    currentConfig = { mode: "remote", remoteUrl: cleanUrl };
    mainWindow?.loadURL(cleanUrl);
  });

  ipcMain.on("use-local-mode", async () => {
    writeConfig({ mode: "local" });
    currentConfig = { mode: "local" };
    // Ensure the backend is running — it may not be if the user arrived here
    // from a previous remote-mode session via "Change Server".
    if (!backendProcess) {
      try {
        await startBackend();
      } catch {
        // startBackend already showed an error dialog; don't load the SPA.
        return;
      }
    }
    mainWindow?.loadURL("app://plumio/");
  });

  ipcMain.on("clear-server-config", () => {
    clearConfig();
    currentConfig = null;
    // Return to the connect screen.
    mainWindow?.loadURL("app://plumio/connect/");
  });

  // ── Protocol: serve connect screen + SPA ──────────────────────────────────

  const resolvedConnectDir = path.resolve(connectDir);
  const resolvedSpaDir = path.resolve(spaDir);

  protocol.handle("app", (request) => {
    const url = new URL(request.url);
    const pathname = url.pathname;

    // /connect/ → connect screen files
    if (pathname.startsWith("/connect")) {
      const relPath =
        pathname === "/connect" || pathname === "/connect/"
          ? "index.html"
          : pathname.replace(/^\/connect\/?/, "");
      const resolved = path.resolve(
        resolvedConnectDir,
        relPath || "index.html",
      );
      // Deny path traversal outside connectDir
      if (
        resolved !== resolvedConnectDir &&
        !resolved.startsWith(resolvedConnectDir + path.sep)
      ) {
        return new Response(null, { status: 403 });
      }
      if (fs.existsSync(resolved)) {
        return electronNet.fetch(pathToFileURL(resolved).href);
      }
    }

    // Everything else → SPA (fall back to index.html for client-side routing)
    const spaPath = pathname === "/" ? "index.html" : pathname;
    const resolvedSpa = path.resolve(resolvedSpaDir, spaPath);
    // Deny path traversal outside spaDir — fall back to index.html
    const spaFile =
      resolvedSpa !== resolvedSpaDir &&
      resolvedSpa.startsWith(resolvedSpaDir + path.sep) &&
      fs.existsSync(resolvedSpa) &&
      !fs.statSync(resolvedSpa).isDirectory()
        ? resolvedSpa
        : path.join(resolvedSpaDir, "index.html");
    return electronNet.fetch(pathToFileURL(spaFile).href);
  });

  // ── Start the right backend / URL based on saved config ───────────────────

  createWindow();
  await applyStartupRouting();

  // macOS: re-create the window when the dock icon is clicked and no windows are open
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
      void applyStartupRouting();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

app.on("will-quit", () => {
  backendProcess?.kill();
});
