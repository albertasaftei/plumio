import { Show, createSignal, onMount } from "solid-js";
import Button from "../Button";
import { api } from "~/lib/api";
import { useI18n } from "~/i18n";

export type SettingsSection =
  | "account"
  | "editor"
  | "import-export"
  | "organization"
  | "admin"
  | "app-configuration"
  | "build-information"
  | null;

interface SettingsSidebarProps {
  activeSection: SettingsSection;
  onSectionChange: (section: SettingsSection) => void;
  onClose: () => void;
  onLogout: () => void;
  isAdmin: boolean;
  isOrgAdmin: boolean;
  isOpen: boolean;
  onToggle: () => void;
}

export default function SettingsSidebar(props: SettingsSidebarProps) {
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
    <aside
      class="w-80 h-full border-r py-2 border-subtle bg-surface flex flex-col fixed lg:relative inset-y-0 left-0 z-50 lg:z-auto transition-transform duration-300 ease-in-out"
      classList={{
        "-translate-x-full lg:translate-x-0": !props.isOpen,
        "translate-x-0": props.isOpen,
      }}
    >
      <div class="flex items-center justify-end p-4 border-subtle lg:hidden">
        <Button
          onClick={props.onToggle}
          variant="icon"
          size="md"
          title={t("sidebar.closeSidebar")}
          class=""
        >
          <div class="i-carbon-close w-5 h-5" />
        </Button>
      </div>

      <nav class="flex flex-col flex-1 p-2">
        <div class="flex flex-col gap-2">
          <Button
            onClick={() => props.onSectionChange("account")}
            variant={props.activeSection === "account" ? "secondary" : "ghost"}
            size="md"
            fullWidth
          >
            <div class="i-carbon-user w-4 h-4" />
            <span class="ml-2">{t("settings.account")}</span>
          </Button>

          <Button
            onClick={() => props.onSectionChange("editor")}
            variant={props.activeSection === "editor" ? "secondary" : "ghost"}
            size="md"
            fullWidth
          >
            <div class="i-carbon-edit w-4 h-4" />
            <span class="ml-2">{t("settings.editor")}</span>
          </Button>

          <Button
            onClick={() => props.onSectionChange("import-export")}
            variant={
              props.activeSection === "import-export" ? "secondary" : "ghost"
            }
            size="md"
            fullWidth
          >
            <div class="i-carbon-document-import w-4 h-4" />
            <span class="ml-2">{t("settings.importExport")}</span>
          </Button>

          <Show when={props.isOrgAdmin}>
            <Button
              onClick={() => props.onSectionChange("organization")}
              variant={
                props.activeSection === "organization" ? "secondary" : "ghost"
              }
              size="md"
              fullWidth
            >
              <div class="i-carbon-enterprise w-4 h-4" />
              <span class="ml-2">{t("settings.organization")}</span>
            </Button>
          </Show>

          <Show when={props.isAdmin}>
            <Button
              onClick={() => props.onSectionChange("admin")}
              variant={props.activeSection === "admin" ? "secondary" : "ghost"}
              size="md"
              fullWidth
            >
              <div class="i-carbon-user-admin w-4 h-4" />
              <span class="ml-2">{t("settings.admin")}</span>
            </Button>

            <Button
              onClick={() => props.onSectionChange("app-configuration")}
              variant={
                props.activeSection === "app-configuration"
                  ? "secondary"
                  : "ghost"
              }
              size="md"
              fullWidth
            >
              <div class="i-carbon-settings-adjust w-4 h-4" />
              <span class="ml-2">{t("settings.appConfiguration")}</span>
            </Button>
          </Show>

          <div class="relative">
            <Button
              onClick={() => props.onSectionChange("build-information")}
              variant={
                props.activeSection === "build-information"
                  ? "secondary"
                  : "ghost"
              }
              size="md"
              fullWidth
            >
              <div class="i-carbon-information w-4 h-4" />
              <span class="ml-2">{t("settings.buildInformation")}</span>
              <Show when={versionInfo()?.updateAvailable}>
                <span class="ml-auto w-2 h-2 rounded-full bg-amber-400 flex-shrink-0" />
              </Show>
            </Button>
          </div>

          <div class="border-t border-subtle my-2" />

          <Button
            onClick={props.onLogout}
            variant="ghost"
            size="md"
            fullWidth
            class="text-red-400 hover:text-red-300 hover:bg-red-950/30"
          >
            <div class="i-carbon-logout w-4 h-4" />
            <span class="ml-2">{t("settings.logout")}</span>
          </Button>
        </div>
        <div class="mt-auto p-2 border-t border-subtle ">
          <span class="text-sm text-muted-body">
            v{import.meta.env.VITE_APP_VERSION}
          </span>
        </div>
      </nav>
    </aside>
  );
}
