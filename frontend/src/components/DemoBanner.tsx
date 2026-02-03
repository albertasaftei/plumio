import { Show } from "solid-js";
import { clearDemoStorage } from "../lib/demo/demo-storage";

const isDemoMode = import.meta.env.VITE_DEMO_MODE === "true";

export function DemoBanner() {
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
      <div class="fixed top-0 z-10 w-full bg-amber-400/50 border-b px-4 py-2 text-sm text-amber-900 flex items-center justify-between">
        <div></div>
        <div class="flex items-center gap-2">
          <span class="font-bold text-amber-100">Demo Mode</span>
          <span> - </span>
          <span class="text-amber-100">
            All data is stored in your browser's localStorage.
          </span>
        </div>
        <div class="flex items-center gap-3">
          <button
            onClick={handleReset}
            class="text-amber-100 hover:text-amber-200 underline text-xs cursor-pointer"
          >
            Reset Demo
          </button>
        </div>
      </div>
    </Show>
  );
}
