import { createSignal, createMemo, For, Show } from "solid-js";
import AlertDialog from "./AlertDialog";
import type { Document } from "~/lib/api";
import type { TreeNode } from "~/types/Sidebar.types";
import {
  buildFolderTree,
  getParentPath,
  isDescendantOf,
} from "~/utils/sidebar.utils";

export interface MoveDialogProps {
  isOpen: boolean;
  itemPath: string;
  itemName: string;
  itemType: "file" | "folder";
  documents: Document[];
  onConfirm: (destinationFolder: string) => void;
  onCancel: () => void;
}

export default function MoveDialog(props: Readonly<MoveDialogProps>) {
  const [selectedDestination, setSelectedDestination] = createSignal("/");
  const [expandedFolders, setExpandedFolders] = createSignal<Set<string>>(
    new Set(["/"]),
  );

  // Reset selection when dialog opens with a new item
  const currentParent = () => getParentPath(props.itemPath);

  // When the dialog opens, pre-select the current parent
  const resolvedSelection = () => {
    if (!props.isOpen) return "/";
    // On first open, default to current parent
    return selectedDestination();
  };

  // Build folder-only tree from documents (memoized for performance)
  const folderTree = createMemo(() => buildFolderTree(props.documents));

  // Check if a path is an invalid target (the item itself or a descendant)
  const isInvalidTarget = (folderPath: string): boolean => {
    if (props.itemType !== "folder") return false;
    return (
      folderPath === props.itemPath ||
      isDescendantOf(folderPath, props.itemPath)
    );
  };

  const toggleExpand = (path: string) => {
    const expanded = new Set(expandedFolders());
    if (expanded.has(path)) {
      expanded.delete(path);
    } else {
      expanded.add(path);
    }
    setExpandedFolders(expanded);
  };

  const handleConfirm = () => {
    props.onConfirm(resolvedSelection());
  };

  const handleOpen = () => {
    // Reset state when opening
    setSelectedDestination(currentParent());
    // Expand all ancestor folders of the current parent so it's visible
    const expanded = new Set<string>(["/"]);
    const parent = currentParent();
    if (parent !== "/") {
      const parts = parent.split("/").filter(Boolean);
      let accum = "";
      for (const part of parts) {
        accum += `/${part}`;
        expanded.add(accum);
      }
    }
    setExpandedFolders(expanded);
  };

  // Auto-reset when dialog opens
  createMemo(() => {
    if (props.isOpen) {
      handleOpen();
    }
  });

  // Recursive folder tree node renderer
  const FolderNode = (nodeProps: { node: TreeNode; depth: number }) => {
    const isExpanded = () => expandedFolders().has(nodeProps.node.path);
    const isSelected = () => resolvedSelection() === nodeProps.node.path;
    const isCurrentParent = () => currentParent() === nodeProps.node.path;
    const isDisabled = () => isInvalidTarget(nodeProps.node.path);
    const hasChildren = () =>
      nodeProps.node.children.filter((c) => c.type === "folder").length > 0;

    return (
      <>
        <button
          type="button"
          role="treeitem"
          aria-selected={isSelected()}
          aria-disabled={isDisabled()}
          disabled={isDisabled()}
          onClick={() => {
            if (!isDisabled()) {
              setSelectedDestination(nodeProps.node.path);
            }
          }}
          class="w-full flex items-center gap-2 py-1.5 px-2 rounded-md text-left transition-colors"
          classList={{
            "bg-[var(--color-primary)]/10 border-l-2 border-l-[var(--color-primary)]":
              isSelected(),
            "hover:bg-[var(--color-bg-elevated)]":
              !isSelected() && !isDisabled(),
            "opacity-40 cursor-not-allowed": isDisabled(),
            "ring-1 ring-[var(--color-border)]":
              isCurrentParent() && !isSelected(),
          }}
          style={{ "padding-left": `${nodeProps.depth * 16 + 8}px` }}
        >
          <Show when={hasChildren()}>
            <div
              onClick={(e) => {
                e.stopPropagation();
                toggleExpand(nodeProps.node.path);
              }}
              class={`w-3 h-3 flex-shrink-0 bg-[var(--color-text-primary)] cursor-pointer transition-transform ${
                isExpanded()
                  ? "i-carbon-chevron-down"
                  : "i-carbon-chevron-right"
              }`}
            />
          </Show>
          <Show when={!hasChildren()}>
            <div class="w-3 h-3 flex-shrink-0" />
          </Show>
          <div class="i-carbon-folder w-4 h-4 flex-shrink-0 text-blue-400" />
          <span class="truncate text-sm text-[var(--color-text-primary)]">
            {nodeProps.node.name}
          </span>
          <Show when={isCurrentParent()}>
            <span class="text-xs text-[var(--color-text-muted)] ml-auto flex-shrink-0">
              current
            </span>
          </Show>
        </button>

        <Show when={isExpanded()}>
          <For
            each={nodeProps.node.children.filter((c) => c.type === "folder")}
          >
            {(child) => <FolderNode node={child} depth={nodeProps.depth + 1} />}
          </For>
        </Show>
      </>
    );
  };

  return (
    <AlertDialog
      isOpen={props.isOpen}
      title={`Move "${props.itemName}"`}
      confirmText="Move"
      cancelText="Cancel"
      onConfirm={handleConfirm}
      onCancel={props.onCancel}
    >
      <p class="text-[var(--color-text-secondary)] mb-3 text-sm">
        Select a destination folder:
      </p>
      <div
        role="tree"
        aria-label="Folder tree"
        class="max-h-64 overflow-y-auto border border-[var(--color-border)] rounded-lg p-2 mb-4 bg-[var(--color-bg-base)]"
      >
        {/* Root option */}
        <button
          type="button"
          role="treeitem"
          aria-selected={resolvedSelection() === "/"}
          onClick={() => setSelectedDestination("/")}
          class="w-full flex items-center gap-2 py-1.5 px-2 rounded-md text-left transition-colors"
          classList={{
            "bg-[var(--color-primary)]/10 border-l-2 border-l-[var(--color-primary)]":
              resolvedSelection() === "/",
            "hover:bg-[var(--color-bg-elevated)]": resolvedSelection() !== "/",
            "ring-1 ring-[var(--color-border)]":
              currentParent() === "/" && resolvedSelection() !== "/",
          }}
        >
          <div class="w-3 h-3 flex-shrink-0" />
          <div class="i-carbon-home w-4 h-4 flex-shrink-0 text-[var(--color-text-muted)]" />
          <span class="text-sm text-[var(--color-text-primary)] font-medium">
            Root
          </span>
          <Show when={currentParent() === "/"}>
            <span class="text-xs text-[var(--color-text-muted)] ml-auto">
              current
            </span>
          </Show>
        </button>

        {/* Folder tree */}
        <For each={folderTree()}>
          {(node) => <FolderNode node={node} depth={1} />}
        </For>
      </div>
    </AlertDialog>
  );
}
