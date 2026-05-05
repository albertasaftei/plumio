import { createSignal, Show } from "solid-js";
import Button from "../Button";
import AlertDialog from "../AlertDialog";
import Toast from "../Toast";
import {
  exportDocuments,
  exportDocumentsPlain,
  importDocuments,
} from "~/lib/api";
import { useI18n } from "~/i18n";

export default function ImportExport() {
  const { t } = useI18n();
  const [isExporting, setIsExporting] = createSignal(false);
  const [isExportingPlain, setIsExportingPlain] = createSignal(false);
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
        message: t("importExport.exportSuccess"),
        type: "success",
      });
    } catch (error) {
      console.error("Export failed:", error);
      setToast({
        show: true,
        message: t("importExport.exportFailed"),
        type: "error",
      });
    } finally {
      setIsExporting(false);
    }
  };

  const handleExportPlain = async () => {
    setIsExportingPlain(true);
    try {
      await exportDocumentsPlain();
      setToast({
        show: true,
        message: t("importExport.exportSuccess"),
        type: "success",
      });
    } catch (error) {
      console.error("Export failed:", error);
      setToast({
        show: true,
        message: t("importExport.exportFailed"),
        type: "error",
      });
    } finally {
      setIsExportingPlain(false);
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
        message: t("importExport.importSuccess"),
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
        message: t("importExport.importFailed"),
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
        <div class="bg-elevated rounded-lg p-6 border border-transparent light:border-base light:shadow-sm">
          <h3 class="text-lg font-semibold text-body mb-2">
            {t("importExport.exportTitle")}
          </h3>
          <p class="text-muted-body mb-4">{t("importExport.exportDesc")}</p>
          <div class="flex gap-3 flex-wrap">
            <Button
              onClick={handleExport}
              variant="primary"
              size="md"
              disabled={isExporting() || isExportingPlain()}
            >
              <Show
                when={!isExporting()}
                fallback={
                  <>
                    <div class="i-carbon-in-progress animate-spin w-4 h-4" />
                    <span class="ml-2">{t("importExport.exporting")}</span>
                  </>
                }
              >
                <div class="i-carbon-download w-4 h-4" />
                <span class="ml-2">{t("importExport.exportEncrypted")}</span>
              </Show>
            </Button>
            <Button
              onClick={handleExportPlain}
              variant="secondary"
              size="md"
              disabled={isExporting() || isExportingPlain()}
            >
              <Show
                when={!isExportingPlain()}
                fallback={
                  <>
                    <div class="i-carbon-in-progress animate-spin w-4 h-4" />
                    <span class="ml-2">{t("importExport.exporting")}</span>
                  </>
                }
              >
                <div class="i-carbon-document w-4 h-4" />
                <span class="ml-2">{t("importExport.exportPlainText")}</span>
              </Show>
            </Button>
          </div>
        </div>

        <div class="bg-elevated rounded-lg p-6 border border-transparent light:border-base light:shadow-sm">
          <h3 class="text-lg font-semibold text-body mb-2">
            {t("importExport.importTitle")}
          </h3>
          <p class="text-muted-body mb-4">{t("importExport.importDesc")}</p>
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
                  <span class="ml-2">{t("importExport.importing")}</span>
                </>
              }
            >
              <div class="i-carbon-upload w-4 h-4" />
              <span class="ml-2">{t("common.import")}</span>
            </Show>
          </Button>
        </div>
      </div>

      {/* Hidden file input */}
      <input
        id="settings-import-file-input"
        type="file"
        accept="application/gzip,application/x-gzip,application/x-tar,application/x-compressed-tar,.tar.gz,.tgz,.gz,.zip,application/zip"
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
        title={t("importExport.importDialogTitle")}
        onConfirm={confirmImport}
        onCancel={cancelImport}
      >
        <p class="text-muted-body mb-2">{t("importExport.importDialogDesc")}</p>
      </AlertDialog>
    </>
  );
}
