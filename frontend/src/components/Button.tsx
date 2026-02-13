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
    "flex items-center gap-2 rounded-lg transition-all duration-150 cursor-pointer active:scale-95 hover:scale-[1.02]";

  const variantClasses = () => {
    const v = variant();
    const classes = {
      primary: local.active
        ? "bg-primary hover:bg-primary-dark text-white"
        : "bg-primary hover:bg-primary-dark text-white",
      secondary: local.active
        ? "bg-neutral-700 text-neutral-100 border border-neutral-600"
        : "bg-neutral-800 hover:bg-neutral-700 text-neutral-200 border border-neutral-700",
      ghost: local.active
        ? "bg-neutral-700 text-neutral-100"
        : "text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800",
      danger: local.active
        ? "bg-red-600 text-white"
        : "bg-red-600 hover:bg-red-500 text-white",
      warning: local.active
        ? "bg-yellow-600 text-white"
        : "bg-yellow-700 hover:bg-yellow-600 text-white",

      icon: "hover:bg-neutral-800 text-neutral-400",
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
