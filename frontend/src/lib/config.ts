import { createSignal } from "solid-js";
import { api } from "./api";

// Reactive app config fetched from the backend at runtime.
// Add new flags here as the settings table grows.
export interface AppConfig {
  registration_enabled: boolean;
}

const defaultConfig: AppConfig = {
  registration_enabled: true,
};

const [config, setConfig] = createSignal<AppConfig>(defaultConfig);

export { config };

export async function fetchConfig() {
  try {
    const raw = await api.getConfig();
    setConfig({
      registration_enabled: raw["registration_enabled"] !== false,
    });
  } catch {
    // Non-fatal — fall back to defaults (open registration, etc.)
  }
}
