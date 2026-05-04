import { createSignal, For, onMount } from "solid-js";
import { getVimMode, setVimMode } from "~/lib/editorPreferences";
import { initializeTheme, Theme, THEME_META, useTheme } from "~/lib/theme";
import ThemeSwatch from "~/components/ThemeSwatch";
import { api } from "~/lib/api";

interface ToggleProps {
  enabled: boolean;
  onChange: (value: boolean) => void;
}

function Toggle(props: ToggleProps) {
  return (
    <button
      onClick={() => props.onChange(!props.enabled)}
      class="relative inline-flex h-6 w-11 items-center rounded-full transition-colors cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 dark:focus:ring-offset-neutral-800 light:focus:ring-offset-white"
      classList={{
        "bg-primary": props.enabled,
        "bg-neutral-600 dark:bg-neutral-600 light:bg-neutral-300":
          !props.enabled,
      }}
      role="switch"
      aria-checked={props.enabled}
    >
      <span
        class="inline-block h-4 w-4 transform rounded-full bg-white transition-transform"
        classList={{
          "translate-x-6": props.enabled,
          "translate-x-1": !props.enabled,
        }}
      />
    </button>
  );
}

export default function EditorPreferences() {
  const [vimEnabled, setVimEnabled] = createSignal(getVimMode());
  const [theme, setTheme] = useTheme();
  const themes = Object.entries(THEME_META) as [
    Theme,
    (typeof THEME_META)[Theme],
  ][];

  onMount(() => {
    initializeTheme();
  });

  const handleVimToggle = (value: boolean) => {
    setVimMode(value);
    setVimEnabled(value);
  };

  const handleThemeSelect = (id: Theme) => {
    setTheme(id);
    api.updatePreferences({ theme: id }).catch(() => {});
  };

  return (
    <div class="space-y-6">
      {/* Theme */}
      <div class="bg-elevated rounded-lg p-6 border border-transparent light:border-base light:shadow-sm">
        <h3 class="text-xl font-semibold text-body mb-1">Theme</h3>
        <p class="text-sm text-muted-body mb-4">
          Pick an appearance that suits you.
        </p>
        <div class="grid grid-cols-3 sm:grid-cols-5 gap-3">
          <For each={themes}>
            {([id]) => (
              <ThemeSwatch
                id={id}
                isActive={theme() === id}
                onSelect={handleThemeSelect}
              />
            )}
          </For>
        </div>
      </div>
      {/* Vim Mode */}
      <div class="bg-elevated rounded-lg p-6 border border-transparent light:border-base light:shadow-sm">
        <h3 class="text-xl font-semibold text-body mb-1">Keybindings</h3>
        <p class="text-sm text-muted-body mb-4">
          Customize how you interact with the editor.
        </p>

        <div class="space-y-4">
          <div class="flex items-center justify-between gap-4">
            <div class="flex-1">
              <label class="block text-sm font-medium text-secondary-body mb-1">
                Vim motions
              </label>
              <p class="text-sm text-muted-body">
                Enable modal editing with Vim keybindings (h/j/k/l, w/b/e,
                dd/yy/p, visual mode, and more). Applies to the live preview
                editor. Changes take effect after navigating to a document.
              </p>
            </div>
            <Toggle enabled={vimEnabled()} onChange={handleVimToggle} />
          </div>
        </div>
      </div>

      {/* Vim cheatsheet — shown only when vim is enabled */}
      {vimEnabled() && (
        <div class="bg-elevated rounded-lg p-6 border border-transparent light:border-base light:shadow-sm">
          <h3 class="text-xl font-semibold text-body mb-4">
            Vim quick reference
          </h3>
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-6 text-sm">
            <div>
              <p class="font-medium text-secondary-body mb-2">Navigation</p>
              <div class="space-y-1 font-mono text-muted-body">
                <p>
                  <span class="text-body">h j k l</span> — left / down / up /
                  right
                </p>
                <p>
                  <span class="text-body">w / b / e</span> — next word / prev
                  word / word end
                </p>
                <p>
                  <span class="text-body">0 / $</span> — line start / line end
                </p>
                <p>
                  <span class="text-body">gg / G</span> — document start / end
                </p>
              </div>
            </div>
            <div>
              <p class="font-medium text-secondary-body mb-2">Insert mode</p>
              <div class="space-y-1 font-mono text-muted-body">
                <p>
                  <span class="text-body">i / a</span> — insert before / after
                  cursor
                </p>
                <p>
                  <span class="text-body">I / A</span> — insert at line start /
                  end
                </p>
                <p>
                  <span class="text-body">o / O</span> — new line below / above
                </p>
                <p>
                  <span class="text-body">Esc / Ctrl+[</span> — back to normal
                </p>
              </div>
            </div>
            <div>
              <p class="font-medium text-secondary-body mb-2">Editing</p>
              <div class="space-y-1 font-mono text-muted-body">
                <p>
                  <span class="text-body">x</span> — delete char
                </p>
                <p>
                  <span class="text-body">dd / yy</span> — delete / yank line
                </p>
                <p>
                  <span class="text-body">p / P</span> — paste after / before
                </p>
                <p>
                  <span class="text-body">r{"{char}"}</span> — replace char
                </p>
              </div>
            </div>
            <div>
              <p class="font-medium text-secondary-body mb-2">Visual mode</p>
              <div class="space-y-1 font-mono text-muted-body">
                <p>
                  <span class="text-body">v</span> — enter visual mode
                </p>
                <p>
                  <span class="text-body">h j k l w b</span> — extend selection
                </p>
                <p>
                  <span class="text-body">y</span> — yank selection
                </p>
                <p>
                  <span class="text-body">d / x</span> — delete selection
                </p>
                <p>
                  <span class="text-body">Esc</span> — back to normal
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
