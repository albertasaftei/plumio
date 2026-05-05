import { createSignal, onMount, Show } from "solid-js";
import { useNavigate } from "@solidjs/router";
import { api } from "~/lib/api";
import { syncThemeFromServer } from "~/lib/theme";
import Logo from "~/components/Logo";
import Button from "~/components/Button";
import { routes } from "~/routes";
import { useI18n } from "~/i18n";

const isDemoMode = import.meta.env.VITE_DEMO_MODE === "true";

export default function Home() {
  const navigate = useNavigate();
  const { t } = useI18n();
  const [needsSetup, setNeedsSetup] = createSignal(false);
  const [isSetup, setIsSetup] = createSignal(false);
  const [username, setUsername] = createSignal("");
  const [email, setEmail] = createSignal("");
  const [password, setPassword] = createSignal("");
  const [confirmPassword, setConfirmPassword] = createSignal("");
  const [error, setError] = createSignal("");
  const [loading, setLoading] = createSignal(true);
  const [showPassword, setShowPassword] = createSignal(false);
  const [showConfirmPassword, setShowConfirmPassword] = createSignal(false);

  onMount(async () => {
    // In demo mode, skip auth and go straight to editor
    if (isDemoMode) {
      setLoading(false);
      navigate(routes.homepage);
      return;
    }

    try {
      const result = await api.checkSetup();
      setNeedsSetup(result.needsSetup);
      setIsSetup(result.needsSetup);

      // If setup is complete and has token, validate session
      if (!result.needsSetup && localStorage.getItem("plumio_token")) {
        const session = await api.validateSession();
        if (session.valid) {
          navigate(routes.homepage);
        }
        // If invalid, token was cleared by validateSession()
      }
    } catch (err) {
      console.error("Failed to check setup:", err);
      setError(
        t("auth.connectFailed"),
      );
    } finally {
      setLoading(false);
    }
  });

  const handleSetup = async (e: Event) => {
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

    try {
      await api.setup(username(), email(), password());
      setNeedsSetup(false);
      setIsSetup(false);
      setEmail("");
      setPassword("");
      setConfirmPassword("");
    } catch (err: any) {
      setError(err.message || "Setup failed");
    }
  };

  const handleLogin = async (e: Event) => {
    e.preventDefault();
    setError("");

    try {
      const result = await api.login(username(), password());
      syncThemeFromServer(result.theme);
      navigate(routes.homepage);
    } catch (err: any) {
      setError(err.message || "Login failed");
    }
  };

  return (
    <div class="min-h-screen bg-base flex items-center justify-center p-4">
      <Show
        when={!loading()}
        fallback={
          <div class="text-secondary-body">
            <div class="i-carbon-circle-dash animate-spin w-8 h-8 mx-auto" />
          </div>
        }
      >
        <div class="w-full max-w-md">
          <div class="flex gap-4 items-center justify-center mb-8">
            <Logo color="#2a9d8f" size="48" />
            <span class="text-4xl font-bold text-body mb-2">
              plumio
            </span>
          </div>

          <div class="bg-surface rounded-lg p-8 border border-base">
            <Show when={isSetup()}>
              <h2 class="text-2xl font-semibold text-body mb-6">
                {t("auth.initialSetup")}
              </h2>
              <p class="text-secondary-body mb-6 ">
                {t("auth.setupSubtitle")}
              </p>
            </Show>

            <Show when={!isSetup() && !needsSetup()}>
              <h2 class="text-2xl font-semibold text-body mb-6">
                {t("auth.welcomeBack")}
              </h2>
            </Show>

            <Show when={error()}>
              <div class="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 ">
                {error()}
              </div>
            </Show>

            <form onSubmit={isSetup() ? handleSetup : handleLogin}>
              <div class="mb-4">
                <label class="block font-medium text-secondary-body mb-2">
                  {t("auth.username")}
                </label>
                <input
                  type="text"
                  value={username()}
                  onInput={(e) => setUsername(e.currentTarget.value)}
                  required
                  class="focus-ring w-full px-3 py-2 bg-base border border-base rounded-lg text-body placeholder-muted-body focus:outline-none focus:border-[var(--color-primary)] transition-colors"
                  placeholder={t("auth.enterUsername")}
                />
              </div>

              <Show when={isSetup()}>
                <div class="mb-4">
                  <label class="block font-medium text-secondary-body mb-2">
                    {t("auth.email")}
                  </label>
                  <input
                    type="email"
                    value={email()}
                    onInput={(e) => setEmail(e.currentTarget.value)}
                    required
                    class="focus-ring w-full px-3 py-2 bg-base border border-base rounded-lg text-body placeholder-muted-body focus:outline-none focus:border-[var(--color-primary)] transition-colors"
                    placeholder={t("auth.enterEmail")}
                  />
                </div>
              </Show>

              <div class="mb-4">
                <label class="block font-medium text-secondary-body mb-2">
                  {t("auth.password")}
                </label>
                <div class="relative">
                  <input
                    type={showPassword() ? "text" : "password"}
                    value={password()}
                    onInput={(e) => setPassword(e.currentTarget.value)}
                    required
                    class="focus-ring w-full px-3 py-2 pr-10 bg-base border border-base rounded-lg text-body placeholder-muted-body focus:outline-none focus:border-[var(--color-primary)] transition-colors"
                    placeholder={t("auth.enterPassword")}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword())}
                    class="absolute right-3 top-1/2 -translate-y-1/2 text-muted-body hover:text-body transition-colors cursor-pointer"
                    title={showPassword() ? t("auth.hidePassword") : t("auth.showPassword")}
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

              <Show when={isSetup()}>
                <div class="mb-6">
                  <label class="block font-medium text-secondary-body mb-2">
                    {t("auth.confirmPassword")}
                  </label>
                  <div class="relative">
                    <input
                      type={showConfirmPassword() ? "text" : "password"}
                      value={confirmPassword()}
                      onInput={(e) => setConfirmPassword(e.currentTarget.value)}
                      required
                      class="focus-ring w-full px-3 py-2 pr-10 bg-base border border-base rounded-lg text-body placeholder-muted-body focus:outline-none focus:border-[var(--color-primary)] transition-colors"
                      placeholder={t("auth.confirmPasswordPlaceholder")}
                    />
                    <button
                      type="button"
                      onClick={() =>
                        setShowConfirmPassword(!showConfirmPassword())
                      }
                      class="absolute right-3 top-1/2 -translate-y-1/2 text-muted-body hover:text-body transition-colors cursor-pointer"
                      title={
                        showConfirmPassword()
                          ? t("auth.hidePassword")
                          : t("auth.showPassword")
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
              </Show>

              <Button
                variant="primary"
                type="submit"
                class="justify-center"
                fullWidth
              >
                {isSetup() ? t("auth.completeSetup") : t("auth.login")}
              </Button>
            </form>

            <Show when={!isSetup()}>
              <div class="mt-6 text-center">
                <span class="text-secondary-body">
                  {t("auth.noAccount")}
                </span>
                <button
                  onClick={() => navigate(routes.register)}
                  class="ml-2 text-primary hover:underline cursor-pointer"
                >
                  {t("auth.register")}
                </button>
              </div>
              <div class="mt-3 text-center">
                <button
                  onClick={() => navigate(routes.forgotPassword)}
                  class="text-muted-body hover:text-secondary-body cursor-pointer transition-colors text-sm"
                >
                  {t("auth.forgotPassword")}
                </button>
              </div>
            </Show>
          </div>

          <p class="text-center text-muted-body mt-6">
            {t("auth.dataEncrypted")}
          </p>
        </div>
      </Show>
    </div>
  );
}
