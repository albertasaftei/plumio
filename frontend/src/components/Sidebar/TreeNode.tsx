import {
  createSignal,
  For,
  Show,
  onMount,
  onCleanup,
  type Accessor,
} from "solid-js";
import { Popover } from "@kobalte/core/popover";
import {
  draggable,
  dropTargetForElements,
} from "@atlaskit/pragmatic-drag-and-drop/element/adapter";
import { combine } from "@atlaskit/pragmatic-drag-and-drop/combine";
import {
  attachInstruction,
  extractInstruction,
  type Instruction,
} from "@atlaskit/pragmatic-drag-and-drop-hitbox/list-item";
import DropIndicator from "../DropIndicator";
import Button from "../Button";
import DocumentMenuContent from "../DocumentMenuContent";
import type { TreeNode as TreeNodeType } from "~/types/Sidebar.types";
import { COLOR_PALETTE } from "~/utils/sidebar.utils";
import { getDisplayName } from "~/utils/document.utils";
import type { Tag } from "~/types/Tag.types";
import { api } from "~/lib/api";

interface TreeNodeProps {
  node: TreeNodeType;
  expandedFolders: Set<string>;
  currentPath: string | null;
  onSelectDocument: (path: string) => void;
  onExpandFolder: (path: string) => void;
  onDeleteItem: (path: string) => void;
  onArchiveItem: (path: string) => void;
  onCreateDocument: (path: string, name: string) => void;
  onCreateFolder: (path: string, name: string) => void;
  onRenameItem?: (oldPath: string, newName: string) => void;
  onMoveItem?: (sourcePath: string, destPath: string) => void;
  onDuplicateItem?: (path: string) => void;
  onToggleFavorite?: (path: string, isFavorite: boolean) => void;
  onSetColor?: (path: string, color: string | null) => void;
  onToggleTag?: (path: string, tagId: number, add: boolean) => void;
  tags: Accessor<Tag[]>;
  tagMappings: Accessor<Record<string, number[]>>;
  openMenuPath: Accessor<string | null>;
  setOpenMenuPath: (path: string | null) => void;
  onModalOpen: {
    setShowNewDocModal: (show: boolean) => void;
    setShowNewFolderModal: (show: boolean) => void;
    setShowRenameModal: (show: boolean) => void;
    setShowMoveModal: (show: boolean) => void;
    setTargetFolder: (folder: string) => void;
    setNewDocName: (name: string) => void;
    setNewFolderName: (name: string) => void;
    setItemToRename: (path: string | null) => void;
    setNewItemName: (name: string) => void;
    setItemToMove: (
      item: { path: string; name: string; type: "file" | "folder" } | null,
    ) => void;
    getDefaultDocName: () => string;
  };
}

export default function TreeNode(props: TreeNodeProps) {
  const isExpanded = () => props.expandedFolders.has(props.node.path);
  const paddingLeft = () => `${props.node.depth * 8}px`;
  const isAncestorOfCurrent = () =>
    props.node.type === "folder" &&
    props.currentPath !== null &&
    props.currentPath.startsWith(props.node.path + "/");

  const getBackgroundColor = () => {
    if (props.node.path === props.currentPath) {
      return (
        COLOR_PALETTE.find((c) => c.value === props.node.color)?.bg ||
        "var(--color-bg-elevated)"
      );
    }
    return props.node.color
      ? COLOR_PALETTE.find((c) => c.value === props.node.color)?.bg
      : undefined;
  };

  let rowRef: HTMLDivElement | undefined;
  const [instruction, setInstruction] = createSignal<Instruction | null>(null);
  const [isDragging, setIsDragging] = createSignal(false);
  let autoExpandTimer: number | undefined;

  onMount(() => {
    if (!rowRef) return;
    const el = rowRef;

    const cleanup = combine(
      draggable({
        element: el,
        getInitialData: () => ({
          path: props.node.path,
          name: props.node.name,
          type: props.node.type,
        }),
        onDragStart: () => setIsDragging(true),
        onDrop: () => setIsDragging(false),
      }),
      dropTargetForElements({
        element: el,
        canDrop: ({ source }) => {
          const sourcePath = source.data.path as string;
          // Prevent dropping onto self
          if (sourcePath === props.node.path) return false;
          // Prevent dropping a parent into its own descendant
          if (props.node.path.startsWith(sourcePath + "/")) return false;
          return true;
        },
        getData: ({ input, element }) => {
          const isFolder = props.node.type === "folder";
          const isExpandedFolder = isFolder && isExpanded();

          return attachInstruction(
            {
              path: props.node.path,
              name: props.node.name,
              type: props.node.type,
            },
            {
              input,
              element,
              operations: {
                "reorder-before": "available",
                "reorder-after": isExpandedFolder
                  ? "not-available"
                  : "available",
                combine: isFolder ? "available" : "not-available",
              },
            },
          );
        },
        getIsSticky: () => true,
        onDrag: ({ self }) => {
          setInstruction(extractInstruction(self.data));
        },
        onDragEnter: ({ self }) => {
          setInstruction(extractInstruction(self.data));
          // Auto-expand folders after a delay
          if (props.node.type === "folder" && !isExpanded()) {
            autoExpandTimer = window.setTimeout(() => {
              props.onExpandFolder(props.node.path);
            }, 500);
          }
        },
        onDragLeave: () => {
          setInstruction(null);
          if (autoExpandTimer) {
            clearTimeout(autoExpandTimer);
            autoExpandTimer = undefined;
          }
        },
        onDrop: () => {
          setInstruction(null);
          if (autoExpandTimer) {
            clearTimeout(autoExpandTimer);
            autoExpandTimer = undefined;
          }
        },
      }),
    );

    onCleanup(() => {
      cleanup();
      if (autoExpandTimer) {
        clearTimeout(autoExpandTimer);
      }
    });
  });

  return (
    <>
      <div
        ref={rowRef}
        class={`group relative hover:bg-elevated border-l-4 transition-colors rounded-md m-2 ${
          props.node.path === props.currentPath
            ? "border-l-primary"
            : isAncestorOfCurrent()
              ? "border-l-primary/40"
              : "border-l-transparent"
        } ${props.node.depth === 0 ? "mb-0" : ""}`}
        style={{
          "padding-left":
            props.node.depth === 0
              ? `${parseInt(paddingLeft()) + 16}px`
              : paddingLeft(),
          "background-color": getBackgroundColor(),
          opacity: isDragging() ? 0.4 : 1,
        }}
      >
        <DropIndicator instruction={instruction()} indent={props.node.depth} />
        <div
          onClick={() => {
            if (props.node.type === "file") {
              props.onSelectDocument(props.node.path);
            } else {
              props.onExpandFolder(props.node.path);
            }
          }}
          onContextMenu={(e) => {
            e.preventDefault();
            props.setOpenMenuPath(props.node.path);
          }}
          class="flex items-center gap-2 py-1 pr-2"
        >
          <div
            class={`w-4 h-4 flex-shrink-0 ${
              props.node.type === "folder"
                ? "i-carbon-folder text-blue-400"
                : "i-carbon-document text-muted-body"
            }`}
          />

          <button class="flex-1 text-left text-body truncate cursor-pointer">
            {props.node.type === "file"
              ? getDisplayName(props.node.name)
              : props.node.name}
          </button>

          <Show when={props.node.favorite}>
            <div class="i-carbon-star-filled w-4 h-4 text-yellow-400 flex-shrink-0" />
          </Show>

          <div
            class="flex items-center gap-1 transition-opacity opacity-100 lg:opacity-0 lg:group-hover:opacity-100"
            classList={{
              "lg:!opacity-100": props.openMenuPath() === props.node.path,
            }}
          >
            <Popover
              open={props.openMenuPath() === props.node.path}
              onOpenChange={(isOpen) => {
                props.setOpenMenuPath(isOpen ? props.node.path : null);
              }}
            >
              <Popover.Trigger
                as={(triggerProps: any) => (
                  <Button
                    {...triggerProps}
                    onClick={(e) => {
                      e.stopPropagation();
                      triggerProps.onClick?.(e);
                    }}
                    variant="icon"
                    size="sm"
                    title="More options"
                  >
                    <div class="i-carbon-overflow-menu-vertical w-5 h-5 text-muted-body" />
                  </Button>
                )}
              />
              <Popover.Portal>
                <Popover.Content class="mt-1 mb-1 max-w-36 bg-surface border border-base rounded-lg shadow-lg z-50 py-1 animate-slide-down">
                  <DocumentMenuContent
                    path={props.node.path}
                    name={props.node.name}
                    type={props.node.type}
                    isFavorite={props.node.favorite}
                    color={props.node.color}
                    tags={props.tags}
                    tagMappings={props.tagMappings}
                    onClose={() => props.setOpenMenuPath(null)}
                    onDelete={() => props.onDeleteItem(props.node.path)}
                    onArchive={() => props.onArchiveItem(props.node.path)}
                    onDownloadMarkdown={async () => {
                      const result = await api.getDocument(props.node.path);
                      const filename = props.node.name.endsWith(".md")
                        ? props.node.name
                        : `${props.node.name}.md`;
                      api.downloadDocumentAsMarkdown(filename, result.content);
                    }}
                    onDownloadPdf={async () => {
                      const result = await api.getDocument(props.node.path);
                      api.downloadDocumentAsPdf(
                        props.node.name,
                        result.content,
                      );
                    }}
                    onRename={() => {
                      const fileName = getDisplayName(props.node.name);
                      props.onModalOpen.setItemToRename(props.node.path);
                      props.onModalOpen.setNewItemName(fileName);
                      props.onModalOpen.setShowRenameModal(true);
                    }}
                    onMove={
                      props.onMoveItem
                        ? () => {
                            props.onModalOpen.setItemToMove({
                              path: props.node.path,
                              name: getDisplayName(props.node.name),
                              type: props.node.type,
                            });
                            props.onModalOpen.setShowMoveModal(true);
                          }
                        : undefined
                    }
                    onDuplicate={
                      props.onDuplicateItem
                        ? () => props.onDuplicateItem!(props.node.path)
                        : undefined
                    }
                    onToggleFavorite={
                      props.onToggleFavorite
                        ? (fav) => props.onToggleFavorite!(props.node.path, fav)
                        : undefined
                    }
                    onSetColor={
                      props.onSetColor
                        ? (color) => props.onSetColor!(props.node.path, color)
                        : undefined
                    }
                    onToggleTag={
                      props.onToggleTag
                        ? (tagId, add) =>
                            props.onToggleTag!(props.node.path, tagId, add)
                        : undefined
                    }
                    onAddFile={() => {
                      props.onModalOpen.setTargetFolder(props.node.path);
                      props.onModalOpen.setNewDocName(
                        props.onModalOpen.getDefaultDocName(),
                      );
                      props.onModalOpen.setShowNewDocModal(true);
                    }}
                    onAddFolder={() => {
                      props.onModalOpen.setTargetFolder(props.node.path);
                      props.onModalOpen.setNewFolderName("");
                      props.onModalOpen.setShowNewFolderModal(true);
                    }}
                  />
                </Popover.Content>
              </Popover.Portal>
            </Popover>
          </div>
        </div>
      </div>

      <Show when={props.node.type === "folder" && isExpanded()}>
        <div
          class={`${props.node.depth === 0 ? "mb-1" : ""} ml-8 mr-2 border-l-2 border-subtle`}
        >
          <For each={props.node.children}>
            {(child) => (
              <TreeNode
                node={child}
                expandedFolders={props.expandedFolders}
                currentPath={props.currentPath}
                onSelectDocument={props.onSelectDocument}
                onExpandFolder={props.onExpandFolder}
                onDeleteItem={props.onDeleteItem}
                onArchiveItem={props.onArchiveItem}
                onCreateDocument={props.onCreateDocument}
                onCreateFolder={props.onCreateFolder}
                onRenameItem={props.onRenameItem}
                onMoveItem={props.onMoveItem}
                onDuplicateItem={props.onDuplicateItem}
                onToggleFavorite={props.onToggleFavorite}
                onSetColor={props.onSetColor}
                onToggleTag={props.onToggleTag}
                tags={props.tags}
                tagMappings={props.tagMappings}
                openMenuPath={props.openMenuPath}
                setOpenMenuPath={props.setOpenMenuPath}
                onModalOpen={props.onModalOpen}
              />
            )}
          </For>
        </div>
      </Show>
    </>
  );
}
