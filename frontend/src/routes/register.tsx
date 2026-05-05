import { createEffect, createSignal, For, Show } from "solid-js";
import { useNavigate } from "@solidjs/router";
import { api } from "~/lib/api";
import { config } from "~/lib/config";
import Logo from "~/components/Logo";
import Button from "~/components/Button";
import { routes } from "~/routes";
import { useI18n } from "~/i18n";

interface DiscoverableOrg {
  id: number;
  name: string;
  slug: string;
}

export default function Register() {
  const navigate = useNavigate();
  const { t } = useI18n();
  const [username, setUsername] = createSignal("");
  const [email, setEmail] = createSignal("");
  const [password, setPassword] = createSignal("");
  const [confirmPassword, setConfirmPassword] = createSignal("");
  const [error, setError] = createSignal("");
  const [success, setSuccess] = createSignal(false);
  const [loading, setLoading] = createSignal(false);

  // Join org state
  const [discoverableOrgs, setDiscoverableOrgs] = createSignal<
    DiscoverableOrg[]
  >([]);
  const [selectedOrgId, setSelectedOrgId] = createSignal<number | null>(null);
  const [joinMessage, setJoinMessage] = createSignal("");
  const [joinRequestSent, setJoinRequestSent] = createSignal(false);

  createEffect(() => {
    api
      .listDiscoverableOrgs()
      .then((r) => setDiscoverableOrgs(r.organizations))
      .catch(() => {});
  });

  createEffect(() => {
    if (!config().registration_enabled) {
      navigate(routes.login);
    }
  });

  const handleRegister = async (e: Event) => {
    e.preventDefault();
    setError("");

    if (password() !== confirmPassword()) {
      setError(t("auth.passwordsNoMatch"));
      return;
    }

    if (password().length < 8) {
      setError(t("auth.passwordTooShort"));
      return;
    }

    if (!username().trim() || !email().trim()) {
      setError(t("auth.usernameEmailRequired"));
      return;
    }

    setLoading(true);
    try {
      await api.register(username(), email(), password());

      // If an org was selected for joining, send the join request
      // We need to login first to get a token for the join request
      if (selectedOrgId()) {
        try {
          const loginResult = await api.login(username(), password());
          if (loginResult.token) {
            await api.createJoinRequest(
              selectedOrgId()!,
              joinMessage() || undefined,
            );
            setJoinRequestSent(true);
          }
          // Logout since user should go through normal login flow
          api.clearToken();
        } catch {
          // Join request failed but registration succeeded — user can request later
        }
      }

      setSuccess(true);
      setTimeout(() => {
        navigate(routes.login);
      }, 2000);
    } catch (err: any) {
      setError(err.message || t("auth.registrationFailed"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div class="min-h-screen bg-base flex items-center justify-center p-4">
      <div class="w-full max-w-md">
        <div class="flex gap-4 items-center justify-center mb-8">
          <Logo color="#2a9d8f" size="48" />
          <span class="text-4xl font-bold text-body mb-2">plumio</span>
        </div>

        <div class="bg-surface rounded-lg p-8 border border-subtle light:shadow-xl">
          <h2 class="text-2xl font-semibold text-body mb-6">{t("auth.createAccount")}</h2>

          <Show when={success()}>
            <div class="mb-4 p-3 bg-green-500/10 border border-green-500/20 rounded-lg text-green-400">
              {t("auth.registrationSuccess")}
              <Show when={joinRequestSent()}>
                {" "}
                {t("auth.joinRequestSent")}
              </Show>{" "}
              {t("auth.redirectingToLogin")}
            </div>
          </Show>

          <Show when={error()}>
            <div class="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400">
              {error()}
            </div>
          </Show>

          <form onSubmit={handleRegister}>
            <div class="mb-4">
              <label class="block font-medium text-secondary-body mb-2">
                {t("auth.username")}
              </label>
              <input
                type="text"
                value={username()}
                onInput={(e) => setUsername(e.currentTarget.value)}
                required
                disabled={loading() || success()}
                class="w-full px-3 py-2 bg-base border border-subtle rounded-lg text-body placeholder-muted-body focus:outline-none focus:border-base disabled:opacity-50"
                placeholder={t("auth.chooseUsername")}
              />
            </div>

            <div class="mb-4">
              <label class="block font-medium text-secondary-body mb-2">
                {t("auth.email")}
              </label>
              <input
                type="email"
                value={email()}
                onInput={(e) => setEmail(e.currentTarget.value)}
                required
                disabled={loading() || success()}
                class="w-full px-3 py-2 bg-base border border-subtle rounded-lg text-body placeholder-muted-body focus:outline-none focus:border-base disabled:opacity-50"
                placeholder="your@email.com"
              />
            </div>

            <div class="mb-4">
              <label class="block font-medium text-secondary-body mb-2">
                Join an Organization
                <span class="text-muted-body font-normal ml-1">(optional)</span>
              </label>
              <select
                value={selectedOrgId() ?? ""}
                onChange={(e) =>
                  setSelectedOrgId(
                    e.currentTarget.value
                      ? Number(e.currentTarget.value)
                      : null,
                  )
                }
                disabled={loading() || success()}
                class="w-full px-3 py-2 bg-base border border-subtle rounded-lg text-body focus:outline-none focus:border-base disabled:opacity-50"
              >
                <option value="">None</option>
                <For each={discoverableOrgs()}>
                  {(org) => <option value={org.id}>{org.name}</option>}
                </For>
              </select>
              <Show when={selectedOrgId()}>
                <div class="mt-2">
                  <input
                    type="text"
                    value={joinMessage()}
                    onInput={(e) => setJoinMessage(e.currentTarget.value)}
                    disabled={loading() || success()}
                    class="w-full px-3 py-2 bg-base border border-subtle rounded-lg text-body placeholder-muted-body focus:outline-none focus:border-base disabled:opacity-50 text-sm"
                    placeholder="Optional message to the organization admin..."
                    maxLength={500}
                  />
                </div>
                <p class="text-xs text-muted-body mt-1">
                  A request will be sent to the organization admin for approval.
                </p>
              </Show>
            </div>

            <div class="mb-4">
              <label class="block font-medium text-secondary-body mb-2">
                {t("auth.password")}
              </label>
              <input
                type="password"
                value={password()}
                onInput={(e) => setPassword(e.currentTarget.value)}
                required
                disabled={loading() || success()}
                class="w-full px-3 py-2 bg-base border border-subtle rounded-lg text-body placeholder-muted-body focus:outline-none focus:border-base disabled:opacity-50"
                placeholder="At least 8 characters"
              />
            </div>

            <div class="mb-6">
              <label class="block font-medium text-secondary-body mb-2">
                {t("auth.confirmPassword")}
              </label>
              <input
                type="password"
                value={confirmPassword()}
                onInput={(e) => setConfirmPassword(e.currentTarget.value)}
                required
                disabled={loading() || success()}
                class="w-full px-3 py-2 bg-base border border-subtle rounded-lg text-body placeholder-muted-body focus:outline-none focus:border-base disabled:opacity-50"
                placeholder={t("auth.confirmPasswordPlaceholder")}
              />
            </div>

            <Button
              variant="primary"
              type="submit"
              class="justify-center"
              fullWidth
              disabled={loading() || success()}
            >
              <Show when={loading()}>
                <div class="i-carbon-circle-dash animate-spin w-4 h-4" />
                <span class="ml-2">{t("common.loading")}</span>
              </Show>
              <Show when={!loading()}>{t("auth.createAccount")}</Show>
            </Button>
          </form>

          <div class="mt-6 text-center">
            <span class="text-muted-body">{t("auth.noAccount")}</span>
            <button
              onClick={() => navigate(routes.login)}
              class="ml-2 text-primary hover:underline cursor-pointer"
            >
              {t("auth.login")}
            </button>
          </div>
        </div>

        <p class="text-center text-muted-body mt-6">
          {t("auth.dataEncrypted")}
        </p>
      </div>
    </div>
  );
}
