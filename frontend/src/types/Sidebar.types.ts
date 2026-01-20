import type { Document } from "~/lib/api";

export interface SidebarProps {
  documents: Document[];
  currentPath: string | null;
  onSelectDocument: (path: string) => void;
  onCreateDocument: (name: string, folderPath?: string) => void;
  onCreateFolder: (name: string, parentPath?: string) => void;
  onDeleteItem: (path: string) => void;
  onRenameItem?: (oldPath: string, newName: string) => void;
}

export interface TreeNode extends Document {
  children: TreeNode[];
  depth: number;
}
