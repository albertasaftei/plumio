import { createSignal, For, Show, onMount, createEffect } from "solid-js";
import { api } from "~/lib/api";
import Button from "../Button";
import AlertDialog from "../AlertDialog";

interface User {
  id: number;
  username: string;
  email: string;
  createdAt: string;
  isAdmin: boolean;
}

interface AdminPanelProps {
  isOpen: boolean;
  onClose: () => void;
  inline?: boolean;
}

export default function AdminPanel(props: AdminPanelProps) {
  const [users, setUsers] = createSignal<User[]>([]);
  const [loading, setLoading] = createSignal(false);
  const [showCreateForm, setShowCreateForm] = createSignal(false);
  const [deleteDialog, setDeleteDialog] = createSignal<{
    isOpen: boolean;
    user: User | null;
  }>({ isOpen: false, user: null });

  // Form state
  const [username, setUsername] = createSignal("");
  const [email, setEmail] = createSignal("");
  const [password, setPassword] = createSignal("");
  const [error, setError] = createSignal("");

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
      loadUsers();
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
      await api.createUser(username(), email(), password());
      setUsername("");
      setEmail("");
      setPassword("");
      setShowCreateForm(false);
      await loadUsers();
    } catch (err: any) {
      setError(err.message || "Failed to create user");
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

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
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
          <h3 class="text-lg font-semibold text-neutral-100">Users</h3>
          <p class="text-sm text-neutral-400">{users().length} total users</p>
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
        <div class="mb-6 p-4 bg-neutral-800/50 border border-neutral-700 rounded-lg">
          <h4 class="text-md font-semibold text-neutral-100 mb-4">
            Create New User
          </h4>
          <form onSubmit={handleCreateUser} class="space-y-4">
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
                placeholder="Enter username"
              />
            </div>

            <div>
              <label class="block text-sm font-medium text-neutral-300 mb-2">
                Email
              </label>
              <input
                type="email"
                value={email()}
                onInput={(e) => setEmail(e.currentTarget.value)}
                required
                class="w-full px-3 py-2 bg-neutral-950 border border-neutral-800 rounded-lg text-neutral-200 placeholder-neutral-600 focus:outline-none focus:border-neutral-700"
                placeholder="Enter email"
              />
            </div>

            <div>
              <label class="block text-sm font-medium text-neutral-300 mb-2">
                Password
              </label>
              <input
                type="password"
                value={password()}
                onInput={(e) => setPassword(e.currentTarget.value)}
                required
                minLength={8}
                class="w-full px-3 py-2 bg-neutral-950 border border-neutral-800 rounded-lg text-neutral-200 placeholder-neutral-600 focus:outline-none focus:border-neutral-700"
                placeholder="Min 8 characters"
              />
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
            <div class="i-carbon-circle-dash animate-spin w-8 h-8 text-neutral-500" />
          </div>
        }
      >
        <div class="border border-neutral-700 bg-neutral-900 rounded-lg overflow-auto">
          <table class="w-full">
            <thead class="bg-neutral-800/50">
              <tr>
                <th class="px-4 py-3 text-left text-xs font-medium text-neutral-400 uppercase tracking-wider">
                  User
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
                <th class="px-4 py-3 text-right text-xs font-medium text-neutral-400 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody class="divide-y divide-neutral-700">
              <For each={users()}>
                {(user) => (
                  <tr class="hover:bg-neutral-800/30">
                    <td class="px-4 py-3 whitespace-nowrap">
                      <div class="flex items-center">
                        <div class="i-carbon-user-avatar w-8 h-8 text-neutral-400 mr-3" />
                        <div class="text-sm font-medium text-neutral-100">
                          {user.username}
                        </div>
                      </div>
                    </td>
                    <td class="px-4 py-3 whitespace-nowrap text-sm text-neutral-300">
                      {user.email}
                    </td>
                    <td class="px-4 py-3 whitespace-nowrap">
                      <Show
                        when={user.isAdmin}
                        fallback={
                          <span class="px-2 py-1 text-xs font-medium bg-neutral-700 text-neutral-300 rounded">
                            Member
                          </span>
                        }
                      >
                        <span class="px-2 py-1 text-xs font-medium bg-blue-500/20 text-blue-400 rounded">
                          Admin
                        </span>
                      </Show>
                    </td>
                    <td class="px-4 py-3 whitespace-nowrap text-sm text-neutral-400">
                      {formatDate(user.createdAt)}
                    </td>
                    <td class="flex items-center justify-end px-4 py-3 whitespace-nowrap text-right text-sm">
                      <Show when={!user.isAdmin}>
                        <Button
                          onClick={() => handleDeleteUser(user)}
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
      <div class="max-w-5xl bg-neutral-800 rounded-lg mx-auto p-6">
        <Show when={props.inline}>
          {/* Inline mode - just render content */}
          <div class="flex-1 overflow-auto">
            <h2 class="text-xl font-bold text-neutral-100 mb-2">
              Global User Management
            </h2>
            <p class="text-sm text-neutral-400 mb-6">
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
              class="bg-neutral-900 border border-neutral-700 rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col"
              onClick={(e) => e.stopPropagation()}
            >
              <div class="px-6 py-4 border-b border-neutral-700 flex items-center justify-between">
                <div>
                  <h2 class="text-2xl font-bold text-neutral-100">
                    Global User Management
                  </h2>
                  <p class="text-sm text-neutral-400 mt-1">
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
    </>
  );
}
