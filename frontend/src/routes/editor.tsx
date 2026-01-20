import { createSignal, createEffect, Show, For } from "solid-js";
import { api, type Document } from "~/lib/api";
import Editor from "~/components/Editor";
import Sidebar from "~/components/Sidebar";

export default function EditorPage() {
  const [allDocuments, setAllDocuments] = createSignal<Document[]>([]);
  const [currentPath, setCurrentPath] = createSignal<string | null>(null);
  const [currentContent, setCurrentContent] = createSignal("");
  const [loading, setLoading] = createSignal(false);
  const [sidebarOpen, setSidebarOpen] = createSignal(true);
  const [saveStatus, setSaveStatus] = createSignal<
    "saved" | "saving" | "unsaved"
  >("saved");

  let saveTimeout: NodeJS.Timeout;

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

  createEffect(() => {
    loadAllDocuments();
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
      await api.saveDocument(fullPath, "# New Document\n\nStart writing...");
      await loadAllDocuments();
      loadDocument(fullPath);
    } catch (error) {
      console.error("Failed to create document:", error);
    }
  };

  const createNewFolder = async (name: string, parentPath = "/") => {
    const fullPath = parentPath === "/" ? `/${name}` : `${parentPath}/${name}`;
    try {
      await api.createFolder(fullPath);
      await loadAllDocuments();
    } catch (error) {
      console.error("Failed to create folder:", error);
    }
  };

  const deleteItem = async (path: string) => {
    if (!confirm("Are you sure you want to delete this item?")) return;

    try {
      await api.deleteItem(path);
      await loadAllDocuments();
      if (currentPath() === path) {
        setCurrentPath(null);
        setCurrentContent("");
      }
    } catch (error) {
      console.error("Failed to delete item:", error);
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

  const handleLogout = () => {
    api.clearToken();
    window.location.href = "/";
  };

  return (
    <div class="h-screen flex flex-col bg-neutral-900">
      {/* Header */}
      <header class="h-14 border-b border-neutral-800 flex items-center justify-between px-4 bg-neutral-950">
        <div class="flex items-center gap-4">
          <button
            onClick={() => setSidebarOpen(!sidebarOpen())}
            class="p-2 hover:bg-neutral-800 rounded-lg transition-colors"
            aria-label="Toggle sidebar"
          >
            <div class="i-carbon-menu w-5 h-5 text-neutral-400" />
          </button>
          <h1 class="text-lg font-semibold text-neutral-100">Pluma</h1>
          <Show when={currentPath()}>
            <span class=" text-neutral-500">{currentPath()}</span>
          </Show>
        </div>

        <div class="flex items-center gap-4">
          <Show when={saveStatus() === "saving"}>
            <span class=" text-neutral-400">Saving...</span>
          </Show>
          <Show when={saveStatus() === "saved"}>
            <span class=" text-green-500">✓ Saved</span>
          </Show>
          <Show when={saveStatus() === "unsaved"}>
            <span class=" text-yellow-500">● Unsaved</span>
          </Show>

          <button
            onClick={handleLogout}
            class="px-3 py-1.5  text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800 rounded-lg transition-colors"
          >
            Logout
          </button>
        </div>
      </header>

      <div class="flex-1 flex overflow-hidden">
        {/* Sidebar */}
        <Show when={sidebarOpen()}>
          <Sidebar
            documents={allDocuments()}
            currentPath={currentPath()}
            onSelectDocument={loadDocument}
            onCreateDocument={createNewDocument}
            onCreateFolder={createNewFolder}
            onDeleteItem={deleteItem}
            onRenameItem={renameItem}
          />
        </Show>

        {/* Main Editor Area */}
        <div class="flex-1 flex overflow-hidden">
          <Show
            when={currentPath()}
            fallback={
              <div class="flex-1 flex items-center justify-center text-neutral-500">
                <div class="text-center">
                  <div class="i-carbon-document-blank w-16 h-16 mx-auto mb-4 opacity-20" />
                  <p class="text-lg mb-2">No document selected</p>
                  <p class="">Create or select a document from the sidebar</p>
                </div>
              </div>
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
              <Editor
                content={currentContent()}
                onChange={handleContentChange}
              />
            </Show>
          </Show>
        </div>
      </div>
    </div>
  );
}
