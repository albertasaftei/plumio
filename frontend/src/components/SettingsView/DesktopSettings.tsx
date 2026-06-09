import { createSignal, Show } from "solid-js";
import Button from "../Button";

export default function DesktopSettings() {
  const plumio =
    typeof window !== "undefined" ? (window as any).__plumio__ : undefined;

  const [docsPath, setDocsPath] = createSignal<string>(
    plumio?.documentsPath ?? "",
  );
  const [status, setStatus] = createSignal<{
    type: "success" | "error";
    message: string;
  } | null>(null);
  const [loading, setLoading] = createSignal(false);

  const handleChoosePath = async () => {
    setLoading(true);
    setStatus(null);
    try {
      const newPath: string | null = await plumio.chooseDocumentsPath();
      if (newPath) {
        setDocsPath(newPath);
        setStatus({
          type: "success",
          message:
            "Documents folder updated. The local backend has been restarted with the new path.",
        });
      }
    } catch {
      setStatus({
        type: "error",
        message: "Failed to change the documents folder. Please try again.",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div class="space-y-8">
      {/* Documents Folder */}
      <section>
        <h3 class="text-base font-semibold text-body mb-1">Documents Folder</h3>
        <p class="text-sm text-muted-body mb-4">
          The folder where Plumio stores your notes and database on this
          machine. Changing it restarts the embedded backend — your existing
          documents stay in the old location until you move them manually.
        </p>

        <div class="flex items-center gap-3 px-3 py-2.5 bg-subtle rounded-lg border border-subtle">
          <div class="i-carbon-folder w-4 h-4 text-muted-body flex-shrink-0" />
          <span class="text-sm font-mono text-body truncate flex-1 min-w-0">
            {docsPath()}
          </span>
          <Button
            onClick={handleChoosePath}
            disabled={loading()}
            variant="secondary"
            size="sm"
            class="flex-shrink-0"
          >
            {loading() ? "Restarting…" : "Change…"}
          </Button>
        </div>

        <Show when={status()}>
          <p
            class="text-sm mt-2"
            classList={{
              "text-green-400": status()?.type === "success",
              "text-red-400": status()?.type === "error",
            }}
          >
            {status()?.message}
          </p>
        </Show>
      </section>
    </div>
  );
}
