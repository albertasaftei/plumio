import { createSignal, createEffect, For, Show, onMount } from "solid-js";
import { api } from "~/lib/api";
import "~/styles/animations.css";

interface Organization {
  id: number;
  name: string;
  slug: string;
  role: string;
  createdAt: string;
}

interface OrganizationSelectorProps {
  onSwitch?: () => void;
  fullWidth?: boolean;
}

export default function OrganizationSelector(props: OrganizationSelectorProps) {
  const [organizations, setOrganizations] = createSignal<Organization[]>([]);
  const [currentOrg, setCurrentOrg] = createSignal<Organization | null>(null);
  const [loading, setLoading] = createSignal(false);
  const [isOpen, setIsOpen] = createSignal(false);

  const loadOrganizations = async () => {
    try {
      const result = await api.listOrganizations();
      setOrganizations(result.organizations);

      // Set current org from localStorage
      const current = await api.getCurrentOrganization();
      if (current) {
        const org = result.organizations.find((o) => o.id === current.id);
        if (org) {
          setCurrentOrg(org);
        }
      }
    } catch (error) {
      console.error("Failed to load organizations:", error);
    }
  };

  onMount(() => {
    loadOrganizations();
  });

  const handleSwitch = async (orgId: number) => {
    if (loading()) return;

    setLoading(true);
    try {
      await api.switchOrganization(orgId);

      // Update current org
      const org = organizations().find((o) => o.id === orgId);
      if (org) {
        setCurrentOrg(org);
      }

      setIsOpen(false);

      // Trigger refresh callback
      props.onSwitch?.();

      // Reload page to refresh all data
      window.location.reload();
    } catch (error) {
      console.error("Failed to switch organization:", error);
      alert("Failed to switch organization");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div class="relative">
      {/* Selector Button */}
      <button
        onClick={() => setIsOpen(!isOpen())}
        class={`flex items-center justify-between gap-2 p-4 bg-neutral-800 dark:bg-neutral-800 light:bg-neutral-50 hover:bg-neutral-700 dark:hover:bg-neutral-700 light:hover:bg-neutral-100 border border-neutral-700 dark:border-neutral-700 light:border-neutral-300 rounded-lg transition-colors text-sm cursor-pointer light:shadow-sm ${props.fullWidth ? "w-full" : ""}`}
        title="Switch organization"
      >
        <div class="flex gap-2 items-center">
          <div class="i-carbon-enterprise w-4 h-4 text-neutral-400 dark:text-neutral-400 light:text-neutral-600" />
          <span class="text-neutral-200 dark:text-neutral-200 light:text-neutral-900 max-w-[150px] truncate">
            {currentOrg()?.name || "Select Organization"}
          </span>
        </div>
        <div
          class={`i-carbon-chevron-down w-4 h-4 text-neutral-400 dark:text-neutral-400 light:text-neutral-600 transition-transform ${isOpen() ? "rotate-180" : ""}`}
        />
      </button>

      {/* Dropdown */}
      <Show when={isOpen()}>
        <div class="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
        <div class="absolute top-full mt-2 right-0 w-64 bg-neutral-800 dark:bg-neutral-800 light:bg-neutral-50 border border-neutral-700 dark:border-neutral-700 light:border-neutral-300 rounded-lg shadow-xl light:shadow-2xl z-50 overflow-hidden animate-slide-down">
          <div class="p-2 border-b border-neutral-700 dark:border-neutral-700 light:border-neutral-200">
            <div class="text-xs font-medium text-neutral-400 dark:text-neutral-400 light:text-neutral-600 px-2 py-1">
              Your Organizations
            </div>
          </div>

          <div class="max-h-[300px] overflow-y-auto">
            <For each={organizations()}>
              {(org) => (
                <button
                  onClick={() => handleSwitch(org.id)}
                  disabled={loading() || currentOrg()?.id === org.id}
                  class={`w-full text-left px-3 py-2 hover:bg-neutral-700 dark:hover:bg-neutral-700 light:hover:bg-neutral-100 transition-colors flex items-center justify-between ${
                    currentOrg()?.id === org.id
                      ? "bg-neutral-700 dark:bg-neutral-700 light:bg-neutral-100"
                      : ""
                  }`}
                >
                  <div class="flex-1 min-w-0">
                    <div class="text-sm font-medium text-neutral-100 dark:text-neutral-100 light:text-neutral-900 truncate">
                      {org.name}
                    </div>
                    <div class="text-xs text-neutral-400 dark:text-neutral-400 light:text-neutral-600 flex items-center gap-2 mt-0.5">
                      <span class="truncate">{org.slug}</span>
                      <span
                        class={`px-1.5 py-0.5 rounded text-xs ${
                          org.role === "admin"
                            ? "bg-blue-500/20 text-blue-400 border border-blue-500/30"
                            : "bg-neutral-700 text-neutral-300"
                        }`}
                      >
                        {org.role}
                      </span>
                    </div>
                  </div>

                  <Show when={currentOrg()?.id === org.id}>
                    <div class="i-carbon-checkmark w-5 h-5 text-green-500 ml-2 flex-shrink-0" />
                  </Show>
                </button>
              )}
            </For>
          </div>

          <Show when={organizations().length === 0}>
            <div class="px-3 py-8 text-center text-neutral-400 dark:text-neutral-400 light:text-neutral-600 text-sm">
              No organizations found
            </div>
          </Show>
        </div>
      </Show>
    </div>
  );
}
