import type { Document } from "~/lib/api";
import type { TreeNode } from "~/types/Sidebar.types";

/**
 * Preset color palette for files and folders
 */
export const COLOR_PALETTE = [
  { name: "Red", value: "#ef4444", bg: "rgba(239, 68, 68, 0.15)" },
  { name: "Orange", value: "#f97316", bg: "rgba(249, 115, 22, 0.15)" },
  { name: "Yellow", value: "#eab308", bg: "rgba(234, 179, 8, 0.15)" },
  { name: "Green", value: "#22c55e", bg: "rgba(34, 197, 94, 0.15)" },
  { name: "Blue", value: "#3b82f6", bg: "rgba(59, 130, 246, 0.15)" },
  { name: "Purple", value: "#a855f7", bg: "rgba(168, 85, 247, 0.15)" },
  { name: "Pink", value: "#ec4899", bg: "rgba(236, 72, 153, 0.15)" },
];

/**
 * Builds a tree structure from a flat array of documents
 */
export function buildDocumentTree(documents: Document[]): TreeNode[] {
  const tree: TreeNode[] = [];
  const pathMap = new Map<string, TreeNode>();

  // First pass: create all nodes
  for (const doc of documents) {
    const node: TreeNode = { ...doc, children: [], depth: 0 };
    pathMap.set(doc.path, node);
  }

  // Second pass: build tree structure and calculate depth
  for (const doc of documents) {
    const node = pathMap.get(doc.path)!;
    const parentPath = doc.path.substring(0, doc.path.lastIndexOf("/")) || "/";

    if (parentPath === "/") {
      tree.push(node);
    } else {
      const parent = pathMap.get(parentPath);
      if (parent) {
        node.depth = parent.depth + 1;
        parent.children.push(node);
      } else {
        // If parent not found, add to root
        tree.push(node);
      }
    }
  }

  // Sort: folders first, then alphabetically
  sortTreeNodes(tree);
  return tree;
}

/**
 * Recursively sorts tree nodes: favorites first, then folders, then alphabetically
 */
function sortTreeNodes(nodes: TreeNode[]) {
  nodes.sort((a, b) => {
    // Favorites first
    if (a.favorite && !b.favorite) return -1;
    if (!a.favorite && b.favorite) return 1;
    
    // Then folders before files
    if (a.type === "folder" && b.type === "file") return -1;
    if (a.type === "file" && b.type === "folder") return 1;
    
    // Then alphabetically
    return a.name.localeCompare(b.name);
  });
  nodes.forEach((node) => {
    if (node.children.length > 0) {
      sortTreeNodes(node.children);
    }
  });
}

/**
 * Filters tree nodes based on a search query
 */
export function filterTreeNodes(tree: TreeNode[], query: string): TreeNode[] {
  if (!query) return tree;

  const lowerQuery = query.toLowerCase();

  const filterNode = (node: TreeNode): TreeNode | null => {
    const matches = node.name.toLowerCase().includes(lowerQuery);
    const filteredChildren = node.children
      .map(filterNode)
      .filter((n): n is TreeNode => n !== null);

    if (matches || filteredChildren.length > 0) {
      return { ...node, children: filteredChildren };
    }
    return null;
  };

  return tree.map(filterNode).filter((n): n is TreeNode => n !== null);
}

/**
 * Formats a date string for display
 */
export function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}
