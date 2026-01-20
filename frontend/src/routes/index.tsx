import { createSignal, createEffect, Show } from "solid-js";
import { useNavigate } from "@solidjs/router";
import { api } from "~/lib/api";

export default function Home() {
  const navigate = useNavigate();
  const [needsSetup, setNeedsSetup] = createSignal(false);
  const [isSetup, setIsSetup] = createSignal(false);
  const [username, setUsername] = createSignal("");
  const [password, setPassword] = createSignal("");
  const [confirmPassword, setConfirmPassword] = createSignal("");
  const [error, setError] = createSignal("");
  const [loading, setLoading] = createSignal(true);

  createEffect(async () => {
    try {
      const result = await api.checkSetup();
      setNeedsSetup(result.needsSetup);
      setIsSetup(result.needsSetup);

      // If already has token and setup is complete, go to editor
      if (!result.needsSetup && localStorage.getItem("pluma_token")) {
        navigate("/editor");
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
      await api.setup(username(), password());
      setNeedsSetup(false);
      setIsSetup(false);
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
      navigate("/editor");
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
          <div class="text-center mb-8">
            <h1 class="text-4xl font-bold text-neutral-100 mb-2">Pluma</h1>
            <p class="text-neutral-400">Self-hosted Markdown Editor</p>
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

              <button
                type="submit"
                class="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
              >
                {isSetup() ? "Complete Setup" : "Login"}
              </button>
            </form>
          </div>

          <p class="text-center text-neutral-600  mt-6">
            Your data is encrypted and stored locally on your server
          </p>
        </div>
      </Show>
    </div>
  );
}
