import type { Document } from "~/lib/api";

export interface SidebarProps {
  documents: Document[];
  currentPath: string | null;
  sidebarOpen: boolean;
  setSidebarOpen: (open: boolean) => void;
  saveStatus: "saved" | "saving" | "unsaved";
  expandedFolders: Set<string>;
  onSelectDocument: (path: string) => void;
  onCreateDocument: (name: string, folderPath?: string) => void;
  onCreateFolder: (name: string, parentPath?: string) => void;
  onDeleteItem: (path: string) => void;
  onRenameItem?: (oldPath: string, newName: string) => void;
  onMoveItem?: (
    sourcePath: string,
    destinationFolder: string,
    targetOrgId?: number,
  ) => void;
  onExpandFolder: (path: string) => void;
  onSetColor?: (path: string, color: string | null) => void;
  onToggleFavorite?: (path: string, favorite: boolean) => void;
  onOrgSwitch: () => void;
  onArchiveItem: (path: string) => void;
  onDuplicateItem?: (path: string) => void;
  onReorderItem?: (
    sourcePath: string,
    targetPath: string,
    operation: "reorder-before" | "reorder-after" | "make-child",
  ) => void;
  onViewHome: () => void;
  onViewArchive: () => void;
  onViewDeleted: () => void;
  onViewSearch: () => void;
  onViewTags: () => void;
}

export interface TreeNode extends Document {
  children: TreeNode[];
  depth: number;
}
