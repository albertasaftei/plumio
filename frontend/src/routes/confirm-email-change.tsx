import { createSignal, onMount, Show } from "solid-js";
import { useSearchParams } from "@solidjs/router";
import { api } from "~/lib/api";
import Logo from "~/components/Logo";
import Button from "~/components/Button";
import { routes } from "~/routes";

export default function ConfirmEmailChange() {
  const [searchParams] = useSearchParams();
  const [loading, setLoading] = createSignal(true);
  const [success, setSuccess] = createSignal(false);
  const [error, setError] = createSignal("");
  const [tokenMissing, setTokenMissing] = createSignal(false);

  onMount(async () => {
    const rawToken = searchParams.token;
    const token = Array.isArray(rawToken) ? rawToken[0] : rawToken;
    if (!token) {
      setTokenMissing(true);
      setLoading(false);
      return;
    }

    try {
      await api.confirmEmailChange(token);
      setSuccess(true);
    } catch (err: any) {
      setError(err.message || "Failed to confirm email change");
    } finally {
      setLoading(false);
    }
  });

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
            Email Change
          </h2>

          <Show when={loading()}>
            <p class="text-[var(--color-text-secondary)]">
              Confirming your new email address…
            </p>
          </Show>

          <Show when={!loading()}>
            <Show when={tokenMissing()}>
              <div class="p-4 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 mb-4">
                Invalid confirmation link.
              </div>
              <a
                href={routes.settings}
                class="text-primary hover:underline text-sm"
              >
                Go to Settings
              </a>
            </Show>

            <Show when={success()}>
              <div class="p-4 bg-green-500/10 border border-green-500/20 rounded-lg text-green-400 mb-6">
                Your email address has been updated successfully.
              </div>
              <Button
                variant="primary"
                size="md"
                onClick={() => (window.location.href = routes.homepage)}
              >
                Go to Homepage
              </Button>
            </Show>

            <Show when={!tokenMissing() && !success()}>
              <div class="p-4 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 mb-4">
                {error()}
              </div>
              <a
                href={routes.settings}
                class="text-primary hover:underline text-sm"
              >
                Go to Settings
              </a>
            </Show>
          </Show>
        </div>
      </div>
    </div>
  );
}
