import {
  createSignal,
  onMount,
  Show,
  ParentComponent,
  createContext,
  useContext,
  createMemo,
} from "solid-js";
import { useNavigate, useLocation } from "@solidjs/router";
import Sidebar from "~/components/Sidebar";
import Button from "~/components/Button";
import AlertDialog from "~/components/AlertDialog";
import Toast from "~/components/Toast";
import { api, type Document } from "~/lib/api";
import { syncThemeFromServer } from "~/lib/theme";
import { isMobile } from "~/utils/device.utils";
import { routes } from "~/routes";

const isDemoMode = import.meta.env.VITE_DEMO_MODE === "true";

export interface AppLayoutContext {
  allDocuments: () => Document[];
  loadAllDocuments: () => Promise<void>;
  expandedFolders: () => Set<string>;
  toggleExpandFolder: (path: string) => void;
  sidebarOpen: () => boolean;
  setSidebarOpen: (open: boolean) => void;
}

interface AppLayoutProps {
  showSidebar?: boolean;
}

const AppLayoutContext = createContext<AppLayoutContext>();

export function useAppLayout() {
  const context = useContext(AppLayoutContext);
  if (!context) {
    throw new Error("useAppLayout must be used within AppLayout");
  }
  return context;
}

export const AppLayout: ParentComponent<AppLayoutProps> = (props) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [allDocuments, setAllDocuments] = createSignal<Document[]>([]);
  const [sidebarOpen, setSidebarOpen] = createSignal(false);
  const [expandedFolders, setExpandedFolders] = createSignal<Set<string>>(
    new Set(["/"]),
  );
  const [deleteDialog, setDeleteDialog] = createSignal<{
    isOpen: boolean;
    path: string | null;
  }>({ isOpen: false, path: null });
  const [toast, setToast] = createSignal<{
    message: string;
    type: "success" | "error";
  } | null>(null);

  // Load all documents in a single recursive API call
  const loadAllDocuments = async () => {
    try {
      const result = await api.listAllDocuments();
      setAllDocuments(result.items);
    } catch (error) {
      console.error("Failed to load documents:", error);
    }
  };

  // Validate session and load documents on mount
  onMount(async () => {
    setSidebarOpen(!isMobile(1024));

    // In demo mode, skip session validation
    if (!isDemoMode) {
      const session = await api.validateSession();
      if (!session.valid) {
        // Session is invalid or expired, redirect to login
        navigate(routes.login);
        return;
      }
      syncThemeFromServer(session.theme);
    }

    // Load documents once on mount
    await loadAllDocuments();
  });

  const toggleExpandFolder = (path: string) => {
    const expanded = new Set(expandedFolders());
    if (expanded.has(path)) {
      expanded.delete(path);
    } else {
      expanded.add(path);
    }
    setExpandedFolders(expanded);
  };

  // Reactive currentPath that updates when location changes
  const currentPath = createMemo(() => {
    const pathname = location.pathname;
    // Remove /file prefix and decode URI components
    return decodeURIComponent(pathname.replace(/^\/file/, ""));
  });

  // #5: Encode a filesystem path into a URL-safe /file/... path
  const encodePath = (path: string) =>
    path.split("/").map(encodeURIComponent).join("/");

  // #6: Navigate to a new path only when that path is currently being viewed
  const navigateIfViewing = (oldPath: string, newPath: string) => {
    if (window.location.pathname === `/file${encodePath(oldPath)}`) {
      navigate(`/file${encodePath(newPath)}`);
    }
  };

  // #7: Navigate and auto-close sidebar on mobile
  const navigateAndClose = (route: string) => {
    navigate(route);
    if (window.innerWidth < 1024) {
      setSidebarOpen(false);
    }
  };

  const createNewDocument = async (name: string, folderPath = "/") => {
    try {
      const result = await api.saveDocument(
        "",
        "# New Document\n\nStart writing...",
        true,
        folderPath,
        name,
      );
      await loadAllDocuments();
      navigate(`/file${encodePath(result.path)}`);
    } catch (error) {
      console.error("Failed to create document:", error);
    }
  };

  const createNewFolder = async (name: string, parentPath = "/") => {
    try {
      await api.createFolder("", parentPath, name);
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

  const deleteItem = async (path: string) => {
    setDeleteDialog({ isOpen: true, path });
  };

  const confirmDelete = async () => {
    const path = deleteDialog().path;
    if (!path) return;

    try {
      await api.deleteItem(path);
      await loadAllDocuments();
      navigateIfViewing(path, routes.homepage);
    } catch (error) {
      console.error("Failed to delete item:", error);
    } finally {
      setDeleteDialog({ isOpen: false, path: null });
    }
  };

  const renameItem = async (oldPath: string, newName: string) => {
    try {
      const result = await api.renameItem(oldPath, newName);
      await loadAllDocuments();
      navigateIfViewing(oldPath, result.newPath);
    } catch (error) {
      console.error("Failed to rename item:", error);
      const message =
        error instanceof Error ? error.message : "Failed to rename item";
      setToast({ message, type: "error" });
    }
  };

  const archiveItem = async (path: string) => {
    try {
      await api.archiveDocument(path);
      await loadAllDocuments();
      navigateIfViewing(path, routes.homepage);
    } catch (error) {
      console.error("Failed to archive item:", error);
    }
  };

  const moveItem = async (
    sourcePath: string,
    destinationFolder: string,
    targetOrgId?: number,
    keepSource?: boolean,
  ) => {
    try {
      if (targetOrgId !== undefined) {
        await api.moveCrossOrg(sourcePath, targetOrgId, keepSource);
        await loadAllDocuments();
        const itemName = sourcePath.split("/").pop() ?? sourcePath;
        if (keepSource) {
          setToast({
            message: `"${itemName}" copied successfully`,
            type: "success",
          });
        } else {
          navigateIfViewing(sourcePath, routes.homepage);
          setToast({
            message: `"${itemName}" moved successfully`,
            type: "success",
          });
        }
      } else {
        const result = await api.moveItem(sourcePath, destinationFolder);
        await loadAllDocuments();
        navigateIfViewing(sourcePath, result.newPath);
      }
    } catch (error) {
      console.error("Failed to move item:", error);
      const message =
        error instanceof Error ? error.message : "Failed to move item";
      setToast({ message, type: "error" });
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

  const reorderItem = async (
    sourcePath: string,
    targetPath: string,
    operation: "reorder-before" | "reorder-after" | "make-child",
  ) => {
    try {
      const result = await api.reorderItem(sourcePath, targetPath, operation);
      await loadAllDocuments();
      if (result.newPath) {
        navigateIfViewing(sourcePath, result.newPath);
      }
    } catch (error) {
      console.error("Failed to reorder item:", error);
      const message =
        error instanceof Error ? error.message : "Failed to move item";
      setToast({ message, type: "error" });
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

  const duplicateItem = async (path: string) => {
    try {
      await api.duplicateItem(path);
      await loadAllDocuments();
      setToast({ message: "Duplicated successfully", type: "success" });
    } catch (error) {
      console.error("Failed to duplicate item:", error);
      setToast({ message: "Failed to duplicate", type: "error" });
    }
  };

  const contextValue: AppLayoutContext = {
    allDocuments,
    loadAllDocuments,
    expandedFolders,
    toggleExpandFolder,
    sidebarOpen,
    setSidebarOpen,
  };

  return (
    <AppLayoutContext.Provider value={contextValue}>
      <div class="h-dvh flex flex-col overflow-hidden bg-surface">
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
          {props.showSidebar && sidebarOpen() && (
            <div
              class="fixed inset-0 bg-black/50 z-40 lg:hidden"
              onClick={() => setSidebarOpen(false)}
            />
          )}

          {/* Sidebar */}
          {props.showSidebar && (
            <Sidebar
              documents={allDocuments()}
              currentPath={currentPath()}
              sidebarOpen={sidebarOpen()}
              setSidebarOpen={setSidebarOpen}
              saveStatus="saved"
              expandedFolders={expandedFolders()}
              onSelectDocument={(path) =>
                navigateAndClose(`/file${encodePath(path)}`)
              }
              onCreateDocument={createNewDocument}
              onCreateFolder={createNewFolder}
              onDeleteItem={deleteItem}
              onRenameItem={renameItem}
              onMoveItem={moveItem}
              onExpandFolder={toggleExpandFolder}
              onSetColor={setItemColor}
              onToggleFavorite={toggleFavorite}
              onOrgSwitch={() => loadAllDocuments()}
              onArchiveItem={archiveItem}
              onDuplicateItem={duplicateItem}
              onReorderItem={reorderItem}
              onViewHome={() => navigateAndClose(routes.homepage)}
              onViewArchive={() => navigateAndClose(routes.archive)}
              onViewDeleted={() => navigateAndClose(routes.deleted)}
              onViewSearch={() => navigateAndClose(routes.search)}
              onViewTags={() => navigateAndClose(routes.tags)}
            />
          )}

          {/* Main Content Area */}
          <div class="flex-1 flex flex-col overflow-hidden">
            {/* Mobile header with menu toggle */}
            {props.showSidebar && (
              <div class="lg:hidden border-b border-subtle bg-base p-4">
                <Button
                  onClick={() => setSidebarOpen(true)}
                  variant="ghost"
                  size="md"
                >
                  <div class="i-carbon-menu w-5 h-5" />
                </Button>
              </div>
            )}
            {props.children}
          </div>
        </div>
      </div>
      <Show when={toast()}>
        <Toast
          message={toast()!.message}
          type={toast()!.type}
          onClose={() => setToast(null)}
        />
      </Show>
    </AppLayoutContext.Provider>
  );
};
