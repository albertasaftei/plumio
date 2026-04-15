import { createSignal, onMount, Show } from "solid-js";
import { useNavigate, useSearchParams } from "@solidjs/router";
import { api } from "~/lib/api";
import Logo from "~/components/Logo";
import Button from "~/components/Button";
import { routes } from "~/routes";

export default function ResetPassword() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [password, setPassword] = createSignal("");
  const [confirmPassword, setConfirmPassword] = createSignal("");
  const [showPassword, setShowPassword] = createSignal(false);
  const [showConfirmPassword, setShowConfirmPassword] = createSignal(false);
  const [error, setError] = createSignal("");
  const [success, setSuccess] = createSignal(false);
  const [loading, setLoading] = createSignal(false);
  const [tokenMissing, setTokenMissing] = createSignal(false);

  onMount(() => {
    if (!searchParams.token) {
      setTokenMissing(true);
    }
  });

  const handleSubmit = async (e: Event) => {
    e.preventDefault();
    setError("");

    const token = Array.isArray(searchParams.token)
      ? searchParams.token[0]
      : searchParams.token;
    if (!token) {
      setError("Reset token is missing");
      return;
    }

    if (password() !== confirmPassword()) {
      setError("Passwords do not match");
      return;
    }

    if (password().length < 8) {
      setError("Password must be at least 8 characters");
      return;
    }

    setLoading(true);
    try {
      await api.resetPassword(token, password());
      setSuccess(true);
      setTimeout(() => navigate(routes.login), 2500);
    } catch (err: any) {
      setError(err.message || "Failed to reset password");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div class="min-h-screen bg-[var(--color-bg-base)] flex items-center justify-center p-4">
      <div class="w-full max-w-md">
        <div class="flex gap-4 items-center justify-center mb-8">
          <Logo color="#2a9d8f" size="48" />
          <span class="text-4xl font-bold text-[var(--color-text-primary)] mb-2">
            plumio
          </span>
        </div>

        <div class="bg-[var(--color-bg-surface)] rounded-lg p-8 border border-[var(--color-border)]">
          <h2 class="text-2xl font-semibold text-[var(--color-text-primary)] mb-6">
            Reset Password
          </h2>

          <Show when={tokenMissing()}>
            <div class="p-4 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 mb-4">
              Invalid reset link. Please request a new one.
            </div>
            <button
              onClick={() => navigate(routes.forgotPassword)}
              class="text-primary hover:underline cursor-pointer"
            >
              Request a new reset link
            </button>
          </Show>

          <Show when={!tokenMissing()}>
            <Show when={success()}>
              <div class="p-4 bg-green-500/10 border border-green-500/20 rounded-lg text-green-400">
                Password reset successfully! Redirecting to login...
              </div>
            </Show>

            <Show when={!success()}>
              <Show when={error()}>
                <div class="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400">
                  {error()}
                </div>
              </Show>

              <form onSubmit={handleSubmit}>
                <div class="mb-4">
                  <label class="block font-medium text-[var(--color-text-secondary)] mb-2">
                    New Password
                  </label>
                  <div class="relative">
                    <input
                      type={showPassword() ? "text" : "password"}
                      value={password()}
                      onInput={(e) => setPassword(e.currentTarget.value)}
                      required
                      disabled={loading()}
                      class="focus-ring w-full px-3 py-2 pr-10 bg-[var(--color-bg-base)] border border-[var(--color-border)] rounded-lg text-[var(--color-text-primary)] placeholder-[var(--color-text-muted)] focus:outline-none focus:border-[var(--color-primary)] transition-colors disabled:opacity-50"
                      placeholder="At least 8 characters"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword())}
                      class="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors cursor-pointer"
                      title={showPassword() ? "Hide password" : "Show password"}
                    >
                      <div
                        class={
                          showPassword()
                            ? "i-carbon-view-off w-4 h-4"
                            : "i-carbon-view w-4 h-4"
                        }
                      />
                    </button>
                  </div>
                </div>

                <div class="mb-6">
                  <label class="block font-medium text-[var(--color-text-secondary)] mb-2">
                    Confirm Password
                  </label>
                  <div class="relative">
                    <input
                      type={showConfirmPassword() ? "text" : "password"}
                      value={confirmPassword()}
                      onInput={(e) => setConfirmPassword(e.currentTarget.value)}
                      required
                      disabled={loading()}
                      class="focus-ring w-full px-3 py-2 pr-10 bg-[var(--color-bg-base)] border border-[var(--color-border)] rounded-lg text-[var(--color-text-primary)] placeholder-[var(--color-text-muted)] focus:outline-none focus:border-[var(--color-primary)] transition-colors disabled:opacity-50"
                      placeholder="Confirm new password"
                    />
                    <button
                      type="button"
                      onClick={() =>
                        setShowConfirmPassword(!showConfirmPassword())
                      }
                      class="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors cursor-pointer"
                      title={
                        showConfirmPassword()
                          ? "Hide password"
                          : "Show password"
                      }
                    >
                      <div
                        class={
                          showConfirmPassword()
                            ? "i-carbon-view-off w-4 h-4"
                            : "i-carbon-view w-4 h-4"
                        }
                      />
                    </button>
                  </div>
                </div>

                <Button
                  variant="primary"
                  type="submit"
                  class="justify-center"
                  fullWidth
                  disabled={loading()}
                >
                  {loading() ? "Resetting..." : "Reset Password"}
                </Button>
              </form>
            </Show>

            <div class="mt-6 text-center">
              <button
                onClick={() => navigate(routes.login)}
                class="text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] cursor-pointer transition-colors"
              >
                ← Back to Login
              </button>
            </div>
          </Show>
        </div>
      </div>
    </div>
  );
}
