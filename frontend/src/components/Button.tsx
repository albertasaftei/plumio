import { JSX, splitProps } from "solid-js";

type ButtonVariant = "primary" | "secondary" | "ghost" | "icon";
type ButtonSize = "sm" | "md" | "lg";

interface ButtonProps extends JSX.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  fullWidth?: boolean;
  icon?: JSX.Element;
  iconPosition?: "left" | "right";
  active?: boolean;
}

export default function Button(props: ButtonProps) {
  const [local, others] = splitProps(props, [
    "variant",
    "size",
    "fullWidth",
    "icon",
    "iconPosition",
    "active",
    "class",
    "children",
  ]);

  const variant = () => local.variant || "secondary";
  const size = () => local.size || "md";
  const iconPosition = () => local.iconPosition || "left";

  const baseClasses = "rounded-lg transition-colors cursor-pointer";

  const variantClasses = () => {
    const v = variant();
    const classes = {
      primary: local.active
        ? "bg-primary hover:bg-primary-dark text-white"
        : "bg-primary hover:bg-primary-dark text-white",
      secondary: local.active
        ? "bg-neutral-700 text-neutral-100"
        : "bg-neutral-800 hover:bg-neutral-700 text-neutral-200",
      ghost: local.active
        ? "bg-neutral-700 text-neutral-100"
        : "text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800",
      icon: "hover:bg-neutral-800 text-neutral-400",
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

  const widthClass = () => (local.fullWidth ? "flex-1" : "");

  const classes = () =>
    `${baseClasses} ${variantClasses()} ${sizeClasses()} ${widthClass()} ${local.class || ""}`;

  return (
    <button class={classes()} {...others}>
      {local.icon && iconPosition() === "left" && (
        <span class={local.children ? "mr-2" : ""}>{local.icon}</span>
      )}
      {local.children}
      {local.icon && iconPosition() === "right" && (
        <span class={local.children ? "ml-2" : ""}>{local.icon}</span>
      )}
    </button>
  );
}
