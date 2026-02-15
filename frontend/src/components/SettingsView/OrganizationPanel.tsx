import { createSignal, createEffect, For, Show, onMount } from "solid-js";
import { api } from "~/lib/api";
import Button from "../Button";
import AlertDialog from "../AlertDialog";
import Toast from "../Toast";

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

  onMount(async () => {
    setMounted(true);
    const currentOrg = await api.getCurrentOrganization();
    setCurrentOrg(currentOrg);
    // Fetch admin status from server for security validation
    const adminStatus = await api.isOrgAdmin();
    setIsAdmin(adminStatus);
  });

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

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  const renderContent = () => (
    <>
      <p class="text-sm text-neutral-400 mb-6">
        Manage organization members and access
      </p>

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
              <h3 class="text-lg font-semibold text-neutral-100">Members</h3>
              <p class="text-sm text-neutral-400">
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
            <div class="mb-6 p-4 bg-neutral-800/50 border border-neutral-700 rounded-lg">
              <h4 class="text-md font-semibold text-neutral-100 mb-4">
                Add Member to Organization
              </h4>
              <form onSubmit={handleAddMember} class="space-y-4">
                <div>
                  <label class="block text-sm font-medium text-neutral-300 mb-2">
                    Username
                  </label>
                  <input
                    type="text"
                    value={username()}
                    onInput={(e) => setUsername(e.currentTarget.value)}
                    required
                    class="w-full px-3 py-2 bg-neutral-950 border border-neutral-800 rounded-lg text-neutral-200 placeholder-neutral-600 focus:outline-none focus:border-neutral-700"
                    placeholder="Enter existing username"
                  />
                  <p class="text-xs text-neutral-500 mt-1">
                    The user must already have an account
                  </p>
                </div>

                <div>
                  <label class="block text-sm font-medium text-neutral-300 mb-2">
                    Role
                  </label>
                  <select
                    value={role()}
                    onChange={(e) => setRole(e.currentTarget.value)}
                    class="w-full px-3 py-2 bg-neutral-950 border border-neutral-800 rounded-lg text-neutral-200 focus:outline-none focus:border-neutral-700"
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
              <div class="i-carbon-circle-dash animate-spin w-8 h-8 text-neutral-500" />
            </div>
          }
        >
          <div class="border border-neutral-700 rounded-lg overflow-auto">
            <table class="w-full">
              <thead class="bg-neutral-800/50">
                <tr>
                  <th class="px-4 py-3 text-left text-xs font-medium text-neutral-400 uppercase tracking-wider">
                    Member
                  </th>
                  <th class="px-4 py-3 text-left text-xs font-medium text-neutral-400 uppercase tracking-wider">
                    Email
                  </th>
                  <th class="px-4 py-3 text-left text-xs font-medium text-neutral-400 uppercase tracking-wider">
                    Role
                  </th>
                  <th class="px-4 py-3 text-left text-xs font-medium text-neutral-400 uppercase tracking-wider">
                    Joined
                  </th>
                  <Show when={mounted() && isAdmin()}>
                    <th class="px-4 py-3 text-right text-xs font-medium text-neutral-400 uppercase tracking-wider">
                      Actions
                    </th>
                  </Show>
                </tr>
              </thead>
              <tbody class="divide-y divide-neutral-700">
                <For each={members()}>
                  {(member) => (
                    <tr class="hover:bg-neutral-800/30">
                      <td class="px-4 py-3 whitespace-nowrap">
                        <div class="flex items-center">
                          <div class="i-carbon-user-avatar w-8 h-8 text-neutral-400 mr-3" />
                          <div class="text-sm font-medium text-neutral-100">
                            {member.username}
                          </div>
                        </div>
                      </td>
                      <td class="px-4 py-3 whitespace-nowrap text-sm text-neutral-300">
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
                                    : "bg-neutral-700 text-neutral-300"
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
                              class="px-2 py-1 text-xs font-medium bg-neutral-800 border border-neutral-700 rounded text-neutral-200 focus:outline-none focus:border-neutral-600"
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
                      <td class="px-4 py-3 whitespace-nowrap text-sm text-neutral-400">
                        {formatDate(member.joinedAt)}
                      </td>
                      <Show when={mounted() && isAdmin()}>
                        <td class="flex items-center justify-end px-4 py-3 whitespace-nowrap text-sm">
                          <Show
                            when={!member.isOwner}
                            fallback={
                              <span class="text-xs text-neutral-500 italic">
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

      <div class="max-w-4xl mx-auto py-6">
        <Show when={props.inline}>
          {/* Inline mode - just render content */}
          <div class="flex-1 overflow-auto">
            <h2 class="text-xl font-bold text-neutral-100 mb-2">
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
