import { Show, createSignal, onMount } from "solid-js";
import { api } from "~/lib/api";
import { useI18n } from "~/i18n";

const BuildInformation = () => {
  const { t } = useI18n();
  const [versionInfo, setVersionInfo] = createSignal<{
    updateAvailable: boolean;
    latestVersion: string | null;
    releaseUrl: string | null;
  } | null>(null);

  onMount(() => {
    api
      .checkVersion()
      .then(setVersionInfo)
      .catch(() => {});
  });

  return (
    <div class="space-y-4">
      <Show when={versionInfo()?.updateAvailable}>
        <div class="rounded-lg p-4 border border-amber-400/50 bg-amber-400/10 light:bg-amber-50 light:border-amber-400 flex items-start gap-3">
          <div class="i-carbon-upgrade w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
          <div class="flex-1 min-w-0">
            <p class="text-sm font-medium text-amber-600 dark:text-amber-300">
              {t("buildInfo.updateAvailable", {
                version: versionInfo()?.latestVersion ?? "",
              })}
            </p>
            <p class="text-xs text-amber-600/70 dark:text-amber-400/70 mt-0.5">
              {t("buildInfo.currentVersion", {
                version: import.meta.env.VITE_APP_VERSION,
              })}
            </p>
            <a
              href={versionInfo()?.releaseUrl ?? "#"}
              target="_blank"
              rel="noopener noreferrer"
              class="inline-block mt-2 text-xs text-amber-600 dark:text-amber-300 underline underline-offset-2 hover:text-amber-700 dark:hover:text-amber-200 transition-colors"
            >
              {t("buildInfo.viewRelease")}
            </a>
          </div>
        </div>
      </Show>

      <div class="bg-elevated rounded-lg p-6 border border-transparent light:border-base light:shadow-sm">
        <h3 class="text-lg font-semibold text-body mb-4">
          {t("buildInfo.title")}
        </h3>
        <div class="space-y-4">
          <div>
            <label class="block text-sm font-medium text-secondary-body mb-2">
              {t("buildInfo.version")}
            </label>
            <div class="text-body">{import.meta.env.VITE_APP_VERSION}</div>
          </div>
          <div>
            <label class="block text-sm font-medium text-secondary-body mb-2">
              {t("buildInfo.gitCommit")}
            </label>
            <div class="text-body">{import.meta.env.VITE_GIT_COMMIT}</div>
          </div>
          <div>
            <label class="block text-sm font-medium text-secondary-body mb-2">
              {t("buildInfo.gitBranch")}
            </label>
            <div class="text-body">{import.meta.env.VITE_GIT_BRANCH}</div>
          </div>
          <div>
            <label class="block text-sm font-medium text-secondary-body mb-2">
              {t("buildInfo.buildDate")}
            </label>
            <div class="text-body">{import.meta.env.VITE_BUILD_DATE}</div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BuildInformation;
