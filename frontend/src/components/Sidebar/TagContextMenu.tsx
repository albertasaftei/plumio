import { For, type Accessor } from "solid-js";
import type { Tag } from "~/types/Tag.types";

interface TagContextMenuProps {
  documentPath: string;
  tags: Accessor<Tag[]>;
  tagMappings: Accessor<Record<string, number[]>>;
  onToggle: (tagId: number, add: boolean) => void;
}

export default function TagContextMenu(props: TagContextMenuProps) {
  const docTags = () => props.tagMappings()[props.documentPath] || [];

  return (
    <>
      <For
        each={props.tags()}
        fallback={
          <p class="px-3 py-2 text-xs text-[var(--color-text-muted)]">
            No tags. Create one first.
          </p>
        }
      >
        {(tag) => {
          const isChecked = () => docTags().includes(tag.id);
          return (
            <button
              onClick={(e) => {
                e.stopPropagation();
                props.onToggle(tag.id, !isChecked());
              }}
              class="w-full px-3 py-1.5 text-left text-sm text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-elevated)] transition-colors flex items-center gap-2 cursor-pointer"
            >
              <div
                class={`w-4 h-4 flex-shrink-0 ${isChecked() ? "i-carbon-checkbox-checked text-[var(--color-primary)]" : "i-carbon-checkbox"}`}
              />
              <div
                class="w-3 h-3 rounded-full flex-shrink-0"
                style={{
                  "background-color": tag.color || "var(--color-text-muted)",
                }}
              />
              {tag.name}
            </button>
          );
        }}
      </For>
    </>
  );
}
