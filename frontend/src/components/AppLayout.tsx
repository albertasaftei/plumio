import {
  createSignal,
  onMount,
  ParentComponent,
  createContext,
  useContext,
  createMemo,
} from "solid-js";
import { useNavigate, useLocation } from "@solidjs/router";
import Sidebar from "~/components/Sidebar";
import Button from "~/components/Button";
import AlertDialog from "~/components/AlertDialog";
import { api, type Document } from "~/lib/api";
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

  // Validate session and load documents on mount
  onMount(async () => {
    setSidebarOpen(!isMobile());

    // In demo mode, skip session validation
    if (!isDemoMode) {
      const isValid = await api.validateSession();
      if (!isValid) {
        // Session is invalid or expired, redirect to login
        navigate(routes.login);
        return;
      }
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
      // Navigate to the new document
      const encodedPath = result.path
        .split("/")
        .map(encodeURIComponent)
        .join("/");
      navigate(`/file${encodedPath}`);
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

  const deleteItem = async (path: string) => {
    setDeleteDialog({ isOpen: true, path });
  };

  const confirmDelete = async () => {
    const path = deleteDialog().path;
    if (!path) return;

    try {
      await api.deleteItem(path);
      await loadAllDocuments();
      // If we're viewing the deleted item, go to homepage
      const encodedPath = path.split("/").map(encodeURIComponent).join("/");
      if (window.location.pathname === `/file${encodedPath}`) {
        navigate(routes.homepage);
      }
    } catch (error) {
      console.error("Failed to delete item:", error);
    } finally {
      setDeleteDialog({ isOpen: false, path: null });
    }
  };

  const renameItem = async (oldPath: string, newName: string) => {
    try {
      const pathParts = oldPath.split("/");
      const oldName = pathParts[pathParts.length - 1];
      const parentPath = pathParts.slice(0, -1).join("/") || "/";

      const isFile = oldName.includes(".");
      const finalName =
        isFile && !newName.endsWith(".md") ? `${newName}.md` : newName;
      const newPath =
        parentPath === "/" ? `/${finalName}` : `${parentPath}/${finalName}`;

      await api.renameItem(oldPath, newPath);
      await loadAllDocuments();

      // If we're viewing the renamed item, navigate to the new path
      const oldEncodedPath = oldPath
        .split("/")
        .map(encodeURIComponent)
        .join("/");
      if (window.location.pathname === `/file${oldEncodedPath}`) {
        const newEncodedPath = newPath
          .split("/")
          .map(encodeURIComponent)
          .join("/");
        navigate(`/file${newEncodedPath}`);
      }
    } catch (error) {
      console.error("Failed to rename item:", error);
    }
  };

  const archiveItem = async (path: string) => {
    try {
      await api.archiveDocument(path);
      await loadAllDocuments();
      // If we're viewing the archived item, go to homepage
      const encodedPath = path.split("/").map(encodeURIComponent).join("/");
      if (window.location.pathname === `/file${encodedPath}`) {
        navigate(routes.homepage);
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
      <div class="h-dvh flex flex-col overflow-hidden bg-neutral-900 dark:bg-neutral-900 light:bg-neutral-50">
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
              onSelectDocument={(path) => {
                // Encode the path to handle spaces and special characters
                const encodedPath = path
                  .split("/")
                  .map(encodeURIComponent)
                  .join("/");
                navigate(`/file${encodedPath}`);
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
                navigate(routes.homepage);
                if (window.innerWidth < 1024) {
                  setSidebarOpen(false);
                }
              }}
              onViewArchive={() => {
                navigate(routes.archive);
                if (window.innerWidth < 1024) {
                  setSidebarOpen(false);
                }
              }}
              onViewDeleted={() => {
                navigate(routes.deleted);
                if (window.innerWidth < 1024) {
                  setSidebarOpen(false);
                }
              }}
            />
          )}

          {/* Main Content Area */}
          <div class="flex-1 flex flex-col overflow-hidden">
            {/* Mobile header with menu toggle */}
            {props.showSidebar && (
              <div class="lg:hidden border-b border-neutral-800 dark:border-neutral-800 light:border-neutral-200 bg-neutral-950 dark:bg-neutral-950 light:bg-white p-4">
                <Button
                  onClick={() => setSidebarOpen(true)}
                  variant="ghost"
                  size="md"
                  class="lg:hidden"
                >
                  <div class="i-carbon-menu w-5 h-5" />
                </Button>
              </div>
            )}
            {props.children}
          </div>
        </div>
      </div>
    </AppLayoutContext.Provider>
  );
};
