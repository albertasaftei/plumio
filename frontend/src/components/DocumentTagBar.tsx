import { createSignal, createEffect, For, Show } from "solid-js";
import { Popover } from "@kobalte/core/popover";
import { api } from "~/lib/api";
import type { DocumentTag, Tag } from "~/types/Tag.types";
import Button from "./Button";

interface DocumentTagBarProps {
  documentPath: string;
}

export default function DocumentTagBar(props: DocumentTagBarProps) {
  const [docTags, setDocTags] = createSignal<DocumentTag[]>([]);
  const [allTags, setAllTags] = createSignal<Tag[]>([]);
  const [searchQuery, setSearchQuery] = createSignal("");

  const loadTags = async () => {
    try {
      const [docResult, allResult] = await Promise.all([
        api.getDocumentTags(props.documentPath),
        api.listTags(),
      ]);
      setDocTags(docResult.tags);
      setAllTags(allResult.tags);
    } catch {
      // Tags not available
    }
  };

  createEffect(() => {
    // Re-fetch when document changes
    const _path = props.documentPath;
    if (_path) {
      loadTags();
    }
  });

  const toggleTag = async (tagId: number) => {
    const current = docTags();
    const currentIds = current.map((t) => t.id);
    const isAssigned = currentIds.includes(tagId);

    const newIds = isAssigned
      ? currentIds.filter((id) => id !== tagId)
      : [...currentIds, tagId];

    // Optimistic update
    if (isAssigned) {
      setDocTags(current.filter((t) => t.id !== tagId));
    } else {
      const tag = allTags().find((t) => t.id === tagId);
      if (tag) {
        setDocTags([
          ...current,
          { id: tag.id, name: tag.name, color: tag.color },
        ]);
      }
    }

    try {
      const result = await api.setDocumentTags(props.documentPath, newIds);
      setDocTags(result.tags);
    } catch {
      // Revert on error
      loadTags();
    }
  };

  const removeTag = async (tagId: number) => {
    const current = docTags();
    const newIds = current.filter((t) => t.id !== tagId).map((t) => t.id);

    setDocTags(current.filter((t) => t.id !== tagId));

    try {
      const result = await api.setDocumentTags(props.documentPath, newIds);
      setDocTags(result.tags);
    } catch {
      loadTags();
    }
  };

  const filteredTags = () => {
    const q = searchQuery().toLowerCase();
    if (!q) return allTags();
    return allTags().filter((t) => t.name.toLowerCase().includes(q));
  };

  const docTagIds = () => new Set(docTags().map((t) => t.id));

  return (
    <div class="px-4 py-1.5 border-b border-subtle bg-base flex items-center gap-1.5 min-h-8 flex-wrap">
      <For each={docTags()}>
        {(tag) => (
          <span
            class="inline-flex items-center gap-1 px-2 py-0.5 rounded-sm text-xs border select-none"
            style={{
              "background-color": tag.color
                ? `${tag.color}20`
                : "var(--color-bg-elevated)",
              "border-color": tag.color || "var(--color-border)",
              color: tag.color || "var(--color-text-secondary)",
            }}
          >
            <span
              class="w-2 h-2 rounded-full"
              style={{
                "background-color": tag.color || "var(--color-text-muted)",
              }}
            />
            {tag.name}
            <button
              onClick={() => removeTag(tag.id)}
              class="ml-0.5 hover:opacity-70 cursor-pointer"
              title="Remove tag"
            >
              <div class="i-carbon-close w-3 h-3" />
            </button>
          </span>
        )}
      </For>

      <Popover>
        <Popover.Trigger
          as={(triggerProps: any) => (
            <Button
              {...triggerProps}
              variant="ghost"
              size="sm"
              title="Add tags"
              class="!px-1.5 !py-0.5"
            >
              <Show
                when={docTags().length > 0}
                fallback={
                  <span class="text-xs text-muted-body flex items-center gap-1">
                    <div class="i-carbon-tag w-3.5 h-3.5" />
                    Add tags...
                  </span>
                }
              >
                <div class="i-carbon-add w-3.5 h-3.5" />
              </Show>
            </Button>
          )}
        />
        <Popover.Portal>
          <Popover.Content class="mt-1 bg-[var(--color-bg-surface)] border border-[var(--color-border)] rounded-lg shadow-lg z-50 min-w-48 animate-slide-down">
            {/* Search input */}
            <div class="p-2 border-b border-[var(--color-border)]">
              <input
                type="text"
                placeholder="Search tags..."
                value={searchQuery()}
                onInput={(e) => setSearchQuery(e.currentTarget.value)}
                class="w-full px-2 py-1 text-sm bg-[var(--color-bg-base)] border border-[var(--color-border)] rounded text-[var(--color-text-primary)] placeholder-[var(--color-text-muted)] focus:outline-none focus:border-[var(--color-primary)]"
              />
            </div>

            <div class="max-h-48 overflow-y-auto py-1">
              <For
                each={filteredTags()}
                fallback={
                  <p class="px-3 py-2 text-xs text-[var(--color-text-muted)]">
                    {allTags().length === 0
                      ? "No tags. Create one in the sidebar."
                      : "No matching tags"}
                  </p>
                }
              >
                {(tag) => {
                  const isAssigned = () => docTagIds().has(tag.id);
                  return (
                    <button
                      onClick={() => toggleTag(tag.id)}
                      class="w-full px-3 py-1.5 text-left text-sm text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-elevated)] transition-colors flex items-center gap-2 cursor-pointer"
                    >
                      <div
                        class={`w-4 h-4 flex-shrink-0 ${isAssigned() ? "i-carbon-checkbox-checked text-[var(--color-primary)]" : "i-carbon-checkbox"}`}
                      />
                      <div
                        class="w-3 h-3 rounded-full flex-shrink-0"
                        style={{
                          "background-color":
                            tag.color || "var(--color-text-muted)",
                        }}
                      />
                      {tag.name}
                    </button>
                  );
                }}
              </For>
            </div>
          </Popover.Content>
        </Popover.Portal>
      </Popover>
    </div>
  );
}
