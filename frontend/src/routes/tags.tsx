import { createSignal, For, Show, onMount } from "solid-js";
import { useNavigate } from "@solidjs/router";
import { api } from "~/lib/api";
import Button from "~/components/Button";
import AlertDialog from "~/components/AlertDialog";
import DocumentListPage from "~/components/DocumentListPage";
import { routes } from "~/routes";
import type { Tag } from "~/types/Tag.types";
import { COLOR_PALETTE } from "~/utils/sidebar.utils";

export default function TagsPage() {
  const navigate = useNavigate();
  const [tags, setTags] = createSignal<Tag[]>([]);
  const [loading, setLoading] = createSignal(true);
  const [showCreateForm, setShowCreateForm] = createSignal(false);
  const [editingTag, setEditingTag] = createSignal<Tag | null>(null);
  const [tagName, setTagName] = createSignal("");
  const [tagColor, setTagColor] = createSignal<string | null>(null);
  const [tagDescription, setTagDescription] = createSignal("");
  const [showDeleteConfirm, setShowDeleteConfirm] = createSignal(false);
  const [tagToDelete, setTagToDelete] = createSignal<Tag | null>(null);
  const [error, setError] = createSignal("");

  let nameInputRef: HTMLInputElement | undefined;

  const loadTags = async () => {
    setLoading(true);
    try {
      const result = await api.listTags();
      setTags(result.tags);
    } catch (err) {
      console.error("Failed to load tags:", err);
    } finally {
      setLoading(false);
    }
  };

  onMount(async () => {
    const isValid = await api.validateSession();
    if (!isValid) {
      navigate(routes.login);
      return;
    }
    loadTags();
  });

  const resetForm = () => {
    setTagName("");
    setTagColor(null);
    setTagDescription("");
    setError("");
  };

  const openCreate = () => {
    resetForm();
    setEditingTag(null);
    setShowCreateForm(true);
    setTimeout(() => nameInputRef?.focus(), 0);
  };

  const openEdit = (tag: Tag) => {
    setEditingTag(tag);
    setTagName(tag.name);
    setTagColor(tag.color);
    setTagDescription(tag.description || "");
    setError("");
    setShowCreateForm(true);
    setTimeout(() => nameInputRef?.focus(), 0);
  };

  const handleSubmit = async () => {
    const name = tagName().trim();
    if (!name) {
      setError("Name is required");
      return;
    }

    try {
      if (editingTag()) {
        await api.updateTag(editingTag()!.id, {
          name,
          color: tagColor(),
          description: tagDescription().trim() || null,
        });
      } else {
        await api.createTag(name, tagColor(), tagDescription().trim() || null);
      }
      await loadTags();
      resetForm();
      setShowCreateForm(false);
      setEditingTag(null);
    } catch (e: any) {
      const msg = e?.message || "";
      if (msg.includes("409") || msg.includes("already exists")) {
        setError("A tag with this name already exists");
      } else {
        setError(
          editingTag() ? "Failed to update tag" : "Failed to create tag",
        );
      }
    }
  };

  const handleDelete = async () => {
    const tag = tagToDelete();
    if (!tag) return;
    try {
      await api.deleteTag(tag.id);
      await loadTags();
      setShowDeleteConfirm(false);
      setTagToDelete(null);
    } catch {
      setError("Failed to delete tag");
    }
  };

  const selectColor = (color: string | null) => {
    setTagColor(color);
  };

  return (
    <DocumentListPage
      title="Tags"
      icon="i-carbon-tag"
      loading={loading()}
      onBack={() => navigate(routes.homepage)}
      headerAction={() => (
        <Button onClick={openCreate} variant="primary" size="md">
          <div class="i-carbon-add w-4 h-4" />
          New tag
        </Button>
      )}
      emptyState={
        <div class="text-center py-12 text-secondary-body">
          <div class="i-carbon-tag w-16 h-16 mx-auto mb-4 opacity-50" />
          <p class="text-lg">No tags yet</p>
          <p class="text-sm text-muted-body mt-2">
            Create your first tag to start organizing your notes
          </p>
        </div>
      }
    >
      <Show
        when={tags().length > 0}
        fallback={
          <div class="text-center py-12 text-secondary-body">
            <div class="i-carbon-tag w-16 h-16 mx-auto mb-4 opacity-50" />
            <p class="text-lg">No tags yet</p>
            <p class="text-sm text-muted-body mt-2">
              Create your first tag to start organizing your notes
            </p>
          </div>
        }
      >
        <div class="space-y-2 w-full">
          <For each={tags()}>
            {(tag) => (
              <div class="bg-elevated rounded-lg p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 transition-colors border border-base">
                <div class="flex items-center gap-3 flex-1 min-w-0">
                  {/* Color dot */}
                  <div
                    class="w-5 h-5 rounded-full flex-shrink-0 border border-base"
                    style={{
                      "background-color":
                        tag.color || "var(--color-text-muted)",
                    }}
                  />
                  <div class="min-w-0 flex-1">
                    <p class="text-body font-medium truncate mb-1">
                      {tag.name}
                    </p>
                    <Show when={tag.description}>
                      <p class="text-xs text-muted-body truncate">
                        {tag.description}
                      </p>
                    </Show>
                  </div>
                </div>

                <div class="flex items-center gap-3 w-full sm:w-auto">
                  {/* Document count */}
                  <div class="flex items-center gap-1 text-sm text-muted-body mr-auto sm:mr-0">
                    <div class="i-carbon-document w-4 h-4" />
                    <span class="tabular-nums">{tag.document_count}</span>
                  </div>

                  <Button
                    onClick={() => openEdit(tag)}
                    variant="secondary"
                    size="sm"
                    title="Edit tag"
                  >
                    <div class="i-carbon-edit w-4 h-4" />
                  </Button>
                  <Button
                    onClick={() => {
                      setTagToDelete(tag);
                      setShowDeleteConfirm(true);
                    }}
                    variant="secondary"
                    size="sm"
                    title="Delete tag"
                    class="text-red-500 hover:text-red-400"
                  >
                    <div class="i-carbon-trash-can w-4 h-4" />
                  </Button>
                </div>
              </div>
            )}
          </For>
        </div>
      </Show>

      {/* Create / Edit form modal */}
      <AlertDialog
        isOpen={showCreateForm()}
        title={editingTag() ? "Edit Tag" : "New Tag"}
        onConfirm={handleSubmit}
        onCancel={() => {
          resetForm();
          setShowCreateForm(false);
          setEditingTag(null);
        }}
        confirmText={editingTag() ? "Save" : "Create"}
      >
        <div class="space-y-3">
          <div>
            <label class="block text-sm text-secondary-body mb-1">
              Name
            </label>
            <input
              ref={nameInputRef}
              type="text"
              placeholder="Tag name"
              maxLength={50}
              value={tagName()}
              onInput={(e) => {
                setTagName(e.currentTarget.value);
                setError("");
              }}
              onKeyPress={(e) => e.key === "Enter" && handleSubmit()}
              class="w-full px-3 py-2 bg-base border border-base rounded-lg text-body placeholder-muted-body focus:outline-none focus:border-[var(--color-primary)]"
            />
          </div>

          <div>
            <label class="block text-sm text-secondary-body mb-1">
              Description (optional)
            </label>
            <input
              type="text"
              placeholder="What is this tag about?"
              maxLength={200}
              value={tagDescription()}
              onInput={(e) => setTagDescription(e.currentTarget.value)}
              class="w-full px-3 py-2 bg-base border border-base rounded-lg text-body placeholder-muted-body focus:outline-none focus:border-[var(--color-primary)]"
            />
          </div>

          <div>
            <label class="block text-sm text-secondary-body mb-2">
              Color
            </label>
            <div class="flex flex-wrap items-center gap-2 mb-2">
              <For each={COLOR_PALETTE}>
                {(color) => (
                  <button
                    onClick={() => selectColor(color.value)}
                    class="w-7 h-7 rounded-md border-2 hover:scale-110 transition-transform cursor-pointer"
                    style={{
                      "background-color": color.value,
                      "border-color":
                        tagColor() === color.value
                          ? "var(--color-text-primary)"
                          : "transparent",
                    }}
                    title={color.name}
                  />
                )}
              </For>
              <button
                onClick={() => selectColor(null)}
                class="w-7 h-7 rounded-md border-2 border-base hover:scale-110 transition-transform flex items-center justify-center cursor-pointer"
                title="Remove color"
              >
                <div class="i-carbon-close w-4 h-4 text-muted-body" />
              </button>
            </div>
            <div class="flex items-center gap-2">
              <label class="relative flex items-center gap-2 h-9 px-3 rounded-md border border-base bg-base hover:bg-elevated transition-colors cursor-pointer text-sm text-secondary-body">
                <div class="i-carbon-color-palette w-4 h-4" />
                <div
                  class="w-4 h-4 rounded-sm border border-base"
                  style={{ "background-color": tagColor() || "#cccccc" }}
                />
                <input
                  type="color"
                  value={tagColor() || "#cccccc"}
                  onChange={(e) => selectColor(e.currentTarget.value)}
                  aria-label="Pick custom color"
                  class="absolute inset-0 opacity-0 cursor-pointer"
                />
              </label>
              <Show when={tagColor()}>
                <span class="text-xs text-muted-body uppercase">
                  {tagColor()}
                </span>
              </Show>
            </div>
          </div>

          <Show when={error()}>
            <p class="text-sm text-red-400">{error()}</p>
          </Show>
        </div>
      </AlertDialog>

      {/* Delete confirmation */}
      <AlertDialog
        isOpen={showDeleteConfirm()}
        title="Delete Tag"
        message={`Delete "${tagToDelete()?.name}"? This will remove the tag from all documents.`}
        variant="danger"
        confirmText="Delete"
        onConfirm={handleDelete}
        onCancel={() => {
          setShowDeleteConfirm(false);
          setTagToDelete(null);
        }}
      />
    </DocumentListPage>
  );
}
