import { createSignal, onMount } from "solid-js";
import { api } from "~/lib/api";
import { initializeTheme, Theme, useTheme } from "~/lib/theme";

export default function Account() {
  const [username, setUsername] = createSignal<string | null>(null);
  const [theme, setTheme] = useTheme();

  onMount(async () => {
    initializeTheme();
    // Get current username from API
    const currentUsername = await api.getUsername();
    setUsername(currentUsername);
  });

  const handleThemeToggle = () => {
    const newTheme: Theme = theme() === "dark" ? "light" : "dark";
    setTheme(newTheme);
  };

  return (
    <div class="space-y-4 bg-elevated rounded-lg p-6 border border-transparent light:border-base light:shadow-sm">
      <div>
        <h3 class="text-lg font-semibold text-body mb-2">
          Profile
        </h3>
        <div class="space-y-4">
          <div>
            <label class="block text-sm font-medium text-secondary-body mb-1">
              Username
            </label>
            <div class="text-body">
              {username() || "Loading..."}
            </div>
          </div>
        </div>
      </div>
      <div>
        <h3 class="text-lg font-semibold text-body mb-2">
          Theme
        </h3>
        <div class="space-y-4">
          <div class="flex items-center justify-between">
            <div class="flex-1">
              <label class="block text-sm font-medium text-secondary-body mb-1">
                Appearance
              </label>
              <p class="text-sm text-muted-body">
                Choose between light and dark mode
              </p>
            </div>
            <button
              onClick={handleThemeToggle}
              class="relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 dark:focus:ring-offset-neutral-800 light:focus:ring-offset-white cursor-pointer"
              classList={{
                "bg-primary": theme() === "dark",
                "bg-neutral-600 dark:bg-neutral-600 light:bg-neutral-300":
                  theme() === "light",
              }}
              aria-label="Toggle theme"
            >
              <span
                class="inline-block h-4 w-4 transform rounded-full bg-white transition-transform"
                classList={{
                  "translate-x-6": theme() === "dark",
                  "translate-x-1": theme() === "light",
                }}
              />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
