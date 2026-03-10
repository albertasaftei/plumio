import { Component } from "solid-js";

interface ActiveState {
  bold?: boolean;
  italic?: boolean;
  strikethrough?: boolean;
  inlineCode?: boolean;
  highlight?: boolean;
  link?: boolean;
  headingLevel?: number | null;
  bulletList?: boolean;
  orderedList?: boolean;
  taskList?: boolean;
  blockquote?: boolean;
  codeBlock?: boolean;
}

interface ToolbarProps {
  onCommand: (command: string, payload?: any) => void;
  hasSelection?: boolean;
  activeState?: ActiveState;
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
      class={`toolbar-button p-1.5 rounded transition-colors duration-150 ${
        props.disabled
          ? "text-[var(--color-text-muted)] cursor-not-allowed"
          : props.active
            ? "bg-[var(--color-bg-elevated)] text-[var(--color-primary)]"
            : "text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-elevated)] active:bg-[var(--color-bg-elevated)]"
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

  return (
    <div class="editor-toolbar flex items-center gap-0.5 px-3 py-1.5 bg-[var(--color-bg-base)] border-b border-[var(--color-border)] overflow-x-auto shrink-0">
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
    </div>
  );
}
