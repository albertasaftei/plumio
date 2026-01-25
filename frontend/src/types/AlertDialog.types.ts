import type { JSX } from "solid-js";

export interface AlertDialogProps {
  isOpen: boolean;
  title: string;
  message?: string;
  children?: JSX.Element;
  confirmText?: string;
  cancelText?: string;
  onConfirm?: () => void;
  onCancel?: () => void;
  variant?: "danger" | "warning" | "info";
  showActions?: boolean;
  showCloseIcon?: boolean;
}
