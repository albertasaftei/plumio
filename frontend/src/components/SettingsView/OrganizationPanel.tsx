import { createSignal, createEffect, For, Show, onMount } from "solid-js";
import { api } from "~/lib/api";
import Button from "../Button";
import AlertDialog from "../AlertDialog";
import Toast from "../Toast";
import { formatAbsoluteDate } from "~/utils/date.utils";

interface Member {
  id: number;
  username: string;
  email: string;
  role: string;
  joinedAt: string;
  isOwner?: boolean;
}

interface OrganizationPanelProps {
  isOpen: boolean;
  onClose: () => void;
  inline?: boolean;
}

export default function OrganizationPanel(props: OrganizationPanelProps) {
  const [members, setMembers] = createSignal<Member[]>([]);
  const [loading, setLoading] = createSignal(false);
  const [showAddForm, setShowAddForm] = createSignal(false);
  const [username, setUsername] = createSignal("");
  const [role, setRole] = createSignal("member");
  const [error, setError] = createSignal("");
  const [toast, setToast] = createSignal<{
    message: string;
    type: "success" | "error" | "info" | "warning";
  } | null>(null);
  const [removeDialog, setRemoveDialog] = createSignal<{
    isOpen: boolean;
    member: Member | null;
  }>({ isOpen: false, member: null });
  const [isAdmin, setIsAdmin] = createSignal(false);
  const [mounted, setMounted] = createSignal(false);
  const [currentOrg, setCurrentOrg] = createSignal(
    null as null | { id: number; name: string },
  );
  const [editingOrgName, setEditingOrgName] = createSignal(false);
  const [newOrgName, setNewOrgName] = createSignal("");
  const [savingOrgName, setSavingOrgName] = createSignal(false);
  const [orgDiscoverable, setOrgDiscoverable] = createSignal(false);
  const [orgAutoAccept, setOrgAutoAccept] = createSignal(false);
  const [savingDiscovery, setSavingDiscovery] = createSignal(false);

  onMount(async () => {
    setMounted(true);
    const currentOrg = await api.getCurrentOrganization();
    setCurrentOrg(currentOrg);
    // Fetch admin status from server for security validation
    const adminStatus = await api.isOrgAdmin();
    setIsAdmin(adminStatus);
    // Load discovery settings
    if (currentOrg?.id) {
      try {
        const { organization } = await api.getOrganization(currentOrg.id);
        setOrgDiscoverable(organization.discoverable === 1);
        setOrgAutoAccept(organization.autoAccept === 1);
      } catch {
        // ignore
      }
    }
  });

  const handleRenameOrg = async (e: Event) => {
    e.preventDefault();
    const org = currentOrg();
    if (!org || !newOrgName().trim()) return;

    setSavingOrgName(true);
    try {
      // Derive slug from name
      const slug = newOrgName()
        .trim()
        .toLowerCase()
        .replace(/\s+/g, "-")
        .replace(/[^a-z0-9-]/g, "");
      await api.updateOrganization(org.id, newOrgName().trim(), slug);
      setCurrentOrg({ ...org, name: newOrgName().trim() });
      // Update localStorage
      const stored = localStorage.getItem("plumio_current_org");
      if (stored) {
        const parsed = JSON.parse(stored);
        localStorage.setItem(
          "plumio_current_org",
          JSON.stringify({ ...parsed, name: newOrgName().trim() }),
        );
      }
      setEditingOrgName(false);
      setToast({ message: "Organization name updated", type: "success" });
    } catch (err: any) {
      setToast({
        message: err.message || "Failed to update name",
        type: "error",
      });
    } finally {
      setSavingOrgName(false);
    }
  };

  const loadMembers = async () => {
    const org = currentOrg();
    if (!org) return;

    setLoading(true);
    try {
      const result = await api.listOrgMembers(org.id);
      setMembers(result.members);
    } catch (err: any) {
      console.error("Failed to load members:", err);
      setError(err.message || "Failed to load members");
    } finally {
      setLoading(false);
    }
  };

  createEffect(() => {
    if (props.isOpen) {
      loadMembers();
    }
  });

  const handleAddMember = async (e: Event) => {
    e.preventDefault();
    setError("");

    const org = currentOrg();
    if (!org) return;

    if (!username().trim()) {
      setError("Username is required");
      return;
    }

    try {
      await api.addOrgMember(org.id, username(), role());
      setUsername("");
      setRole("member");
      setShowAddForm(false);
      setToast({ message: "Member added successfully", type: "success" });
      await loadMembers();
    } catch (err: any) {
      setToast({
        message: err.message || "Failed to add member",
        type: "error",
      });
    }
  };

  const handleRoleChange = async (memberId: number, newRole: string) => {
    const org = currentOrg();
    if (!org) return;

    try {
      await api.updateOrgMemberRole(org.id, memberId, newRole);
      setToast({ message: "Role updated successfully", type: "success" });
      await loadMembers();
    } catch (err: any) {
      setToast({
        message: err.message || "Failed to update role",
        type: "error",
      });
    }
  };

  const handleRemoveMember = (member: Member) => {
    setRemoveDialog({ isOpen: true, member });
  };

  const confirmRemove = async () => {
    const member = removeDialog().member;
    const org = currentOrg();
    if (!member || !org) return;

    try {
      await api.removeOrgMember(org.id, member.id);
      setRemoveDialog({ isOpen: false, member: null });
      setToast({ message: "Member removed successfully", type: "success" });
      await loadMembers();
    } catch (err: any) {
      setToast({
        message: err.message || "Failed to remove member",
        type: "error",
      });
      setRemoveDialog({ isOpen: false, member: null });
    }
  };

  const renderContent = () => (
    <>
      <p class="text-sm text-muted-body mb-6">
        Manage organization members and access
      </p>

      {/* Organization Name */}
      <div class="mb-6 p-4 bg-surface border border-base rounded-lg">
        <div class="flex items-center justify-between">
          <div>
            <p class="text-xs font-medium text-muted-body uppercase tracking-wider mb-1">
              Organization Name
            </p>
            <Show
              when={!editingOrgName()}
              fallback={
                <form
                  onSubmit={handleRenameOrg}
                  class="flex items-center gap-2 mt-1"
                >
                  <input
                    type="text"
                    value={newOrgName()}
                    onInput={(e) => setNewOrgName(e.currentTarget.value)}
                    required
                    autofocus
                    class="px-3 py-1.5 bg-base border border-subtle rounded-lg text-body text-sm focus:outline-none focus:border-neutral-500"
                  />
                  <Button
                    type="submit"
                    variant="primary"
                    size="sm"
                    disabled={savingOrgName()}
                  >
                    {savingOrgName() ? "Saving…" : "Save"}
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={() => setEditingOrgName(false)}
                  >
                    Cancel
                  </Button>
                </form>
              }
            >
              <p class="text-base font-semibold text-body">
                {currentOrg()?.name}
              </p>
            </Show>
          </div>
          <Show when={mounted() && isAdmin() && !editingOrgName()}>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                setNewOrgName(currentOrg()?.name || "");
                setEditingOrgName(true);
              }}
            >
              <div class="i-carbon-edit w-4 h-4 mr-1.5" />
              Rename
            </Button>
          </Show>
        </div>
      </div>

      <div
        class={props.inline ? "overflow-auto" : "max-h-[60vh] overflow-auto"}
      >
        <Show when={error()}>
          <div class="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400">
            {error()}
          </div>
        </Show>

        {/* Add Member Section */}
        <Show when={mounted() && isAdmin()}>
          <div class="mb-6 flex justify-between items-center">
            <div>
              <h3 class="text-lg font-semibold text-body">Members</h3>
              <p class="text-sm text-muted-body">
                {members().length} total members
              </p>
            </div>
            <Button
              onClick={() => setShowAddForm(!showAddForm())}
              variant="primary"
              size="md"
            >
              <div class="i-carbon-user-follow w-5 h-5 mr-2" />
              Add Member
            </Button>
          </div>

          {/* Add Member Form */}
          <Show when={showAddForm()}>
            <div class="mb-6 p-4 bg-elevated/50 border border-base rounded-lg">
              <h4 class="text-md font-semibold text-body mb-4">
                Add Member to Organization
              </h4>
              <form onSubmit={handleAddMember} class="space-y-4">
                <div>
                  <label class="block text-sm font-medium text-secondary-body mb-2">
                    Username
                  </label>
                  <input
                    type="text"
                    value={username()}
                    onInput={(e) => setUsername(e.currentTarget.value)}
                    required
                    class="w-full px-3 py-2 bg-base border border-subtle rounded-lg text-body placeholder-muted-body focus:outline-none focus:border-base"
                    placeholder="Enter existing username"
                  />
                  <p class="text-xs text-muted-body mt-1">
                    The user must already have an account
                  </p>
                </div>

                <div>
                  <label class="block text-sm font-medium text-secondary-body mb-2">
                    Role
                  </label>
                  <select
                    value={role()}
                    onChange={(e) => setRole(e.currentTarget.value)}
                    class="w-full px-3 py-2 bg-base border border-subtle rounded-lg text-body focus:outline-none focus:border-base"
                  >
                    <option value="member">Member</option>
                    <option value="admin">Admin</option>
                  </select>
                </div>

                <div class="flex gap-2">
                  <Button type="submit" variant="primary" size="md">
                    Add Member
                  </Button>
                  <Button
                    onClick={() => {
                      setShowAddForm(false);
                      setUsername("");
                      setRole("member");
                      setError("");
                    }}
                    variant="secondary"
                    size="md"
                  >
                    Cancel
                  </Button>
                </div>
              </form>
            </div>
          </Show>
        </Show>

        {/* Members List */}
        <Show
          when={!loading()}
          fallback={
            <div class="flex items-center justify-center py-12">
              <div class="i-carbon-circle-dash animate-spin w-8 h-8 text-muted-body" />
            </div>
          }
        >
          <div class="border border-base bg-surface rounded-lg overflow-auto">
            <table class="w-full">
              <thead class="bg-elevated/50">
                <tr>
                  <th class="px-4 py-3 text-left text-xs font-medium text-muted-body uppercase tracking-wider">
                    Member
                  </th>
                  <th class="px-4 py-3 text-left text-xs font-medium text-muted-body uppercase tracking-wider">
                    Email
                  </th>
                  <th class="px-4 py-3 text-left text-xs font-medium text-muted-body uppercase tracking-wider">
                    Role
                  </th>
                  <th class="px-4 py-3 text-left text-xs font-medium text-muted-body uppercase tracking-wider">
                    Joined
                  </th>
                  <Show when={mounted() && isAdmin()}>
                    <th class="px-4 py-3 text-right text-xs font-medium text-muted-body uppercase tracking-wider">
                      Actions
                    </th>
                  </Show>
                </tr>
              </thead>
              <tbody class="divide-y divide-neutral-700 dark:divide-neutral-700 light:divide-neutral-300">
                <For each={members()}>
                  {(member) => (
                    <tr class="hover:bg-[var(--color-bg-elevated)]">
                      <td class="px-4 py-3 whitespace-nowrap">
                        <div class="flex items-center">
                          <div class="i-carbon-user-avatar w-8 h-8 text-muted-body mr-3" />
                          <div class="text-sm font-medium text-body">
                            {member.username}
                          </div>
                        </div>
                      </td>
                      <td class="px-4 py-3 whitespace-nowrap text-sm text-secondary-body">
                        {member.email}
                      </td>
                      <td class="px-4 py-3 whitespace-nowrap">
                        <div class="flex items-center gap-2">
                          <Show
                            when={mounted() && isAdmin() && !member.isOwner}
                            fallback={
                              <span
                                class={`px-2 py-1 text-xs font-medium rounded capitalize ${
                                  member.role === "admin"
                                    ? "bg-blue-500/20 text-blue-400 border border-blue-500/30"
                                    : "bg-[var(--color-bg-elevated)] text-[var(--color-text-secondary)]"
                                }`}
                              >
                                {member.role}
                              </span>
                            }
                          >
                            <select
                              value={member.role}
                              onChange={(e) =>
                                handleRoleChange(
                                  member.id,
                                  e.currentTarget.value,
                                )
                              }
                              class="px-2 py-1 text-xs font-medium bg-elevated border border-base rounded text-body focus:outline-none focus:border-neutral-600 dark:focus:border-neutral-600 light:focus:border-neutral-500"
                            >
                              <option value="member">Member</option>
                              <option value="admin">Admin</option>
                            </select>
                          </Show>
                          <Show when={member.isOwner}>
                            <span class="px-2 py-1 text-xs font-medium rounded bg-purple-500/20 text-purple-400 border border-purple-500/30">
                              Owner
                            </span>
                          </Show>
                        </div>
                      </td>
                      <td class="px-4 py-3 whitespace-nowrap text-sm text-muted-body">
                        {formatAbsoluteDate(member.joinedAt)}
                      </td>
                      <Show when={mounted() && isAdmin()}>
                        <td class="flex items-center justify-end px-4 py-3 whitespace-nowrap text-sm">
                          <Show
                            when={!member.isOwner}
                            fallback={
                              <span class="text-xs text-muted-body italic">
                                Cannot remove
                              </span>
                            }
                          >
                            <Button
                              onClick={() => handleRemoveMember(member)}
                              variant="icon"
                              size="sm"
                              title="Remove member"
                              class="text-red-400 hover:text-red-300"
                            >
                              <div class="i-carbon-trash-can w-5 h-5" />
                            </Button>
                          </Show>
                        </td>
                      </Show>
                    </tr>
                  )}
                </For>
              </tbody>
            </table>
          </div>
        </Show>
      </div>

      {/* Pending Join Requests */}
      <Show when={mounted() && isAdmin()}>
        <JoinRequestsSection
          orgId={currentOrg()?.id ?? 0}
          onToast={(msg, type) => setToast({ message: msg, type })}
        />
      </Show>

      {/* Discovery Settings */}
      <Show when={mounted() && isAdmin()}>
        <div class="mt-6 p-4 bg-surface border border-base rounded-lg">
          <h3 class="text-sm font-semibold text-body mb-1">
            Discovery Settings
          </h3>
          <p class="text-xs text-muted-body mb-4">
            Control whether other users can find and request to join this
            organization.
          </p>
          <div class="space-y-3">
            <label class="flex items-center justify-between cursor-pointer">
              <div>
                <p class="text-sm text-body">
                  Allow users to discover this organization
                </p>
                <p class="text-xs text-muted-body">
                  Show this org in the "Join an Organization" page
                </p>
              </div>
              <input
                type="checkbox"
                checked={orgDiscoverable()}
                onChange={(e) => {
                  setOrgDiscoverable(e.currentTarget.checked);
                  if (!e.currentTarget.checked) setOrgAutoAccept(false);
                }}
                class="w-4 h-4 accent-[var(--color-primary)]"
              />
            </label>
            <label
              class="flex items-center justify-between cursor-pointer"
              style={{ opacity: orgDiscoverable() ? "1" : "0.4" }}
            >
              <div>
                <p class="text-sm text-body">Auto-accept join requests</p>
                <p class="text-xs text-muted-body">
                  Members are added instantly without admin approval
                </p>
              </div>
              <input
                type="checkbox"
                checked={orgAutoAccept()}
                disabled={!orgDiscoverable()}
                onChange={(e) => setOrgAutoAccept(e.currentTarget.checked)}
                class="w-4 h-4 accent-[var(--color-primary)]"
              />
            </label>
          </div>
          <div class="mt-4">
            <Button
              variant="primary"
              size="sm"
              disabled={savingDiscovery()}
              onClick={async () => {
                const org = currentOrg();
                if (!org) return;
                setSavingDiscovery(true);
                try {
                  await api.updateOrgSettings(
                    org.id,
                    orgDiscoverable(),
                    orgAutoAccept(),
                  );
                  setToast({
                    message: "Discovery settings saved",
                    type: "success",
                  });
                } catch (err: any) {
                  setToast({
                    message: err.message || "Failed to save settings",
                    type: "error",
                  });
                } finally {
                  setSavingDiscovery(false);
                }
              }}
            >
              {savingDiscovery() ? "Saving…" : "Save Settings"}
            </Button>
          </div>
        </div>
      </Show>
    </>
  );

  return (
    <>
      {/* Remove Confirmation Dialog */}
      <AlertDialog
        isOpen={removeDialog().isOpen}
        title="Remove Member"
        message={`Are you sure you want to remove "${removeDialog().member?.username}" from this organization?`}
        confirmText="Remove"
        cancelText="Cancel"
        variant="danger"
        onConfirm={confirmRemove}
        onCancel={() => setRemoveDialog({ isOpen: false, member: null })}
      />

      <div class="max-w-5xl bg-elevated rounded-lg mx-auto p-6 border border-transparent light:border-base light:shadow-md">
        <Show when={props.inline}>
          {/* Inline mode - just render content */}
          <div class="flex-1 overflow-auto">
            <h2 class="text-xl font-bold text-body mb-2">
              {currentOrg()?.name || "Organization"}
            </h2>
            {renderContent()}
          </div>
        </Show>

        <Show when={!props.inline}>
          {/* Modal mode - wrap in AlertDialog */}
          <AlertDialog
            isOpen={props.isOpen}
            title={currentOrg()?.name || "Organization"}
            showActions={false}
            showCloseIcon
            onCancel={props.onClose}
          >
            {renderContent()}
          </AlertDialog>
        </Show>

        {/* Toast Notifications */}
        <Show when={toast()}>
          <Toast
            message={toast()!.message}
            type={toast()!.type}
            onClose={() => setToast(null)}
          />
        </Show>
      </div>
    </>
  );
}

// --- Join Requests Section (org admin only) ---

interface JoinRequestsSectionProps {
  orgId: number;
  onToast: (
    message: string,
    type: "success" | "error" | "info" | "warning",
  ) => void;
}

interface JoinRequestItem {
  id: number;
  organization_id: number;
  user_id: number;
  status: string;
  message: string | null;
  username: string;
  email: string;
  created_at: string;
}

function JoinRequestsSection(props: JoinRequestsSectionProps) {
  const [requests, setRequests] = createSignal<JoinRequestItem[]>([]);
  const [loading, setLoading] = createSignal(false);

  const loadRequests = async () => {
    if (!props.orgId) return;
    setLoading(true);
    try {
      const result = await api.listOrgJoinRequests(props.orgId);
      setRequests(result.requests);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  createEffect(() => {
    if (props.orgId) {
      loadRequests();
    }
  });

  const handleAccept = async (requestId: number) => {
    try {
      await api.acceptJoinRequest(requestId);
      props.onToast("Join request accepted", "success");
      await loadRequests();
    } catch (err: any) {
      props.onToast(err.message || "Failed to accept request", "error");
    }
  };

  const handleReject = async (requestId: number) => {
    try {
      await api.rejectJoinRequest(requestId);
      props.onToast("Join request rejected", "info");
      await loadRequests();
    } catch (err: any) {
      props.onToast(err.message || "Failed to reject request", "error");
    }
  };

  return (
    <div class="mt-6">
      <h3 class="text-sm font-semibold text-body mb-3 flex items-center gap-2">
        <div class="i-carbon-user-follow w-4 h-4" />
        Pending Join Requests
        <Show when={requests().length > 0}>
          <span class="px-1.5 py-0.5 rounded-full bg-[var(--color-primary)]/10 text-[var(--color-primary)] text-xs font-medium">
            {requests().length}
          </span>
        </Show>
      </h3>

      <Show
        when={!loading()}
        fallback={
          <div class="text-sm text-muted-body py-4 text-center">
            <div class="i-carbon-circle-dash animate-spin w-4 h-4 inline-block mr-2" />
            Loading...
          </div>
        }
      >
        <Show
          when={requests().length > 0}
          fallback={
            <p class="text-sm text-muted-body py-2">
              No pending join requests.
            </p>
          }
        >
          <div class="space-y-3">
            <For each={requests()}>
              {(request) => (
                <div class="flex items-center justify-between p-3 bg-surface border border-base rounded-lg">
                  <div class="min-w-0 flex-1">
                    <p class="text-sm font-medium text-body">
                      {request.username}
                    </p>
                    <p class="text-xs text-muted-body">{request.email}</p>
                    <Show when={request.message}>
                      <p class="text-xs text-secondary-body mt-1 italic">
                        "{request.message}"
                      </p>
                    </Show>
                    <p class="text-[10px] text-muted-body mt-1">
                      {formatAbsoluteDate(request.created_at)}
                    </p>
                  </div>
                  <div class="flex gap-2 ml-3 flex-shrink-0">
                    <Button
                      onClick={() => handleAccept(request.id)}
                      variant="primary"
                      size="sm"
                    >
                      Accept
                    </Button>
                    <Button
                      onClick={() => handleReject(request.id)}
                      variant="secondary"
                      size="sm"
                    >
                      Reject
                    </Button>
                  </div>
                </div>
              )}
            </For>
          </div>
        </Show>
      </Show>
    </div>
  );
}
