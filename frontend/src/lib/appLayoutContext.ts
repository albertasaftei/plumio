import { createContext, useContext } from "solid-js";
import type { Document } from "./api";

// Keep context identity independent of the hot-reloaded layout component.
export interface AppLayoutContext {
  allDocuments: () => Document[];
  loadAllDocuments: () => Promise<void>;
  expandedFolders: () => Set<string>;
  toggleExpandFolder: (path: string) => void;
  sidebarOpen: () => boolean;
  setSidebarOpen: (open: boolean) => void;
  // Document creation
  createDocument: (name: string, folderPath?: string) => Promise<string>;
  createFolder: (name: string, parentPath?: string) => Promise<void>;
  // Mutations
  deleteItem: (path: string) => void;
  bulkDelete: (paths: string[]) => Promise<void>;
  archiveItem: (path: string) => Promise<void>;
  renameItem: (oldPath: string, newName: string) => Promise<void>;
  moveItem: (
    sourcePath: string,
    destinationFolder: string,
    targetOrgId?: number,
    keepSource?: boolean,
  ) => Promise<void>;
  reorderItem: (
    sourcePath: string,
    targetPath: string,
    operation: "reorder-before" | "reorder-after" | "make-child",
  ) => Promise<void>;
  toggleFavorite: (path: string, favorite: boolean) => Promise<void>;
  setItemColor: (path: string, color: string | null) => Promise<void>;
  duplicateItem: (path: string) => Promise<void>;
}

export const AppLayoutContext = createContext<AppLayoutContext>();

export function useAppLayout() {
  const context = useContext(AppLayoutContext);
  if (!context) {
    throw new Error("useAppLayout must be used within AppLayout");
  }
  return context;
}

