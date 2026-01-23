import { Show } from "solid-js";
import Button from "./Button";
import type { AlertDialogProps } from "~/types/AlertDialog.types";

export default function AlertDialog(props: AlertDialogProps) {
  const confirmText = () => props.confirmText || "Confirm";
  const cancelText = () => props.cancelText || "Cancel";

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
        class="fixed inset-0 bg-black/70 z-[100] flex items-center justify-center p-4"
        onClick={props.onCancel}
      >
        {/* Dialog */}
        <div
          class="bg-neutral-900 border border-neutral-700 rounded-lg shadow-xl max-w-md w-full p-6"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Title */}
          <h2 class="text-xl font-semibold text-neutral-100 mb-3">
            {props.title}
          </h2>

          {/* Message */}
          <p class="text-neutral-300 mb-6 leading-relaxed">{props.message}</p>

          {/* Actions */}
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
        </div>
      </div>
    </Show>
  );
}
