import { createSignal, Show } from "solid-js";
import { useNavigate } from "@solidjs/router";
import { api } from "~/lib/api";
import Logo from "~/components/Logo";
import Button from "~/components/Button";
import { routes } from "~/routes";
import { useI18n } from "~/i18n";

export default function ForgotPassword() {
  const navigate = useNavigate();
  const { t } = useI18n();
  const [email, setEmail] = createSignal("");
  const [error, setError] = createSignal("");
  const [submitted, setSubmitted] = createSignal(false);
  const [loading, setLoading] = createSignal(false);

  const handleSubmit = async (e: Event) => {
    e.preventDefault();
    setError("");

    if (!email().trim()) {
      setError(t("forgotPassword.emailRequired"));
      return;
    }

    setLoading(true);
    try {
      await api.forgotPassword(email());
      setSubmitted(true);
    } catch (err: any) {
      setError(err.message || "Failed to send reset email");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div class="min-h-screen bg-base flex items-center justify-center p-4">
      <div class="w-full max-w-md">
        <div class="flex gap-4 items-center justify-center mb-8">
          <Logo color="#2a9d8f" size="48" />
          <span class="text-4xl font-bold text-body mb-2">
            plumio
          </span>
        </div>

        <div class="bg-surface rounded-lg p-8 border border-base">
          <h2 class="text-2xl font-semibold text-body mb-2">
            {t("forgotPassword.title")}
          </h2>

          <Show when={!submitted()}>
            <p class="text-secondary-body mb-6">
              {t("forgotPassword.instructions")}
            </p>

            <Show when={error()}>
              <div class="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400">
                {error()}
              </div>
            </Show>

            <form onSubmit={handleSubmit}>
              <div class="mb-6">
                <label class="block font-medium text-secondary-body mb-2">
                  {t("auth.email")}
                </label>
                <input
                  type="email"
                  value={email()}
                  onInput={(e) => setEmail(e.currentTarget.value)}
                  required
                  disabled={loading()}
                  class="focus-ring w-full px-3 py-2 bg-base border border-base rounded-lg text-body placeholder-muted-body focus:outline-none focus:border-[var(--color-primary)] transition-colors disabled:opacity-50"
                  placeholder="your@email.com"
                />
              </div>

              <Button
                variant="primary"
                type="submit"
                class="justify-center"
                fullWidth
                disabled={loading()}
              >
                {loading() ? t("forgotPassword.sending") : t("forgotPassword.sendLink")}
              </Button>
            </form>
          </Show>

          <Show when={submitted()}>
            <div class="mt-2 p-4 bg-green-500/10 border border-green-500/20 rounded-lg text-green-400">
              {t("forgotPassword.successMessage")}
            </div>
          </Show>

          <div class="mt-6 text-center">
            <button
              onClick={() => navigate(routes.login)}
              class="text-secondary-body hover:text-body cursor-pointer transition-colors"
            >
              {t("forgotPassword.backToLogin")}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
