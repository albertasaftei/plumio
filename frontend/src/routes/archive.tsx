import { createSignal, For, Show, onMount } from "solid-js";
import { useNavigate } from "@solidjs/router";
import { api, type Document } from "~/lib/api";
import Button from "~/components/Button";
import AlertDialog from "~/components/AlertDialog";
import { routes } from "~/routes";

export default function ArchivePage() {
  const navigate = useNavigate();
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
      await loadArchived();
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

  const getDisplayName = (filePath: string) => {
    const fileName = filePath.split("/").pop() || "";
    // Remove .archived-{timestamp} suffix from display
    return fileName.replace(/\.archived-\d+\.md$/, ".md");
  };

  return (
    <div class="flex flex-col w-full overflow-auto lg:max-w-5xl mx-auto p-4 sm:p-8">
      <div class="flex items-center mb-6 gap-4">
        <Button
          onClick={() => navigate(routes.homepage)}
          variant="ghost"
          size="md"
        >
          <div class="i-carbon-arrow-left w-5 h-5" />
        </Button>
        <div class="i-carbon-archive w-8 h-8 text-neutral-400" />
        <h1 class="text-2xl sm:text-3xl font-bold text-white">
          Archived Documents
        </h1>
      </div>

      <Show
        when={!loading()}
        fallback={
          <div class="flex justify-center py-12">
            <div class="i-carbon-circle-dash animate-spin w-8 h-8 text-neutral-500" />
          </div>
        }
      >
        <Show
          when={archivedDocs().length > 0}
          fallback={
            <div class="text-center py-12 text-neutral-400">
              <div class="i-carbon-folder-off w-16 h-16 mx-auto mb-4 opacity-50" />
              <p>No archived documents</p>
            </div>
          }
        >
          <div class="space-y-2 w-full">
            <For each={archivedDocs()}>
              {(doc) => (
                <div class="bg-neutral-800 rounded-lg p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 hover:bg-neutral-750 transition-colors">
                  <div class="flex items-center gap-3 flex-1 min-w-0">
                    <div class="i-carbon-document w-5 h-5 text-neutral-400 flex-shrink-0" />
                    <div class="min-w-0 flex-1">
                      <p class="text-white truncate">
                        {getDisplayName(doc.path)}
                      </p>
                      <p class="text-xs text-neutral-400 truncate">
                        {doc.path}
                      </p>
                      <Show when={doc.archived_at}>
                        <p class="text-xs text-neutral-500 mt-1">
                          Archived {formatDate(doc.archived_at)}
                        </p>
                      </Show>
                    </div>
                  </div>

                  <div class="flex items-center gap-2 w-full sm:w-auto">
                    <Button
                      onClick={() => handleRestore(doc.path)}
                      variant="ghost"
                      size="sm"
                      class="flex-1 sm:flex-none"
                      title="Restore document"
                    >
                      <div class="i-carbon-undo w-4 h-4" />
                      <span>Restore</span>
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
      </Show>

      <AlertDialog
        isOpen={!!deleteConfirm()}
        title="Delete Permanently?"
        onConfirm={() => deleteConfirm() && handleDelete(deleteConfirm()!)}
        onCancel={() => setDeleteConfirm(null)}
      >
        <p class="text-neutral-400">
          Are you sure you want to permanently delete "
          {deleteConfirm() && getDisplayName(deleteConfirm()!)}"? This action
          cannot be undone.
        </p>
      </AlertDialog>
    </div>
  );
}
