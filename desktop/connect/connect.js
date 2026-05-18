/**
 * Plumio Desktop — Connect to Server
 *
 * Mirrors mobile/dist-cap/connect.js but uses Electron IPC (via contextBridge)
 * instead of Capacitor Preferences for storage and navigation.
 *
 * Platform adapter pattern: the "Platform" object below is the only part that
 * differs from the mobile implementation. When the mobile branch merges, the
 * core logic (health check, form handling, auto-connect) stays identical.
 */

const HEALTH_TIMEOUT_MS = 8000;

// ── Platform adapter (Electron IPC) ─────────────────────────────────────────
// On mobile this adapter wraps Capacitor Preferences + window.location.replace.
// Here it wraps window.__plumio__ contextBridge calls.

const Platform = {
  /** Return the previously saved remote server URL, or null. */
  getSavedUrl() {
    return window.__plumio__?.savedRemoteUrl ?? null;
  },

  /** Navigate to the remote server and persist the URL. */
  connectToServer(url) {
    window.__plumio__.connectToServer(url);
  },

  /** Stay on the local embedded backend and persist the choice. */
  useLocalMode() {
    window.__plumio__.useLocalMode();
  },

  /** Forget the saved server URL (returns to connect screen on next launch). */
  clearSavedUrl() {
    window.__plumio__.clearServerConfig();
  },
};

// ── Health check (identical to mobile) ──────────────────────────────────────

async function checkServerHealth(serverUrl) {
  const url = serverUrl.replace(/\/+$/, "");
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), HEALTH_TIMEOUT_MS);

  try {
    const res = await fetch(`${url}/api/health`, {
      method: "GET",
      signal: controller.signal,
      headers: { Accept: "application/json" },
    });

    if (!res.ok) {
      return { ok: false, error: `Server returned ${res.status}` };
    }

    const data = await res.json();
    if (!data || data.status !== "ok") {
      return { ok: false, error: "Unexpected response from server" };
    }

    return { ok: true, version: data.appVersion || "unknown" };
  } catch (err) {
    if (err.name === "AbortError") {
      return { ok: false, error: "Connection timed out" };
    }
    return {
      ok: false,
      error: "Could not reach server. Check the URL and try again.",
    };
  } finally {
    clearTimeout(timeout);
  }
}

// ── UI elements ──────────────────────────────────────────────────────────────

const tabLocal = document.getElementById("tab-local");
const tabRemote = document.getElementById("tab-remote");
const panelLocal = document.getElementById("panel-local");
const panelRemote = document.getElementById("panel-remote");
const localBtn = document.getElementById("local-btn");

const form = document.getElementById("connect-form");
const urlInput = document.getElementById("server-url");
const errorEl = document.getElementById("error-message");
const connectBtn = document.getElementById("connect-btn");
const btnText = connectBtn?.querySelector(".btn-text");
const btnSpinner = connectBtn?.querySelector(".btn-spinner");
const clearBtn = document.getElementById("clear-btn");

// ── Tab switching ────────────────────────────────────────────────────────────

function switchTab(tab) {
  const isRemote = tab === "remote";
  tabLocal.classList.toggle("active", !isRemote);
  tabRemote.classList.toggle("active", isRemote);
  tabLocal.setAttribute("aria-selected", String(!isRemote));
  tabRemote.setAttribute("aria-selected", String(isRemote));
  panelLocal.classList.toggle("hidden", isRemote);
  panelRemote.classList.toggle("hidden", !isRemote);
  hideError();
}

tabLocal.addEventListener("click", () => switchTab("local"));
tabRemote.addEventListener("click", () => switchTab("remote"));

// ── Error / loading helpers (identical to mobile) ───────────────────────────

function showError(msg) {
  errorEl.textContent = msg;
  errorEl.hidden = false;
}

function hideError() {
  errorEl.hidden = true;
  errorEl.textContent = "";
}

function setLoading(loading) {
  if (connectBtn) connectBtn.disabled = loading;
  if (urlInput) urlInput.disabled = loading;
  if (btnText) btnText.textContent = loading ? "Connecting…" : "Connect";
  if (btnSpinner) btnSpinner.hidden = !loading;
}

// ── Local mode button ────────────────────────────────────────────────────────

localBtn.addEventListener("click", () => {
  localBtn.disabled = true;
  localBtn.textContent = "Starting…";
  Platform.useLocalMode();
  // Main process navigates the window — no further action needed here.
});

// ── Remote form submission (identical logic to mobile) ───────────────────────

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  hideError();

  let url = urlInput.value.trim();
  if (!url) return;

  // Auto-prepend https:// if no scheme provided
  if (!/^https?:\/\//i.test(url)) {
    url = `https://${url}`;
    urlInput.value = url;
  }

  // Basic URL validation
  try {
    new URL(url);
  } catch {
    showError("Please enter a valid URL");
    return;
  }

  setLoading(true);

  const result = await checkServerHealth(url);

  if (result.ok) {
    Platform.connectToServer(url);
    // Main process navigates the window — no further action needed here.
  } else {
    setLoading(false);
    showError(result.error);
  }
});

// ── Clear saved server ───────────────────────────────────────────────────────

clearBtn?.addEventListener("click", () => {
  Platform.clearSavedUrl();
  urlInput.value = "";
  urlInput.focus();
  hideError();
});

// ── Auto-connect on launch (identical logic to mobile) ───────────────────────

async function init() {
  // If the user opened this screen intentionally (menu → Change Server),
  // skip auto-connect so they can choose a different server.
  const params = new URLSearchParams(window.location.search);
  if (params.has("change")) return;

  const savedUrl = Platform.getSavedUrl();

  if (savedUrl) {
    // Pre-fill and switch to remote tab
    switchTab("remote");
    urlInput.value = savedUrl;
    setLoading(true);

    const result = await checkServerHealth(savedUrl);

    if (result.ok) {
      Platform.connectToServer(savedUrl);
      return; // Window will navigate away
    }

    // Server unreachable — let user fix or clear
    setLoading(false);
    showError(
      `Could not reach ${savedUrl}. The server may be offline or the URL may have changed.`,
    );
  }
}

init();
