import { createSignal, createMemo, createEffect, For, Show } from "solid-js";
import AlertDialog from "./AlertDialog";
import Button from "./Button";
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
  onConfirm: (
    destinationFolder: string,
    targetOrgId?: number,
    keepSource?: boolean,
  ) => void;
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
  const [crossOrgMode, setCrossOrgMode] = createSignal<"move" | "copy">("move");

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
      props.onConfirm("/", selectedOrgId()!, crossOrgMode() === "copy");
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
        setCrossOrgMode("move");
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
        <Button
          variant="ghost"
          size="sm"
          fullWidth
          role="treeitem"
          aria-selected={isSelected()}
          aria-disabled={isDisabled()}
          disabled={isDisabled()}
          onClick={(e) => {
            if (!isDisabled()) {
              setSelectedDestination(nodeProps.node.path);
            }
            if (hasChildren()) {
              e.stopPropagation();
              toggleExpand(nodeProps.node.path);
            }
          }}
          class={`text-left cursor-pointer disabled:opacity-40  disabled:cursor-not-allowed ${
            isSelected()
              ? "!bg-primary/10 !text-body border-l-2 border-l-primary"
              : isCurrentParent()
                ? "ring-1 ring-border"
                : ""
          }`}
          style={{ "padding-left": `${nodeProps.depth * 16 + 8}px` }}
        >
          <Show when={hasChildren()}>
            <div
              class={`w-3 h-3 flex-shrink-0 bg-primary cursor-pointer transition-transform ${
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
        </Button>

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
      title={
        isCrossOrg() && crossOrgMode() === "copy"
          ? `Copy "${props.itemName}"`
          : `Move "${props.itemName}"`
      }
      confirmText={isCrossOrg() && crossOrgMode() === "copy" ? "Copy" : "Move"}
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
                <Button
                  variant="secondary"
                  size="sm"
                  active={isSelected()}
                  onClick={() => {
                    setSelectedOrgId(org.id);
                    setCrossOrgMode("move");
                  }}
                  class={`${isSelected() ? "border-primary text-primary" : ""}`}
                >
                  <div class="i-carbon-building w-3.5 h-3.5 flex-shrink-0" />
                  {org.name}
                  <Show when={isCurrent()}>
                    <span class="text-xs opacity-70">(current)</span>
                  </Show>
                </Button>
              );
            }}
          </For>
        </div>
      </Show>

      {/* Cross-org: mode selector + confirmation message */}
      <Show when={isCrossOrg()}>
        {/* Move / Copy toggle */}
        <div class="flex gap-2 mb-3">
          <Button
            variant="secondary"
            size="sm"
            active={crossOrgMode() === "move"}
            fullWidth
            class={`justify-center ${crossOrgMode() === "move" ? "border-primary text-primary" : ""}`}
            onClick={() => setCrossOrgMode("move")}
          >
            <div class="i-carbon-migrate w-4 h-4 flex-shrink-0" />
            Move
          </Button>
          <Button
            variant="secondary"
            size="sm"
            active={crossOrgMode() === "copy"}
            fullWidth
            class={`justify-center ${crossOrgMode() === "copy" ? "border-primary text-primary" : ""}`}
            onClick={() => setCrossOrgMode("copy")}
          >
            <div class="i-carbon-copy w-4 h-4 flex-shrink-0" />
            Copy
          </Button>
        </div>

        {/* Description */}
        <div class="flex items-start gap-3 p-3 mb-4 rounded-lg bg-elevated border border-base text-sm text-body">
          <div class="i-carbon-information w-4 h-4 flex-shrink-0 mt-0.5 text-[var(--color-primary)]" />
          <Show when={crossOrgMode() === "move"}>
            <span>
              <strong class="font-medium">"{props.itemName}"</strong> will be{" "}
              <strong class="font-medium">moved</strong> to the root of{" "}
              <strong class="font-medium">{selectedOrgName()}</strong>. It will
              be removed from the current organization.
            </span>
          </Show>
          <Show when={crossOrgMode() === "copy"}>
            <span>
              A copy of <strong class="font-medium">"{props.itemName}"</strong>{" "}
              will be placed in the root of{" "}
              <strong class="font-medium">{selectedOrgName()}</strong>. The
              original will remain in the current organization.
            </span>
          </Show>
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
          <Button
            variant="ghost"
            size="sm"
            fullWidth
            role="treeitem"
            aria-selected={resolvedSelection() === "/"}
            onClick={() => setSelectedDestination("/")}
            class={`text-left ${
              resolvedSelection() === "/"
                ? "!bg-[var(--color-primary)]/10 !text-body border-l-2 border-l-[var(--color-primary)]"
                : currentParent() === "/"
                  ? "ring-1 ring-[var(--color-border)]"
                  : ""
            }`}
          >
            <div class="w-3 h-3 flex-shrink-0" />
            <div class="i-carbon-home w-4 h-4 flex-shrink-0 text-muted-body" />
            <span class="text-sm font-medium">Root</span>
            <Show when={currentParent() === "/"}>
              <span class="text-xs text-muted-body ml-auto">current</span>
            </Show>
          </Button>

          {/* Folder tree */}
          <For each={folderTree()}>
            {(node) => <FolderNode node={node} depth={1} />}
          </For>
        </div>
      </Show>
    </AlertDialog>
  );
}
