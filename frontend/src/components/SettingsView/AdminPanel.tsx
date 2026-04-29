import { createSignal, For, Show, createEffect } from "solid-js";
import { api } from "~/lib/api";
import Button from "../Button";
import AlertDialog from "../AlertDialog";
import Toast from "../Toast";
import { formatAbsoluteDate } from "~/utils/date.utils";

interface User {
  id: number;
  username: string;
  email: string;
  createdAt: string;
  isAdmin: boolean;
}

interface OrgMembership {
  orgId: number;
  orgName: string;
  orgSlug: string;
  role: string;
  joinedAt: string;
  isOwner: boolean;
}

interface OrgListItem {
  id: number;
  name: string;
  slug: string;
}

interface AdminPanelProps {
  isOpen: boolean;
  onClose: () => void;
  inline?: boolean;
}

export default function AdminPanel(props: AdminPanelProps) {
  const [users, setUsers] = createSignal<User[]>([]);
  const [loading, setLoading] = createSignal(false);
  const [isOwner, setIsOwner] = createSignal(false);
  const [showCreateForm, setShowCreateForm] = createSignal(false);
  const [deleteDialog, setDeleteDialog] = createSignal<{
    isOpen: boolean;
    user: User | null;
  }>({ isOpen: false, user: null });

  // Form state
  const [username, setUsername] = createSignal("");
  const [email, setEmail] = createSignal("");
  const [password, setPassword] = createSignal("");
  const [newUserIsAdmin, setNewUserIsAdmin] = createSignal(false);
  const [error, setError] = createSignal("");
  const [toast, setToast] = createSignal<{
    message: string;
    type: "success" | "error" | "info" | "warning";
  } | null>(null);

  // Per-user org expansion state
  const [expandedUserId, setExpandedUserId] = createSignal<number | null>(null);
  const [userOrgsCache, setUserOrgsCache] = createSignal<
    Record<number, OrgMembership[]>
  >({});
  const [allOrgs, setAllOrgs] = createSignal<OrgListItem[]>([]);
  const [orgLoadingFor, setOrgLoadingFor] = createSignal<number | null>(null);
  // Per-user "add to org" form state: { orgId, role }
  const [addOrgForm, setAddOrgForm] = createSignal<
    Record<number, { orgId: number; role: string }>
  >({});

  const loadUsers = async () => {
    setLoading(true);
    try {
      const result = await api.listUsers();
      setUsers(result.users);
    } catch (err: any) {
      console.error("Failed to load users:", err);
      setError(err.message || "Failed to load users");
    } finally {
      setLoading(false);
    }
  };

  createEffect(() => {
    if (props.isOpen) {
      (async () => {
        const currentUserId = await api.getCurrentUserId();
        setIsOwner(currentUserId === 1);
        await loadUsers();
        try {
          const result = await api.adminListAllOrgs();
          setAllOrgs(result.organizations);
        } catch (err) {
          console.error("Failed to load organizations:", err);
        }
      })();
    }
  });

  const handleCreateUser = async (e: Event) => {
    e.preventDefault();
    setError("");

    if (password().length < 8) {
      setError("Password must be at least 8 characters");
      return;
    }

    try {
      await api.createUser(username(), email(), password(), newUserIsAdmin());
      setUsername("");
      setEmail("");
      setPassword("");
      setNewUserIsAdmin(false);
      setShowCreateForm(false);
      await loadUsers();
    } catch (err: any) {
      setError(err.message || "Failed to create user");
    }
  };

  const handleRoleChange = async (user: User, newIsAdmin: boolean) => {
    try {
      await api.updateUserAdminStatus(user.id, newIsAdmin);
      setToast({
        message: `Role updated to ${newIsAdmin ? "Admin" : "Member"}`,
        type: "success",
      });
      await loadUsers();
    } catch (err: any) {
      setError(err.message || "Failed to update role");
    }
  };

  const handleDeleteUser = (user: User) => {
    setDeleteDialog({ isOpen: true, user });
  };

  const confirmDelete = async () => {
    const user = deleteDialog().user;
    if (!user) return;

    try {
      await api.deleteUser(user.id);
      setDeleteDialog({ isOpen: false, user: null });
      await loadUsers();
    } catch (err: any) {
      console.error("Failed to delete user:", err);
      setError(err.message || "Failed to delete user");
      setDeleteDialog({ isOpen: false, user: null });
    }
  };

  const toggleUserExpand = async (userId: number) => {
    if (expandedUserId() === userId) {
      setExpandedUserId(null);
      return;
    }
    setExpandedUserId(userId);
    if (userOrgsCache()[userId]) return; // already loaded
    setOrgLoadingFor(userId);
    try {
      const result = await api.adminGetUserOrgs(userId);
      setUserOrgsCache((prev) => ({ ...prev, [userId]: result.organizations }));
    } catch (err) {
      console.error("Failed to load user orgs:", err);
    } finally {
      setOrgLoadingFor(null);
    }
  };

  const refreshUserOrgs = async (userId: number) => {
    try {
      const result = await api.adminGetUserOrgs(userId);
      setUserOrgsCache((prev) => ({ ...prev, [userId]: result.organizations }));
    } catch (err) {
      console.error("Failed to refresh user orgs:", err);
    }
  };

  const handleOrgRoleChange = async (
    userId: number,
    orgId: number,
    role: string,
  ) => {
    try {
      await api.adminUpdateUserOrgRole(userId, orgId, role);
      setToast({ message: "Role updated", type: "success" });
      await refreshUserOrgs(userId);
    } catch (err: any) {
      setToast({
        message: err.message || "Failed to update role",
        type: "error",
      });
    }
  };

  const handleRemoveFromOrg = async (userId: number, orgId: number) => {
    try {
      await api.adminRemoveUserFromOrg(userId, orgId);
      setToast({ message: "Removed from organization", type: "success" });
      await refreshUserOrgs(userId);
    } catch (err: any) {
      setToast({
        message: err.message || "Failed to remove from organization",
        type: "error",
      });
    }
  };

  const handleAddToOrg = async (userId: number) => {
    const form = addOrgForm()[userId];
    if (!form?.orgId) return;
    try {
      await api.adminAddUserToOrg(userId, form.orgId, form.role || "member");
      setToast({ message: "Added to organization", type: "success" });
      setAddOrgForm((prev) => {
        const next = { ...prev };
        delete next[userId];
        return next;
      });
      await refreshUserOrgs(userId);
    } catch (err: any) {
      setToast({
        message: err.message || "Failed to add to organization",
        type: "error",
      });
    }
  };

  const renderContent = () => (
    <>
      <Show when={error()}>
        <div class="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400">
          {error()}
        </div>
      </Show>

      {/* Create User Button */}
      <div class="mb-6 flex justify-between items-center">
        <div>
          <h3 class="text-lg font-semibold text-body">Users</h3>
          <p class="text-sm text-muted-body">{users().length} total users</p>
        </div>
        <Button
          onClick={() => setShowCreateForm(!showCreateForm())}
          variant="primary"
          size="md"
        >
          <div class="i-carbon-user-follow w-5 h-5 mr-2" />
          Create User
        </Button>
      </div>

      {/* Create User Form */}
      <Show when={showCreateForm()}>
        <div class="mb-6 p-4 bg-elevated/50 border border-base rounded-lg">
          <h4 class="text-md font-semibold text-body mb-4">Create New User</h4>
          <form onSubmit={handleCreateUser} class="space-y-4">
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
                placeholder="Enter username"
              />
            </div>

            <div>
              <label class="block text-sm font-medium text-secondary-body mb-2">
                Email
              </label>
              <input
                type="email"
                value={email()}
                onInput={(e) => setEmail(e.currentTarget.value)}
                required
                class="w-full px-3 py-2 bg-base border border-subtle rounded-lg text-body placeholder-muted-body focus:outline-none focus:border-base"
                placeholder="Enter email"
              />
            </div>

            <div>
              <label class="block text-sm font-medium text-secondary-body mb-2">
                Password
              </label>
              <input
                type="password"
                value={password()}
                onInput={(e) => setPassword(e.currentTarget.value)}
                required
                minLength={8}
                class="w-full px-3 py-2 bg-base border border-subtle rounded-lg text-body placeholder-muted-body focus:outline-none focus:border-base"
                placeholder="Min 8 characters"
              />
            </div>

            <div class="flex items-center gap-3">
              <input
                id="new-user-admin"
                type="checkbox"
                checked={newUserIsAdmin()}
                onChange={(e) => setNewUserIsAdmin(e.currentTarget.checked)}
                class="w-4 h-4 rounded accent-[var(--color-primary)] cursor-pointer"
              />
              <label
                for="new-user-admin"
                class="text-sm font-medium text-secondary-body cursor-pointer select-none"
              >
                Grant app admin role
              </label>
            </div>

            <div class="flex gap-2">
              <Button type="submit" variant="primary" size="md">
                Create User
              </Button>
              <Button
                onClick={() => {
                  setShowCreateForm(false);
                  setUsername("");
                  setEmail("");
                  setPassword("");
                  setNewUserIsAdmin(false);
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

      {/* Users List */}
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
                  User
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
                <th class="px-4 py-3 text-right text-xs font-medium text-muted-body uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody class="divide-y divide-neutral-700 dark:divide-neutral-700 light:divide-neutral-300">
              <For each={users()}>
                {(user) => (
                  <>
                    <tr
                      class="hover:bg-elevated cursor-pointer"
                      onClick={() => toggleUserExpand(user.id)}
                    >
                      <td class="px-4 py-3 whitespace-nowrap">
                        <div class="flex items-center">
                          <div
                            class={`w-4 h-4 mr-2 text-muted-body transition-transform ${expandedUserId() === user.id ? "i-carbon-chevron-down" : "i-carbon-chevron-right"}`}
                          />
                          <div class="i-carbon-user-avatar w-8 h-8 text-muted-body mr-3" />
                          <div class="text-sm font-medium text-body">
                            {user.username}
                          </div>
                        </div>
                      </td>
                      <td class="px-4 py-3 whitespace-nowrap text-sm text-secondary-body">
                        {user.email}
                      </td>
                      <td class="px-4 py-3 whitespace-nowrap">
                        <Show
                          when={user.id !== 1 && (isOwner() || !user.isAdmin)}
                          fallback={
                            <span class="px-2 py-1 text-xs font-medium bg-blue-500/20 text-blue-400 rounded border border-blue-500/30">
                              Admin
                            </span>
                          }
                        >
                          <select
                            value={user.isAdmin ? "admin" : "member"}
                            onClick={(e) => e.stopPropagation()}
                            onChange={(e) =>
                              handleRoleChange(
                                user,
                                e.currentTarget.value === "admin",
                              )
                            }
                            class="px-2 py-1 text-xs font-medium bg-elevated border border-base rounded text-body focus:outline-none focus:border-neutral-600 dark:focus:border-neutral-600 light:focus:border-neutral-500"
                          >
                            <option value="member">Member</option>
                            <option value="admin">Admin</option>
                          </select>
                        </Show>
                      </td>
                      <td class="px-4 py-3 whitespace-nowrap text-sm text-muted-body">
                        {formatAbsoluteDate(user.createdAt)}
                      </td>
                      <td class="flex items-center justify-end px-4 py-3 whitespace-nowrap text-right text-sm">
                        <Show
                          when={user.id !== 1 && (isOwner() || !user.isAdmin)}
                        >
                          <Button
                            onClick={(e: MouseEvent) => {
                              e.stopPropagation();
                              handleDeleteUser(user);
                            }}
                            variant="icon"
                            size="sm"
                            title="Delete user"
                            class="text-red-400 hover:text-red-300"
                          >
                            <div class="i-carbon-trash-can w-5 h-5" />
                          </Button>
                        </Show>
                      </td>
                    </tr>
                    <Show when={expandedUserId() === user.id}>
                      <tr>
                        <td colspan="5" class="bg-base/40 px-6 py-4">
                          <div class="text-xs font-semibold text-muted-body uppercase tracking-wider mb-3">
                            Organization Memberships
                          </div>
                          <Show
                            when={orgLoadingFor() !== user.id}
                            fallback={
                              <div class="flex items-center gap-2 text-sm text-muted-body py-2">
                                <div class="i-carbon-circle-dash animate-spin w-4 h-4" />
                                Loading…
                              </div>
                            }
                          >
                            <Show
                              when={(userOrgsCache()[user.id] ?? []).length > 0}
                              fallback={
                                <p class="text-sm text-muted-body mb-3">
                                  No organization memberships.
                                </p>
                              }
                            >
                              <table class="w-full mb-4 text-sm">
                                <thead>
                                  <tr class="text-xs text-muted-body uppercase">
                                    <th class="text-left pb-2 pr-4">
                                      Organization
                                    </th>
                                    <th class="text-left pb-2 pr-4">Role</th>
                                    <th class="text-left pb-2 pr-4">Joined</th>
                                    <th class="text-right pb-2" />
                                  </tr>
                                </thead>
                                <tbody class="divide-y divide-neutral-700/40 dark:divide-neutral-700/40 light:divide-neutral-300/60">
                                  <For each={userOrgsCache()[user.id] ?? []}>
                                    {(mem) => (
                                      <tr>
                                        <td class="py-2 pr-4 text-body font-medium">
                                          {mem.orgName}
                                          <Show when={mem.isOwner}>
                                            <span class="ml-2 text-xs text-amber-400">
                                              owner
                                            </span>
                                          </Show>
                                        </td>
                                        <td class="py-2 pr-4">
                                          <Show
                                            when={!mem.isOwner}
                                            fallback={
                                              <span class="px-2 py-1 text-xs bg-amber-500/20 text-amber-400 rounded border border-amber-500/30">
                                                owner
                                              </span>
                                            }
                                          >
                                            <select
                                              value={mem.role}
                                              onChange={(e) =>
                                                handleOrgRoleChange(
                                                  user.id,
                                                  mem.orgId,
                                                  e.currentTarget.value,
                                                )
                                              }
                                              class="px-2 py-1 text-xs bg-elevated border border-base rounded text-body focus:outline-none"
                                            >
                                              <option value="member">
                                                Member
                                              </option>
                                              <option value="admin">
                                                Admin
                                              </option>
                                            </select>
                                          </Show>
                                        </td>
                                        <td class="py-2 pr-4 text-muted-body text-xs">
                                          {formatAbsoluteDate(mem.joinedAt)}
                                        </td>
                                        <td class="py-2 text-right">
                                          <Show when={!mem.isOwner}>
                                            <Button
                                              onClick={() =>
                                                handleRemoveFromOrg(
                                                  user.id,
                                                  mem.orgId,
                                                )
                                              }
                                              variant="icon"
                                              size="sm"
                                              title="Remove from organization"
                                              class="text-red-400 hover:text-red-300"
                                            >
                                              <div class="i-carbon-close w-4 h-4" />
                                            </Button>
                                          </Show>
                                        </td>
                                      </tr>
                                    )}
                                  </For>
                                </tbody>
                              </table>
                            </Show>
                            {/* Add to organization */}
                            <div class="flex items-center gap-2 flex-wrap">
                              <span class="text-xs text-muted-body">
                                Add to organization:
                              </span>
                              <select
                                value={addOrgForm()[user.id]?.orgId ?? ""}
                                onChange={(e) => {
                                  const val = parseInt(e.currentTarget.value);
                                  setAddOrgForm((prev) => ({
                                    ...prev,
                                    [user.id]: {
                                      orgId: val,
                                      role: prev[user.id]?.role ?? "member",
                                    },
                                  }));
                                }}
                                class="px-2 py-1 text-xs bg-elevated border border-base rounded text-body focus:outline-none"
                              >
                                <option value="">Select org…</option>
                                <For
                                  each={allOrgs().filter(
                                    (o) =>
                                      !(userOrgsCache()[user.id] ?? []).some(
                                        (m) => m.orgId === o.id,
                                      ),
                                  )}
                                >
                                  {(org) => (
                                    <option value={org.id}>{org.name}</option>
                                  )}
                                </For>
                              </select>
                              <select
                                value={addOrgForm()[user.id]?.role ?? "member"}
                                onChange={(e) => {
                                  setAddOrgForm((prev) => ({
                                    ...prev,
                                    [user.id]: {
                                      orgId: prev[user.id]?.orgId ?? 0,
                                      role: e.currentTarget.value,
                                    },
                                  }));
                                }}
                                class="px-2 py-1 text-xs bg-elevated border border-base rounded text-body focus:outline-none"
                              >
                                <option value="member">Member</option>
                                <option value="admin">Admin</option>
                              </select>
                              <Button
                                onClick={() => handleAddToOrg(user.id)}
                                variant="primary"
                                size="sm"
                                disabled={!addOrgForm()[user.id]?.orgId}
                              >
                                Add
                              </Button>
                            </div>
                          </Show>
                        </td>
                      </tr>
                    </Show>
                  </>
                )}
              </For>
            </tbody>
          </table>
        </div>
      </Show>
    </>
  );

  return (
    <>
      {/* Delete Confirmation Dialog */}
      <AlertDialog
        isOpen={deleteDialog().isOpen}
        title="Delete User"
        message={`Are you sure you want to delete user "${deleteDialog().user?.username}"? This will also delete all their documents and cannot be undone.`}
        confirmText="Delete"
        cancelText="Cancel"
        variant="danger"
        onConfirm={confirmDelete}
        onCancel={() => setDeleteDialog({ isOpen: false, user: null })}
      />
      <div class="max-w-5xl bg-elevated rounded-lg mx-auto p-6 border border-transparent light:border-base light:shadow-md">
        <Show when={props.inline}>
          {/* Inline mode - just render content */}
          <div class="flex-1 overflow-auto">
            <h2 class="text-xl font-bold text-body mb-2">
              Global User Management
            </h2>
            <p class="text-sm text-muted-body mb-6">
              Manage global users and access
            </p>
            {renderContent()}
          </div>
        </Show>

        <Show when={!props.inline && props.isOpen}>
          {/* Modal mode - full modal panel */}
          <div
            class="fixed inset-0 bg-black/70 z-[90] flex items-center justify-center p-4"
            onClick={props.onClose}
          >
            <div
              class="bg-surface border border-base rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col"
              onClick={(e) => e.stopPropagation()}
            >
              <div class="px-6 py-4 border-b border-base flex items-center justify-between">
                <div>
                  <h2 class="text-2xl font-bold text-body">
                    Global User Management
                  </h2>
                  <p class="text-sm text-muted-body mt-1">
                    Manage global users and access
                  </p>
                </div>
                <Button
                  onClick={props.onClose}
                  variant="icon"
                  size="md"
                  title="Close"
                >
                  <div class="i-carbon-close w-5 h-5" />
                </Button>
              </div>
              <div class="flex-1 overflow-auto p-6">{renderContent()}</div>
            </div>
          </div>
        </Show>
      </div>

      <Show when={toast()}>
        <Toast
          message={toast()!.message}
          type={toast()!.type}
          onClose={() => setToast(null)}
        />
      </Show>
    </>
  );
}
