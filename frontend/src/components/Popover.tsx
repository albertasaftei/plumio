import { Show, children, createSignal, onMount, onCleanup } from "solid-js";
import type { PopoverProps, PopoverItemProps } from "~/types/Popover.types";
import "~/styles/animations.css";

export default function Popover(props: PopoverProps) {
  let popoverRef: HTMLDivElement | undefined;
  let triggerRef: HTMLDivElement | undefined;

  // Close popover when clicking outside
  const handleClickOutside = (e: MouseEvent) => {
    if (
      props.isOpen &&
      popoverRef &&
      triggerRef &&
      !popoverRef.contains(e.target as Node) &&
      !triggerRef.contains(e.target as Node)
    ) {
      props.onClose();
    }
  };

  onMount(() => {
    if (typeof document !== "undefined") {
      document.addEventListener("mousedown", handleClickOutside);
    }
  });

  onCleanup(() => {
    if (typeof document !== "undefined") {
      document.removeEventListener("mousedown", handleClickOutside);
    }
  });

  return (
    <div class="relative flex items-center">
      <div ref={triggerRef}>{props.trigger}</div>
      <Show when={props.isOpen}>
        <div
          ref={popoverRef}
          class="absolute right-0 top-full mt-1 bg-neutral-800 border border-neutral-700 rounded-lg shadow-lg z-50 min-w-32 py-1 animate-slide-down"
        >
          {props.children}
        </div>
      </Show>
    </div>
  );
}

export function PopoverItem(props: PopoverItemProps) {
  const textColor =
    props.variant === "danger" ? "text-red-400" : "text-neutral-200";

  return (
    <button
      onClick={props.onClick}
      disabled={props.disabled}
      class={`w-full px-3 py-2 text-left text-sm ${textColor} hover:bg-neutral-700 transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed`}
    >
      <Show when={props.icon}>
        <div class={`${props.icon} w-4 h-4`} />
      </Show>
      {props.label}
    </button>
  );
}
