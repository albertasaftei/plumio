import { createSignal, onMount, Show } from "solid-js";
import { api } from "~/lib/api";
import { fetchConfig } from "~/lib/config";
import { useI18n } from "~/i18n";
import Toggle from "~/components/Toggle";

export default function AppConfiguration() {
  const { t } = useI18n();
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
      setError(err.message || t("appConfig.failedLoad"));
    }
  });

  const handleToggle = async (key: string, value: boolean) => {
    setSaving(true);
    setError("");
    setSuccessMsg("");

    try {
      await api.updateAdminSetting(key, value ? "true" : "false");
      if (key === "registration_enabled") setRegistrationEnabled(value);
      setSuccessMsg(t("appConfig.settingSaved"));
      // Re-fetch the global config store so other components react immediately
      await fetchConfig();
      setTimeout(() => setSuccessMsg(""), 2500);
    } catch (err: any) {
      setError(err.message || t("appConfig.failedSave"));
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
        <h3 class="text-xl font-semibold text-body mb-1">
          {t("appConfig.authTitle")}
        </h3>
        <p class="text-sm text-muted-body mb-4">{t("appConfig.authDesc")}</p>

        <div class="space-y-4">
          {/* Registration toggle */}
          <div class="flex items-center justify-between gap-4">
            <div class="flex-1">
              <label class="block text-sm font-medium text-secondary-body mb-1">
                {t("appConfig.registrationLabel")}
              </label>
              <p class="text-sm text-muted-body">
                {t("appConfig.registrationDesc")}
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
