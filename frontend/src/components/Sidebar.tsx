import {
  createSignal,
  For,
  Show,
  createMemo,
  createEffect,
  onCleanup,
  onMount,
} from "solid-js";
import { Popover } from "@kobalte/core/popover";
import ColorPicker from "./ColorPicker";
import Button from "./Button";
import type { SidebarProps, TreeNode } from "~/types/Sidebar.types";
import {
  buildDocumentTree,
  COLOR_PALETTE,
  filterTreeNodes,
  formatDate,
} from "~/utils/sidebar.utils";
import { getDisplayName } from "~/utils/document.utils";
import { useNavigate } from "@solidjs/router";
import AlertDialog from "./AlertDialog";
import OrganizationSelector from "./OrganizationSelector";
import PopoverItem from "./PopoverItem";
import MoveDialog from "./MoveDialog";
import { routes } from "~/routes";
import { ResizableContainer } from "./ResizableContainer";

export default function Sidebar(props: Readonly<SidebarProps>) {
  const navigate = useNavigate();
  const [showNewDocModal, setShowNewDocModal] = createSignal(false);
  const [showNewFolderModal, setShowNewFolderModal] = createSignal(false);
  const [showRenameModal, setShowRenameModal] = createSignal(false);
  const getDefaultDocName = () => {
    const now = new Date();
    return `Note (${now.toLocaleDateString()}  ${now.getHours()}:${String(now.getMinutes()).padStart(2, "0")})`;
  };
  const [newItemName, setNewItemName] = createSignal(getDefaultDocName());
  const [targetFolder, setTargetFolder] = createSignal<string>("/");
  const [itemToRename, setItemToRename] = createSignal<string | null>(null);
  const [openMenuPath, setOpenMenuPath] = createSignal<string | null>(null);
  const [searchQuery, setSearchQuery] = createSignal("");
  const [showMoveModal, setShowMoveModal] = createSignal(false);
  const [itemToMove, setItemToMove] = createSignal<{
    path: string;
    name: string;
    type: "file" | "folder";
  } | null>(null);
  // Start with false to match SSR, update after mount
  const [isMobile, setIsMobile] = createSignal(false);
  const [isMounted, setIsMounted] = createSignal(false);

  let newDocInputRef: HTMLInputElement | undefined;
  let newFolderInputRef: HTMLInputElement | undefined;
  let renameInputRef: HTMLInputElement | undefined;

  const buildTree = createMemo(() => buildDocumentTree(props.documents));

  const toggleFolder = (path: string) => {
    props.onExpandFolder(path);
  };

  const filteredTree = () => filterTreeNodes(buildTree(), searchQuery());

  // Detect mobile view after mount to prevent hydration mismatch
  onMount(() => {
    setIsMounted(true);
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 1024); // lg breakpoint
    };
    checkMobile();
    window.addEventListener("resize", checkMobile);
    onCleanup(() => window.removeEventListener("resize", checkMobile));
  });

  // Auto-focus inputs when modals open
  createEffect(() => {
    if (showNewDocModal() && newDocInputRef) {
      setTimeout(() => newDocInputRef?.focus(), 0);
    }
  });

  createEffect(() => {
    if (showNewFolderModal() && newFolderInputRef) {
      setTimeout(() => newFolderInputRef?.focus(), 0);
    }
  });

  createEffect(() => {
    if (showRenameModal() && renameInputRef) {
      setTimeout(() => renameInputRef?.focus(), 0);
    }
  });

  const handleCreateDocument = () => {
    const name = newItemName().trim();
    if (name) {
      props.onCreateDocument(name, targetFolder());
      setNewItemName("");
      setTargetFolder("/");
      setShowNewDocModal(false);
    }
  };

  const handleCreateFolder = () => {
    const name = newItemName().trim();
    const parent = targetFolder();
    if (name) {
      props.onCreateFolder(name, parent);
      // Auto-expand the parent folder to show the new subfolder
      if (parent !== "/") {
        props.onExpandFolder(parent);
      }
      setNewItemName("");
      setTargetFolder("/");
      setShowNewFolderModal(false);
    }
  };

  const handleRename = () => {
    const name = newItemName().trim();
    const oldPath = itemToRename();
    if (name && oldPath && props.onRenameItem) {
      props.onRenameItem(oldPath, name);
      setNewItemName("");
      setItemToRename(null);
      setShowRenameModal(false);
    }
  };

  // Recursive tree node component
  const TreeNode = (nodeProps: { node: TreeNode }) => {
    const isExpanded = () => props.expandedFolders.has(nodeProps.node.path);
    const paddingLeft = () => `${nodeProps.node.depth * 8}px`;
    const getBackgroundColor = () => {
      if (nodeProps.node.path === props.currentPath) {
        return (
          COLOR_PALETTE.find((c) => c.value === nodeProps.node.color)?.bg ||
          "var(--color-bg-elevated)"
        );
      }
      return nodeProps.node.color
        ? COLOR_PALETTE.find((c) => c.value === nodeProps.node.color)?.bg
        : undefined;
    };

    return (
      <>
        <div
          class={`group relative hover:bg-[var(--color-bg-elevated)] border-l-4 transition-colors rounded-md m-2 ${
            nodeProps.node.path === props.currentPath
              ? "border-l-primary"
              : "border-l-transparent"
          } ${nodeProps.node.depth === 0 ? "mb-0" : ""}`}
          style={{
            "padding-left":
              nodeProps.node.depth === 0
                ? `${parseInt(paddingLeft()) + 16}px`
                : paddingLeft(),
            "background-color": getBackgroundColor(),
          }}
        >
          <div
            onClick={() => {
              if (nodeProps.node.type === "file") {
                props.onSelectDocument(nodeProps.node.path);
              } else {
                toggleFolder(nodeProps.node.path);
              }
            }}
            class="flex items-center gap-2 py-1 pr-2"
          >
            <div
              class={`w-4 h-4 flex-shrink-0 ${
                nodeProps.node.type === "folder"
                  ? "i-carbon-folder text-blue-400"
                  : "i-carbon-document text-[var(--color-text-muted)]"
              }`}
            />

            <button class="flex-1 text-left text-[var(--color-text-primary)] truncate cursor-pointer">
              {nodeProps.node.type === "file"
                ? getDisplayName(nodeProps.node.name)
                : nodeProps.node.name}
            </button>

            <Show when={nodeProps.node.favorite}>
              <div class="i-carbon-star-filled w-4 h-4 text-yellow-400 flex-shrink-0" />
            </Show>

            <div
              class="flex items-center gap-1 transition-opacity opacity-100 lg:opacity-0 lg:group-hover:opacity-100"
              classList={{
                "lg:!opacity-100": openMenuPath() === nodeProps.node.path,
              }}
            >
              <Popover
                open={openMenuPath() === nodeProps.node.path}
                onOpenChange={(isOpen) => {
                  setOpenMenuPath(isOpen ? nodeProps.node.path : null);
                }}
              >
                <Popover.Trigger
                  as={(props: any) => (
                    <Button
                      {...props}
                      onClick={(e) => {
                        e.stopPropagation();
                        props.onClick?.(e);
                      }}
                      variant="icon"
                      size="sm"
                      title="More options"
                    >
                      <div class="i-carbon-overflow-menu-vertical w-5 h-5 text-[var(--color-text-muted)]" />
                    </Button>
                  )}
                />
                <Popover.Portal>
                  <Popover.Content class="mt-1 mb-1 max-w-36 bg-[var(--color-bg-surface)] border border-[var(--color-border)] rounded-lg shadow-lg z-50 py-1 animate-slide-down">
                    {/* Add file/folder actions (folders only) */}
                    <Show when={nodeProps.node.type === "folder"}>
                      <PopoverItem
                        onClick={(e) => {
                          e.stopPropagation();
                          setTargetFolder(nodeProps.node.path);
                          setNewItemName(getDefaultDocName());
                          setShowNewDocModal(true);
                          setOpenMenuPath(null);
                        }}
                      >
                        <div class="i-carbon-document-add w-4 h-4" />
                        Add file
                      </PopoverItem>
                      <PopoverItem
                        onClick={(e) => {
                          e.stopPropagation();
                          setTargetFolder(nodeProps.node.path);
                          setShowNewFolderModal(true);
                          setOpenMenuPath(null);
                        }}
                      >
                        <div class="i-carbon-folder-add w-4 h-4" />
                        Add folder
                      </PopoverItem>
                      <div class="h-px bg-[var(--color-border)] my-1" />
                    </Show>

                    <Show when={props.onToggleFavorite}>
                      <PopoverItem
                        onClick={(e) => {
                          e.stopPropagation();
                          props.onToggleFavorite?.(
                            nodeProps.node.path,
                            !nodeProps.node.favorite,
                          );
                          setOpenMenuPath(null);
                        }}
                      >
                        <div
                          class={`w-4 h-4 ${
                            nodeProps.node.favorite
                              ? "i-carbon-star-filled text-yellow-400"
                              : "i-carbon-star"
                          }`}
                        />
                        {nodeProps.node.favorite ? "Unfavorite" : "Favorite"}
                      </PopoverItem>
                      <div class="h-px bg-[var(--color-border)] my-1" />
                    </Show>

                    {/* Archive action (files only) */}
                    <Show when={nodeProps.node.type === "file"}>
                      <PopoverItem
                        onClick={(e) => {
                          e.stopPropagation();
                          props.onArchiveItem(nodeProps.node.path);
                          setOpenMenuPath(null);
                        }}
                      >
                        <div class="i-carbon-archive w-4 h-4" />
                        Archive
                      </PopoverItem>
                    </Show>

                    <PopoverItem
                      onClick={(e) => {
                        e.stopPropagation();
                        const fileName = getDisplayName(nodeProps.node.name);
                        setItemToRename(nodeProps.node.path);
                        setNewItemName(fileName);
                        setShowRenameModal(true);
                        setOpenMenuPath(null);
                      }}
                    >
                      <div class="i-carbon-edit w-4 h-4" />
                      Rename
                    </PopoverItem>
                    <Show when={props.onMoveItem}>
                      <PopoverItem
                        onClick={(e) => {
                          e.stopPropagation();
                          setItemToMove({
                            path: nodeProps.node.path,
                            name: getDisplayName(nodeProps.node.name),
                            type: nodeProps.node.type,
                          });
                          setShowMoveModal(true);
                          setOpenMenuPath(null);
                        }}
                      >
                        <div class="i-carbon-move w-4 h-4" />
                        Move
                      </PopoverItem>
                    </Show>
                    <Show when={props.onDuplicateItem}>
                      <PopoverItem
                        onClick={(e) => {
                          e.stopPropagation();
                          props.onDuplicateItem?.(nodeProps.node.path);
                          setOpenMenuPath(null);
                        }}
                      >
                        <div class="i-carbon-copy w-4 h-4" />
                        Duplicate
                      </PopoverItem>
                    </Show>
                    <div class="h-px bg-[var(--color-border)] my-1" />

                    {/* Delete action */}
                    <PopoverItem
                      onClick={(e) => {
                        e.stopPropagation();
                        props.onDeleteItem(nodeProps.node.path);
                        setOpenMenuPath(null);
                      }}
                    >
                      <div class="i-carbon-trash-can w-4 h-4" />
                      Delete
                    </PopoverItem>

                    {/* Color picker */}
                    <Show when={props.onSetColor}>
                      <div class="h-px bg-[var(--color-border)] my-1" />
                      <ColorPicker
                        currentColor={nodeProps.node.color}
                        onColorSelect={(color) => {
                          props.onSetColor?.(nodeProps.node.path, color);
                          setOpenMenuPath(null);
                        }}
                      />
                    </Show>
                  </Popover.Content>
                </Popover.Portal>
              </Popover>
            </div>
          </div>
        </div>

        <Show when={nodeProps.node.type === "folder" && isExpanded()}>
          <div
            class={`${nodeProps.node.depth === 0 ? "mb-1" : ""} ml-8 mr-2 border-l-2 border-[var(--color-border-subtle)]`}
          >
            <For each={nodeProps.node.children}>
              {(child) => <TreeNode node={child} />}
            </For>
          </div>
        </Show>
      </>
    );
  };

  const SidebarContent = () => (
    <div class="flex h-full w-full">
      {/* Small Sidebar */}
      <div class="w-14 flex-shrink-0 border-r border-[var(--color-border)] bg-[var(--color-bg-base)] flex flex-col items-center py-4 gap-4">
        <Button
          onClick={() => props.onViewHome()}
          variant="icon"
          size="md"
          title="Homepage"
        >
          <div class="i-carbon-home w-5 h-5 flex-shrink-0" />
        </Button>
        <Button
          onClick={() => props.onViewSearch()}
          variant="icon"
          size="md"
          title="Full-text Search"
        >
          <div class="i-carbon-search w-5 h-5 flex-shrink-0" />
        </Button>
        <Button
          onClick={() => props.onViewArchive()}
          variant="icon"
          size="md"
          title="View Archive"
        >
          <div class="i-carbon-archive w-5 h-5 flex-shrink-0" />
        </Button>
        <Button
          onClick={() => props.onViewDeleted()}
          variant="icon"
          size="md"
          title="Recently Deleted"
        >
          <div class="i-carbon-trash-can w-5 h-5 flex-shrink-0" />
        </Button>
        <div class="flex-1" />
        <Button
          onClick={() => navigate(routes.settings)}
          variant="icon"
          size="md"
          title="Settings"
        >
          <div class="i-carbon-settings w-5 h-5 flex-shrink-0" />
        </Button>
      </div>

      {/* Big Sidebar */}
      <div class="flex-1 flex flex-col min-w-0 bg-[var(--color-bg-base)]">
        {/* Sidebar Header */}
        <div class="p-4 sm:p-4 border-b border-[var(--color-border)]">
          <div class="w-full flex items-center justify-end pb-4 lg:hidden">
            <Button
              onClick={() => props.setSidebarOpen(false)}
              variant="icon"
              size="md"
              title="Close sidebar"
            >
              <div class="i-carbon-close w-5 h-5" />
            </Button>
          </div>
          <div class="pb-4">
            <OrganizationSelector onSwitch={props.onOrgSwitch} fullWidth />
          </div>

          <div class="flex gap-2">
            <Button
              onClick={() => {
                setTargetFolder("/");
                setNewItemName(getDefaultDocName());
                setShowNewDocModal(true);
              }}
              variant="primary"
              size="md"
              fullWidth
              class="justify-center"
            >
              <div class="i-carbon-document-add w-4 h-4" />
              New file
            </Button>
            <Button
              onClick={() => {
                setTargetFolder("/");
                setShowNewFolderModal(true);
              }}
              variant="secondary"
              size="md"
              title="New folder"
            >
              <div class="i-carbon-folder-add w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Documents Tree */}
        <div class="flex-1 overflow-y-auto scrollbar-none pb-4">
          <For each={filteredTree()}>{(node) => <TreeNode node={node} />}</For>
        </div>
      </div>
    </div>
  );

  return (
    <>
      {/* Mobile: Simple aside with fixed positioning */}
      <Show when={isMounted() && isMobile()}>
        <aside
          class="w-80 h-full border-r border-[var(--color-border)] bg-[var(--color-bg-base)] flex flex-col fixed inset-y-0 left-0 z-50 transition-transform duration-300 ease-in-out"
          classList={{
            "-translate-x-full": !props.sidebarOpen,
            "translate-x-0": props.sidebarOpen,
          }}
        >
          <SidebarContent />
        </aside>
      </Show>

      {/* Desktop: ResizableContainer for drag-to-resize functionality */}
      {/* Show by default (SSR) and after mount when not mobile */}
      <Show when={!isMounted() || !isMobile()}>
        <ResizableContainer
          initialSize={350}
          minSize={300}
          maxSize={600}
          resizeFrom="right"
          class="h-full border-r border-[var(--color-border)] bg-[var(--color-bg-base)] flex flex-col relative"
        >
          <SidebarContent />
        </ResizableContainer>
      </Show>

      {/* New Document Modal */}
      <AlertDialog
        isOpen={showNewDocModal()}
        title="New Document"
        onConfirm={handleCreateDocument}
        onCancel={() => {
          setNewItemName(getDefaultDocName());
          setShowNewDocModal(false);
        }}
      >
        <p class="text-[var(--color-text-secondary)] mb-3">
          Creating in: {targetFolder()}
        </p>
        <input
          ref={newDocInputRef}
          type="text"
          placeholder="Document name"
          value={newItemName()}
          onInput={(e) => setNewItemName(e.currentTarget.value)}
          onKeyPress={(e) => e.key === "Enter" && handleCreateDocument()}
          class="w-full px-3 py-2 bg-[var(--color-bg-base)] border border-[var(--color-border)] rounded-lg text-[var(--color-text-primary)] placeholder-[var(--color-text-muted)] focus:outline-none focus:border-[var(--color-primary)] mb-4"
        />
      </AlertDialog>

      {/* New Folder Modal */}
      <AlertDialog
        isOpen={showNewFolderModal()}
        title="New Folder"
        onConfirm={handleCreateFolder}
        onCancel={() => setShowNewFolderModal(false)}
      >
        <p class="text-[var(--color-text-secondary)] mb-3">
          Creating in: {targetFolder()}
        </p>
        <input
          ref={newFolderInputRef}
          type="text"
          placeholder="Folder name"
          value={newItemName()}
          onInput={(e) => setNewItemName(e.currentTarget.value)}
          onKeyPress={(e) => e.key === "Enter" && handleCreateFolder()}
          class="w-full px-3 py-2 bg-[var(--color-bg-base)] border border-[var(--color-border)] rounded-lg text-[var(--color-text-primary)] placeholder-[var(--color-text-muted)] focus:outline-none focus:border-[var(--color-primary)] mb-4"
        />
      </AlertDialog>

      {/* Rename Modal */}
      <AlertDialog
        isOpen={showRenameModal()}
        title="Rename"
        onConfirm={handleRename}
        onCancel={() => setShowRenameModal(false)}
      >
        <p class="text-[var(--color-text-secondary)] mb-3">
          Current: {itemToRename() ? getDisplayName(itemToRename()!) : ""}
        </p>
        <input
          ref={renameInputRef}
          type="text"
          placeholder="New name"
          value={newItemName()}
          onInput={(e) => setNewItemName(e.currentTarget.value)}
          onKeyPress={(e) => e.key === "Enter" && handleRename()}
          class="w-full px-3 py-2 bg-[var(--color-bg-base)] border border-[var(--color-border)] rounded-lg text-[var(--color-text-primary)] placeholder-[var(--color-text-muted)] focus:outline-none focus:border-[var(--color-primary)] mb-4"
        />
      </AlertDialog>

      {/* Move Dialog */}
      <MoveDialog
        isOpen={showMoveModal()}
        itemPath={itemToMove()?.path ?? ""}
        itemName={itemToMove()?.name ?? ""}
        itemType={itemToMove()?.type ?? "file"}
        documents={props.documents}
        onConfirm={(dest) => {
          const source = itemToMove();
          if (source && props.onMoveItem) {
            props.onMoveItem(source.path, dest);
          }
          setShowMoveModal(false);
          setItemToMove(null);
        }}
        onCancel={() => {
          setShowMoveModal(false);
          setItemToMove(null);
        }}
      />
    </>
  );
}
