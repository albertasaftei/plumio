import { createSignal, Show, lazy, Suspense, onMount } from "solid-js";
import { useNavigate } from "@solidjs/router";
import { api, type Document } from "~/lib/api";
import Editor from "~/components/Editor";
import Sidebar from "~/components/Sidebar";
import AlertDialog from "~/components/AlertDialog";
import Button from "~/components/Button";
import { isMobile } from "~/utils/device.utils";
import ArchivedView from "~/components/ArchivedView";
import DeletedRecentlyView from "~/components/DeletedRecentlyView";
import Homepage from "~/components/Homepage";

const isDemoMode = import.meta.env.VITE_DEMO_MODE === "true";

// Lazy load markdown editor with live preview to avoid SSR issues
const MarkdownEditor = lazy(() => import("~/components/MarkdownEditor"));

export default function EditorPage() {
  const navigate = useNavigate();
  const [allDocuments, setAllDocuments] = createSignal<Document[]>([]);
  const [currentPath, setCurrentPath] = createSignal<string | null>(null);
  const [currentContent, setCurrentContent] = createSignal("");
  const [loading, setLoading] = createSignal(false);
  const [sidebarOpen, setSidebarOpen] = createSignal(false);
  const [useLivePreview, setUseLivePreview] = createSignal(true);
  const [expandedFolders, setExpandedFolders] = createSignal<Set<string>>(
    new Set(["/"]),
  );
  const [saveStatus, setSaveStatus] = createSignal<
    "saved" | "saving" | "unsaved"
  >("saved");
  const [deleteDialog, setDeleteDialog] = createSignal<{
    isOpen: boolean;
    path: string | null;
  }>({ isOpen: false, path: null });
  const [currentView, setCurrentView] = createSignal<
    "home" | "editor" | "archive" | "deleted"
  >("home");

  let saveTimeout: ReturnType<typeof setTimeout>;

  // Load all documents recursively
  const loadAllDocuments = async () => {
    const loadFolder = async (path: string): Promise<Document[]> => {
      const result = await api.listDocuments(path);
      const items: Document[] = [];

      for (const item of result.items) {
        items.push(item);
        if (item.type === "folder") {
          const children = await loadFolder(item.path);
          items.push(...children);
        }
      }
      return items;
    };

    try {
      const items = await loadFolder("/");
      setAllDocuments(items);
    } catch (error) {
      console.error("Failed to load documents:", error);
    }
  };

  // Validate session and load documents on mount (FIXED: was createEffect causing infinite loop)
  onMount(async () => {
    setSidebarOpen(!isMobile());

    // In demo mode, skip session validation
    if (!isDemoMode) {
      const isValid = await api.validateSession();
      if (!isValid) {
        // Session is invalid or expired, redirect to login
        navigate("/");
        return;
      }
    }

    // Load documents once on mount
    await loadAllDocuments();
  });

  const loadDocument = async (path: string) => {
    setLoading(true);
    try {
      const result = await api.getDocument(path);
      setCurrentContent(result.content);
      setCurrentPath(path);
      setSaveStatus("saved");
    } catch (error) {
      console.error("Failed to load document:", error);
    } finally {
      setLoading(false);
    }
  };

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
    const path = currentPath();
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

  const createNewDocument = async (name: string, folderPath = "/") => {
    const fileName = name.endsWith(".md") ? name : `${name}.md`;
    const fullPath =
      folderPath === "/" ? `/${fileName}` : `${folderPath}/${fileName}`;
    try {
      const result = await api.saveDocument(
        fullPath,
        "# New Document\n\nStart writing...",
        true, // isNew flag
      );
      await loadAllDocuments();
      // Load the document with the unique path returned from API
      loadDocument(result.path);
    } catch (error) {
      console.error("Failed to create document:", error);
    }
  };

  const createNewFolder = async (name: string, parentPath = "/") => {
    const fullPath = parentPath === "/" ? `/${name}` : `${parentPath}/${name}`;
    try {
      await api.createFolder(fullPath);
      await loadAllDocuments();
      // Auto-expand parent folder to show the new subfolder
      if (parentPath !== "/") {
        const expanded = new Set(expandedFolders());
        expanded.add(parentPath);
        setExpandedFolders(expanded);
      }
    } catch (error) {
      console.error("Failed to create folder:", error);
    }
  };

  const toggleExpandFolder = (path: string) => {
    const expanded = new Set(expandedFolders());
    if (expanded.has(path)) {
      expanded.delete(path);
    } else {
      expanded.add(path);
    }
    setExpandedFolders(expanded);
  };

  const deleteItem = async (path: string) => {
    setDeleteDialog({ isOpen: true, path });
  };

  const confirmDelete = async () => {
    const path = deleteDialog().path;
    if (!path) return;

    try {
      await api.deleteItem(path);
      await loadAllDocuments();
      if (currentPath() === path) {
        setCurrentPath(null);
        setCurrentContent("");
      }
    } catch (error) {
      console.error("Failed to delete item:", error);
    } finally {
      setDeleteDialog({ isOpen: false, path: null });
    }
  };

  const renameItem = async (oldPath: string, newName: string) => {
    try {
      // Determine if it's a file or folder, and construct new path
      const pathParts = oldPath.split("/");
      const oldName = pathParts[pathParts.length - 1];
      const parentPath = pathParts.slice(0, -1).join("/") || "/";

      // For files, ensure .md extension
      const isFile = oldName.includes(".");
      const finalName =
        isFile && !newName.endsWith(".md") ? `${newName}.md` : newName;
      const newPath =
        parentPath === "/" ? `/${finalName}` : `${parentPath}/${finalName}`;

      await api.renameItem(oldPath, newPath);
      await loadAllDocuments();

      // If we renamed the current document, update the current path
      if (currentPath() === oldPath) {
        setCurrentPath(newPath);
      }
    } catch (error) {
      console.error("Failed to rename item:", error);
    }
  };

  const archiveItem = async (path: string) => {
    try {
      await api.archiveDocument(path);
      await loadAllDocuments();
      if (currentPath() === path) {
        setCurrentPath(null);
        setCurrentContent("");
      }
    } catch (error) {
      console.error("Failed to archive item:", error);
    }
  };

  const setItemColor = async (path: string, color: string | null) => {
    try {
      await api.setItemColor(path, color);
      await loadAllDocuments();
    } catch (error) {
      console.error("Failed to set item color:", error);
    }
  };

  const toggleFavorite = async (path: string, favorite: boolean) => {
    try {
      await api.toggleFavorite(path, favorite);
      await loadAllDocuments();
    } catch (error) {
      console.error("Failed to toggle favorite:", error);
    }
  };

  return (
    <div class="h-dvh flex flex-col overflow-hidden bg-neutral-900">
      {/* Delete Confirmation Dialog */}
      <AlertDialog
        isOpen={deleteDialog().isOpen}
        title="Delete Item"
        message="Are you sure you want to delete this item?"
        confirmText="Delete"
        cancelText="Cancel"
        variant="danger"
        onConfirm={confirmDelete}
        onCancel={() => setDeleteDialog({ isOpen: false, path: null })}
      />

      {/* Main Content Area */}
      <div class="flex-1 flex overflow-hidden relative">
        {/* Mobile overlay backdrop */}
        <Show when={sidebarOpen()}>
          <div
            class="fixed inset-0 bg-black/50 z-40 lg:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        </Show>

        {/* Sidebar - hidden on mobile by default, visible on desktop via CSS */}
        <Sidebar
          documents={allDocuments()}
          currentPath={currentPath()}
          sidebarOpen={sidebarOpen()}
          setSidebarOpen={setSidebarOpen}
          saveStatus={saveStatus()}
          expandedFolders={expandedFolders()}
          onSelectDocument={(path) => {
            loadDocument(path);
            setCurrentView("editor");
            // Close sidebar on mobile after selecting document
            if (window.innerWidth < 1024) {
              setSidebarOpen(false);
            }
          }}
          onCreateDocument={createNewDocument}
          onCreateFolder={createNewFolder}
          onDeleteItem={deleteItem}
          onRenameItem={renameItem}
          onExpandFolder={toggleExpandFolder}
          onSetColor={setItemColor}
          onToggleFavorite={toggleFavorite}
          onOrgSwitch={() => loadAllDocuments()}
          onArchiveItem={archiveItem}
          onViewHome={() => {
            setCurrentView("home");
            if (window.innerWidth < 1024) {
              setSidebarOpen(false);
            }
          }}
          onViewArchive={() => {
            setCurrentView("archive");
            if (window.innerWidth < 1024) {
              setSidebarOpen(false);
            }
          }}
          onViewDeleted={() => {
            setCurrentView("deleted");
            if (window.innerWidth < 1024) {
              setSidebarOpen(false);
            }
          }}
        />

        {/* Main Editor Area */}
        <div class="flex-1 flex flex-col overflow-hidden">
          {/* Mobile header with menu toggle */}
          <div class="lg:hidden border-b border-neutral-800 bg-neutral-950 p-4">
            <Button
              onClick={() => setSidebarOpen(true)}
              variant="ghost"
              size="md"
              class="lg:hidden"
            >
              <div class="i-carbon-menu w-5 h-5" />
            </Button>
          </div>

          {/* Current File Breadcrumb */}
          <Show when={currentPath() && currentView() === "editor"}>
            <div class="px-4 py-2 border-b border-neutral-800 bg-neutral-950">
              <div class="flex items-center gap-2">
                <div class="i-carbon-document w-4 h-4 text-neutral-500" />
                <span class="text-xs text-neutral-500">Current file:</span>
                <span class="text-sm text-neutral-200 truncate">
                  {currentPath()}
                </span>
              </div>
            </div>
          </Show>

          {/* Document Actions Toolbar */}
          <Show when={currentPath() && currentView() === "editor"}>
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
          </Show>

          {/* Main Content - Switch between views */}
          {currentView() === "home" && (
            <Homepage
              documents={allDocuments()}
              onSelectDocument={(path) => {
                loadDocument(path);
                setCurrentView("editor");
                if (window.innerWidth < 1024) {
                  setSidebarOpen(false);
                }
              }}
            />
          )}

          {currentView() === "archive" && (
            <ArchivedView
              onClose={() => setCurrentView("home")}
              onDocumentsChange={loadAllDocuments}
            />
          )}

          {currentView() === "deleted" && (
            <DeletedRecentlyView
              onClose={() => setCurrentView("home")}
              onDocumentsChange={loadAllDocuments}
            />
          )}

          {currentView() === "editor" && (
            <Show
              when={currentPath()}
              fallback={
                <Homepage
                  documents={allDocuments()}
                  onSelectDocument={(path) => {
                    loadDocument(path);
                    setCurrentView("editor");
                    if (window.innerWidth < 1024) {
                      setSidebarOpen(false);
                    }
                  }}
                />
              }
            >
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
                  <Editor
                    content={currentContent()}
                    onChange={handleContentChange}
                  />
                )}
              </Show>
            </Show>
          )}
        </div>
      </div>
    </div>
  );
}
