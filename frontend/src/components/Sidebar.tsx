import { createSignal, For, Show, createMemo, createEffect } from "solid-js";
import Popover, { PopoverItem } from "./Popover";
import ColorPicker from "./ColorPicker";
import Button from "./Button";
import type { SidebarProps, TreeNode } from "~/types/Sidebar.types";
import {
  buildDocumentTree,
  COLOR_PALETTE,
  filterTreeNodes,
  formatDate,
} from "~/utils/sidebar.utils";

export default function Sidebar(props: SidebarProps) {
  const [showNewDocModal, setShowNewDocModal] = createSignal(false);
  const [showNewFolderModal, setShowNewFolderModal] = createSignal(false);
  const [showRenameModal, setShowRenameModal] = createSignal(false);
  const [newItemName, setNewItemName] = createSignal("");
  const [targetFolder, setTargetFolder] = createSignal<string>("/");
  const [itemToRename, setItemToRename] = createSignal<string | null>(null);
  const [openMenuPath, setOpenMenuPath] = createSignal<string | null>(null);
  const [searchQuery, setSearchQuery] = createSignal("");

  let newDocInputRef: HTMLInputElement | undefined;
  let newFolderInputRef: HTMLInputElement | undefined;
  let renameInputRef: HTMLInputElement | undefined;

  const buildTree = createMemo(() => buildDocumentTree(props.documents));

  const toggleFolder = (path: string) => {
    props.onExpandFolder(path);
  };

  const filteredTree = () => filterTreeNodes(buildTree(), searchQuery());

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
          class={`group relative hover:bg-neutral-900 border-l-2 transition-colors ${
            nodeProps.node.path === props.currentPath
              ? "border-l-blue-500"
              : "border-l-transparent"
          }`}
          style={{
            "padding-left": paddingLeft(),
            "background-color": getBackgroundColor(),
          }}
          class="border-y border-neutral-800/50"
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
            <Show when={nodeProps.node.type === "file"}>
              <div class="w-3 h-3" />
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
                  <div class="i-carbon-add w-4 h-4 text-green-400" />
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
                  <div class="i-carbon-folder-add w-4 h-4 text-blue-400" />
                </Button>
              </Show>
              <Popover
                trigger={
                  <Button
                    onClick={(e) => {
                      e.stopPropagation();
                      setOpenMenuPath(
                        openMenuPath() === nodeProps.node.path
                          ? null
                          : nodeProps.node.path,
                      );
                    }}
                    variant="icon"
                    size="sm"
                    title="More options"
                  >
                    <div class="i-carbon-overflow-menu-vertical w-4 h-4 text-neutral-400" />
                  </Button>
                }
                isOpen={openMenuPath() === nodeProps.node.path}
                onClose={() => setOpenMenuPath(null)}
              >
                <PopoverItem
                  icon="i-carbon-edit"
                  label="Rename"
                  onClick={(e) => {
                    e.stopPropagation();
                    const fileName = nodeProps.node.name.split(".")[0];
                    setItemToRename(nodeProps.node.path);
                    setNewItemName(fileName);
                    setShowRenameModal(true);
                    setOpenMenuPath(null);
                  }}
                />

                <PopoverItem
                  icon="i-carbon-trash-can"
                  label="Delete"
                  variant="danger"
                  onClick={(e) => {
                    e.stopPropagation();
                    props.onDeleteItem(nodeProps.node.path);
                    setOpenMenuPath(null);
                  }}
                />
                <Show when={props.onSetColor}>
                  <ColorPicker
                    currentColor={nodeProps.node.color}
                    onColorSelect={(color) => {
                      props.onSetColor?.(nodeProps.node.path, color);
                      setOpenMenuPath(null);
                    }}
                  />
                </Show>
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

  return (
    <>
      <aside class="w-80 sm:w-96 h-full border-r border-neutral-800 bg-neutral-950 flex flex-col">
        {/* Sidebar Header */}
        <div class="p-3 sm:p-4 border-b border-neutral-800">
          <div class="flex items-center justify-between mb-3">
            <Button
              onClick={() => props.setSidebarOpen(false)}
              variant="icon"
              size="md"
              title="Close sidebar"
            >
              <div class="i-carbon-side-panel-close w-5 h-5" />
            </Button>
            <Show when={props.saveStatus === "saving"}>
              <span class="text-xs text-neutral-400">Saving...</span>
            </Show>
            <Show when={props.saveStatus === "saved"}>
              <span class="text-xs text-green-500">✓ Saved</span>
            </Show>
            <Show when={props.saveStatus === "unsaved"}>
              <span class="text-xs text-yellow-500">● Unsaved</span>
            </Show>
          </div>

          {/* Current File Breadcrumb */}
          <Show when={props.currentPath}>
            <div class="mb-3 px-2 py-1.5 bg-neutral-900 rounded-lg border border-neutral-800">
              <div class="text-xs text-neutral-500 mb-0.5">Current file</div>
              <div class="text-sm text-neutral-200 truncate">
                {props.currentPath}
              </div>
            </div>
          </Show>

          <div class="flex gap-2 mb-3">
            <Button
              onClick={() => {
                setTargetFolder("/");
                setShowNewDocModal(true);
              }}
              variant="secondary"
              size="md"
              fullWidth
              class="flex items-center justify-center gap-2"
            >
              <div class="i-carbon-document-add w-4 h-4" />
              New
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
        <div class="flex-1 overflow-y-auto">
          <For each={filteredTree()}>{(node) => <TreeNode node={node} />}</For>
        </div>
      </aside>

      {/* New Document Modal */}
      <Show when={showNewDocModal()}>
        <div
          class="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          onClick={() => setShowNewDocModal(false)}
        >
          <div
            class="bg-neutral-900 rounded-lg p-4 sm:p-6 w-full max-w-md border border-neutral-800"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 class="text-lg font-semibold text-neutral-100 mb-4">
              New Document
            </h3>
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
            <div class="flex gap-2 justify-end">
              <Button
                onClick={() => setShowNewDocModal(false)}
                variant="ghost"
                size="lg"
              >
                Cancel
              </Button>
              <Button
                onClick={handleCreateDocument}
                variant="primary"
                size="lg"
              >
                Create
              </Button>
            </div>
          </div>
        </div>
      </Show>

      {/* New Folder Modal */}
      <Show when={showNewFolderModal()}>
        <div
          class="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          onClick={() => setShowNewFolderModal(false)}
        >
          <div
            class="bg-neutral-900 rounded-lg p-4 sm:p-6 w-full max-w-md border border-neutral-800"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 class="text-lg font-semibold text-neutral-100 mb-4">
              New Folder
            </h3>
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
            <div class="flex gap-2 justify-end">
              <Button
                onClick={() => setShowNewFolderModal(false)}
                variant="ghost"
                size="lg"
              >
                Cancel
              </Button>
              <Button onClick={handleCreateFolder} variant="primary" size="lg">
                Create
              </Button>
            </div>
          </div>
        </div>
      </Show>

      {/* Rename Modal */}
      <Show when={showRenameModal()}>
        <div
          class="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          onClick={() => setShowRenameModal(false)}
        >
          <div
            class="bg-neutral-900 rounded-lg p-4 sm:p-6 w-full max-w-md border border-neutral-800"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 class="text-lg font-semibold text-neutral-100 mb-4">Rename</h3>
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
            <div class="flex gap-2 justify-end">
              <Button
                onClick={() => setShowRenameModal(false)}
                variant="ghost"
                size="lg"
              >
                Cancel
              </Button>
              <Button onClick={handleRename} variant="primary" size="lg">
                Rename
              </Button>
            </div>
          </div>
        </div>
      </Show>
    </>
  );
}
