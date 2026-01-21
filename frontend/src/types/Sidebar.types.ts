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
  onExpandFolder: (path: string) => void;
}

export interface TreeNode extends Document {
  children: TreeNode[];
  depth: number;
}
