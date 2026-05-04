import { createSignal, createMemo, createEffect, For, Show } from "solid-js";
import AlertDialog from "./AlertDialog";
import type { Document } from "~/lib/api";
import type { TreeNode } from "~/types/Sidebar.types";
import {
  buildFolderTree,
  getParentPath,
  isDescendantOf,
} from "~/utils/sidebar.utils";
import { api } from "~/lib/api";

interface OrgOption {
  id: number;
  name: string;
  slug: string;
  role: string;
}

export interface MoveDialogProps {
  isOpen: boolean;
  itemPath: string;
  itemName: string;
  itemType: "file" | "folder";
  documents: Document[];
  onConfirm: (destinationFolder: string, targetOrgId?: number) => void;
  onCancel: () => void;
}

export default function MoveDialog(props: Readonly<MoveDialogProps>) {
  const [selectedDestination, setSelectedDestination] = createSignal("/");
  const [expandedFolders, setExpandedFolders] = createSignal<Set<string>>(
    new Set(["/"]),
  );
  const [orgs, setOrgs] = createSignal<OrgOption[]>([]);
  const [currentOrgId, setCurrentOrgId] = createSignal<number | null>(null);
  const [selectedOrgId, setSelectedOrgId] = createSignal<number | null>(null);

  // Reset selection when dialog opens with a new item
  const currentParent = () => getParentPath(props.itemPath);

  // When the dialog opens, pre-select the current parent
  const resolvedSelection = () => {
    if (!props.isOpen) return "/";
    return selectedDestination();
  };

  // Whether the user has picked a different org
  const isCrossOrg = () => {
    const selOrg = selectedOrgId();
    const curOrg = currentOrgId();
    return selOrg !== null && curOrg !== null && selOrg !== curOrg;
  };

  const selectedOrgName = () =>
    orgs().find((o) => o.id === selectedOrgId())?.name ?? "";

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
    if (isCrossOrg()) {
      props.onConfirm("/", selectedOrgId()!);
    } else {
      props.onConfirm(resolvedSelection());
    }
  };

  const handleOpen = () => {
    // Reset folder selection
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

    // Fetch orgs and current org
    api.getCurrentOrganization().then((org) => {
      if (org) {
        setCurrentOrgId(org.id);
        setSelectedOrgId(org.id);
      }
    });
    api.listOrganizations().then((res) => {
      if (res?.organizations) {
        setOrgs(res.organizations);
      }
    });
  };

  // Auto-reset when dialog opens
  createEffect(() => {
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
            "hover:bg-elevated": !isSelected() && !isDisabled(),
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
          <span class="truncate text-sm text-body">{nodeProps.node.name}</span>
          <Show when={isCurrentParent()}>
            <span class="text-xs text-muted-body ml-auto flex-shrink-0">
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
      {/* Organization selector — only shown when the user belongs to multiple orgs */}
      <Show when={orgs().length > 1}>
        <p class="text-secondary-body mb-2 text-sm">Organization:</p>
        <div class="flex flex-wrap gap-2 mb-4">
          <For each={orgs()}>
            {(org) => {
              const isCurrent = () => org.id === currentOrgId();
              const isSelected = () => org.id === selectedOrgId();
              return (
                <button
                  type="button"
                  onClick={() => setSelectedOrgId(org.id)}
                  class="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium border transition-colors"
                  classList={{
                    "bg-[var(--color-primary)] border-[var(--color-primary)] text-white":
                      isSelected(),
                    "bg-base border-base hover:border-[var(--color-border-hover)] text-body":
                      !isSelected(),
                  }}
                >
                  <div class="i-carbon-building w-3.5 h-3.5 flex-shrink-0" />
                  {org.name}
                  <Show when={isCurrent()}>
                    <span class="text-xs opacity-70">(current)</span>
                  </Show>
                </button>
              );
            }}
          </For>
        </div>
      </Show>

      {/* Cross-org: no folder picker, just a confirmation message */}
      <Show when={isCrossOrg()}>
        <div class="flex items-start gap-3 p-3 mb-4 rounded-lg bg-elevated border border-base text-sm text-body">
          <div class="i-carbon-information w-4 h-4 flex-shrink-0 mt-0.5 text-[var(--color-primary)]" />
          <span>
            <strong class="font-medium">"{props.itemName}"</strong> will be
            moved to the root of{" "}
            <strong class="font-medium">{selectedOrgName()}</strong>.
          </span>
        </div>
      </Show>

      {/* Same-org: existing folder tree */}
      <Show when={!isCrossOrg()}>
        <p class="text-secondary-body mb-3 text-sm">
          Select a destination folder:
        </p>
        <div
          role="tree"
          aria-label="Folder tree"
          class="max-h-64 overflow-y-auto border border-base rounded-lg p-2 mb-4 bg-base"
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
              "hover:bg-elevated": resolvedSelection() !== "/",
              "ring-1 ring-[var(--color-border)]":
                currentParent() === "/" && resolvedSelection() !== "/",
            }}
          >
            <div class="w-3 h-3 flex-shrink-0" />
            <div class="i-carbon-home w-4 h-4 flex-shrink-0 text-muted-body" />
            <span class="text-sm text-body font-medium">Root</span>
            <Show when={currentParent() === "/"}>
              <span class="text-xs text-muted-body ml-auto">current</span>
            </Show>
          </button>

          {/* Folder tree */}
          <For each={folderTree()}>
            {(node) => <FolderNode node={node} depth={1} />}
          </For>
        </div>
      </Show>
    </AlertDialog>
  );
}
