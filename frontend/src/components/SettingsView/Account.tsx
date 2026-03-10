import { createSignal, onMount, For } from "solid-js";
import { api } from "~/lib/api";
import { initializeTheme, Theme, THEME_META, useTheme } from "~/lib/theme";
import ThemeSwatch from "~/components/ThemeSwatch";

export default function Account() {
  const [username, setUsername] = createSignal<string | null>(null);
  const [theme, setTheme] = useTheme();

  onMount(async () => {
    initializeTheme();
    const currentUsername = await api.getUsername();
    setUsername(currentUsername);
  });

  const themes = Object.entries(THEME_META) as [
    Theme,
    (typeof THEME_META)[Theme],
  ][];

  return (
    <div class="space-y-4 bg-elevated rounded-lg p-6 border border-transparent light:border-base light:shadow-sm">
      <div>
        <h3 class="text-lg font-semibold text-body mb-2">Profile</h3>
        <div class="space-y-4">
          <div>
            <label class="block text-sm font-medium text-secondary-body mb-1">
              Username
            </label>
            <div class="text-body">{username() || "Loading..."}</div>
          </div>
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
    </div>
  );
}
