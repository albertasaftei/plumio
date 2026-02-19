import { Show } from "solid-js";
import Button from "./Button";
import type { AlertDialogProps } from "~/types/AlertDialog.types";
import "~/styles/animations.css";

export default function AlertDialog(props: AlertDialogProps) {
  const confirmText = () => props.confirmText || "Confirm";
  const cancelText = () => props.cancelText || "Cancel";
  const showActions = () => props.showActions ?? true;

  const buttonVariant = () => {
    switch (props.variant) {
      case "danger":
        return "danger" as const;
      case "warning":
        return "warning" as const;
      case "info":
      default:
        return "primary" as const;
    }
  };

  return (
    <Show when={props.isOpen}>
      {/* Backdrop */}
      <div
        class="fixed inset-0 bg-black/70 z-[100] flex items-center justify-center p-4 animate-dialog-fade-in"
        onClick={props.onCancel}
      >
        {/* Dialog */}
        <div
          class="bg-neutral-900 dark:bg-neutral-900 light:bg-neutral-50 border border-neutral-700 dark:border-neutral-700 light:border-neutral-300 rounded-lg shadow-xl light:shadow-2xl max-w-4xl w-full p-6 animate-dialog-scale-in relative"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Close Icon */}
          <Show when={props.showCloseIcon}>
            <Button
              onClick={props.onCancel}
              variant="icon"
              size="md"
              title="Close"
              class="absolute top-4 right-4"
            >
              <div class="i-carbon-close w-5 h-5" />
            </Button>
          </Show>

          {/* Title */}
          <h2 class="text-xl font-semibold text-neutral-100 dark:text-neutral-100 light:text-neutral-900 mb-3">
            {props.title}
          </h2>

          {/* Message or Custom Content */}
          <Show
            when={props.children}
            fallback={
              <p class="text-neutral-300 dark:text-neutral-300 light:text-neutral-700 mb-6 leading-relaxed">
                {props.message}
              </p>
            }
          >
            {props.children}
          </Show>

          {/* Actions */}
          <Show when={showActions()}>
            <div class="flex gap-3 justify-end">
              <Button onClick={props.onCancel} variant="secondary" size="md">
                {cancelText()}
              </Button>
              <Button
                onClick={props.onConfirm}
                variant={buttonVariant()}
                size="md"
              >
                {confirmText()}
              </Button>
            </div>
          </Show>
        </div>
      </div>
    </Show>
  );
}
