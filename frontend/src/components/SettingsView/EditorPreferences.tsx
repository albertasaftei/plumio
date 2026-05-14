import { createSignal, For, onMount } from "solid-js";
import { getVimMode, setVimMode } from "~/lib/editorPreferences";
import { initializeTheme, Theme, THEME_META, useTheme } from "~/lib/theme";
import ThemeSwatch from "~/components/ThemeSwatch";
import { api } from "~/lib/api";
import { useI18n } from "~/i18n";
import Toggle from "~/components/Toggle";

export default function EditorPreferences() {
  const { t } = useI18n();
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
        <h3 class="text-xl font-semibold text-body mb-1">
          {t("editorPrefs.themeTitle")}
        </h3>
        <p class="text-sm text-muted-body mb-4">{t("editorPrefs.themeDesc")}</p>
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
        <h3 class="text-xl font-semibold text-body mb-1">
          {t("editorPrefs.keybindingsTitle")}
        </h3>
        <p class="text-sm text-muted-body mb-4">
          {t("editorPrefs.keybindingsDesc")}
        </p>

        <div class="space-y-4">
          <div class="flex items-center justify-between gap-4">
            <div class="flex-1">
              <label class="block text-sm font-medium text-secondary-body mb-1">
                {t("editorPrefs.vimLabel")}
              </label>
              <p class="text-sm text-muted-body">{t("editorPrefs.vimDesc")}</p>
            </div>
            <Toggle enabled={vimEnabled()} onChange={handleVimToggle} />
          </div>
        </div>
      </div>

      {/* Vim cheatsheet */}
      {vimEnabled() && (
        <div class="bg-elevated rounded-lg p-6 border border-transparent light:border-base light:shadow-sm">
          <h3 class="text-xl font-semibold text-body mb-4">
            {t("editorPrefs.vimRefTitle")}
          </h3>
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-6 text-sm">
            <div>
              <p class="font-medium text-secondary-body mb-2">
                {t("editorPrefs.vimNavTitle")}
              </p>
              <div class="space-y-1 font-mono text-muted-body">
                <p>
                  <span class="text-body">h j k l</span>{" "}
                  {t("editorPrefs.vimNav1")}
                </p>
                <p>
                  <span class="text-body">w / b / e</span>{" "}
                  {t("editorPrefs.vimNav2")}
                </p>
                <p>
                  <span class="text-body">0 / $</span>{" "}
                  {t("editorPrefs.vimNav3")}
                </p>
                <p>
                  <span class="text-body">gg / G</span>{" "}
                  {t("editorPrefs.vimNav4")}
                </p>
              </div>
            </div>

            <div>
              <p class="font-medium text-secondary-body mb-2">
                {t("editorPrefs.vimInsertTitle")}
              </p>
              <div class="space-y-1 font-mono text-muted-body">
                <p>
                  <span class="text-body">i / a</span>{" "}
                  {t("editorPrefs.vimInsert1")}
                </p>
                <p>
                  <span class="text-body">I / A</span>{" "}
                  {t("editorPrefs.vimInsert2")}
                </p>
                <p>
                  <span class="text-body">o / O</span>{" "}
                  {t("editorPrefs.vimInsert3")}
                </p>
                <p>
                  <span class="text-body">Esc / Ctrl+[</span>{" "}
                  {t("editorPrefs.vimInsert4")}
                </p>
              </div>
            </div>

            <div>
              <p class="font-medium text-secondary-body mb-2">
                {t("editorPrefs.vimEditTitle")}
              </p>
              <div class="space-y-1 font-mono text-muted-body">
                <p>
                  <span class="text-body">x</span> {t("editorPrefs.vimEdit1")}
                </p>
                <p>
                  <span class="text-body">dd / yy</span>{" "}
                  {t("editorPrefs.vimEdit2")}
                </p>
                <p>
                  <span class="text-body">p / P</span>{" "}
                  {t("editorPrefs.vimEdit3")}
                </p>
                <p>
                  <span class="text-body">{"r{char}"}</span>{" "}
                  {t("editorPrefs.vimEdit4")}
                </p>
              </div>
            </div>

            <div>
              <p class="font-medium text-secondary-body mb-2">
                {t("editorPrefs.vimVisualTitle")}
              </p>
              <div class="space-y-1 font-mono text-muted-body">
                <p>
                  <span class="text-body">v</span> {t("editorPrefs.vimVisual1")}
                </p>
                <p>
                  <span class="text-body">h j k l w b</span>{" "}
                  {t("editorPrefs.vimVisual2")}
                </p>
                <p>
                  <span class="text-body">y</span> {t("editorPrefs.vimVisual3")}
                </p>
                <p>
                  <span class="text-body">d / x</span>{" "}
                  {t("editorPrefs.vimVisual4")}
                </p>
                <p>
                  <span class="text-body">Esc</span>{" "}
                  {t("editorPrefs.vimVisual5")}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
