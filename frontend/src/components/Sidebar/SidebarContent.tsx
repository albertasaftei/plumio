import { createSignal, For, Show, type Accessor } from "solid-js";
import Button from "../Button";
import OrganizationSelector from "../OrganizationSelector";
import { useNavigate } from "@solidjs/router";
import { routes } from "~/routes";
import TreeNode from "./TreeNode";
import type {
  SidebarProps,
  TreeNode as TreeNodeType,
} from "~/types/Sidebar.types";
import type { Tag } from "~/types/Tag.types";

interface SidebarContentProps extends Omit<
  Readonly<SidebarProps>,
  "sidebarOpen" | "expandedFolders" | "onExpandFolder"
> {
  filteredTree: Accessor<TreeNodeType[]>;
  setSidebarOpen: (open: boolean) => void;
  expandedFolders: Set<string>;
  currentPath: string | null;
  onSelectDocument: (path: string) => void;
  onExpandFolder: (path: string) => void;
  versionInfo: Accessor<{
    updateAvailable: boolean;
    latestVersion: string | null;
    releaseUrl: string | null;
  } | null>;
  showNewDocModal: Accessor<boolean>;
  setShowNewDocModal: (show: boolean) => void;
  showNewFolderModal: Accessor<boolean>;
  setShowNewFolderModal: (show: boolean) => void;
  showFilterModal: Accessor<boolean>;
  setShowFilterModal: (show: boolean) => void;
  selectedFilterTags: Accessor<number[]>;
  tags: Accessor<Tag[]>;
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
  tagMappings: Accessor<Record<string, number[]>>;
  onToggleTag?: (path: string, tagId: number, add: boolean) => void;
}

export default function SidebarContent(props: SidebarContentProps) {
  const navigate = useNavigate();

  return (
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
          onClick={() => props.onViewTags()}
          variant="icon"
          size="md"
          title="Tags"
        >
          <div class="i-carbon-tag w-5 h-5 flex-shrink-0" />
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
        <div class="relative">
          <Button
            onClick={() => navigate(routes.settings)}
            variant="icon"
            size="md"
            title={
              props.versionInfo()?.updateAvailable
                ? `Settings — Update available (${props.versionInfo()?.latestVersion})`
                : "Settings"
            }
          >
            <div class="i-carbon-settings w-5 h-5 flex-shrink-0" />
          </Button>
          <Show when={props.versionInfo()?.updateAvailable}>
            <span class="absolute top-0.5 right-0.5 w-2 h-2 rounded-full bg-amber-400 pointer-events-none" />
          </Show>
        </div>
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
                props.onModalOpen.setTargetFolder("/");
                props.onModalOpen.setNewDocName(
                  props.onModalOpen.getDefaultDocName(),
                );
                props.setShowNewDocModal(true);
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
                props.onModalOpen.setTargetFolder("/");
                props.onModalOpen.setNewFolderName("");
                props.setShowNewFolderModal(true);
              }}
              variant="secondary"
              size="md"
              title="New folder"
            >
              <div class="i-carbon-folder-add w-4 h-4" />
            </Button>
            <div class="relative">
              <Button
                onClick={() => props.setShowFilterModal(true)}
                variant={
                  props.selectedFilterTags().length > 0
                    ? "primary"
                    : "secondary"
                }
                size="md"
                title="Filter"
                class="h-full"
              >
                <div class="i-carbon-filter w-4 h-4" />
              </Button>
              <Show when={props.selectedFilterTags().length > 0}>
                <span class="absolute -top-1 -right-1 min-w-4 h-4 px-1 rounded-full bg-[var(--color-bg-surface)] border border-[var(--color-primary)] text-[var(--color-primary)] text-[10px] flex items-center justify-center font-semibold pointer-events-none shadow-sm">
                  {props.selectedFilterTags().length}
                </span>
              </Show>
            </div>
          </div>
        </div>

        {/* Documents Tree */}
        <div class="flex-1 overflow-y-auto scrollbar-none pb-4">
          <For each={props.filteredTree()}>
            {(node) => (
              <TreeNode
                node={node}
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
      </div>
    </div>
  );
}
