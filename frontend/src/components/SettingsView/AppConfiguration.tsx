import { createSignal, onMount, Show } from "solid-js";
import { api } from "~/lib/api";
import { fetchConfig } from "~/lib/config";

interface ToggleProps {
  enabled: boolean;
  onChange: (value: boolean) => void;
  disabled?: boolean;
}

function Toggle(props: ToggleProps) {
  return (
    <button
      onClick={() => !props.disabled && props.onChange(!props.enabled)}
      class="relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 dark:focus:ring-offset-neutral-800 light:focus:ring-offset-white"
      classList={{
        "bg-primary cursor-pointer": props.enabled && !props.disabled,
        "bg-neutral-600 dark:bg-neutral-600 light:bg-neutral-300 cursor-pointer":
          !props.enabled && !props.disabled,
        "opacity-50 cursor-not-allowed": !!props.disabled,
      }}
      aria-checked={props.enabled}
      role="switch"
    >
      <span
        class="inline-block h-4 w-4 transform rounded-full bg-white transition-transform"
        classList={{
          "translate-x-6": props.enabled,
          "translate-x-1": !props.enabled,
        }}
      />
    </button>
  );
}

export default function AppConfiguration() {
  const [registrationEnabled, setRegistrationEnabled] = createSignal(false);
  const [saving, setSaving] = createSignal(false);
  const [error, setError] = createSignal("");
  const [successMsg, setSuccessMsg] = createSignal("");

  onMount(async () => {
    try {
      const result = await api.getAdminSettings();
      setRegistrationEnabled(
        result.settings["registration_enabled"] === "true",
      );
    } catch (err: any) {
      setError(err.message || "Failed to load settings");
    }
  });

  const handleToggle = async (key: string, value: boolean) => {
    setSaving(true);
    setError("");
    setSuccessMsg("");

    try {
      await api.updateAdminSetting(key, value ? "true" : "false");
      if (key === "registration_enabled") setRegistrationEnabled(value);
      setSuccessMsg("Setting saved");
      // Re-fetch the global config store so other components react immediately
      await fetchConfig();
      setTimeout(() => setSuccessMsg(""), 2500);
    } catch (err: any) {
      setError(err.message || "Failed to save setting");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div class="space-y-6">
      <Show when={error()}>
        <div class="p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm">
          {error()}
        </div>
      </Show>

      <Show when={successMsg()}>
        <div class="p-3 bg-green-500/10 border border-green-500/20 rounded-lg text-green-400 text-sm">
          {successMsg()}
        </div>
      </Show>

      {/* Authentication */}
      <div class="bg-elevated rounded-lg p-6 border border-transparent light:border-base light:shadow-sm">
        <h3 class="text-xl font-semibold text-body mb-1">Authentication</h3>
        <p class="text-sm text-muted-body mb-4">
          Control how users can access this instance.
        </p>

        <div class="space-y-4">
          {/* Registration toggle */}
          <div class="flex items-center justify-between gap-4">
            <div class="flex-1">
              <label class="block text-sm font-medium text-secondary-body mb-1">
                Enable registration
              </label>
              <p class="text-sm text-muted-body">
                Allow new users to create an account. When disabled, only
                admin-created accounts can be used to log in.
              </p>
            </div>
            <Toggle
              enabled={registrationEnabled()}
              onChange={(v) => handleToggle("registration_enabled", v)}
              disabled={saving()}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
