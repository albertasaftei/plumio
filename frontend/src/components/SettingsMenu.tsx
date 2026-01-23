import { createSignal, Show } from "solid-js";
import Button from "./Button";
import Popover, { PopoverItem } from "./Popover";
import { exportDocuments, importDocuments } from "../lib/api";
import AlertDialog from "./AlertDialog";

export function SettingsMenu() {
  const [isOpen, setIsOpen] = createSignal(false);
  const [isExporting, setIsExporting] = createSignal(false);
  const [isImporting, setIsImporting] = createSignal(false);
  const [importDialog, setImportDialog] = createSignal<{
    isOpen: boolean;
    file: File | null;
    target: HTMLInputElement | null;
  }>({ isOpen: false, file: null, target: null });

  const handleExport = async () => {
    setIsExporting(true);
    try {
      await exportDocuments();
      setIsOpen(false);
    } catch (error) {
      console.error("Export failed:", error);
      alert("Failed to export documents");
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
      target.value = ""; // Reset the file input
      setIsOpen(false);
      window.location.reload(); // Refresh the page
    } catch (error) {
      console.error("Failed to import documents:", error);
      alert("Failed to import documents. Please try again.");
    } finally {
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
      {/* Import Confirmation Dialog */}
      <AlertDialog
        isOpen={importDialog().isOpen}
        title="Import Documents"
        message="Importing will merge with existing documents. Any files with the same name will be overwritten. Continue?"
        confirmText="Import"
        cancelText="Cancel"
        onConfirm={confirmImport}
        onCancel={cancelImport}
      />

      <Popover
        isOpen={isOpen()}
        onClose={() => setIsOpen(false)}
        trigger={
          <Button
            onClick={() => setIsOpen(!isOpen())}
            variant="icon"
            size="md"
            title="Settings"
          >
            <div class="i-carbon-settings w-5 h-5" />
          </Button>
        }
      >
        <PopoverItem
          label={isExporting() ? "Exporting..." : "Export"}
          icon={
            isExporting()
              ? "i-carbon-in-progress animate-spin"
              : "i-carbon-download"
          }
          onClick={handleExport}
          disabled={isExporting()}
        />

        <PopoverItem
          label={isImporting() ? "Importing..." : "Import"}
          icon={
            isImporting()
              ? "i-carbon-in-progress animate-spin"
              : "i-carbon-upload"
          }
          onClick={handleImportClick}
          disabled={isImporting()}
        />
      </Popover>

      {/* Hidden file input */}
      <input
        id="settings-import-file-input"
        type="file"
        accept="application/gzip,application/x-gzip,application/x-tar,application/x-compressed-tar,.tar.gz,.tgz,.gz"
        onChange={handleImportFile}
        class="hidden"
      />
    </>
  );
}
