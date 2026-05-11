import { contextBridge, ipcRenderer } from "electron";

// Read config synchronously at preload time so window.__plumio__ is ready
// before any renderer/SPA code runs.
const mode = ipcRenderer.sendSync("get-mode") as "local" | "remote" | null;
const savedRemoteUrl = ipcRenderer.sendSync("get-remote-url") as string | null;
const localBackendUrl = ipcRenderer.sendSync("get-backend-url") as string;

// In local mode expose the embedded backend URL.
// In remote mode expose the remote server URL so api.ts uses it directly
// (avoids the window.location.origin fallback which would be app:// — wrong).
// In unconfigured state (connect screen) expose null.
const backendUrl =
  mode === "remote"
    ? savedRemoteUrl
    : mode === "local"
      ? localBackendUrl
      : null;

contextBridge.exposeInMainWorld("__plumio__", {
  /** Current mode: 'local' | 'remote' | null (null = first launch, connect screen) */
  mode,

  /**
   * The backend URL the SPA should talk to.
   * - local mode  → http://127.0.0.1:{port}  (embedded Hono server)
   * - remote mode → the saved remote server URL
   * - null        → connect screen is showing, no backend configured yet
   */
  backendUrl,

  /** The saved remote server URL (used by the connect screen to pre-fill the input). */
  savedRemoteUrl,

  // ── Actions (called from the connect screen) ─────────────────────────────

  /** Navigate the window to a remote server and persist the choice. */
  connectToServer: (url: string) => ipcRenderer.send("connect-to-server", url),

  /** Stay on the embedded local backend and persist the choice. */
  useLocalMode: () => ipcRenderer.send("use-local-mode"),

  /** Forget the saved server config and return to the connect screen. */
  clearServerConfig: () => ipcRenderer.send("clear-server-config"),
});
