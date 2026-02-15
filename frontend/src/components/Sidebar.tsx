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
import { useNavigate } from "@solidjs/router";
import AlertDialog from "./AlertDialog";
import OrganizationSelector from "./OrganizationSelector";
import PopoverItem from "./PopoverItem";
import { routes } from "~/routes";
import { ResizableContainer } from "./ResizableContainer";

export default function Sidebar(props: Readonly<SidebarProps>) {
  const navigate = useNavigate();
  const [showNewDocModal, setShowNewDocModal] = createSignal(false);
  const [showNewFolderModal, setShowNewFolderModal] = createSignal(false);
  const [showRenameModal, setShowRenameModal] = createSignal(false);
  const [newItemName, setNewItemName] = createSignal("");
  const [targetFolder, setTargetFolder] = createSignal<string>("/");
  const [itemToRename, setItemToRename] = createSignal<string | null>(null);
  const [openMenuPath, setOpenMenuPath] = createSignal<string | null>(null);
  const [searchQuery, setSearchQuery] = createSignal("");
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
    const paddingLeft = () => `${nodeProps.node.depth * 16 + 16}px`;
    const getBackgroundColor = () => {
      if (nodeProps.node.path === props.currentPath) {
        return nodeProps.node.color
          ? COLOR_PALETTE.find((c) => c.value === nodeProps.node.color)?.bg ||
              "#171717"
          : "#171717";
      }
      return nodeProps.node.color
        ? COLOR_PALETTE.find((c) => c.value === nodeProps.node.color)?.bg
        : undefined;
    };

    return (
      <>
        <div
          class={`group relative hover:bg-neutral-900 border-l-4 transition-colors border-y border-neutral-800/50 ${
            nodeProps.node.path === props.currentPath
              ? "border-l-primary"
              : "border-l-transparent"
          }`}
          style={{
            "padding-left": paddingLeft(),
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
            class="flex items-center gap-2 py-2 pr-2"
          >
            <Show when={nodeProps.node.type === "folder"}>
              <Button variant="icon" size="sm" class="text-neutral-500">
                <div
                  class={`w-3 h-3 transition-transform ${
                    isExpanded()
                      ? "i-carbon-chevron-down"
                      : "i-carbon-chevron-right"
                  }`}
                />
              </Button>
            </Show>

            <div
              class={`w-4 h-4 flex-shrink-0 ${
                nodeProps.node.type === "folder"
                  ? "i-carbon-folder text-blue-400"
                  : "i-carbon-document text-neutral-400"
              }`}
            />

            <button class="flex-1 text-left text-neutral-200 truncate hover:text-neutral-100 cursor-pointer">
              {nodeProps.node.name}
            </button>

            <Show when={nodeProps.node.favorite}>
              <div class="i-carbon-star-filled w-4 h-4 text-yellow-400 flex-shrink-0" />
            </Show>

            <div class="flex items-center gap-1 ">
              <Show when={nodeProps.node.type === "folder"}>
                <Button
                  onClick={(e) => {
                    e.stopPropagation();
                    setTargetFolder(nodeProps.node.path);
                    setShowNewDocModal(true);
                  }}
                  variant="icon"
                  size="sm"
                  title="Add file"
                >
                  <div class="i-carbon-add w-5 h-5 text-green-400" />
                </Button>
                <Button
                  onClick={(e) => {
                    e.stopPropagation();
                    setTargetFolder(nodeProps.node.path);
                    setShowNewFolderModal(true);
                  }}
                  variant="icon"
                  size="sm"
                  title="Add subfolder"
                >
                  <div class="i-carbon-folder-add w-5 h-5 text-blue-400" />
                </Button>
              </Show>
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
                      <div class="i-carbon-overflow-menu-vertical w-5 h-5 text-neutral-400" />
                    </Button>
                  )}
                />
                <Popover.Portal>
                  <Popover.Content class="mt-1 mb-1 max-w-36 bg-neutral-800 border border-neutral-700 rounded-lg shadow-lg z-50 py-1 animate-slide-down">
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
                    </Show>

                    <PopoverItem
                      onClick={(e) => {
                        e.stopPropagation();
                        const fileName = nodeProps.node.name.split(".")[0];
                        setItemToRename(nodeProps.node.path);
                        setNewItemName(fileName);
                        setShowRenameModal(true);
                        setOpenMenuPath(null);
                      }}
                    >
                      <div class="i-carbon-edit w-4 h-4" />
                      Rename
                    </PopoverItem>

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
                    <Show when={props.onSetColor}>
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

          <Show when={nodeProps.node.type === "file"}>
            <div
              class="text-sm text-neutral-600 pb-1 flex items-center gap-2"
              style={{ "padding-left": "28px" }}
            >
              <span>{formatDate(nodeProps.node.modified)}</span>
            </div>
          </Show>
        </div>

        <Show when={nodeProps.node.type === "folder" && isExpanded()}>
          <For each={nodeProps.node.children}>
            {(child) => <TreeNode node={child} />}
          </For>
        </Show>
      </>
    );
  };

  const SidebarContent = () => (
    <>
      {/* Sidebar Header */}
      <div class="p-4 sm:p-4 border-b border-neutral-800">
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

        <div class="flex gap-2 mb-3">
          <Button
            onClick={() => {
              setTargetFolder("/");
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

        {/* Search */}
        <div class="relative">
          <div class="absolute left-3 top-1/2 -translate-y-1/2 i-carbon-search w-4 h-4 text-neutral-500" />
          <input
            type="text"
            placeholder="Search..."
            value={searchQuery()}
            onInput={(e) => setSearchQuery(e.currentTarget.value)}
            class="w-full pl-9 pr-3 py-2 bg-neutral-900 border border-neutral-800 rounded-lg  text-neutral-200 placeholder-neutral-600 focus:outline-none focus:border-neutral-700"
          />
        </div>
      </div>

      {/* Documents Tree */}
      <div class="flex-1 overflow-y-auto scrollbar-none">
        <For each={filteredTree()}>{(node) => <TreeNode node={node} />}</For>
      </div>

      {/* Archive & Recently Deleted Buttons */}
      <div class="p-4 space-y-2">
        <Button
          onClick={() => props.onViewHome()}
          variant="ghost"
          size="md"
          fullWidth
        >
          <div class="i-carbon-home w-4 h-4" />
          <span class="ml-2">Homepage</span>
        </Button>
        <Button
          onClick={() => props.onViewArchive()}
          variant="ghost"
          size="md"
          fullWidth
        >
          <div class="i-carbon-archive w-4 h-4" />
          <span class="ml-2">View Archive</span>
        </Button>
        <Button
          onClick={() => props.onViewDeleted()}
          variant="ghost"
          size="md"
          fullWidth
        >
          <div class="i-carbon-trash-can w-4 h-4" />
          <span class="ml-2">Recently Deleted</span>
        </Button>
        <Button
          onClick={() => navigate(routes.settings)}
          variant="ghost"
          size="md"
          fullWidth
        >
          <div class="i-carbon-settings w-4 h-4" />
          <span class="ml-2">Settings</span>
        </Button>
      </div>
    </>
  );

  return (
    <>
      {/* Mobile: Simple aside with fixed positioning */}
      <Show when={isMounted() && isMobile()}>
        <aside
          class="w-80 h-full border-r border-neutral-800 bg-neutral-950 flex flex-col fixed inset-y-0 left-0 z-50 transition-transform duration-300 ease-in-out"
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
          initialSize={320}
          minSize={240}
          maxSize={600}
          resizeFrom="right"
          class="h-full border-r border-neutral-800 bg-neutral-950 flex flex-col relative"
        >
          <SidebarContent />
        </ResizableContainer>
      </Show>

      {/* New Document Modal */}
      <AlertDialog
        isOpen={showNewDocModal()}
        title="New Document"
        onConfirm={handleCreateDocument}
        onCancel={() => setShowNewDocModal(false)}
      >
        <p class=" text-neutral-400 mb-3">Creating in: {targetFolder()}</p>
        <input
          ref={newDocInputRef}
          type="text"
          placeholder="Document name"
          value={newItemName()}
          onInput={(e) => setNewItemName(e.currentTarget.value)}
          onKeyPress={(e) => e.key === "Enter" && handleCreateDocument()}
          class="w-full px-3 py-2 bg-neutral-950 border border-neutral-800 rounded-lg text-neutral-200 placeholder-neutral-600 focus:outline-none focus:border-neutral-700 mb-4"
        />
      </AlertDialog>

      {/* New Folder Modal */}
      <AlertDialog
        isOpen={showNewFolderModal()}
        title="New Folder"
        onConfirm={handleCreateFolder}
        onCancel={() => setShowNewFolderModal(false)}
      >
        <p class=" text-neutral-400 mb-3">Creating in: {targetFolder()}</p>
        <input
          ref={newFolderInputRef}
          type="text"
          placeholder="Folder name"
          value={newItemName()}
          onInput={(e) => setNewItemName(e.currentTarget.value)}
          onKeyPress={(e) => e.key === "Enter" && handleCreateFolder()}
          class="w-full px-3 py-2 bg-neutral-950 border border-neutral-800 rounded-lg text-neutral-200 placeholder-neutral-600 focus:outline-none focus:border-neutral-700 mb-4"
        />
      </AlertDialog>

      {/* Rename Modal */}
      <AlertDialog
        isOpen={showRenameModal()}
        title="Rename"
        onConfirm={handleRename}
        onCancel={() => setShowRenameModal(false)}
      >
        <p class=" text-neutral-400 mb-3">Current: {itemToRename()}</p>
        <input
          ref={renameInputRef}
          type="text"
          placeholder="New name"
          value={newItemName()}
          onInput={(e) => setNewItemName(e.currentTarget.value)}
          onKeyPress={(e) => e.key === "Enter" && handleRename()}
          class="w-full px-3 py-2 bg-neutral-950 border border-neutral-800 rounded-lg text-neutral-200 placeholder-neutral-600 focus:outline-none focus:border-neutral-700 mb-4"
        />
      </AlertDialog>
    </>
  );
}
