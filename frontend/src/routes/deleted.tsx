import { createSignal, For, Show, onMount } from "solid-js";
import { useNavigate } from "@solidjs/router";
import { api, type Document } from "~/lib/api";
import Button from "~/components/Button";
import AlertDialog from "~/components/AlertDialog";
import DocumentListPage from "~/components/DocumentListPage";
import { routes } from "~/routes";
import { getDisplayName } from "~/utils/document.utils";
import { useAppLayout } from "~/components/AppLayout";
import { formatDayRelativeDate } from "~/utils/date.utils";

export default function DeletedPage() {
  const navigate = useNavigate();
  const { loadAllDocuments } = useAppLayout();
  const [deletedDocs, setDeletedDocs] = createSignal<Document[]>([]);
  const [loading, setLoading] = createSignal(true);
  const [deleteConfirm, setDeleteConfirm] = createSignal<string | null>(null);

  const loadDeleted = async () => {
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
      await Promise.all([loadDeleted(), loadAllDocuments()]);
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

  return (
    <DocumentListPage
      title="Recently Deleted"
      icon="i-carbon-trash-can"
      loading={loading()}
      onBack={() => navigate(routes.homepage)}
      emptyState={
        <div class="text-center py-12">
          <div class="i-carbon-trash-can w-16 h-16 text-[var(--color-text-muted)] mx-auto mb-4" />
          <p class="text-[var(--color-text-secondary)] text-lg">
            No recently deleted documents
          </p>
          <p class="text-[var(--color-text-muted)] text-sm mt-2">
            Deleted files will appear here and be kept for 30 days
          </p>
        </div>
      }
    >
      <Show
        when={deletedDocs().length > 0}
        fallback={
          <div class="text-center py-12">
            <div class="i-carbon-trash-can w-16 h-16 text-[var(--color-text-muted)] mx-auto mb-4" />
            <p class="text-[var(--color-text-secondary)] text-lg">
              No recently deleted documents
            </p>
            <p class="text-[var(--color-text-muted)] text-sm mt-2">
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
                <div class="bg-[var(--color-bg-surface)] rounded-lg p-4 hover:bg-[var(--color-bg-elevated)] transition-colors border border-[var(--color-border)] cursor-pointer">
                  <div class="flex items-center justify-between gap-4">
                    <div class="flex-1 min-w-0">
                      <div class="flex items-center gap-3">
                        <div class="i-carbon-document w-5 h-5 text-[var(--color-text-muted)] flex-shrink-0" />
                        <div class="flex-1 min-w-0">
                          <h3 class="text-[var(--color-text-primary)] font-medium truncate mb-1">
                            {getDisplayName(doc.path)}
                          </h3>
                          <div class="flex items-center gap-4 text-sm text-[var(--color-text-secondary)]">
                            <span class="text-xs text-[var(--color-text-muted)]">
                              Deleted {formatDayRelativeDate(doc.deleted_at)}
                            </span>
                            <span class="text-xs text-yellow-400 dark:text-yellow-400 light:text-yellow-600">
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
                        variant="secondary"
                        size="sm"
                        class="text-red-500 hover:text-red-400"
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
    </DocumentListPage>
  );
}
