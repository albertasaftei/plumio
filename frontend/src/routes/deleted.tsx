import { createSignal, For, Show, onMount } from "solid-js";
import { useNavigate } from "@solidjs/router";
import { api, type Document } from "~/lib/api";
import Button from "~/components/Button";
import AlertDialog from "~/components/AlertDialog";
import { routes } from "~/routes";

export default function DeletedPage() {
  const navigate = useNavigate();
  const [deletedDocs, setDeletedDocs] = createSignal<Document[]>([]);
  const [loading, setLoading] = createSignal(true);
  const [deleteConfirm, setDeleteConfirm] = createSignal<string | null>(null);

  const loadDeleted = async () => {
    console.log("loadDeleted");
    setLoading(true);
    try {
      const result = await api.listDeletedDocuments();
      setDeletedDocs(result.items);
    } catch (error) {
      console.error("Failed to load deleted documents:", error);
    } finally {
      setLoading(false);
    }
  };

  onMount(async () => {
    // Validate session first
    const isValid = await api.validateSession();
    if (!isValid) {
      navigate(routes.login);
      return;
    }

    loadDeleted();
  });

  const handleRestore = async (path: string) => {
    try {
      await api.restoreDeletedDocument(path);
      await loadDeleted();
    } catch (error) {
      console.error("Failed to restore document:", error);
    }
  };

  const handlePermanentDelete = async (path: string) => {
    try {
      await api.permanentlyDeleteFromTrash(path);
      await loadDeleted();
      setDeleteConfirm(null);
    } catch (error) {
      console.error("Failed to permanently delete document:", error);
    }
  };

  const formatDate = (dateStr: string | undefined) => {
    if (!dateStr) return "";
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return "Today";
    if (diffDays === 1) return "Yesterday";
    if (diffDays < 7) return `${diffDays} days ago`;
    return date.toLocaleDateString();
  };

  const getDaysUntilPermanentDelete = (deletedAt: string | undefined) => {
    if (!deletedAt) return 0;
    const deletedDate = new Date(deletedAt);
    const deleteDate = new Date(
      deletedDate.getTime() + 30 * 24 * 60 * 60 * 1000,
    );
    const now = new Date();
    const diffMs = deleteDate.getTime() - now.getTime();
    const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
    return Math.max(0, diffDays);
  };

  const getDisplayName = (filePath: string) => {
    const fileName = filePath.split("/").pop() || "";
    // Remove .deleted-{timestamp} suffix from display
    return fileName.replace(/\.deleted-\d+\.md$/, ".md");
  };

  return (
    <div class="flex flex-col w-full overflow-auto lg:max-w-5xl mx-auto p-4 sm:p-8">
      <div class="flex items-center mb-6 gap-4">
        <div class="flex">
          <Button
            onClick={() => navigate(routes.homepage)}
            variant="ghost"
            size="md"
          >
            <div class="i-carbon-arrow-left w-5 h-5" />
          </Button>
          <div class="i-carbon-trash-can w-8 h-8 text-neutral-400 dark:text-neutral-400 light:text-neutral-500" />
        </div>
        <h1 class="text-2xl sm:text-3xl font-bold text-white dark:text-white light:text-neutral-900">
          Recently Deleted
        </h1>
      </div>

      <Show
        when={!loading()}
        fallback={
          <div class="flex justify-center py-12">
            <div class="i-carbon-circle-dash animate-spin w-8 h-8 text-neutral-500 dark:text-neutral-500 light:text-neutral-400" />
          </div>
        }
      >
        <Show
          when={deletedDocs().length > 0}
          fallback={
            <div class="text-center py-12">
              <div class="i-carbon-trash-can w-16 h-16 text-neutral-600 dark:text-neutral-600 light:text-neutral-400 mx-auto mb-4" />
              <p class="text-neutral-400 dark:text-neutral-400 light:text-neutral-600 text-lg">
                No recently deleted documents
              </p>
              <p class="text-neutral-500 dark:text-neutral-500 light:text-neutral-500 text-sm mt-2">
                Deleted files will appear here and be kept for 30 days
              </p>
            </div>
          }
        >
          <div class="space-y-2 w-full">
            <For each={deletedDocs()}>
              {(doc) => {
                const daysLeft = getDaysUntilPermanentDelete(doc.deleted_at);
                return (
                  <div class="bg-neutral-800 dark:bg-neutral-800 light:bg-neutral-50 rounded-lg p-4 hover:bg-neutral-750 dark:hover:bg-neutral-750 light:hover:bg-neutral-100 transition-colors border border-transparent light:border-neutral-300 light:shadow-sm">
                    <div class="flex items-center justify-between gap-4">
                      <div class="flex-1 min-w-0">
                        <div class="flex items-center gap-3">
                          <div class="i-carbon-document w-5 h-5 text-neutral-400 dark:text-neutral-400 light:text-neutral-500 flex-shrink-0" />
                          <div class="flex-1 min-w-0">
                            <h3 class="text-white dark:text-white light:text-neutral-900 font-medium truncate">
                              {getDisplayName(doc.path)}
                            </h3>
                            <div class="flex items-center gap-4 mt-1 text-sm text-neutral-400 dark:text-neutral-400 light:text-neutral-600">
                              <span>Deleted {formatDate(doc.deleted_at)}</span>
                              <span class="text-yellow-400">
                                {daysLeft === 0
                                  ? "Deletes today"
                                  : daysLeft === 1
                                    ? "Deletes tomorrow"
                                    : `Deletes in ${daysLeft} days`}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>

                      <div class="flex items-center gap-2 flex-shrink-0">
                        <Button
                          onClick={() => handleRestore(doc.path)}
                          variant="secondary"
                          size="sm"
                        >
                          <div class="i-carbon-reset w-4 h-4" />
                        </Button>
                        <Button
                          onClick={() => setDeleteConfirm(doc.path)}
                          variant="danger"
                          size="sm"
                        >
                          <div class="i-carbon-trash-can w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              }}
            </For>
          </div>
        </Show>
      </Show>

      <AlertDialog
        isOpen={deleteConfirm() !== null}
        onCancel={() => setDeleteConfirm(null)}
        onConfirm={() => {
          const path = deleteConfirm();
          if (path) handlePermanentDelete(path);
        }}
        title="Permanently Delete Document?"
        message="This action cannot be undone. The document will be permanently deleted."
        confirmText="Delete"
        variant="danger"
      />
    </div>
  );
}
