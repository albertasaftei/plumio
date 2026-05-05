import { Show, createSignal } from "solid-js";
import { clearDemoStorage } from "../lib/demo/demo-storage";
import Button from "./Button";
import { useI18n } from "~/i18n";

const isDemoMode = import.meta.env.VITE_DEMO_MODE === "true";

export function DemoBanner() {
  const { t } = useI18n();
  const [isOpen, setIsOpen] = createSignal(true);

  const handleReset = () => {
    if (confirm(t("demo.resetConfirm"))) {
      clearDemoStorage();
      window.location.reload();
    }
  };

  return (
    <Show when={isDemoMode}>
      {/* Floating Button */}
      <div onClick={() => setIsOpen(true)} class="fixed bottom-4 right-4 z-50">
        <button class="bg-amber-400 p-2 rounded-md cursor-pointer">
          <div class="i-carbon-information w-7 h-7 lg:w-5 lg:h-5 text-neutral-900" />
        </button>
      </div>

      {/* Info Box */}
      <Show when={isOpen()}>
        <div class="fixed bottom-20 right-4 z-50 bg-surface rounded-lg shadow-2xl border border-amber-400 w-80 p-4">
          <div class="flex items-start justify-between mb-3">
            <div class="flex items-center gap-2">
              <div class="w-2 h-2 rounded-full bg-amber-400 animate-pulse"></div>
              <h3 class="font-bold text-amber-400">{t("demo.title")}</h3>
            </div>
          </div>

          <p class="text-sm text-body mb-4">
            {t("demo.description")}
          </p>

          <div class="flex gap-2">
            <Button class="justify-center flex-1 bg-amber-400">
              <span onClick={handleReset}>{t("demo.reset")}</span>
            </Button>
            <Button variant="secondary" class="justify-center">
              <span onClick={() => setIsOpen(false)}>{t("common.close")}</span>
            </Button>
          </div>
        </div>
      </Show>
    </Show>
  );
}
