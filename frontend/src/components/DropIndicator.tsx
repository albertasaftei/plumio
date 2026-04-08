import { Show } from "solid-js";
import type { Instruction } from "@atlaskit/pragmatic-drag-and-drop-hitbox/list-item";

interface DropIndicatorProps {
  instruction: Instruction | null;
  indent?: number;
}

/**
 * SolidJS drop indicator for tree items.
 * Renders a line for reorder-before/after, or a border for combine (make-child).
 */
export default function DropIndicator(props: Readonly<DropIndicatorProps>) {
  const indentPx = () => `${(props.indent ?? 0) * 8 + 8}px`;

  return (
    <Show when={props.instruction}>
      {(instruction) => {
        const op = () => instruction().operation;
        const isBlocked = () => instruction().blocked;
        const color = () =>
          isBlocked()
            ? "var(--color-warning, #eab308)"
            : "var(--color-primary, #3b82f6)";

        return (
          <>
            {/* Reorder line (before/after) */}
            <Show when={op() === "reorder-before" || op() === "reorder-after"}>
              <div
                style={{
                  position: "absolute",
                  left: indentPx(),
                  right: "8px",
                  height: "2px",
                  "background-color": color(),
                  "pointer-events": "none",
                  "z-index": 10,
                  ...(op() === "reorder-before"
                    ? { top: "-1px" }
                    : { bottom: "-1px" }),
                }}
              >
                {/* Terminal circle */}
                <div
                  style={{
                    position: "absolute",
                    left: "-3px",
                    top: "-3px",
                    width: "8px",
                    height: "8px",
                    "border-radius": "50%",
                    "background-color": color(),
                  }}
                />
              </div>
            </Show>

            {/* Combine border (make-child) */}
            <Show when={op() === "combine"}>
              <div
                style={{
                  position: "absolute",
                  inset: "0",
                  "border-radius": "6px",
                  border: `2px solid ${color()}`,
                  "pointer-events": "none",
                  "z-index": 10,
                }}
              />
            </Show>
          </>
        );
      }}
    </Show>
  );
}
