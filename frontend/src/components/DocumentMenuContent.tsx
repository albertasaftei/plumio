import { Show, type Accessor } from "solid-js";
import { Popover } from "@kobalte/core/popover";
import PopoverItem from "./PopoverItem";
import ColorPicker from "./ColorPicker";
import TagContextMenu from "./Sidebar/TagContextMenu";
import type { Tag } from "~/types/Tag.types";

export interface DocumentMenuContentProps {
  path: string;
  name: string;
  type?: "file" | "folder";
  isFavorite?: boolean;
  color?: string | null;
  tags?: Accessor<Tag[]>;
  tagMappings?: Accessor<Record<string, number[]>>;
  onClose: () => void;
  onDelete?: () => void;
  onArchive?: () => void;
  onDownloadMarkdown?: () => void | Promise<void>;
  onDownloadPdf?: () => void | Promise<void>;
  onRename?: () => void;
  onMove?: () => void;
  onDuplicate?: () => void;
  onToggleFavorite?: (isFavorite: boolean) => void;
  onSetColor?: (color: string | null) => void;
  onToggleTag?: (tagId: number, add: boolean) => void;
  onAddFile?: () => void;
  onAddFolder?: () => void;
}

export default function DocumentMenuContent(props: DocumentMenuContentProps) {
  const isFolder = () => (props.type ?? "file") === "folder";
  const isFile = () => (props.type ?? "file") === "file";

  return (
    <>
      {/* Add file/folder actions (folders only) */}
      <Show when={isFolder() && (props.onAddFile || props.onAddFolder)}>
        <Show when={props.onAddFile}>
          <PopoverItem
            onClick={(e) => {
              e.stopPropagation();
              props.onClose();
              props.onAddFile!();
            }}
          >
            <div class="i-carbon-document-add w-4 h-4" />
            Add file
          </PopoverItem>
        </Show>
        <Show when={props.onAddFolder}>
          <PopoverItem
            onClick={(e) => {
              e.stopPropagation();
              props.onClose();
              props.onAddFolder!();
            }}
          >
            <div class="i-carbon-folder-add w-4 h-4" />
            Add folder
          </PopoverItem>
        </Show>
        <div class="h-px bg-[var(--color-border)] my-1" />
      </Show>

      {/* Favorite */}
      <Show when={props.onToggleFavorite}>
        <PopoverItem
          onClick={(e) => {
            e.stopPropagation();
            props.onToggleFavorite!(!props.isFavorite);
            props.onClose();
          }}
        >
          <div
            class={`w-4 h-4 ${
              props.isFavorite
                ? "i-carbon-star-filled text-yellow-400"
                : "i-carbon-star"
            }`}
          />
          {props.isFavorite ? "Unfavorite" : "Favorite"}
        </PopoverItem>
        <div class="h-px bg-[var(--color-border)] my-1" />
      </Show>

      {/* Archive (files only) */}
      <Show when={isFile() && props.onArchive}>
        <PopoverItem
          onClick={(e) => {
            e.stopPropagation();
            props.onArchive!();
            props.onClose();
          }}
        >
          <div class="i-carbon-archive w-4 h-4" />
          Archive
        </PopoverItem>
      </Show>

      {/* Download sub-menu (files only) */}
      <Show
        when={isFile() && (props.onDownloadMarkdown || props.onDownloadPdf)}
      >
        <div class="h-px bg-[var(--color-border)] my-1" />
        <Popover placement="right-start">
          <Popover.Trigger
            as={(triggerProps: any) => (
              <button
                {...triggerProps}
                onClick={(e: MouseEvent) => {
                  e.stopPropagation();
                  triggerProps.onClick?.(e);
                }}
                class="w-full px-3 py-2 text-left text-sm text-secondary-body hover:bg-neutral-600 transition-colors flex items-center gap-2 cursor-pointer"
              >
                <div class="i-carbon-download w-4 h-4" />
                Download
                <div class="i-carbon-chevron-right w-3 h-3 ml-auto" />
              </button>
            )}
          />
          <Popover.Portal>
            <Popover.Content class="bg-surface border border-base rounded-lg shadow-lg z-[60] py-1 min-w-40 animate-slide-down">
              <Show when={props.onDownloadMarkdown}>
                <PopoverItem
                  onClick={async (e) => {
                    e.stopPropagation();
                    props.onClose();
                    await props.onDownloadMarkdown!();
                  }}
                >
                  <div class="i-carbon-document w-4 h-4" />
                  Markdown
                </PopoverItem>
              </Show>
              <Show when={props.onDownloadPdf}>
                <PopoverItem
                  onClick={async (e) => {
                    e.stopPropagation();
                    props.onClose();
                    await props.onDownloadPdf!();
                  }}
                >
                  <div class="i-carbon-document-pdf w-4 h-4" />
                  PDF
                </PopoverItem>
              </Show>
            </Popover.Content>
          </Popover.Portal>
        </Popover>
        <div class="h-px bg-[var(--color-border)] my-1" />
      </Show>

      {/* Tags sub-menu (files only) */}
      <Show
        when={isFile() && props.tags && props.tagMappings && props.onToggleTag}
      >
        <Popover placement="right-start">
          <Popover.Trigger
            as={(triggerProps: any) => (
              <button
                {...triggerProps}
                onClick={(e: MouseEvent) => {
                  e.stopPropagation();
                  triggerProps.onClick?.(e);
                }}
                class="w-full px-3 py-2 text-left text-sm text-secondary-body hover:bg-neutral-600 transition-colors flex items-center gap-2 cursor-pointer"
              >
                <div class="i-carbon-tag w-4 h-4" />
                Tags
                <div class="i-carbon-chevron-right w-3 h-3 ml-auto" />
              </button>
            )}
          />
          <Popover.Portal>
            <Popover.Content class="bg-surface border border-base rounded-lg shadow-lg z-[60] py-1 min-w-40 animate-slide-down">
              <TagContextMenu
                documentPath={props.path}
                tags={props.tags!}
                tagMappings={props.tagMappings!}
                onToggle={(tagId, add) => props.onToggleTag!(tagId, add)}
              />
            </Popover.Content>
          </Popover.Portal>
        </Popover>
      </Show>

      {/* Rename */}
      <Show when={props.onRename}>
        <PopoverItem
          onClick={(e) => {
            e.stopPropagation();
            props.onClose();
            props.onRename!();
          }}
        >
          <div class="i-carbon-edit w-4 h-4" />
          Rename
        </PopoverItem>
      </Show>

      {/* Move */}
      <Show when={props.onMove}>
        <PopoverItem
          onClick={(e) => {
            e.stopPropagation();
            props.onClose();
            props.onMove!();
          }}
        >
          <div class="i-carbon-move w-4 h-4" />
          Move
        </PopoverItem>
      </Show>

      {/* Duplicate */}
      <Show when={props.onDuplicate}>
        <PopoverItem
          onClick={(e) => {
            e.stopPropagation();
            props.onClose();
            props.onDuplicate!();
          }}
        >
          <div class="i-carbon-copy w-4 h-4" />
          Duplicate
        </PopoverItem>
      </Show>

      <div class="h-px bg-[var(--color-border)] my-1" />

      {/* Delete */}
      <Show when={props.onDelete}>
        <PopoverItem
          onClick={(e) => {
            e.stopPropagation();
            props.onDelete!();
            props.onClose();
          }}
        >
          <div class="i-carbon-trash-can w-4 h-4" />
          Delete
        </PopoverItem>
      </Show>

      {/* Color picker */}
      <Show when={props.onSetColor}>
        <div class="h-px bg-[var(--color-border)] my-1" />
        <ColorPicker
          currentColor={props.color}
          onColorSelect={(color) => {
            props.onSetColor!(color);
            props.onClose();
          }}
        />
      </Show>
    </>
  );
}
