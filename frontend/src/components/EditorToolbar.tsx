import { Component, createSignal, Show } from "solid-js";
import { Popover } from "@kobalte/core/popover";

interface ActiveState {
  bold?: boolean;
  italic?: boolean;
  strikethrough?: boolean;
  inlineCode?: boolean;
  highlight?: boolean;
  link?: boolean;
  textColor?: string | null;
  fontFamily?: string | null;
  headingLevel?: number | null;
  bulletList?: boolean;
  orderedList?: boolean;
  taskList?: boolean;
  blockquote?: boolean;
  codeBlock?: boolean;
}

const TEXT_COLORS = [
  { name: "Red", value: "#ef4444" },
  { name: "Orange", value: "#f97316" },
  { name: "Amber", value: "#f59e0b" },
  { name: "Yellow", value: "#eab308" },
  { name: "Green", value: "#22c55e" },
  { name: "Teal", value: "#14b8a6" },
  { name: "Blue", value: "#3b82f6" },
  { name: "Indigo", value: "#6366f1" },
  { name: "Purple", value: "#a855f7" },
  { name: "Pink", value: "#ec4899" },
  { name: "White", value: "#f9fafb" },
  { name: "Light Gray", value: "#9ca3af" },
];

const FONT_FAMILIES = [
  { label: "Arial", value: "Arial, Helvetica, sans-serif" },
  { label: "Georgia", value: "Georgia, serif" },
  { label: "Times New Roman", value: "'Times New Roman', serif" },
  { label: "Verdana", value: "Verdana, Geneva, sans-serif" },
  { label: "Trebuchet MS", value: "'Trebuchet MS', sans-serif" },
  { label: "Courier New", value: "'Courier New', Courier, monospace" },
];

interface ToolbarProps {
  onCommand: (command: string, payload?: any) => void;
  hasSelection?: boolean;
  activeState?: ActiveState;
  showAttachments?: boolean;
  attachmentCount?: number;
}

interface ToolbarButtonProps {
  icon?: string;
  label?: string;
  title: string;
  onClick: () => void;
  class?: string;
  iconClass?: string;
  disabled?: boolean;
  active?: boolean;
}

const isMac =
  typeof navigator !== "undefined" && /Mac/.test(navigator.platform);
const mod = isMac ? "⌘" : "Ctrl+";

const ToolbarButton: Component<ToolbarButtonProps> = (props) => {
  const handleMouseDown = (e: MouseEvent) => {
    if (props.disabled) {
      e.preventDefault();
      return;
    }
    e.preventDefault();
    props.onClick();
  };

  return (
    <button
      type="button"
      disabled={props.disabled}
      class={`toolbar-button p-1.5 rounded transition-colors duration-150 cursor-pointer ${
        props.disabled
          ? "text-muted-body cursor-not-allowed"
          : props.active
            ? "bg-elevated text-[var(--color-primary)]"
            : "text-secondary-body hover:text-body hover:bg-elevated active:bg-elevated"
      } ${props.class || ""}`}
      title={props.title}
      onMouseDown={handleMouseDown}
    >
      {props.label ? (
        <span class="text-xs font-bold leading-none">{props.label}</span>
      ) : (
        <div class={`${props.icon} ${props.iconClass || "w-4 h-4"}`} />
      )}
    </button>
  );
};

const ToolbarDivider: Component = () => (
  <div class="w-px h-5 bg-[var(--color-border)] mx-0.5 shrink-0" />
);

export default function EditorToolbar(props: ToolbarProps) {
  const s = () => props.activeState || {};
  const [showColorPicker, setShowColorPicker] = createSignal(false);
  const [showFontPicker, setShowFontPicker] = createSignal(false);

  // Derive a short display label for the active font
  const activeFontLabel = () => {
    const ff = s().fontFamily;
    if (!ff) return null;
    return FONT_FAMILIES.find((f) => f.value === ff)?.label ?? "Custom";
  };

  return (
    <div class="editor-toolbar flex items-center gap-0.5 px-3 py-1.5 bg-base border-b border-base overflow-x-auto shrink-0">
      {/* Undo / Redo */}
      <ToolbarButton
        icon="i-carbon-undo"
        title={`Undo (${mod}Z)`}
        onClick={() => props.onCommand("undo")}
      />
      <ToolbarButton
        icon="i-carbon-redo"
        title={`Redo (${mod}${isMac ? "⇧Z" : "Shift+Z"})`}
        onClick={() => props.onCommand("redo")}
      />

      <ToolbarDivider />

      {/* Font Family */}
      <Popover
        open={showFontPicker()}
        onOpenChange={(isOpen) => {
          if (!props.hasSelection && !s().fontFamily) return;
          setShowFontPicker(isOpen);
        }}
      >
        <Popover.Trigger
          as={(triggerProps: any) => (
            <button
              {...triggerProps}
              type="button"
              disabled={!props.hasSelection && !s().fontFamily}
              onMouseDown={(e: MouseEvent) => {
                e.preventDefault();
                triggerProps.onClick?.(e);
              }}
              title="Font Family"
              class={`toolbar-button px-1.5 py-1 rounded transition-colors duration-150 cursor-pointer flex items-center gap-1 max-w-[80px] ${
                !props.hasSelection && !s().fontFamily
                  ? "text-muted-body cursor-not-allowed opacity-50"
                  : s().fontFamily
                    ? "bg-elevated text-[var(--color-primary)]"
                    : "text-secondary-body hover:text-body hover:bg-elevated"
              }`}
            >
              <span
                class="text-[11px] font-medium leading-none truncate"
                style={{ "font-family": s().fontFamily || "inherit" }}
              >
                {activeFontLabel() ?? "Font"}
              </span>
              <div class="i-carbon-chevron-down w-2.5 h-2.5 shrink-0 opacity-60" />
            </button>
          )}
        />
        <Popover.Portal>
          <Popover.Content class="mt-1 bg-surface border border-base rounded-lg shadow-lg p-1.5 z-50 animate-slide-down min-w-[160px]">
            <p class="text-[10px] text-muted-body uppercase tracking-wide mb-1 px-1.5">
              Font Family
            </p>
            {FONT_FAMILIES.map((f) => (
              <button
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault();
                  props.onCommand("setFontFamily", f.value);
                  setShowFontPicker(false);
                }}
                class={`w-full text-left px-2 py-1.5 rounded text-sm transition-colors cursor-pointer hover:bg-elevated ${
                  s().fontFamily === f.value
                    ? "text-[var(--color-primary)] bg-elevated"
                    : "text-body"
                }`}
                style={{ "font-family": f.value }}
              >
                {f.label}
              </button>
            ))}
            <Show when={!!s().fontFamily}>
              <div class="border-t border-base mt-1 pt-1">
                <button
                  type="button"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    props.onCommand("setFontFamily", null);
                    setShowFontPicker(false);
                  }}
                  class="w-full text-[11px] text-secondary-body hover:text-body hover:bg-elevated rounded px-2 py-1 text-left transition-colors cursor-pointer"
                >
                  Reset to default
                </button>
              </div>
            </Show>
          </Popover.Content>
        </Popover.Portal>
      </Popover>

      <ToolbarDivider />

      {/* Text formatting */}
      <ToolbarButton
        icon="i-carbon-text-bold"
        title={`Bold (${mod}B)`}
        active={s().bold}
        onClick={() => props.onCommand("toggleBold")}
      />
      <ToolbarButton
        icon="i-carbon-text-italic"
        title={`Italic (${mod}I)`}
        active={s().italic}
        onClick={() => props.onCommand("toggleItalic")}
      />
      <ToolbarButton
        icon="i-carbon-text-strikethrough"
        title="Strikethrough"
        active={s().strikethrough}
        onClick={() => props.onCommand("toggleStrikethrough")}
      />
      <ToolbarButton
        icon="i-carbon-code"
        title="Inline Code"
        active={s().inlineCode}
        onClick={() => props.onCommand("toggleInlineCode")}
      />
      <ToolbarButton
        icon="i-carbon-text-highlight"
        title="Highlight"
        active={s().highlight}
        onClick={() => props.onCommand("toggleHighlight")}
      />

      {/* Text Color */}
      <Popover
        open={showColorPicker()}
        onOpenChange={(isOpen) => {
          if (!props.hasSelection && !s().textColor) return;
          setShowColorPicker(isOpen);
        }}
      >
        <Popover.Trigger
          as={(triggerProps: any) => (
            <button
              {...triggerProps}
              type="button"
              disabled={!props.hasSelection && !s().textColor}
              onMouseDown={(e: MouseEvent) => {
                e.preventDefault();
                triggerProps.onClick?.(e);
              }}
              title="Text Color"
              class={`toolbar-button p-1.5 rounded transition-colors duration-150 cursor-pointer flex flex-col items-center gap-0.5 ${
                !props.hasSelection && !s().textColor
                  ? "text-muted-body cursor-not-allowed opacity-50"
                  : s().textColor
                    ? "bg-elevated text-[var(--color-primary)]"
                    : "text-secondary-body hover:text-body hover:bg-elevated"
              }`}
            >
              <span
                class="text-xs font-bold leading-none"
                style={{ color: s().textColor || "currentColor" }}
              >
                A
              </span>
              <span
                class="w-3 h-0.5 rounded-full transition-colors"
                style={{
                  "background-color": s().textColor || "currentColor",
                  opacity: s().textColor ? "1" : "0.4",
                }}
              />
            </button>
          )}
        />
        <Popover.Portal>
          <Popover.Content class="mt-1 bg-surface border border-base rounded-lg shadow-lg p-2 z-50 animate-slide-down">
            <p class="text-[10px] text-muted-body uppercase tracking-wide mb-1.5 px-0.5">
              Text Color
            </p>
            <div class="grid grid-cols-6 gap-1 mb-1.5">
              {TEXT_COLORS.map((c) => (
                <button
                  type="button"
                  title={c.name}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    props.onCommand("setTextColor", c.value);
                    setShowColorPicker(false);
                  }}
                  class={`w-5 h-5 rounded-sm border-2 transition-transform hover:scale-110 cursor-pointer ${
                    s().textColor === c.value
                      ? "border-white"
                      : "border-transparent"
                  }`}
                  style={{ "background-color": c.value }}
                />
              ))}
            </div>
            <Show when={!!s().textColor}>
              <button
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault();
                  props.onCommand("setTextColor", null);
                  setShowColorPicker(false);
                }}
                class="w-full text-[11px] text-secondary-body hover:text-body hover:bg-elevated rounded px-2 py-1 text-left transition-colors cursor-pointer"
              >
                Remove color
              </button>
            </Show>
          </Popover.Content>
        </Popover.Portal>
      </Popover>

      <ToolbarDivider />

      {/* Headings */}
      <ToolbarButton
        label="H1"
        title={`Heading 1 (${mod}1)`}
        active={s().headingLevel === 1}
        onClick={() => props.onCommand("setHeading", 1)}
        class="min-w-[28px] justify-center"
      />
      <ToolbarButton
        label="H2"
        title={`Heading 2 (${mod}2)`}
        active={s().headingLevel === 2}
        onClick={() => props.onCommand("setHeading", 2)}
        class="min-w-[28px] justify-center"
      />
      <ToolbarButton
        label="H3"
        title={`Heading 3 (${mod}3)`}
        active={s().headingLevel === 3}
        onClick={() => props.onCommand("setHeading", 3)}
        class="min-w-[28px] justify-center"
      />

      <ToolbarDivider />

      {/* Lists */}
      <ToolbarButton
        icon="i-carbon-list-bulleted"
        title="Bullet List"
        active={s().bulletList && !s().taskList}
        onClick={() => props.onCommand("toggleBulletList")}
      />
      <ToolbarButton
        icon="i-carbon-list-numbered"
        title="Ordered List"
        active={s().orderedList}
        onClick={() => props.onCommand("toggleOrderedList")}
      />
      <ToolbarButton
        icon="i-carbon-checkbox-checked"
        title="Task List"
        active={s().taskList}
        onClick={() => props.onCommand("toggleTaskList")}
      />

      <ToolbarDivider />

      {/* Blocks & Insert */}
      <ToolbarButton
        icon="i-carbon-quotes"
        title="Blockquote"
        active={s().blockquote}
        onClick={() => props.onCommand("toggleBlockquote")}
      />
      <ToolbarButton
        icon="i-carbon-terminal"
        title={`Code Block (${mod}${isMac ? "⌥" : "Alt+"}C)`}
        active={s().codeBlock}
        onClick={() => props.onCommand("toggleCodeBlock")}
      />
      <ToolbarButton
        icon="i-carbon-pen"
        title="Sketch"
        onClick={() => props.onCommand("insertSketch")}
      />
      <ToolbarButton
        icon="i-carbon-link"
        title={s().link ? "Edit Link" : "Add Link"}
        active={s().link}
        disabled={!props.hasSelection && !s().link}
        onClick={() => props.onCommand("toggleLink")}
      />
      <ToolbarButton
        icon="i-carbon-subtract"
        title="Horizontal Rule"
        onClick={() => props.onCommand("insertHorizontalRule")}
      />

      <ToolbarDivider />

      {/* Attachments */}
      <ToolbarButton
        icon="i-carbon-attachment"
        title="Attachments"
        active={props.showAttachments || (props.attachmentCount ?? 0) > 0}
        onClick={() => props.onCommand("toggleAttachments")}
      />

      <ToolbarDivider />

      {/* Download */}
      <Popover>
        <Popover.Trigger
          as={(triggerProps: any) => (
            <button
              {...triggerProps}
              type="button"
              onMouseDown={(e: MouseEvent) => {
                e.preventDefault();
                triggerProps.onClick?.(e);
              }}
              title="Download document"
              class="toolbar-button p-1.5 rounded transition-colors duration-150 cursor-pointer text-secondary-body hover:text-body hover:bg-elevated active:bg-elevated"
            >
              <div class="i-carbon-download w-4 h-4" />
            </button>
          )}
        />
        <Popover.Portal>
          <Popover.Content class="mt-1 bg-surface border border-base rounded-lg shadow-lg z-50 py-1 min-w-[160px] animate-slide-down">
            <button
              type="button"
              onMouseDown={(e) => {
                e.preventDefault();
                props.onCommand("downloadMarkdown");
              }}
              class="w-full flex items-center gap-2 px-3 py-1.5 text-sm text-body hover:bg-elevated transition-colors cursor-pointer"
            >
              <div class="i-carbon-document w-4 h-4" />
              Markdown
            </button>
            <button
              type="button"
              onMouseDown={(e) => {
                e.preventDefault();
                props.onCommand("downloadPdf");
              }}
              class="w-full flex items-center gap-2 px-3 py-1.5 text-sm text-body hover:bg-elevated transition-colors cursor-pointer"
            >
              <div class="i-carbon-document-pdf w-4 h-4" />
              PDF
            </button>
          </Popover.Content>
        </Popover.Portal>
      </Popover>
    </div>
  );
}
