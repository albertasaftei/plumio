import {
  createSignal,
  onMount,
  Show,
  ParentComponent,
  createMemo,
} from "solid-js";
import { useNavigate, useLocation } from "@solidjs/router";
import Sidebar from "~/components/Sidebar";
import AlertDialog from "~/components/AlertDialog";
import Toast from "~/components/Toast";
import { api } from "~/lib/api";
import { syncThemeFromServer } from "~/lib/theme";
import { isMobileOrTablet } from "~/utils/device.utils";
import { routes } from "~/routes";
import { createDocumentStore } from "~/lib/documentStore";
import { prefetchDocuments } from "~/lib/prefetchDocuments";
import { AppLayoutContext } from "~/lib/appLayoutContext";
export { useAppLayout } from "~/lib/appLayoutContext";

const isDemoMode = import.meta.env.VITE_DEMO_MODE === "true";

interface AppLayoutProps {
  showSidebar?: boolean;
}

export const AppLayout: ParentComponent<AppLayoutProps> = (props) => {
  const navigate = useNavigate();
  const location = useLocation();
  const store = createDocumentStore();
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

  // Validate session and load documents on mount
  onMount(async () => {
    setSidebarOpen(!isMobileOrTablet());

    // In demo mode, skip session validation
    if (!isDemoMode) {
      try {
        const session = await api.validateSession();
        if (!session.valid) {
          // Session is invalid or expired, redirect to login
          navigate(routes.login);
          return;
        }
        syncThemeFromServer(session.theme);
      } catch {
        // Network error (e.g. offline) — if there's no token at all, redirect
        // to login; otherwise stay and let the document cache serve content.
        if (!localStorage.getItem("plumio_token")) {
          navigate(routes.login);
          return;
        }
      }
    }

    // Load documents once on mount
    try {
      await store.load();
    } catch {
      // Offline on first load — document tree will be empty but cached
      // documents can still be opened individually.
    }

    // Prefetch all document contents in the background so they're available
    // offline. Runs in idle batches after the UI is ready.
    prefetchDocuments(store.documents());
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

  const createNewDocument = async (
    name: string,
    folderPath = "/",
  ): Promise<string> => {
    const result = await store.createDocument(name, folderPath);
    navigate(`/file${encodePath(result.path)}`);
    return result.path;
  };

  const createNewFolder = async (name: string, parentPath = "/") => {
    try {
      await store.createFolder(name, parentPath);
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
      await store.deleteItem(path);
      navigateIfViewing(path, routes.homepage);
    } catch (error) {
      console.error("Failed to delete item:", error);
    } finally {
      setDeleteDialog({ isOpen: false, path: null });
    }
  };

  const renameItem = async (oldPath: string, newName: string) => {
    try {
      const result = await store.renameItem(oldPath, newName);
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
      await store.archiveItem(path);
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
      const result = await store.moveItem(
        sourcePath,
        destinationFolder,
        targetOrgId,
        keepSource,
      );
      if (targetOrgId !== undefined) {
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
      } else if (result.newPath) {
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
      await store.setItemColor(path, color);
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
      const result = await store.reorderItem(sourcePath, targetPath, operation);
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
      await store.toggleFavorite(path, favorite);
    } catch (error) {
      console.error("Failed to toggle favorite:", error);
    }
  };

  const duplicateItem = async (path: string) => {
    try {
      await store.duplicateItem(path);
      setToast({ message: "Duplicated successfully", type: "success" });
    } catch (error) {
      console.error("Failed to duplicate item:", error);
      setToast({ message: "Failed to duplicate", type: "error" });
    }
  };

  const bulkDeleteItems = async (paths: string[]) => {
    try {
      await store.bulkDelete(paths);
      const location_ = location.pathname;
      const deletedCurrentFile = paths.some(
        (p) => location_.startsWith(`/file`) && location_.includes(p),
      );
      if (deletedCurrentFile) navigate(routes.homepage);
      setToast({
        message: `${paths.length} item${paths.length === 1 ? "" : "s"} deleted`,
        type: "success",
      });
    } catch (error) {
      console.error("Failed to bulk delete:", error);
      setToast({ message: "Failed to delete some items", type: "error" });
    }
  };

  const contextValue: AppLayoutContext = {
    allDocuments: store.documents,
    loadAllDocuments: store.load,
    expandedFolders,
    toggleExpandFolder,
    sidebarOpen,
    setSidebarOpen,
    createDocument: createNewDocument,
    createFolder: createNewFolder,
    deleteItem,
    bulkDelete: bulkDeleteItems,
    archiveItem,
    renameItem,
    moveItem,
    reorderItem,
    toggleFavorite,
    setItemColor,
    duplicateItem,
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
          {/* Sidebar */}
          {props.showSidebar && <Sidebar />}

          {/* Main Content Area */}
          <div class="flex-1 flex flex-col overflow-hidden">
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
