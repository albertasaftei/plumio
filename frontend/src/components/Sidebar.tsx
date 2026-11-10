import { Show, createMemo, createEffect, onCleanup, onMount } from "solid-js";
import { monitorForElements } from "@atlaskit/pragmatic-drag-and-drop/element/adapter";
import { extractInstruction } from "@atlaskit/pragmatic-drag-and-drop-hitbox/list-item";
import AlertDialog from "./AlertDialog";
import MoveDialog from "./MoveDialog";
import { ResizableContainer } from "./ResizableContainer";
import { useLocation, useNavigate } from "@solidjs/router";
import { api } from "~/lib/api";
import { useAppLayout } from "~/lib/appLayoutContext";
import type { SidebarProps } from "~/types/Sidebar.types";
import { getDisplayName } from "~/utils/document.utils";
import { isMobileOrTablet } from "~/utils/device.utils";
import FilterNotesBody from "./Sidebar/FilterNotesBody";
import SidebarContent from "./Sidebar/SidebarContent";
import { routes } from "~/routes";
import {
  createSidebarFilterState,
  createSidebarModalState,
} from "./Sidebar/Sidebar.state";

export default function Sidebar(_props: Readonly<SidebarProps>) {
  const layout = useAppLayout();
  const navigate = useNavigate();
  const location = useLocation();

  const encodePath = (path: string) =>
    path.split("/").map(encodeURIComponent).join("/");

  const currentPath = createMemo(() =>
    decodeURIComponent(location.pathname.replace(/^\/file/, "")),
  );

  const navigateAndClose = (route: string) => {
    navigate(route);
    if (isMobileOrTablet()) {
      layout.setSidebarOpen(false);
    }
  };
  const {
    tags,
    setTags,
    selectedFilterTags,
    setSelectedFilterTags,
    filterMode,
    setFilterMode,
    tagMappings,
    setTagMappings,
    filterModifiedFrom,
    setFilterModifiedFrom,
    filterModifiedTo,
    setFilterModifiedTo,
    filterCreatedFrom,
    setFilterCreatedFrom,
    filterCreatedTo,
    setFilterCreatedTo,
    filterFavorite,
    setFilterFavorite,
    filterColors,
    setFilterColors,
    availableColors,
    activeFilterCount,
    filteredTree,
    folderOptions,
    refreshTags,
  } = createSidebarFilterState(() => layout.allDocuments());

  const {
    getDefaultDocName,
    showNewDocModal,
    setShowNewDocModal,
    showNewFolderModal,
    setShowNewFolderModal,
    showRenameModal,
    setShowRenameModal,
    showMoveModal,
    setShowMoveModal,
    showFilterModal,
    setShowFilterModal,
    newDocName,
    setNewDocName,
    newFolderName,
    setNewFolderName,
    newItemName,
    setNewItemName,
    targetFolder,
    setTargetFolder,
    itemToRename,
    setItemToRename,
    itemToMove,
    setItemToMove,
    bulkMovePaths,
    setBulkMovePaths,
  } = createSidebarModalState();

  let newDocInputRef: HTMLInputElement | undefined;
  let newFolderInputRef: HTMLInputElement | undefined;
  let renameInputRef: HTMLInputElement | undefined;

  onMount(() => {
    refreshTags();
  });

  createEffect(() => {
    if (showFilterModal()) {
      refreshTags();
    }
  });

  onMount(() => {
    const cleanup = monitorForElements({
      onDrop: ({ source, location }) => {
        const target = location.current.dropTargets[0];
        if (!target) return;

        const sourceData = source.data as {
          path: string;
          name: string;
          type: string;
        };
        const inst = extractInstruction(target.data);
        if (!inst || inst.blocked) return;

        const targetPath = target.data.path as string;
        const targetType = target.data.type as string;

        if (
          inst.operation === "reorder-before" ||
          inst.operation === "reorder-after"
        ) {
          layout.reorderItem(sourceData.path, targetPath, inst.operation);
        } else if (inst.operation === "combine" && targetType === "folder") {
          layout.reorderItem(sourceData.path, targetPath, "make-child");
        }
      },
    });

    onCleanup(cleanup);
  });

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
    const name = newDocName().trim();
    if (!name) return;

    layout.createDocument(name, targetFolder());
    setNewDocName(getDefaultDocName());
    setTargetFolder("/");
    setShowNewDocModal(false);
  };

  const handleCreateFolder = () => {
    const name = newFolderName().trim();
    const parent = targetFolder();
    if (!name) return;

    layout.createFolder(name, parent);
    if (parent !== "/") {
      layout.toggleExpandFolder(parent);
    }

    setNewFolderName("");
    setTargetFolder("/");
    setShowNewFolderModal(false);
  };

  const handleRename = () => {
    const name = newItemName().trim();
    const oldPath = itemToRename();
    if (!name || !oldPath) return;

    layout.renameItem(oldPath, name);
    setNewItemName("");
    setItemToRename(null);
    setShowRenameModal(false);
  };

  const modalActions = {
    setShowNewDocModal,
    setShowNewFolderModal,
    setShowRenameModal,
    setShowMoveModal,
    setTargetFolder,
    setNewDocName,
    setNewFolderName,
    setItemToRename,
    setNewItemName,
    setItemToMove,
    getDefaultDocName,
  };

  const sidebarContentProps = createMemo(() => ({
    filteredTree,
    expandedFolders: layout.expandedFolders(),
    currentPath: currentPath(),
    onSelectDocument: (path: string) =>
      navigateAndClose(`/file${encodePath(path)}`),
    onExpandFolder: layout.toggleExpandFolder,
    onViewHome: () => navigateAndClose(routes.homepage),
    onViewSearch: () => navigateAndClose(routes.search),
    onViewArchive: () => navigateAndClose(routes.archive),
    onViewDeleted: () => navigateAndClose(routes.deleted),
    onViewTags: () => navigateAndClose(routes.tags),
    onViewOrgs: () => navigateAndClose(routes.joinOrg),
    onOrgSwitch: layout.loadAllDocuments,
    collapsed: !layout.sidebarOpen(),
    onToggleCollapse: () => layout.setSidebarOpen(!layout.sidebarOpen()),
    onCreateDocument: layout.createDocument,
    onCreateFolder: layout.createFolder,
    onDeleteItem: layout.deleteItem,
    onArchiveItem: layout.archiveItem,
    onRenameItem: layout.renameItem,
    onMoveItem: layout.moveItem,
    onDuplicateItem: layout.duplicateItem,
    onToggleFavorite: layout.toggleFavorite,
    onSetColor: layout.setItemColor,
    setShowFilterModal,
    selectedFilterTags,
    activeFilterCount,
    tags,
    tagMappings,
    onToggleTag: async (path: string, tagId: number, add: boolean) => {
      const currentTags = tagMappings()[path] || [];
      const newTags = add
        ? [...currentTags, tagId]
        : currentTags.filter((t) => t !== tagId);
      await api.setDocumentTags(path, newTags);
      refreshTags();
    },
    onBulkMove: (paths: string[]) => {
      setBulkMovePaths(paths);
      setItemToMove({
        path: paths[0],
        name: `${paths.length} item${paths.length === 1 ? "" : "s"}`,
        type: "file" as const,
      });
      setShowMoveModal(true);
    },
    onBulkDelete: layout.bulkDelete,
    onModalOpen: modalActions,
  }));

  return (
    <>
      <Show
        when={layout.sidebarOpen()}
        fallback={
          <div class="h-full border-r border-base bg-surface flex-shrink-0">
            <SidebarContent {...sidebarContentProps()} />
          </div>
        }
      >
        <ResizableContainer
          initialSize={350}
          minSize={300}
          maxSize={600}
          resizeFrom="right"
          class="h-full border-r border-base bg-base flex flex-col relative"
        >
          <SidebarContent {...sidebarContentProps()} />
        </ResizableContainer>
      </Show>

      <AlertDialog
        isOpen={showNewDocModal()}
        title="New Document"
        onConfirm={handleCreateDocument}
        onCancel={() => {
          setNewDocName(getDefaultDocName());
          setTargetFolder("/");
          setShowNewDocModal(false);
        }}
      >
        <input
          ref={newDocInputRef}
          type="text"
          placeholder="Document name"
          value={newDocName()}
          onInput={(e) => setNewDocName(e.currentTarget.value)}
          onKeyPress={(e) => e.key === "Enter" && handleCreateDocument()}
          class="w-full px-3 py-2 bg-base border border-base rounded-lg text-body placeholder-muted-body focus:outline-none focus:border-[var(--color-primary)] mb-3"
        />
        <label class="block text-sm text-secondary-body mb-1">Create in</label>
        <select
          value={targetFolder()}
          onChange={(e) => setTargetFolder(e.currentTarget.value)}
          class="w-full px-3 py-2 bg-base border border-base rounded-lg text-body focus:outline-none focus:border-[var(--color-primary)] mb-4 cursor-pointer"
        >
          {folderOptions().map((opt) => (
            <option value={opt.path}>{opt.label}</option>
          ))}
        </select>
      </AlertDialog>

      <AlertDialog
        isOpen={showNewFolderModal()}
        title="New Folder"
        onConfirm={handleCreateFolder}
        onCancel={() => {
          setNewFolderName("");
          setShowNewFolderModal(false);
        }}
      >
        <p class="text-secondary-body mb-3">Creating in: {targetFolder()}</p>
        <input
          ref={newFolderInputRef}
          type="text"
          placeholder="Folder name"
          value={newFolderName()}
          onInput={(e) => setNewFolderName(e.currentTarget.value)}
          onKeyPress={(e) => e.key === "Enter" && handleCreateFolder()}
          class="w-full px-3 py-2 bg-base border border-base rounded-lg text-body placeholder-muted-body focus:outline-none focus:border-[var(--color-primary)] mb-4"
        />
      </AlertDialog>

      <AlertDialog
        isOpen={showRenameModal()}
        title="Rename"
        onConfirm={handleRename}
        onCancel={() => setShowRenameModal(false)}
      >
        <p class="text-secondary-body mb-3">
          Current: {itemToRename() ? getDisplayName(itemToRename()!) : ""}
        </p>
        <input
          ref={renameInputRef}
          type="text"
          placeholder="New name"
          value={newItemName()}
          onInput={(e) => setNewItemName(e.currentTarget.value)}
          onKeyPress={(e) => e.key === "Enter" && handleRename()}
          class="w-full px-3 py-2 bg-base border border-base rounded-lg text-body placeholder-muted-body focus:outline-none focus:border-[var(--color-primary)] mb-4"
        />
      </AlertDialog>

      <MoveDialog
        isOpen={showMoveModal()}
        itemPath={itemToMove()?.path ?? ""}
        itemName={itemToMove()?.name ?? ""}
        itemType={itemToMove()?.type ?? "file"}
        documents={layout.allDocuments()}
        onConfirm={(dest, targetOrgId, keepSource) => {
          const bulk = bulkMovePaths();
          if (bulk.length > 0) {
            bulk.forEach((path) =>
              layout.moveItem(path, dest, targetOrgId, keepSource),
            );
            setBulkMovePaths([]);
          } else {
            const source = itemToMove();
            if (source) {
              layout.moveItem(source.path, dest, targetOrgId, keepSource);
            }
          }
          setShowMoveModal(false);
          setItemToMove(null);
        }}
        onCancel={() => {
          setShowMoveModal(false);
          setItemToMove(null);
        }}
      />

      <AlertDialog
        isOpen={showFilterModal()}
        title="Filter Notes"
        showActions={false}
        showCloseIcon
        onConfirm={() => setShowFilterModal(false)}
        onCancel={() => setShowFilterModal(false)}
      >
        <FilterNotesBody
          filterMode={filterMode}
          setFilterMode={setFilterMode}
          selectedFilterTags={selectedFilterTags}
          setSelectedFilterTags={setSelectedFilterTags}
          tags={tags}
          filterModifiedFrom={filterModifiedFrom}
          setFilterModifiedFrom={setFilterModifiedFrom}
          filterModifiedTo={filterModifiedTo}
          setFilterModifiedTo={setFilterModifiedTo}
          filterCreatedFrom={filterCreatedFrom}
          setFilterCreatedFrom={setFilterCreatedFrom}
          filterCreatedTo={filterCreatedTo}
          setFilterCreatedTo={setFilterCreatedTo}
          filterFavorite={filterFavorite}
          setFilterFavorite={setFilterFavorite}
          filterColors={filterColors}
          setFilterColors={setFilterColors}
          availableColors={availableColors}
        />
      </AlertDialog>
    </>
  );
}
