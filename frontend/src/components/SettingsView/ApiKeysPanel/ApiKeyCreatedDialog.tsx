import { createSignal, Show } from "solid-js";
import Button from "~/components/Button";
import AlertDialog from "~/components/AlertDialog";
import { useI18n } from "~/i18n";

interface ApiKeyCreatedDialogProps {
  show: boolean;
  keyValue: string;
  onClose: () => void;
}

export default function ApiKeyCreatedDialog(props: ApiKeyCreatedDialogProps) {
  const { t } = useI18n();
  const [copied, setCopied] = createSignal(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(props.keyValue);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback: select the text
      const el = document.querySelector<HTMLInputElement>("#api-key-value");
      el?.select();
    }
  };

  return (
    <AlertDialog
      isOpen={props.show}
      title={t("apiKeys.createdTitle")}
      showActions={false}
      showCloseIcon={false}
      onCancel={() => {}}
      dialogClass="max-w-lg"
    >
      <div class="space-y-4">
        {/* Warning banner */}
        <div class="flex items-start gap-2 bg-amber-500/10 border border-amber-500/30 rounded-md px-3 py-2">
          <div class="i-carbon-warning w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
          <p class="text-sm text-amber-300">{t("apiKeys.createdWarning")}</p>
        </div>

        {/* Key display */}
        <div class="flex items-center gap-2">
          <input
            id="api-key-value"
            type="text"
            readOnly
            value={props.keyValue}
            class="flex-1 px-3 py-2 bg-base border border-base rounded-md text-body text-sm font-mono focus:outline-none select-all"
            onClick={(e) => e.currentTarget.select()}
          />
          <Button
            variant="secondary"
            size="md"
            onClick={handleCopy}
            class="flex-shrink-0"
          >
            <Show
              when={!copied()}
              fallback={
                <div class="i-carbon-checkmark w-4 h-4 text-green-400" />
              }
            >
              <div class="i-carbon-copy w-4 h-4" />
            </Show>
            <span class="ml-1.5">
              {copied() ? t("apiKeys.copied") : t("apiKeys.copyKey")}
            </span>
          </Button>
        </div>

        {/* Done */}
        <div class="flex justify-end">
          <Button variant="primary" size="md" onClick={props.onClose}>
            {t("apiKeys.createdDone")}
          </Button>
        </div>
      </div>
    </AlertDialog>
  );
}
