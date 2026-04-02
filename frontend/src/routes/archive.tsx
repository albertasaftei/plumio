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

export default function ArchivePage() {
  const navigate = useNavigate();
  const { loadAllDocuments } = useAppLayout();
  const [archivedDocs, setArchivedDocs] = createSignal<Document[]>([]);
  const [loading, setLoading] = createSignal(true);
  const [deleteConfirm, setDeleteConfirm] = createSignal<string | null>(null);

  const loadArchived = async () => {
    setLoading(true);
    try {
      const result = await api.listArchivedDocuments();
      setArchivedDocs(result.items);
    } catch (error) {
      console.error("Failed to load archived documents:", error);
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

    loadArchived();
  });

  const handleRestore = async (path: string) => {
    try {
      await api.unarchiveDocument(path);
      await Promise.all([loadArchived(), loadAllDocuments()]);
    } catch (error) {
      console.error("Failed to restore document:", error);
    }
  };

  const handleDelete = async (path: string) => {
    try {
      await api.permanentlyDeleteDocument(path);
      await loadArchived();
      setDeleteConfirm(null);
    } catch (error) {
      console.error("Failed to delete document:", error);
    }
  };

  return (
    <DocumentListPage
      title="Archived Documents"
      icon="i-carbon-archive"
      loading={loading()}
      onBack={() => navigate(routes.homepage)}
      emptyState={
        <div class="text-center py-12 text-[var(--color-text-secondary)]">
          <div class="i-carbon-folder-off w-16 h-16 mx-auto mb-4 opacity-50" />
          <p>No archived documents</p>
        </div>
      }
    >
      <Show
        when={archivedDocs().length > 0}
        fallback={
          <div class="text-center py-12 text-[var(--color-text-secondary)]">
            <div class="i-carbon-folder-off w-16 h-16 mx-auto mb-4 opacity-50" />
            <p>No archived documents</p>
          </div>
        }
      >
        <div class="space-y-2 w-full">
          <For each={archivedDocs()}>
            {(doc) => (
              <div class="bg-[var(--color-bg-surface)] rounded-lg p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 hover:bg-[var(--color-bg-elevated)] transition-colors border border-[var(--color-border)] cursor-pointer">
                <div class="flex items-center gap-3 flex-1 min-w-0">
                  <div class="i-carbon-document w-5 h-5 text-[var(--color-text-muted)] flex-shrink-0" />
                  <div class="min-w-0 flex-1">
                    <p class="text-[var(--color-text-primary)] font-medium truncate mb-1">
                      {getDisplayName(doc.path)}
                    </p>
                    <Show when={doc.archived_at}>
                      <p class="text-xs text-[var(--color-text-muted)]">
                        Archived {formatDayRelativeDate(doc.archived_at)}
                      </p>
                    </Show>
                  </div>
                </div>

                <div class="flex items-center gap-2 w-full sm:w-auto">
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
                    title="Delete permanently"
                  >
                    <div class="i-carbon-trash-can w-4 h-4" />
                  </Button>
                </div>
              </div>
            )}
          </For>
        </div>
      </Show>

      <AlertDialog
        isOpen={!!deleteConfirm()}
        title="Delete Permanently?"
        onConfirm={() => deleteConfirm() && handleDelete(deleteConfirm()!)}
        onCancel={() => setDeleteConfirm(null)}
      >
        <p class="text-[var(--color-text-secondary)]">
          Are you sure you want to permanently delete "
          {deleteConfirm() && getDisplayName(deleteConfirm()!)}"? This action
          cannot be undone.
        </p>
      </AlertDialog>
    </DocumentListPage>
  );
}
