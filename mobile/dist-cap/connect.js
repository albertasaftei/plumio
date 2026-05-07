/**
 * Plumio Mobile — Connect to Server
 *
 * Handles the "Connect to Server" flow:
 * 1. On launch, checks for a saved server URL in native Preferences.
 * 2. If found, validates it with a health-check and navigates the WebView.
 * 3. If not found (or invalid), shows the connect form.
 *
 * Uses Capacitor's Preferences plugin for persistent, native key-value storage
 * that survives WebView cache clearing.
 */

const PREF_KEY = "plumio_server_url";
const PREF_VERSION_KEY = "plumio_prefs_version";
const CURRENT_PREF_VERSION = "3"; // bump to invalidate stale saved URLs
const HEALTH_TIMEOUT_MS = 8000;

// ── Capacitor imports (loaded at runtime from the Capacitor bridge) ──────────

let Preferences;
let CapacitorApp;

async function loadCapacitorPlugins() {
  try {
    const cap = window.Capacitor;
    if (cap && cap.Plugins) {
      Preferences = cap.Plugins.Preferences;
    }
  } catch {
    // Running in a regular browser — fall back to localStorage
  }
}

// ── Preferences helpers (graceful fallback to localStorage) ──────────────────

async function getSavedUrl() {
  if (Preferences) {
    const { value } = await Preferences.get({ key: PREF_KEY });
    return value || null;
  }
  return localStorage.getItem(PREF_KEY);
}

async function saveUrl(url) {
  if (Preferences) {
    await Preferences.set({ key: PREF_KEY, value: url });
  } else {
    localStorage.setItem(PREF_KEY, url);
  }
}

async function clearUrl() {
  if (Preferences) {
    await Preferences.remove({ key: PREF_KEY });
  } else {
    localStorage.removeItem(PREF_KEY);
  }
}

// ── Health check ─────────────────────────────────────────────────────────────

/**
 * Validates a server URL by calling GET {url}/api/health.
 * Returns { ok: true, version } on success, or { ok: false, error } on failure.
 */
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

// ── Navigate to server ───────────────────────────────────────────────────────

function navigateToServer(serverUrl) {
  const url = serverUrl.replace(/\/+$/, "");
  // Use replace() so the connect screen is not in the back-navigation stack.
  // Capacitor's allowNavigation: ["*"] keeps this within the WebView.
  window.location.replace(url);
}

// ── UI helpers ───────────────────────────────────────────────────────────────

const form = document.getElementById("connect-form");
const urlInput = document.getElementById("server-url");
const errorEl = document.getElementById("error-message");
const connectBtn = document.getElementById("connect-btn");
const btnText = connectBtn.querySelector(".btn-text");
const btnSpinner = connectBtn.querySelector(".btn-spinner");
const clearBtn = document.getElementById("clear-btn");

function showError(msg) {
  errorEl.textContent = msg;
  errorEl.hidden = false;
}

function hideError() {
  errorEl.hidden = true;
  errorEl.textContent = "";
}

function setLoading(loading) {
  connectBtn.disabled = loading;
  urlInput.disabled = loading;
  btnText.textContent = loading ? "Connecting…" : "Connect";
  btnSpinner.hidden = !loading;
}

// ── Form submission ──────────────────────────────────────────────────────────

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
    await saveUrl(url);
    navigateToServer(url);
  } else {
    setLoading(false);
    showError(result.error);
  }
});

// ── Clear saved server ───────────────────────────────────────────────────────

clearBtn.addEventListener("click", async () => {
  await clearUrl();
  clearBtn.hidden = true;
  urlInput.value = "";
  urlInput.focus();
  hideError();
});

// ── Auto-connect on launch ───────────────────────────────────────────────────

async function init() {
  await loadCapacitorPlugins();

  // Clear stale preferences from older app versions
  const savedVersion = Preferences
    ? (await Preferences.get({ key: PREF_VERSION_KEY })).value
    : localStorage.getItem(PREF_VERSION_KEY);

  if (savedVersion !== CURRENT_PREF_VERSION) {
    await clearUrl();
    if (Preferences) {
      await Preferences.set({
        key: PREF_VERSION_KEY,
        value: CURRENT_PREF_VERSION,
      });
    } else {
      localStorage.setItem(PREF_VERSION_KEY, CURRENT_PREF_VERSION);
    }
  }

  const savedUrl = await getSavedUrl();

  if (savedUrl) {
    // Show the URL and a loading state while we validate
    urlInput.value = savedUrl;
    clearBtn.hidden = false;
    setLoading(true);

    const result = await checkServerHealth(savedUrl);

    if (result.ok) {
      navigateToServer(savedUrl);
      return; // Page will navigate away
    }

    // Server unreachable — let user fix or clear
    setLoading(false);
    showError(
      `Could not reach ${savedUrl}. The server may be offline or the URL may have changed.`,
    );
  }
}

init();
