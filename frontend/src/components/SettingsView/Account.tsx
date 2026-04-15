import { createSignal, onMount, For } from "solid-js";
import { Show } from "solid-js";
import { api } from "~/lib/api";
import { initializeTheme, Theme, THEME_META, useTheme } from "~/lib/theme";
import ThemeSwatch from "~/components/ThemeSwatch";
import Button from "~/components/Button";
import Toast from "~/components/Toast";

export default function Account() {
  const [username, setUsername] = createSignal<string | null>(null);
  const [email, setEmail] = createSignal<string | null>(null);
  const [theme, setTheme] = useTheme();
  const [editingUsername, setEditingUsername] = createSignal(false);
  const [newUsername, setNewUsername] = createSignal("");
  const [savingUsername, setSavingUsername] = createSignal(false);
  const [usernameError, setUsernameError] = createSignal("");
  const [toast, setToast] = createSignal<{
    message: string;
    type: "success" | "error" | "info" | "warning";
  } | null>(null);

  // Change password modal state
  const [changingPassword, setChangingPassword] = createSignal(false);
  const [currentPassword, setCurrentPassword] = createSignal("");
  const [newPassword, setNewPassword] = createSignal("");
  const [confirmNewPassword, setConfirmNewPassword] = createSignal("");
  const [showCurrentPassword, setShowCurrentPassword] = createSignal(false);
  const [showNewPassword, setShowNewPassword] = createSignal(false);
  const [showConfirmNewPassword, setShowConfirmNewPassword] =
    createSignal(false);
  const [passwordError, setPasswordError] = createSignal("");
  const [savingPassword, setSavingPassword] = createSignal(false);

  // Change email modal state
  const [changingEmail, setChangingEmail] = createSignal(false);
  const [newEmailInput, setNewEmailInput] = createSignal("");
  const [emailChangeError, setEmailChangeError] = createSignal("");
  const [emailChangeSending, setEmailChangeSending] = createSignal(false);
  const [emailChangeSent, setEmailChangeSent] = createSignal(false);

  const resetEmailModal = () => {
    setNewEmailInput("");
    setEmailChangeError("");
    setEmailChangeSending(false);
    setEmailChangeSent(false);
    setChangingEmail(false);
  };

  const resetPasswordModal = () => {
    setCurrentPassword("");
    setNewPassword("");
    setConfirmNewPassword("");
    setShowCurrentPassword(false);
    setShowNewPassword(false);
    setShowConfirmNewPassword(false);
    setPasswordError("");
    setSavingPassword(false);
    setChangingPassword(false);
  };

  const handleChangePassword = async (e: Event) => {
    e.preventDefault();
    setPasswordError("");

    if (newPassword() !== confirmNewPassword()) {
      setPasswordError("New passwords do not match");
      return;
    }
    if (newPassword().length < 8) {
      setPasswordError("New password must be at least 8 characters");
      return;
    }

    setSavingPassword(true);
    try {
      await api.changePassword(currentPassword(), newPassword());
      resetPasswordModal();
      setToast({ message: "Password changed successfully", type: "success" });
    } catch (err: any) {
      setPasswordError(err.message || "Failed to change password");
    } finally {
      setSavingPassword(false);
    }
  };

  onMount(async () => {
    initializeTheme();
    const currentUsername = await api.getUsername();
    setUsername(currentUsername);
    const currentEmail = await api.getEmail();
    setEmail(currentEmail);
  });

  const handleChangeEmail = async (e: Event) => {
    e.preventDefault();
    setEmailChangeError("");
    setEmailChangeSending(true);
    try {
      await api.requestEmailChange(newEmailInput().trim());
      setEmailChangeSent(true);
    } catch (err: any) {
      setEmailChangeError(err.message || "Failed to send confirmation email");
    } finally {
      setEmailChangeSending(false);
    }
  };

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

          <div class="p-4 bg-elevated/50 border border-base rounded-lg">
            <div class="flex items-center justify-between gap-4">
              <div>
                <p class="text-xs font-medium text-muted-body uppercase tracking-wider mb-1">
                  Password
                </p>
                <p class="text-base font-semibold text-body">Change password</p>
                <p class="text-sm text-muted-body mt-1">
                  Update your password using your current one.
                </p>
              </div>

              <Button
                variant="secondary"
                size="sm"
                onClick={() => setChangingPassword(true)}
              >
                <div class="i-carbon-password w-4 h-4 mr-1.5" />
                Change
              </Button>
            </div>
          </div>

          {/* Change Password Modal */}
          <Show when={changingPassword()}>
            <div
              class="fixed inset-0 bg-black/70 z-[100] flex items-center justify-center p-4 animate-dialog-fade-in"
              onClick={resetPasswordModal}
            >
              <div
                class="bg-surface border border-base rounded-lg shadow-xl light:shadow-2xl max-w-md w-full p-6 animate-dialog-scale-in relative"
                onClick={(e) => e.stopPropagation()}
              >
                <Button
                  onClick={resetPasswordModal}
                  variant="icon"
                  size="md"
                  title="Close"
                  class="absolute top-4 right-4"
                >
                  <div class="i-carbon-close w-5 h-5" />
                </Button>

                <h2 class="text-xl font-semibold text-body mb-1">
                  Change Password
                </h2>
                <p class="text-sm text-secondary-body mb-5">
                  Enter your current password and choose a new one.
                </p>

                <Show when={passwordError()}>
                  <div class="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm">
                    {passwordError()}
                  </div>
                </Show>

                <form
                  onSubmit={handleChangePassword}
                  class="flex flex-col gap-4"
                >
                  {/* Current password */}
                  <div>
                    <label class="block text-xs font-medium text-muted-body uppercase tracking-wider mb-1.5">
                      Current Password
                    </label>
                    <div class="relative">
                      <input
                        type={showCurrentPassword() ? "text" : "password"}
                        value={currentPassword()}
                        onInput={(e) =>
                          setCurrentPassword(e.currentTarget.value)
                        }
                        required
                        autofocus
                        disabled={savingPassword()}
                        class="w-full px-3 py-1.5 pr-10 bg-base border border-subtle rounded-lg text-body text-sm focus:outline-none focus:border-neutral-500 disabled:opacity-50"
                        placeholder="Current password"
                      />
                      <button
                        type="button"
                        tabIndex={-1}
                        onClick={() =>
                          setShowCurrentPassword(!showCurrentPassword())
                        }
                        class="absolute right-3 top-1/2 -translate-y-1/2 text-muted-body hover:text-body transition-colors cursor-pointer"
                      >
                        <div
                          class={
                            showCurrentPassword()
                              ? "i-carbon-view-off w-4 h-4"
                              : "i-carbon-view w-4 h-4"
                          }
                        />
                      </button>
                    </div>
                  </div>

                  {/* New password */}
                  <div>
                    <label class="block text-xs font-medium text-muted-body uppercase tracking-wider mb-1.5">
                      New Password
                    </label>
                    <div class="relative">
                      <input
                        type={showNewPassword() ? "text" : "password"}
                        value={newPassword()}
                        onInput={(e) => setNewPassword(e.currentTarget.value)}
                        required
                        disabled={savingPassword()}
                        class="w-full px-3 py-1.5 pr-10 bg-base border border-subtle rounded-lg text-body text-sm focus:outline-none focus:border-neutral-500 disabled:opacity-50"
                        placeholder="At least 8 characters"
                      />
                      <button
                        type="button"
                        tabIndex={-1}
                        onClick={() => setShowNewPassword(!showNewPassword())}
                        class="absolute right-3 top-1/2 -translate-y-1/2 text-muted-body hover:text-body transition-colors cursor-pointer"
                      >
                        <div
                          class={
                            showNewPassword()
                              ? "i-carbon-view-off w-4 h-4"
                              : "i-carbon-view w-4 h-4"
                          }
                        />
                      </button>
                    </div>
                  </div>

                  {/* Confirm new password */}
                  <div>
                    <label class="block text-xs font-medium text-muted-body uppercase tracking-wider mb-1.5">
                      Confirm New Password
                    </label>
                    <div class="relative">
                      <input
                        type={showConfirmNewPassword() ? "text" : "password"}
                        value={confirmNewPassword()}
                        onInput={(e) =>
                          setConfirmNewPassword(e.currentTarget.value)
                        }
                        required
                        disabled={savingPassword()}
                        class="w-full px-3 py-1.5 pr-10 bg-base border border-subtle rounded-lg text-body text-sm focus:outline-none focus:border-neutral-500 disabled:opacity-50"
                        placeholder="Repeat new password"
                      />
                      <button
                        type="button"
                        tabIndex={-1}
                        onClick={() =>
                          setShowConfirmNewPassword(!showConfirmNewPassword())
                        }
                        class="absolute right-3 top-1/2 -translate-y-1/2 text-muted-body hover:text-body transition-colors cursor-pointer"
                      >
                        <div
                          class={
                            showConfirmNewPassword()
                              ? "i-carbon-view-off w-4 h-4"
                              : "i-carbon-view w-4 h-4"
                          }
                        />
                      </button>
                    </div>
                  </div>

                  <div class="flex gap-3 justify-end mt-1">
                    <Button
                      type="button"
                      variant="secondary"
                      size="md"
                      onClick={resetPasswordModal}
                    >
                      Cancel
                    </Button>
                    <Button
                      type="submit"
                      variant="primary"
                      size="md"
                      disabled={savingPassword()}
                    >
                      {savingPassword() ? "Saving…" : "Change Password"}
                    </Button>
                  </div>
                </form>
              </div>
            </div>
          </Show>

          <div class="p-4 bg-elevated/50 border border-base rounded-lg">
            <div class="flex items-center justify-between gap-4">
              <div>
                <p class="text-xs font-medium text-muted-body uppercase tracking-wider mb-1">
                  Email
                </p>
                <p class="text-base font-semibold text-body">
                  {email() || "Loading..."}
                </p>
                <p class="text-sm text-muted-body mt-1">
                  A confirmation link will be sent to your new address.
                </p>
              </div>

              <Button
                variant="secondary"
                size="sm"
                onClick={() => setChangingEmail(true)}
              >
                <div class="i-carbon-email w-4 h-4 mr-1.5" />
                Change
              </Button>
            </div>
          </div>

          {/* Change Email Modal */}
          <Show when={changingEmail()}>
            <div
              class="fixed inset-0 bg-black/70 z-[100] flex items-center justify-center p-4 animate-dialog-fade-in"
              onClick={resetEmailModal}
            >
              <div
                class="bg-surface border border-base rounded-lg shadow-xl light:shadow-2xl max-w-md w-full p-6 animate-dialog-scale-in relative"
                onClick={(e) => e.stopPropagation()}
              >
                <Button
                  onClick={resetEmailModal}
                  variant="icon"
                  size="md"
                  title="Close"
                  class="absolute top-4 right-4"
                >
                  <div class="i-carbon-close w-5 h-5" />
                </Button>

                <h2 class="text-xl font-semibold text-body mb-1">
                  Change Email
                </h2>

                <Show when={!emailChangeSent()}>
                  <p class="text-sm text-secondary-body mb-5">
                    Enter your new email address. We'll send a confirmation link
                    there.
                  </p>

                  <Show when={emailChangeError()}>
                    <div class="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm">
                      {emailChangeError()}
                    </div>
                  </Show>

                  <form
                    onSubmit={handleChangeEmail}
                    class="flex flex-col gap-4"
                  >
                    <div>
                      <label class="block text-xs font-medium text-muted-body uppercase tracking-wider mb-1.5">
                        New Email Address
                      </label>
                      <input
                        type="email"
                        value={newEmailInput()}
                        onInput={(e) => {
                          setNewEmailInput(e.currentTarget.value);
                          setEmailChangeError("");
                        }}
                        required
                        autofocus
                        disabled={emailChangeSending()}
                        class="w-full px-3 py-1.5 bg-base border border-subtle rounded-lg text-body text-sm focus:outline-none focus:border-neutral-500 disabled:opacity-50"
                        placeholder="new@example.com"
                      />
                    </div>

                    <div class="flex gap-3 justify-end mt-1">
                      <Button
                        type="button"
                        variant="secondary"
                        size="md"
                        onClick={resetEmailModal}
                      >
                        Cancel
                      </Button>
                      <Button
                        type="submit"
                        variant="primary"
                        size="md"
                        disabled={emailChangeSending()}
                      >
                        {emailChangeSending()
                          ? "Sending…"
                          : "Send Confirmation"}
                      </Button>
                    </div>
                  </form>
                </Show>

                <Show when={emailChangeSent()}>
                  <p class="text-sm text-secondary-body mb-5">
                    Check your inbox at{" "}
                    <span class="font-semibold text-body">
                      {newEmailInput()}
                    </span>{" "}
                    for a confirmation link.
                  </p>
                  <p class="text-sm text-muted-body mb-5">
                    The link expires in 1 hour. Your email won't change until
                    you click it.
                  </p>
                  <div class="flex justify-end">
                    <Button
                      type="button"
                      variant="primary"
                      size="md"
                      onClick={resetEmailModal}
                    >
                      Done
                    </Button>
                  </div>
                </Show>
              </div>
            </div>
          </Show>
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
