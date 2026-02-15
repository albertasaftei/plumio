import { createSignal, createEffect, ParentComponent, JSX } from "solid-js";

interface ResizableContainerProps {
  initialSize?: number;
  minSize?: number;
  maxSize?: number;
  resizeFrom?: "top" | "bottom" | "left" | "right";
  class?: string;
  classList?: { [key: string]: boolean };
  style?: JSX.CSSProperties;
  onResize?: (size: number) => void;
}

export const ResizableContainer: ParentComponent<ResizableContainerProps> = (
  props,
) => {
  const [size, setSize] = createSignal(props.initialSize ?? 320);
  const [isResizing, setIsResizing] = createSignal(false);

  let containerRef: HTMLDivElement | undefined;

  const isHorizontal = () =>
    props.resizeFrom === "left" || props.resizeFrom === "right";
  const isVertical = () =>
    props.resizeFrom === "top" || props.resizeFrom === "bottom";

  const handleMouseDown = (e: MouseEvent) => {
    setIsResizing(true);
    e.preventDefault();
  };

  const handleMouseMove = (e: MouseEvent) => {
    if (!isResizing() || !containerRef) return;

    let newSize: number;

    if (props.resizeFrom === "right") {
      newSize = e.clientX - containerRef.getBoundingClientRect().left;
    } else if (props.resizeFrom === "left") {
      newSize = containerRef.getBoundingClientRect().right - e.clientX;
    } else if (props.resizeFrom === "bottom") {
      newSize = e.clientY - containerRef.getBoundingClientRect().top;
    } else if (props.resizeFrom === "top") {
      newSize = containerRef.getBoundingClientRect().bottom - e.clientY;
    } else {
      return;
    }

    const minSize = props.minSize ?? 200;
    const maxSize = props.maxSize ?? 800;

    if (newSize >= minSize && newSize <= maxSize) {
      setSize(newSize);
      props.onResize?.(newSize);
    }
  };

  const handleMouseUp = () => {
    setIsResizing(false);
  };

  createEffect(() => {
    if (isResizing()) {
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = isHorizontal() ? "col-resize" : "row-resize";
      document.body.style.userSelect = "none";
    } else {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    }
  });

  const getHandleClasses = () => {
    const hover = "hover:bg-primary/50 transition-colors";
    const resizing = isResizing() ? "bg-primary/50" : "";
    const base = `absolute ${hover} ${resizing} group`;

    switch (props.resizeFrom) {
      case "right":
        return `${base} top-0 right-0 w-1 h-full`;
      case "left":
        return `${base} top-0 left-0 w-1 h-full`;
      case "bottom":
        return `${base} bottom-0 left-0 w-full h-1`;
      case "top":
        return `${base} top-0 left-0 w-full h-1`;
      default:
        return "";
    }
  };

  const getHitAreaClasses = () => {
    switch (props.resizeFrom) {
      case "right":
        return "absolute cursor-col-resize inset-y-0 -right-1 w-3 group-hover:bg-primary/20";
      case "left":
        return "absolute cursor-col-resize inset-y-0 -left-1 w-3 group-hover:bg-primary/20";
      case "bottom":
        return "absolute cursor-row-resize inset-x-0 -bottom-1 h-3 group-hover:bg-primary/20";
      case "top":
        return "absolute cursor-row-resize inset-x-0 -top-1 h-3 group-hover:bg-primary/20";
      default:
        return "";
    }
  };

  const getContainerStyle = (): JSX.CSSProperties => {
    const baseStyle = props.style || {};
    if (isHorizontal()) {
      return { ...baseStyle, width: `${size()}px` };
    } else if (isVertical()) {
      return { ...baseStyle, height: `${size()}px` };
    }
    return baseStyle;
  };

  return (
    <div
      ref={containerRef}
      class={`relative ${props.class || ""}`}
      classList={props.classList}
      style={getContainerStyle()}
    >
      {props.children}

      {/* Resize Handle */}
      <div class={getHandleClasses()} onMouseDown={handleMouseDown}>
        <div class={getHitAreaClasses()} />
      </div>
    </div>
  );
};
