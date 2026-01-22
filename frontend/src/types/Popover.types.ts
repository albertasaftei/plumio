import type { JSX } from "solid-js";

export interface PopoverProps {
  trigger: JSX.Element;
  isOpen: boolean;
  onClose: () => void;
  children: JSX.Element;
}

export interface PopoverItemProps {
  icon?: string;
  label: string;
  onClick: (e: MouseEvent) => void;
  variant?: "default" | "danger";
}
