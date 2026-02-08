import { createSignal, Show } from "solid-js";
import Button from "../Button";
import AlertDialog from "../AlertDialog";
import Toast from "../Toast";
import { exportDocuments, importDocuments } from "~/lib/api";

export default function ImportExport() {
  const [isExporting, setIsExporting] = createSignal(false);
  const [isImporting, setIsImporting] = createSignal(false);
  const [importDialog, setImportDialog] = createSignal<{
    isOpen: boolean;
    file: File | null;
    target: HTMLInputElement | null;
  }>({ isOpen: false, file: null, target: null });
  const [toast, setToast] = createSignal<{
    show: boolean;
    message: string;
    type: "success" | "error";
  }>({ show: false, message: "", type: "success" });

  const handleExport = async () => {
    setIsExporting(true);
    try {
      await exportDocuments();
      setToast({
        show: true,
        message: "Documents exported successfully",
        type: "success",
      });
    } catch (error) {
      console.error("Export failed:", error);
      setToast({
        show: true,
        message: "Failed to export documents",
        type: "error",
      });
    } finally {
      setIsExporting(false);
    }
  };

  const handleImportClick = () => {
    const input = document.getElementById(
      "settings-import-file-input",
    ) as HTMLInputElement;
    input?.click();
  };

  const handleImportFile = async (event: Event) => {
    const target = event.target as HTMLInputElement;
    const file = target.files?.[0];

    if (!file) return;

    setImportDialog({ isOpen: true, file, target });
  };

  const confirmImport = async () => {
    const { file, target } = importDialog();
    if (!file || !target) return;

    setImportDialog({ isOpen: false, file: null, target: null });
    setIsImporting(true);

    try {
      await importDocuments(file);
      target.value = "";
      setToast({
        show: true,
        message: "Documents imported successfully. Reloading...",
        type: "success",
      });
      // Delay reload to show toast
      setTimeout(() => {
        window.location.reload();
      }, 1500);
    } catch (error) {
      console.error("Failed to import documents:", error);
      setToast({
        show: true,
        message: "Failed to import documents. Please try again.",
        type: "error",
      });
      setIsImporting(false);
    }
  };

  const cancelImport = () => {
    const { target } = importDialog();
    if (target) {
      target.value = "";
    }
    setImportDialog({ isOpen: false, file: null, target: null });
  };

  return (
    <>
      <div class="space-y-4">
        <div class="bg-neutral-800 rounded-lg p-6">
          <h3 class="text-lg font-semibold text-white mb-2">
            Export Documents
          </h3>
          <p class="text-neutral-400 mb-4">
            Download all your documents as a compressed archive.
          </p>
          <Button
            onClick={handleExport}
            variant="primary"
            size="md"
            disabled={isExporting()}
          >
            <Show
              when={!isExporting()}
              fallback={
                <>
                  <div class="i-carbon-in-progress animate-spin w-4 h-4" />
                  <span>Exporting...</span>
                </>
              }
            >
              <div class="i-carbon-download w-4 h-4" />
              <span class="ml-2">Export</span>
            </Show>
          </Button>
        </div>

        <div class="bg-neutral-800 rounded-lg p-6">
          <h3 class="text-lg font-semibold text-white mb-2">
            Import Documents
          </h3>
          <p class="text-neutral-400 mb-4">
            Upload a previously exported archive to restore your documents.
          </p>
          <Button
            onClick={handleImportClick}
            variant="secondary"
            size="md"
            disabled={isImporting()}
          >
            <Show
              when={!isImporting()}
              fallback={
                <>
                  <div class="i-carbon-in-progress animate-spin w-4 h-4" />
                  <span class="ml-2">Importing...</span>
                </>
              }
            >
              <div class="i-carbon-upload w-4 h-4" />
              <span class="ml-2">Import</span>
            </Show>
          </Button>
        </div>
      </div>

      {/* Hidden file input */}
      <input
        id="settings-import-file-input"
        type="file"
        accept="application/gzip,application/x-gzip,application/x-tar,application/x-compressed-tar,.tar.gz,.tgz,.gz"
        onChange={handleImportFile}
        class="hidden"
      />

      {/* Import Confirmation Dialog */}

      {/* Toast Notifications */}
      <Show when={toast().show}>
        <Toast
          message={toast().message}
          type={toast().type}
          onClose={() =>
            setToast({ show: false, message: "", type: "success" })
          }
        />
      </Show>
      <AlertDialog
        isOpen={importDialog().isOpen}
        title="Import Documents"
        onConfirm={confirmImport}
        onCancel={cancelImport}
      >
        <p class="text-neutral-400">
          Importing will merge with existing documents. Any files with the same
          name will be overwritten. Continue?
        </p>
      </AlertDialog>
    </>
  );
}
