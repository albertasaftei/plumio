import { Show } from "solid-js";
import Button from "../Button";

export type SettingsSection =
  | "account"
  | "import-export"
  | "organization"
  | "admin"
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
  return (
    <aside
      class="w-80 h-full border-r py-2 border-neutral-800 dark:border-neutral-800 light:border-neutral-200 bg-neutral-950 dark:bg-neutral-950 light:bg-white flex flex-col fixed lg:relative inset-y-0 left-0 z-50 lg:z-auto transition-transform duration-300 ease-in-out"
      classList={{
        "-translate-x-full lg:translate-x-0": !props.isOpen,
        "translate-x-0": props.isOpen,
      }}
    >
      <div class="flex items-center justify-end p-4 border-neutral-800 dark:border-neutral-800 light:border-neutral-200 lg:hidden">
        <Button
          onClick={props.onToggle}
          variant="icon"
          size="md"
          title="Close sidebar"
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
            <span class="ml-2">Account</span>
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
            <span class="ml-2">Import / Export</span>
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
              <span class="ml-2">Organization</span>
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
              <span class="ml-2">Admin Panel</span>
            </Button>
          </Show>

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
            <div class="i-carbon-document-import w-4 h-4" />
            <span class="ml-2">Build Information</span>
          </Button>

          <div class="border-t border-neutral-800 dark:border-neutral-800 light:border-neutral-200 my-2" />

          <Button
            onClick={props.onLogout}
            variant="ghost"
            size="md"
            fullWidth
            class="text-red-400 hover:text-red-300 hover:bg-red-950/30"
          >
            <div class="i-carbon-logout w-4 h-4" />
            <span class="ml-2">Logout</span>
          </Button>
        </div>
        <div class="mt-auto p-2 border-t border-neutral-800 dark:border-neutral-800 light:border-neutral-200 ">
          <span class="text-sm text-neutral-500 dark:text-neutral-500 light:text-neutral-600">
            v{import.meta.env.VITE_APP_VERSION}
          </span>
        </div>
      </nav>
    </aside>
  );
}
