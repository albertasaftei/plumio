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
      <div class="bg-amber-100 border-b border-amber-200 px-4 py-2 text-sm text-amber-900 flex items-center justify-between">
        <div class="flex items-center gap-2">
          <span class="font-medium">Demo Mode</span>
          <span class="text-amber-700">
            All data is stored in your browser's localStorage.
          </span>
        </div>
        <div class="flex items-center gap-3">
          <button
            onClick={handleReset}
            class="text-amber-700 hover:text-amber-900 underline text-xs"
          >
            Reset Demo
          </button>
        </div>
      </div>
    </Show>
  );
}
