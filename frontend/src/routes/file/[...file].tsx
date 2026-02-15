import { createSignal, Show, lazy, Suspense, createEffect } from "solid-js";
import { useParams, useNavigate } from "@solidjs/router";
import { api } from "~/lib/api";
import Editor from "~/components/Editor";
import Button from "~/components/Button";
import { routes } from "~/routes";

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

  // Get the full path from params
  const getDocumentPath = () => {
    // params.file contains the full path for catch-all routes
    // Decode URI components to handle spaces and special characters
    const path = params.file || "";
    return decodeURIComponent(path);
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

  return (
    <>
      {/* Current File Breadcrumb */}
      <div class="px-4 py-2 border-b border-neutral-800 bg-neutral-950">
        <div class="flex items-center gap-2">
          <div class="i-carbon-document w-4 h-4 text-neutral-500" />
          <span class="text-xs text-neutral-500">Current file:</span>
          <span class="text-sm text-neutral-200 truncate">
            {getDocumentPath()}
          </span>
        </div>
      </div>

      {/* Document Actions Toolbar */}
      <div class="h-12 border-b border-neutral-800 flex items-center justify-between p-2 sm:px-4 bg-neutral-950">
        {/* View Mode Toggle */}
        <div class="flex items-center border border-neutral-800 rounded-md overflow-hidden">
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

        {/* Save Status */}
        <div class="flex items-center">
          <Show when={saveStatus() === "saving"}>
            <span class="text-xs text-neutral-400">Saving...</span>
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

      {/* Editor Content */}
      <Show
        when={!loading()}
        fallback={
          <div class="flex-1 flex items-center justify-center">
            <div class="i-carbon-circle-dash animate-spin w-8 h-8 text-neutral-500" />
          </div>
        }
      >
        {useLivePreview() ? (
          <Suspense
            fallback={
              <div class="flex-1 flex items-center justify-center">
                <div class="i-carbon-circle-dash animate-spin w-8 h-8 text-neutral-500" />
              </div>
            }
          >
            <MarkdownEditor
              content={currentContent()}
              onChange={handleContentChange}
            />
          </Suspense>
        ) : (
          <Editor content={currentContent()} onChange={handleContentChange} />
        )}
      </Show>
    </>
  );
}
