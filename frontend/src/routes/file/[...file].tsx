import {
  createSignal,
  Show,
  lazy,
  Suspense,
  createEffect,
  onCleanup,
  onMount,
} from "solid-js";
import { useParams, useNavigate, useBeforeLeave } from "@solidjs/router";
import { Popover } from "@kobalte/core/popover";
import { api } from "~/lib/api";
import Editor from "~/components/Editor";
import Button from "~/components/Button";
import PopoverItem from "~/components/PopoverItem";
import { routes } from "~/routes";
import DocumentTagBar from "~/components/DocumentTagBar";

const MarkdownEditor = lazy(() => import("~/components/MarkdownEditor"));

export default function DocumentPage() {
  const params = useParams();
  const navigate = useNavigate();
  const [currentContent, setCurrentContent] = createSignal("");
  const [loading, setLoading] = createSignal(false);
  const [useLivePreview, setUseLivePreview] = createSignal(true);
  const [saveStatus, setSaveStatus] = createSignal<
    "saved" | "saving" | "unsaved"
  >("saved");

  let saveTimeout: ReturnType<typeof setTimeout>;
  onCleanup(() => clearTimeout(saveTimeout));

  onMount(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (saveStatus() === "unsaved" || saveStatus() === "saving") {
        e.preventDefault();
      }
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    onCleanup(() =>
      window.removeEventListener("beforeunload", handleBeforeUnload),
    );
  });

  useBeforeLeave((e) => {
    if (saveStatus() === "unsaved" || saveStatus() === "saving") {
      if (
        !window.confirm(
          "You have unsaved changes that may be lost. Leave anyway?",
        )
      ) {
        e.preventDefault();
      }
    }
  });

  // Get the full path from params
  const getDocumentPath = () => {
    // params.file contains the full path for catch-all routes
    // Decode URI components to handle spaces and special characters
    const path = params.file || "";
    const decoded = decodeURIComponent(path);
    // Ensure path always starts with /
    return decoded.startsWith("/") ? decoded : `/${decoded}`;
  };

  const loadDocument = async () => {
    const path = getDocumentPath();
    if (!path) {
      navigate(routes.homepage);
      return;
    }

    setLoading(true);
    try {
      const result = await api.getDocument(path);
      setCurrentContent(result.content);
      setSaveStatus("saved");
    } catch (error) {
      console.error("Failed to load document:", error);
      // If document not found, redirect to homepage
      navigate(routes.homepage);
    } finally {
      setLoading(false);
    }
  };

  createEffect(() => {
    const path = params.file;
    if (path) {
      loadDocument();
    }
  });

  const handleContentChange = (newContent: string) => {
    setCurrentContent(newContent);
    setSaveStatus("unsaved");

    // Auto-save after 1 second of no typing
    clearTimeout(saveTimeout);
    saveTimeout = setTimeout(() => {
      saveDocument();
    }, 1000);
  };

  const saveDocument = async () => {
    const path = getDocumentPath();
    if (!path) return;

    setSaveStatus("saving");
    try {
      await api.saveDocument(path, currentContent());
      setSaveStatus("saved");
    } catch (error) {
      console.error("Failed to save document:", error);
      setSaveStatus("unsaved");
    }
  };

  const getFilename = () => {
    const path = getDocumentPath();
    const parts = path.split("/");
    return parts[parts.length - 1] || "document";
  };

  const handleDownloadMarkdown = () => {
    api.downloadDocumentAsMarkdown(getFilename(), currentContent());
  };

  const handleDownloadPdf = () => {
    api.downloadDocumentAsPdf(getFilename(), currentContent());
  };

  return (
    <>
      {/* Document Actions Toolbar */}
      <div class="h-12 border-b border-subtle flex items-center justify-between p-2 sm:px-4 bg-base">
        {/* View Mode Toggle */}
        <div class="flex items-center border border-subtle rounded-md overflow-hidden">
          <Button
            onClick={() => setUseLivePreview(false)}
            variant="ghost"
            size="sm"
            active={!useLivePreview()}
            class="flex items-center rounded-none"
            title="Plain text editor"
          >
            <div class="i-carbon-code w-4 h-4" />
            <span class="hidden sm:inline ml-1">Plain</span>
          </Button>
          <Button
            onClick={() => setUseLivePreview(true)}
            variant="ghost"
            size="sm"
            active={useLivePreview()}
            class="flex items-center rounded-none"
            title="Live preview editor"
          >
            <div class="i-carbon-view w-4 h-4" />
            <span class="hidden sm:inline ml-1">Live</span>
          </Button>
        </div>

        {/* Right side: Download + Save Status */}
        <div class="flex items-center gap-2">
          {/* Download Dropdown */}
          <Popover>
            <Popover.Trigger
              as={(triggerProps: any) => (
                <Button
                  {...triggerProps}
                  variant="ghost"
                  size="sm"
                  class="flex items-center gap-1"
                  title="Download document"
                >
                  <div class="i-carbon-download w-4 h-4" />
                </Button>
              )}
            />
            <Popover.Portal>
              <Popover.Content class="mt-1 bg-surface border border-base rounded-lg shadow-lg z-50 py-1 min-w-44 animate-slide-down">
                <PopoverItem onClick={handleDownloadMarkdown}>
                  <div class="i-carbon-document w-4 h-4" />
                  Markdown
                </PopoverItem>
                <PopoverItem onClick={handleDownloadPdf}>
                  <div class="i-carbon-document-pdf w-4 h-4" />
                  PDF
                </PopoverItem>
              </Popover.Content>
            </Popover.Portal>
          </Popover>

          {/* Save Status */}
          <div class="flex items-center">
            <Show when={saveStatus() === "saving"}>
              <span class="text-xs text-muted-body">Saving...</span>
            </Show>
            <Show when={saveStatus() === "saved"}>
              <div class="flex items-center gap-1">
                <div class="i-carbon-checkmark text-green-500" />
                <span class="text-xs text-green-500">Saved</span>
              </div>
            </Show>
            <Show when={saveStatus() === "unsaved"}>
              <span class="text-xs text-yellow-500">● Unsaved</span>
            </Show>
          </div>
        </div>
      </div>

      {/* Document Tags */}
      <DocumentTagBar documentPath={getDocumentPath()} />
      {/* Editor Content */}
      <Show
        when={!loading()}
        fallback={
          <div class="flex-1 flex items-center justify-center">
            <div class="i-carbon-circle-dash animate-spin w-8 h-8 text-muted-body" />
          </div>
        }
      >
        {useLivePreview() ? (
          <Suspense
            fallback={
              <div class="flex-1 flex items-center justify-center">
                <div class="i-carbon-circle-dash animate-spin w-8 h-8 text-muted-body" />
              </div>
            }
          >
            <MarkdownEditor
              content={currentContent()}
              onChange={handleContentChange}
              documentPath={getDocumentPath()}
            />
          </Suspense>
        ) : (
          <Editor content={currentContent()} onChange={handleContentChange} />
        )}
      </Show>
    </>
  );
}
