import { createSignal, onMount, For } from "solid-js";
import { Show } from "solid-js";
import { api } from "~/lib/api";
import { initializeTheme, Theme, THEME_META, useTheme } from "~/lib/theme";
import ThemeSwatch from "~/components/ThemeSwatch";
import Button from "~/components/Button";
import Toast from "~/components/Toast";

export default function Account() {
  const [username, setUsername] = createSignal<string | null>(null);
  const [theme, setTheme] = useTheme();
  const [editingUsername, setEditingUsername] = createSignal(false);
  const [newUsername, setNewUsername] = createSignal("");
  const [savingUsername, setSavingUsername] = createSignal(false);
  const [usernameError, setUsernameError] = createSignal("");
  const [toast, setToast] = createSignal<{
    message: string;
    type: "success" | "error" | "info" | "warning";
  } | null>(null);

  onMount(async () => {
    initializeTheme();
    const currentUsername = await api.getUsername();
    setUsername(currentUsername);
  });

  const handleRenameUsername = async (e: Event) => {
    e.preventDefault();
    if (!newUsername().trim()) return;
    setUsernameError("");
    setSavingUsername(true);
    try {
      await api.updateUsername(newUsername().trim());
      setUsername(newUsername().trim());
      setEditingUsername(false);
      setToast({ message: "Username updated successfully", type: "success" });
    } catch (err: any) {
      setUsernameError(err.message || "Failed to update username");
    } finally {
      setSavingUsername(false);
    }
  };

  const themes = Object.entries(THEME_META) as [
    Theme,
    (typeof THEME_META)[Theme],
  ][];

  return (
    <div class="space-y-4 bg-elevated rounded-lg p-6 border border-transparent light:border-base light:shadow-sm">
      <div>
        <h3 class="text-lg font-semibold text-body mb-2">Profile</h3>
        <div class="space-y-4">
          <div class="p-4 bg-elevated/50 border border-base rounded-lg">
            <div class="flex items-center justify-between">
              <div>
                <p class="text-xs font-medium text-muted-body uppercase tracking-wider mb-1">
                  Username
                </p>
                <Show
                  when={!editingUsername()}
                  fallback={
                    <form
                      onSubmit={handleRenameUsername}
                      class="flex flex-col gap-2 mt-1"
                    >
                      <div class="flex items-center gap-2">
                        <input
                          type="text"
                          value={newUsername()}
                          onInput={(e) => {
                            setNewUsername(e.currentTarget.value);
                            setUsernameError("");
                          }}
                          required
                          autofocus
                          class="px-3 py-1.5 bg-base border border-subtle rounded-lg text-body text-sm focus:outline-none focus:border-neutral-500"
                        />
                        <Button
                          type="submit"
                          variant="primary"
                          size="sm"
                          disabled={savingUsername()}
                        >
                          {savingUsername() ? "Saving\u2026" : "Save"}
                        </Button>
                        <Button
                          type="button"
                          variant="secondary"
                          size="sm"
                          onClick={() => {
                            setEditingUsername(false);
                            setUsernameError("");
                          }}
                        >
                          Cancel
                        </Button>
                      </div>
                      <Show when={usernameError()}>
                        <p class="text-xs text-red-400">{usernameError()}</p>
                      </Show>
                    </form>
                  }
                >
                  <p class="text-base font-semibold text-body">
                    {username() || "Loading..."}
                  </p>
                </Show>
              </div>
              <Show when={!editingUsername()}>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => {
                    setNewUsername(username() || "");
                    setEditingUsername(true);
                  }}
                >
                  <div class="i-carbon-edit w-4 h-4 mr-1.5" />
                  Edit
                </Button>
              </Show>
            </div>
          </div>
        </div>
      </div>

      <div>
        <h3 class="text-lg font-semibold text-body mb-2">Theme</h3>
        <p class="text-sm text-muted-body mb-4">
          Pick an appearance that suits you.
        </p>
        <div class="grid grid-cols-3 sm:grid-cols-5 gap-3">
          <For each={themes}>
            {([id]) => (
              <ThemeSwatch
                id={id}
                isActive={theme() === id}
                onSelect={setTheme}
              />
            )}
          </For>
        </div>
      </div>

      <Show when={toast()}>
        <Toast
          message={toast()!.message}
          type={toast()!.type}
          onClose={() => setToast(null)}
        />
      </Show>
    </div>
  );
}
