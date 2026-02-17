import { createSignal, Show, onMount, JSX } from "solid-js";
import { useNavigate } from "@solidjs/router";
import { api } from "~/lib/api";
import { isMobile } from "~/utils/device.utils";
import SettingsSidebar, {
  type SettingsSection,
} from "~/components/SettingsView/Sidebar";
import Account from "~/components/SettingsView/Account";
import ImportExport from "~/components/SettingsView/ImportExport";
import OrganizationPanel from "~/components/SettingsView/OrganizationPanel";
import AdminPanel from "~/components/SettingsView/AdminPanel";
import Button from "~/components/Button";
import { routes } from "~/routes";
import BuildInformation from "~/components/SettingsView/BuildInformation";

const SectionsWrapper = ({ children }: { children: JSX.Element }) => {
  return <div class="p-8 max-w-5xl mx-auto">{children}</div>;
};

export default function SettingsPage() {
  const navigate = useNavigate();
  const [activeSection, setActiveSection] =
    createSignal<SettingsSection>("account");
  const [isAdmin, setIsAdmin] = createSignal(false);
  const [isOrgAdmin, setIsOrgAdmin] = createSignal(false);
  const [sidebarOpen, setSidebarOpen] = createSignal(true);

  onMount(async () => {
    // Validate session first
    const isValid = await api.validateSession();
    if (!isValid) {
      navigate(routes.login);
      return;
    }

    const isAdmin = await api.isAdmin();
    setIsAdmin(isAdmin);
    // Fetch org admin status from server for security
    const orgAdminStatus = await api.isOrgAdmin();
    setIsOrgAdmin(orgAdminStatus);
    // Close sidebar by default on mobile
    setSidebarOpen(!isMobile());
  });

  const handleLogout = () => {
    api.clearToken();
    window.location.href = routes.login;
  };

  const handleClose = () => {
    navigate(routes.homepage);
  };

  const handleSectionChange = (section: SettingsSection) => {
    setActiveSection(section);
    // Close sidebar on mobile after selection
    if (isMobile()) {
      setSidebarOpen(false);
    }
  };

  return (
    <div class="flex h-screen overflow-hidden bg-neutral-950">
      {/* Sidebar Overlay for mobile */}
      <Show when={sidebarOpen()}>
        <div
          class="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      </Show>

      <SettingsSidebar
        activeSection={activeSection()}
        onSectionChange={handleSectionChange}
        onClose={handleClose}
        onLogout={handleLogout}
        isAdmin={isAdmin()}
        isOrgAdmin={isOrgAdmin()}
        isOpen={sidebarOpen()}
        onToggle={() => setSidebarOpen(!sidebarOpen())}
      />

      {/* Main Content */}
      <div class="flex-1 overflow-auto bg-neutral-900">
        {/* Mobile header with menu toggle */}
        <div class="lg:hidden sticky top-0 z-10 bg-neutral-950 border-b border-neutral-800 p-4 flex items-center gap-2">
          <Button
            onClick={() => setSidebarOpen(true)}
            variant="ghost"
            size="md"
            class="lg:hidden"
          >
            <div class="i-carbon-menu w-5 h-5" />
          </Button>
        </div>

        <Show
          when={activeSection()}
          fallback={
            <div class="flex items-center justify-center h-full">
              <div class="text-center text-neutral-400">
                <div class="i-carbon-settings w-16 h-16 mx-auto mb-4 opacity-50" />
                <p>Select a settings option from the sidebar</p>
              </div>
            </div>
          }
        >
          <Show when={activeSection() === "account"}>
            <SectionsWrapper>
              <div class="flex items-center gap-3 mb-6">
                <Button
                  onClick={handleClose}
                  variant="ghost"
                  size="md"
                  title="Back to editor"
                >
                  <div class="i-carbon-arrow-left w-5 h-5" />
                </Button>
                <h2 class="text-2xl font-bold text-white">Account</h2>
              </div>
              <Account />
            </SectionsWrapper>
          </Show>

          <Show when={activeSection() === "import-export"}>
            <SectionsWrapper>
              <div class="flex items-center gap-3 mb-6">
                <Button
                  onClick={handleClose}
                  variant="ghost"
                  size="md"
                  title="Back to editor"
                >
                  <div class="i-carbon-arrow-left w-5 h-5" />
                </Button>
                <h2 class="text-2xl font-bold text-white">Import / Export</h2>
              </div>
              <ImportExport />
            </SectionsWrapper>
          </Show>

          <Show when={activeSection() === "organization"}>
            <SectionsWrapper>
              <div class="flex items-center gap-3 mb-6">
                <Button
                  onClick={handleClose}
                  variant="ghost"
                  size="md"
                  title="Back to editor"
                >
                  <div class="i-carbon-arrow-left w-5 h-5" />
                </Button>
                <h2 class="text-2xl font-bold text-white">Organization</h2>
              </div>
              <OrganizationPanel
                isOpen
                inline
                onClose={() => setActiveSection(null)}
              />
            </SectionsWrapper>
          </Show>

          <Show when={activeSection() === "admin"}>
            <SectionsWrapper>
              <div class="flex items-center gap-3 mb-6">
                <Button
                  onClick={handleClose}
                  variant="ghost"
                  size="md"
                  title="Back to editor"
                >
                  <div class="i-carbon-arrow-left w-5 h-5" />
                </Button>
                <h2 class="text-2xl font-bold text-white">Admin Panel</h2>
              </div>
              <AdminPanel
                isOpen={true}
                inline={true}
                onClose={() => setActiveSection(null)}
              />
            </SectionsWrapper>
          </Show>

          <Show when={activeSection() === "build-information"}>
            <SectionsWrapper>
              <div class="flex items-center gap-3 mb-6">
                <Button
                  onClick={handleClose}
                  variant="ghost"
                  size="md"
                  title="Back to editor"
                >
                  <div class="i-carbon-arrow-left w-5 h-5" />
                </Button>
                <h2 class="text-2xl font-bold text-white">Build Information</h2>
              </div>
              <BuildInformation />
            </SectionsWrapper>
          </Show>
        </Show>
      </div>
    </div>
  );
}
