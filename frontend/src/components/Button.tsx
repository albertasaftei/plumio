import { JSX, splitProps } from "solid-js";

type ButtonVariant =
  | "primary"
  | "secondary"
  | "ghost"
  | "icon"
  | "danger"
  | "warning";
type ButtonSize = "sm" | "md" | "lg";

interface ButtonProps extends JSX.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  fullWidth?: boolean;
  active?: boolean;
}

export default function Button(props: ButtonProps) {
  const [local, others] = splitProps(props, [
    "variant",
    "size",
    "fullWidth",
    "active",
    "class",
    "children",
  ]);

  const variant = () => local.variant || "none";
  const size = () => local.size || "md";

  const baseClasses =
    "flex items-center gap-2 rounded-lg transition-all duration-150 cursor-pointer active:scale-95";

  const variantClasses = () => {
    const v = variant();
    const classes = {
      primary: local.active
        ? "bg-primary-dark text-white ring-2 ring-primary/50 ring-offset-2 ring-offset-[var(--color-bg-base)]"
        : "bg-primary hover:bg-primary-dark text-white hover:scale-[1.02]",
      secondary: local.active
        ? "bg-elevated text-body border border-base"
        : "bg-surface hover:bg-elevated text-body border border-base",
      ghost: local.active
        ? "bg-elevated text-body"
        : "text-secondary-body hover:text-body hover:bg-elevated",
      danger: local.active
        ? "bg-red-700 text-white ring-2 ring-red-500/50 ring-offset-2 ring-offset-[var(--color-bg-base)]"
        : "bg-red-600 hover:bg-red-500 text-white",
      warning: local.active
        ? "bg-yellow-700 text-white ring-2 ring-yellow-500/50 ring-offset-2 ring-offset-[var(--color-bg-base)]"
        : "bg-yellow-700 hover:bg-yellow-600 text-white",

      icon: "hover:bg-elevated text-secondary-body",
      none: "",
    };
    return classes[v];
  };

  const sizeClasses = () => {
    const v = variant();
    const s = size();
    const classes = {
      sm: v === "icon" ? "p-1" : "px-2 py-1.5 text-sm",
      md: v === "icon" ? "p-1.5" : "px-3 py-2",
      lg: v === "icon" ? "p-2" : "px-4 py-2",
    };
    return classes[s];
  };

  const widthClass = () => (local.fullWidth ? "w-full" : "");

  const classes = () => {
    const defaultClasses = `${baseClasses} ${variantClasses()} ${sizeClasses()} ${widthClass()}`;
    return local.class ? `${defaultClasses} ${local.class}` : defaultClasses;
  };

  return (
    <button class={classes()} {...others}>
      {local.children}
    </button>
  );
}
