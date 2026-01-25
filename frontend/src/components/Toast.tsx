import { createSignal, Show, onMount } from "solid-js";
import "~/styles/animations.css";

interface ToastProps {
  message: string;
  type?: "success" | "error" | "info" | "warning";
  duration?: number;
  onClose: () => void;
}

export default function Toast(props: ToastProps) {
  const [visible, setVisible] = createSignal(true);
  const type = () => props.type || "info";
  const duration = () => props.duration || 4000;

  onMount(() => {
    const timer = setTimeout(() => {
      setVisible(false);
      setTimeout(() => props.onClose(), 300); // Wait for animation
    }, duration());

    return () => {
      clearTimeout(timer);
    };
  });

  const typeStyles = () => {
    const styles = {
      success: "bg-green-500/90 border-green-400",
      error: "bg-red-500/90 border-red-400",
      warning: "bg-yellow-500/90 border-yellow-400",
      info: "bg-blue-500/90 border-blue-400",
    };
    return styles[type()];
  };

  const iconClass = () => {
    const icons = {
      success: "i-carbon-checkmark-filled",
      error: "i-carbon-warning-filled",
      warning: "i-carbon-warning-alt-filled",
      info: "i-carbon-information-filled",
    };
    return icons[type()];
  };

  return (
    <Show when={visible()}>
      <div
        class={`fixed bottom-6 right-6 z-[100] rounded-lg border shadow-xl text-white overflow-hidden transform transition-all duration-300 ease-out animate-toast-slide-in ${typeStyles()} ${
          visible()
            ? "translate-x-0 opacity-100 scale-100"
            : "translate-x-8 opacity-0 scale-95"
        }`}
      >
        <div class="flex items-center gap-3 px-4 py-3 relative z-10">
          <div class={`${iconClass()} w-5 h-5 flex-shrink-0`} />
          <span class="text-sm font-medium">{props.message}</span>
          <button
            onClick={() => {
              setVisible(false);
              setTimeout(() => props.onClose(), 300);
            }}
            class="ml-2 hover:opacity-80 transition-opacity flex-shrink-0 cursor-pointer"
          >
            <div class="i-carbon-close w-4 h-4" />
          </button>
        </div>
      </div>
    </Show>
  );
}
