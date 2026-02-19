import { createSignal, Show } from "solid-js";
import { useNavigate } from "@solidjs/router";
import { api } from "~/lib/api";
import Logo from "~/components/Logo";
import Button from "~/components/Button";
import { routes } from "~/routes";

export default function Register() {
  const navigate = useNavigate();
  const [username, setUsername] = createSignal("");
  const [email, setEmail] = createSignal("");
  const [password, setPassword] = createSignal("");
  const [confirmPassword, setConfirmPassword] = createSignal("");
  const [error, setError] = createSignal("");
  const [success, setSuccess] = createSignal(false);
  const [loading, setLoading] = createSignal(false);

  const handleRegister = async (e: Event) => {
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

    if (!username().trim() || !email().trim()) {
      setError("Username and email are required");
      return;
    }

    setLoading(true);
    try {
      await api.register(username(), email(), password());
      setSuccess(true);
      setTimeout(() => {
        navigate(routes.login);
      }, 2000);
    } catch (err: any) {
      setError(err.message || "Registration failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div class="min-h-screen bg-neutral-950 dark:bg-neutral-950 light:bg-neutral-100 flex items-center justify-center p-4">
      <div class="w-full max-w-md">
        <div class="flex gap-4 items-center justify-center mb-8">
          <Logo color="#2a9d8f" size="48" />
          <span class="text-4xl font-bold text-neutral-100 dark:text-neutral-100 light:text-neutral-900 mb-2">
            plumio
          </span>
        </div>

        <div class="bg-neutral-900 dark:bg-neutral-900 light:bg-neutral-50 rounded-lg p-8 border border-neutral-800 dark:border-neutral-800 light:border-neutral-300 light:shadow-xl">
          <h2 class="text-2xl font-semibold text-neutral-100 dark:text-neutral-100 light:text-neutral-900 mb-6">
            Create Account
          </h2>

          <Show when={success()}>
            <div class="mb-4 p-3 bg-green-500/10 border border-green-500/20 rounded-lg text-green-400">
              Registration successful! Redirecting to login...
            </div>
          </Show>

          <Show when={error()}>
            <div class="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400">
              {error()}
            </div>
          </Show>

          <form onSubmit={handleRegister}>
            <div class="mb-4">
              <label class="block font-medium text-neutral-300 dark:text-neutral-300 light:text-neutral-700 mb-2">
                Username
              </label>
              <input
                type="text"
                value={username()}
                onInput={(e) => setUsername(e.currentTarget.value)}
                required
                disabled={loading() || success()}
                class="w-full px-3 py-2 bg-neutral-950 dark:bg-neutral-950 light:bg-white border border-neutral-800 dark:border-neutral-800 light:border-neutral-300 rounded-lg text-neutral-200 dark:text-neutral-200 light:text-neutral-900 placeholder-neutral-600 dark:placeholder-neutral-600 light:placeholder-neutral-400 focus:outline-none focus:border-neutral-700 dark:focus:border-neutral-700 light:focus:border-neutral-500 disabled:opacity-50"
                placeholder="Choose a username"
              />
            </div>

            <div class="mb-4">
              <label class="block font-medium text-neutral-300 dark:text-neutral-300 light:text-neutral-700 mb-2">
                Email
              </label>
              <input
                type="email"
                value={email()}
                onInput={(e) => setEmail(e.currentTarget.value)}
                required
                disabled={loading() || success()}
                class="w-full px-3 py-2 bg-neutral-950 dark:bg-neutral-950 light:bg-white border border-neutral-800 dark:border-neutral-800 light:border-neutral-300 rounded-lg text-neutral-200 dark:text-neutral-200 light:text-neutral-900 placeholder-neutral-600 dark:placeholder-neutral-600 light:placeholder-neutral-400 focus:outline-none focus:border-neutral-700 dark:focus:border-neutral-700 light:focus:border-neutral-500 disabled:opacity-50"
                placeholder="your@email.com"
              />
            </div>

            <div class="mb-4">
              <label class="block font-medium text-neutral-300 dark:text-neutral-300 light:text-neutral-700 mb-2">
                Password
              </label>
              <input
                type="password"
                value={password()}
                onInput={(e) => setPassword(e.currentTarget.value)}
                required
                disabled={loading() || success()}
                class="w-full px-3 py-2 bg-neutral-950 dark:bg-neutral-950 light:bg-white border border-neutral-800 dark:border-neutral-800 light:border-neutral-300 rounded-lg text-neutral-200 dark:text-neutral-200 light:text-neutral-900 placeholder-neutral-600 dark:placeholder-neutral-600 light:placeholder-neutral-400 focus:outline-none focus:border-neutral-700 dark:focus:border-neutral-700 light:focus:border-neutral-500 disabled:opacity-50"
                placeholder="At least 8 characters"
              />
            </div>

            <div class="mb-6">
              <label class="block font-medium text-neutral-300 dark:text-neutral-300 light:text-neutral-700 mb-2">
                Confirm Password
              </label>
              <input
                type="password"
                value={confirmPassword()}
                onInput={(e) => setConfirmPassword(e.currentTarget.value)}
                required
                disabled={loading() || success()}
                class="w-full px-3 py-2 bg-neutral-950 dark:bg-neutral-950 light:bg-white border border-neutral-800 dark:border-neutral-800 light:border-neutral-300 rounded-lg text-neutral-200 dark:text-neutral-200 light:text-neutral-900 placeholder-neutral-600 dark:placeholder-neutral-600 light:placeholder-neutral-400 focus:outline-none focus:border-neutral-700 dark:focus:border-neutral-700 light:focus:border-neutral-500 disabled:opacity-50"
                placeholder="Confirm your password"
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
                <span class="ml-2">Creating account...</span>
              </Show>
              <Show when={!loading()}>Create Account</Show>
            </Button>
          </form>

          <div class="mt-6 text-center">
            <span class="text-neutral-400 dark:text-neutral-400 light:text-neutral-600">
              Already have an account?
            </span>
            <button
              onClick={() => navigate(routes.login)}
              class="ml-2 text-primary hover:underline cursor-pointer"
            >
              Login
            </button>
          </div>
        </div>

        <p class="text-center text-neutral-600 mt-6">
          Your data is encrypted and stored locally on your server
        </p>
      </div>
    </div>
  );
}
