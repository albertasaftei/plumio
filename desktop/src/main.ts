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
import { autoUpdater } from "electron-updater";
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
): Promise<void> {
  for (let i = 0; i < retries; i++) {
    // If the process already exited, stop waiting immediately
    if (backendExited) break;
    try {
      const res = await fetch(`http://127.0.0.1:${port}/api/health`);
      if (res.ok) return;
    } catch {
      // not ready yet — keep polling
    }
    await new Promise((r) => setTimeout(r, delayMs));
  }
  console.warn(
    "[desktop] Backend did not respond in time — opening window anyway",
  );
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

async function startBackend(): Promise<void> {
  const userData = app.getPath("userData");
  backendPort = await findFreePort(47147);

  // Inherit the parent process environment so that native modules (better-sqlite3,
  // bcrypt) can find their DLLs/dylibs via PATH, and so that OS-level env vars
  // like TEMP/TMP (Windows) and HOME (macOS/Linux) are available.
  // We then override only the keys specific to the embedded backend.
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
    // Explicitly add the unpacked node_modules to NODE_PATH so that
    // require('better-sqlite3') and require('bcrypt') resolve correctly
    // in the utility process on all platforms (especially Windows).
    NODE_PATH: isDev
      ? path.join(__dirname, "..", "node_modules")
      : getUnpackedPath("node_modules"),
  };

  console.log("[desktop] Backend entry:", backendEntry);

  backendExited = false;
  backendProcess = utilityProcess.fork(backendEntry, [], {
    serviceName: "plumio-backend",
    env,
    stdio: "pipe",
  });

  backendProcess.stdout?.on("data", (d: Buffer) =>
    console.log("[backend]", d.toString().trim()),
  );
  backendProcess.stderr?.on("data", (d: Buffer) =>
    console.error("[backend]", d.toString().trim()),
  );

  backendProcess.on("exit", (code) => {
    backendExited = true;
    if (code !== 0) {
      console.error(`[desktop] Backend exited with code ${code}`);
      mainWindow?.webContents.executeJavaScript(
        `console.error("[plumio] Backend process exited with code ${code}. Check that native modules were rebuilt for Electron.")`,
      );
    }
  });

  await waitForBackend(backendPort);

  if (backendExited) {
    // Process crashed before it became healthy — show a native error dialog
    // so the user isn't staring at a silent "connection refused" screen.
    dialog.showErrorBox(
      "Plumio — Backend Failed to Start",
      "The embedded backend process exited unexpectedly.\n\n" +
        "Open DevTools (Ctrl+Shift+I) and check the Console for the error details.\n\n" +
        "Common causes:\n" +
        "\u2022 Missing Visual C++ Redistributable (Windows)\n" +
        "\u2022 Native modules not rebuilt for this Electron version",
    );
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
    const cleanUrl = url.replace(/\/+$/, "");
    writeConfig({ mode: "remote", remoteUrl: cleanUrl });
    currentConfig = { mode: "remote", remoteUrl: cleanUrl };
    mainWindow?.loadURL(cleanUrl);
  });

  ipcMain.on("use-local-mode", async () => {
    writeConfig({ mode: "local" });
    currentConfig = { mode: "local" };
    // Backend is already running (we start it proactively on first launch).
    mainWindow?.loadURL("app://plumio/");
  });

  ipcMain.on("clear-server-config", () => {
    clearConfig();
    currentConfig = null;
    // Return to the connect screen.
    mainWindow?.loadURL("app://plumio/connect/");
  });

  // ── Protocol: serve connect screen + SPA ──────────────────────────────────

  protocol.handle("app", (request) => {
    const url = new URL(request.url);
    const pathname = url.pathname;

    // /connect/ → connect screen files
    if (pathname.startsWith("/connect")) {
      const relPath =
        pathname === "/connect" || pathname === "/connect/"
          ? "index.html"
          : pathname.replace(/^\/connect\/?/, "");
      const filePath = path.join(connectDir, relPath || "index.html");
      if (fs.existsSync(filePath)) {
        return electronNet.fetch(pathToFileURL(filePath).href);
      }
    }

    // Everything else → SPA (fall back to index.html for client-side routing)
    const spaPath = pathname === "/" ? "index.html" : pathname;
    let filePath = path.join(spaDir, spaPath);
    if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
      filePath = path.join(spaDir, "index.html");
    }
    return electronNet.fetch(pathToFileURL(filePath).href);
  });

  // ── Start the right backend / URL based on saved config ───────────────────

  createWindow();

  if (currentConfig?.mode === "remote" && currentConfig.remoteUrl) {
    // Remote mode: navigate directly to the saved server — no local backend needed.
    console.log(`[desktop] Remote mode → ${currentConfig.remoteUrl}`);
    mainWindow!.loadURL(currentConfig.remoteUrl);
  } else {
    // Local mode OR first launch: start the embedded backend.
    // On first launch we keep the backend running so that if the user picks
    // "local" on the connect screen it's already ready.
    await startBackend();

    if (currentConfig?.mode === "local") {
      mainWindow!.loadURL("app://plumio/");
    } else {
      // First launch — show connect screen.
      mainWindow!.loadURL("app://plumio/connect/");
    }
  }

  // Auto-update: only runs in packaged builds.
  // On macOS Squirrel.Mac requires code-signing — if the build is unsigned the
  // check throws harmlessly and the app continues to work normally.
  if (!isDev) {
    try {
      autoUpdater.checkForUpdatesAndNotify();
    } catch (err) {
      console.warn(
        "[desktop] Auto-update check skipped:",
        (err as Error).message,
      );
    }
  }

  // macOS: re-create the window when the dock icon is clicked and no windows are open
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

app.on("will-quit", () => {
  backendProcess?.kill();
});
