import { Show, createSignal } from "solid-js";
import { clearDemoStorage } from "../lib/demo/demo-storage";
import Button from "./Button";

const isDemoMode = import.meta.env.VITE_DEMO_MODE === "true";

export function DemoBanner() {
  const [isOpen, setIsOpen] = createSignal(true);

  const handleReset = () => {
    if (
      confirm("This will clear all demo data and reload the page. Continue?")
    ) {
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
        <div class="fixed bottom-20 right-4 z-50 bg-neutral-900 rounded-lg shadow-2xl border border-amber-400 w-80 p-4">
          <div class="flex items-start justify-between mb-3">
            <div class="flex items-center gap-2">
              <div class="w-2 h-2 rounded-full bg-amber-400 animate-pulse"></div>
              <h3 class="font-bold text-amber-400">Demo Mode</h3>
            </div>
          </div>

          <p class="text-sm text-neutral-200 mb-4">
            All data is stored in your browser's localStorage. Changes are not
            persisted to a server.
          </p>

          <div class="flex gap-2">
            <Button class="justify-center flex-1 bg-amber-400">
              <span onClick={handleReset}>Reset demo data</span>
            </Button>
            <Button variant="secondary" class="justify-center">
              <span onClick={() => setIsOpen(false)}>Close</span>
            </Button>
          </div>
        </div>
      </Show>
    </Show>
  );
}
