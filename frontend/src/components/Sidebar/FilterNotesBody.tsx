import { For, Show, type Accessor } from "solid-js";
import type { Tag } from "~/types/Tag.types";

interface FilterNotesBodyProps {
  filterMode: Accessor<"any" | "all">;
  setFilterMode: (mode: "any" | "all") => void;
  selectedFilterTags: Accessor<number[]>;
  setSelectedFilterTags: (tags: number[]) => void;
  tags: Accessor<Tag[]>;
}

export default function FilterNotesBody(props: FilterNotesBodyProps) {
  return (
    <div class="space-y-4">
      <div>
        <label class="block text-sm text-secondary-body mb-2">
          Match mode
        </label>
        <div class="flex rounded-md border border-base overflow-hidden text-sm">
          <button
            onClick={() => props.setFilterMode("any")}
            class={`flex-1 px-3 py-1.5 cursor-pointer transition-colors ${
              props.filterMode() === "any"
                ? "bg-[var(--color-primary)] text-white"
                : "text-secondary-body hover:bg-elevated"
            }`}
          >
            Any of selected tags
          </button>
          <button
            onClick={() => props.setFilterMode("all")}
            class={`flex-1 px-3 py-1.5 cursor-pointer transition-colors ${
              props.filterMode() === "all"
                ? "bg-[var(--color-primary)] text-white"
                : "text-secondary-body hover:bg-elevated"
            }`}
          >
            All selected tags
          </button>
        </div>
      </div>

      <div>
        <div class="flex items-center justify-between mb-2">
          <label class="text-sm text-secondary-body">Tags</label>
          <Show when={props.selectedFilterTags().length > 0}>
            <button
              onClick={() => props.setSelectedFilterTags([])}
              class="text-xs text-[var(--color-primary)] hover:underline cursor-pointer"
            >
              Clear all
            </button>
          </Show>
        </div>
        <div class="max-h-64 overflow-y-auto space-y-1">
          <Show
            when={props.tags().length > 0}
            fallback={
              <p class="py-4 text-center text-sm text-muted-body">
                No tags yet. Create tags from the Tags page.
              </p>
            }
          >
            <For each={props.tags()}>
              {(tag) => {
                const isSelected = () =>
                  props.selectedFilterTags().includes(tag.id);

                return (
                  <button
                    onClick={() => {
                      const current = props.selectedFilterTags();
                      if (current.includes(tag.id)) {
                        props.setSelectedFilterTags(
                          current.filter((id) => id !== tag.id),
                        );
                      } else {
                        props.setSelectedFilterTags([...current, tag.id]);
                      }
                    }}
                    class="w-full px-3 py-2 text-left text-sm rounded-lg hover:bg-elevated transition-colors flex items-center gap-3 cursor-pointer"
                    classList={{
                      "bg-elevated": isSelected(),
                    }}
                  >
                    <div
                      class={`w-5 h-5 flex-shrink-0 ${isSelected() ? "i-carbon-checkbox-checked text-[var(--color-primary)]" : "i-carbon-checkbox text-muted-body"}`}
                    />
                    <div
                      class="w-3.5 h-3.5 rounded-full flex-shrink-0 border border-base"
                      style={{
                        "background-color":
                          tag.color || "var(--color-text-muted)",
                      }}
                    />
                    <span class="flex-1 truncate text-body">
                      {tag.name}
                    </span>
                    <span class="text-xs text-muted-body tabular-nums">
                      {tag.document_count}
                    </span>
                  </button>
                );
              }}
            </For>
          </Show>
        </div>
      </div>
    </div>
  );
}
