import { createSignal, onMount, Show } from "solid-js";
import { useNavigate } from "@solidjs/router";
import { api } from "~/lib/api";
import Logo from "~/components/Logo";
import Button from "~/components/Button";
import { routes } from "~/routes";

const isDemoMode = import.meta.env.VITE_DEMO_MODE === "true";

export default function Home() {
  const navigate = useNavigate();
  const [needsSetup, setNeedsSetup] = createSignal(false);
  const [isSetup, setIsSetup] = createSignal(false);
  const [username, setUsername] = createSignal("");
  const [email, setEmail] = createSignal("");
  const [password, setPassword] = createSignal("");
  const [confirmPassword, setConfirmPassword] = createSignal("");
  const [error, setError] = createSignal("");
  const [loading, setLoading] = createSignal(true);

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
        const isValid = await api.validateSession();
        if (isValid) {
          navigate(routes.homepage);
        }
        // If invalid, token was cleared by validateSession()
      }
    } catch (err) {
      console.error("Failed to check setup:", err);
      setError(
        "Failed to connect to server. Make sure the backend is running.",
      );
    } finally {
      setLoading(false);
    }
  });

  const handleSetup = async (e: Event) => {
    e.preventDefault();
    setError("");

    if (password() !== confirmPassword()) {
      setError("Passwords do not match");
      return;
    }

    if (password().length < 8) {
      setError("Password must be at least 8 characters");
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
      await api.login(username(), password());
      navigate(routes.homepage);
    } catch (err: any) {
      setError(err.message || "Login failed");
    }
  };

  return (
    <div class="min-h-screen bg-neutral-950 flex items-center justify-center p-4">
      <Show
        when={!loading()}
        fallback={
          <div class="text-neutral-400">
            <div class="i-carbon-circle-dash animate-spin w-8 h-8 mx-auto" />
          </div>
        }
      >
        <div class="w-full max-w-md">
          <div class="flex gap-4 items-center justify-center mb-8">
            <Logo color="#2a9d8f" size="48" />
            <span class="text-4xl font-bold text-neutral-100 mb-2">plumio</span>
          </div>

          <div class="bg-neutral-900 rounded-lg p-8 border border-neutral-800">
            <Show when={isSetup()}>
              <h2 class="text-2xl font-semibold text-neutral-100 mb-6">
                Initial Setup
              </h2>
              <p class="text-neutral-400 mb-6 ">
                Create your admin account to get started
              </p>
            </Show>

            <Show when={!isSetup() && !needsSetup()}>
              <h2 class="text-2xl font-semibold text-neutral-100 mb-6">
                Welcome Back
              </h2>
            </Show>

            <Show when={error()}>
              <div class="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 ">
                {error()}
              </div>
            </Show>

            <form onSubmit={isSetup() ? handleSetup : handleLogin}>
              <div class="mb-4">
                <label class="block  font-medium text-neutral-300 mb-2">
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

              <Show when={isSetup()}>
                <div class="mb-4">
                  <label class="block  font-medium text-neutral-300 mb-2">
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
              </Show>

              <div class="mb-4">
                <label class="block  font-medium text-neutral-300 mb-2">
                  Password
                </label>
                <input
                  type="password"
                  value={password()}
                  onInput={(e) => setPassword(e.currentTarget.value)}
                  required
                  class="w-full px-3 py-2 bg-neutral-950 border border-neutral-800 rounded-lg text-neutral-200 placeholder-neutral-600 focus:outline-none focus:border-neutral-700"
                  placeholder="Enter password"
                />
              </div>

              <Show when={isSetup()}>
                <div class="mb-6">
                  <label class="block  font-medium text-neutral-300 mb-2">
                    Confirm Password
                  </label>
                  <input
                    type="password"
                    value={confirmPassword()}
                    onInput={(e) => setConfirmPassword(e.currentTarget.value)}
                    required
                    class="w-full px-3 py-2 bg-neutral-950 border border-neutral-800 rounded-lg text-neutral-200 placeholder-neutral-600 focus:outline-none focus:border-neutral-700"
                    placeholder="Confirm password"
                  />
                </div>
              </Show>

              <Button
                variant="primary"
                type="submit"
                class="justify-center"
                fullWidth
              >
                {isSetup() ? "Complete Setup" : "Login"}
              </Button>
            </form>

            <Show when={!isSetup()}>
              <div class="mt-6 text-center">
                <span class="text-neutral-400">Don't have an account?</span>
                <button
                  onClick={() => navigate(routes.register)}
                  class="ml-2 text-primary hover:underline cursor-pointer"
                >
                  Register
                </button>
              </div>
            </Show>
          </div>

          <p class="text-center text-neutral-600  mt-6">
            Your data is encrypted and stored locally on your server
          </p>
        </div>
      </Show>
    </div>
  );
}
