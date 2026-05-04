import { $prose } from "@milkdown/utils";
import { Plugin, PluginKey, TextSelection } from "@milkdown/prose/state";
import type { EditorView } from "@milkdown/prose/view";
import type { EditorState } from "@milkdown/prose/state";

export type VimMode = "NORMAL" | "INSERT" | "VISUAL";

interface VimPluginState {
  mode: VimMode;
  pendingKey: string;
  yankBuffer: string;
  isLineYank: boolean;
  visualAnchor: number;
}

const VIM_KEY = new PluginKey<VimPluginState>("prosemirror-vim");

// ── State helpers ─────────────────────────────────────────────────────────────

function updateVimState(
  view: EditorView,
  patch: Partial<VimPluginState>,
): void {
  const current = VIM_KEY.getState(view.state) ?? defaultVimState();
  const tr = view.state.tr.setMeta(VIM_KEY, { ...current, ...patch });
  view.dispatch(tr);
}

function defaultVimState(): VimPluginState {
  return {
    mode: "NORMAL",
    pendingKey: "",
    yankBuffer: "",
    isLineYank: false,
    visualAnchor: 0,
  };
}

// ── Cursor movement ───────────────────────────────────────────────────────────

function moveTo(view: EditorView, pos: number, anchor?: number): void {
  const { state } = view;
  const clamped = Math.max(0, Math.min(pos, state.doc.content.size));
  const selection =
    anchor !== undefined
      ? TextSelection.create(state.doc, anchor, clamped)
      : TextSelection.create(state.doc, clamped);
  view.dispatch(state.tr.setSelection(selection));
}

function moveDown(view: EditorView, anchor?: number): boolean {
  const head = view.state.selection.head;
  const coords = view.coordsAtPos(head);
  const lineHeight = Math.max(coords.bottom - coords.top, 14);
  const hit = view.posAtCoords({
    left: coords.left,
    top: coords.bottom + lineHeight * 0.5,
  });
  if (!hit) return false;
  moveTo(view, hit.pos, anchor);
  return true;
}

function moveUp(view: EditorView, anchor?: number): boolean {
  const head = view.state.selection.head;
  const coords = view.coordsAtPos(head);
  const lineHeight = Math.max(coords.bottom - coords.top, 14);
  // Use a full lineHeight above the top edge so we clear paragraph margins
  const hit = view.posAtCoords({
    left: coords.left,
    top: coords.top - lineHeight,
  });
  if (!hit) return false;
  moveTo(view, hit.pos, anchor);
  return true;
}

// ── Word navigation ───────────────────────────────────────────────────────────
// Walk ProseMirror positions directly via textBetween so inline marks,
// block boundaries, and mixed content are handled correctly.

const WORD = /[a-zA-Z0-9_]/;

function charAt(state: EditorState, pos: number): string {
  if (pos < 0 || pos >= state.doc.content.size) return "";
  try {
    // "\ufffc" for non-text leaf nodes, "\n" for block boundaries
    return state.doc.textBetween(pos, pos + 1, "\n", "\ufffc");
  } catch {
    return "\n";
  }
}

function isWord(ch: string): boolean {
  return WORD.test(ch);
}

function findNextWordStart(state: EditorState, from: number): number {
  const max = state.doc.content.size;
  let pos = from;

  // skip current word chars
  while (pos < max && isWord(charAt(state, pos))) pos++;
  // skip non-word chars (whitespace, punctuation, block boundaries)
  while (pos < max && !isWord(charAt(state, pos))) pos++;

  return Math.min(pos, max);
}

function findPrevWordStart(state: EditorState, from: number): number {
  let pos = from - 1;

  // skip non-word chars backwards
  while (pos > 0 && !isWord(charAt(state, pos))) pos--;
  // skip word chars backwards to find start of word
  while (pos > 0 && isWord(charAt(state, pos - 1))) pos--;

  return Math.max(pos, 0);
}

function findWordEnd(state: EditorState, from: number): number {
  const max = state.doc.content.size;
  let pos = from + 1;

  // if on non-word char, skip to next word first
  while (pos < max && !isWord(charAt(state, pos))) pos++;
  // extend to end of word
  while (pos < max && isWord(charAt(state, pos))) pos++;
  // back up one: we want the last word char, not the char after it
  pos = Math.max(pos - 1, from + 1);

  return Math.min(pos, max);
}

// ── Mode indicator ────────────────────────────────────────────────────────────

function createModeBar(): HTMLDivElement {
  const bar = document.createElement("div");
  bar.className = "vim-mode-bar";
  bar.style.cssText = [
    "position:sticky",
    "bottom:0",
    "left:0",
    "right:0",
    "padding:2px 12px",
    "font-size:11px",
    "font-family:monospace",
    "letter-spacing:0.04em",
    "user-select:none",
    "z-index:10",
    "pointer-events:none",
    "background:var(--color-surface,#1a1a1a)",
    "border-top:1px solid var(--color-border-subtle,#2a2a2a)",
    "color:var(--color-muted,#888)",
    "transition:color 0.1s",
  ].join(";");
  bar.textContent = "-- NORMAL --";
  return bar;
}

function updateModeBar(bar: HTMLDivElement, vimState: VimPluginState): void {
  switch (vimState.mode) {
    case "NORMAL":
      bar.textContent = vimState.pendingKey
        ? `-- NORMAL -- ${vimState.pendingKey}`
        : "-- NORMAL --";
      bar.style.color = "var(--color-muted,#888)";
      break;
    case "INSERT":
      bar.textContent = "-- INSERT --";
      bar.style.color = "var(--color-primary,#2a9d8f)";
      break;
    case "VISUAL":
      bar.textContent = "-- VISUAL --";
      bar.style.color = "#e9c46a";
      break;
  }
}

// ── Plugin ────────────────────────────────────────────────────────────────────

export const vimPlugin = $prose(() => {
  return new Plugin<VimPluginState>({
    key: VIM_KEY,

    state: {
      init: defaultVimState,
      apply(tr, value) {
        const meta = tr.getMeta(VIM_KEY) as Partial<VimPluginState> | undefined;
        if (meta) return { ...value, ...meta };
        return value;
      },
    },

    view(editorView: EditorView) {
      const bar = createModeBar();
      const wrapper =
        editorView.dom.closest(".milkdown-editor-wrapper") ??
        editorView.dom.parentElement;
      wrapper?.appendChild(bar);

      return {
        update(view: EditorView) {
          const state = VIM_KEY.getState(view.state);
          if (state) updateModeBar(bar, state);
        },
        destroy() {
          bar.remove();
        },
      };
    },

    props: {
      handleKeyDown(view: EditorView, event: KeyboardEvent): boolean {
        const vimState = VIM_KEY.getState(view.state);
        if (!vimState) return false;

        const { mode, pendingKey, yankBuffer, isLineYank, visualAnchor } =
          vimState;
        const key = event.key;
        const ctrl = event.ctrlKey || event.metaKey;

        // ══ INSERT MODE ══════════════════════════════════════════════════════
        if (mode === "INSERT") {
          if (key === "Escape" || (ctrl && key === "[")) {
            event.preventDefault();
            const { state } = view;
            const pos = state.selection.head;
            const $pos = state.doc.resolve(pos);
            // vim nudges cursor back by 1 when leaving insert mode
            const newPos = Math.max($pos.start(), pos - 1);
            moveTo(view, newPos);
            updateVimState(view, { mode: "NORMAL", pendingKey: "" });
            return true;
          }
          return false; // let ProseMirror handle everything
        }

        // ══ VISUAL MODE ══════════════════════════════════════════════════════
        if (mode === "VISUAL") {
          event.preventDefault();
          const { state } = view;

          if (key === "Escape" || (ctrl && key === "[")) {
            moveTo(view, state.selection.head);
            updateVimState(view, { mode: "NORMAL", pendingKey: "" });
            return true;
          }

          let head = state.selection.head;
          const anchor = visualAnchor;

          switch (key) {
            case "h":
              head = Math.max(state.doc.resolve(head).start(), head - 1);
              break;
            case "l":
              head = Math.min(state.doc.resolve(head).end(), head + 1);
              break;
            case "j":
              moveDown(view, anchor);
              return true;
            case "k":
              moveUp(view, anchor);
              return true;
            case "w":
              head = findNextWordStart(state, head);
              break;
            case "b":
              head = findPrevWordStart(state, head);
              break;
            case "0":
              head = state.doc.resolve(head).start();
              break;
            case "$":
              head = state.doc.resolve(head).end();
              break;

            case "y": {
              const from = Math.min(state.selection.from, state.selection.to);
              const to = Math.max(state.selection.from, state.selection.to);
              const text = state.doc.textBetween(from, to, "\n");
              updateVimState(view, {
                mode: "NORMAL",
                pendingKey: "",
                yankBuffer: text,
                isLineYank: false,
              });
              moveTo(view, from);
              return true;
            }

            case "d":
            case "x": {
              const from = Math.min(state.selection.from, state.selection.to);
              const to = Math.max(state.selection.from, state.selection.to);
              const text = state.doc.textBetween(from, to, "\n");
              const tr = state.tr.delete(from, to).setMeta(VIM_KEY, {
                ...vimState,
                mode: "NORMAL",
                pendingKey: "",
                yankBuffer: text,
                isLineYank: false,
              });
              view.dispatch(tr);
              return true;
            }

            default:
              return true;
          }

          moveTo(view, head, anchor);
          return true;
        }

        // ══ NORMAL MODE ══════════════════════════════════════════════════════

        // Pass through all other ctrl/meta combos (browser shortcuts, etc.)
        if (ctrl) return false;

        // Pass through browser utility keys
        if (
          key === "Tab" ||
          key === "F5" ||
          key === "F12" ||
          key === "F11" ||
          key === "F1"
        )
          return false;

        // ── Pending combo: g_ ─────────────────────────────────────────────
        if (pendingKey === "g") {
          event.preventDefault();
          if (key === "g") {
            moveTo(view, 1);
          }
          updateVimState(view, { pendingKey: "" });
          return true;
        }

        // ── Pending combo: d_ ─────────────────────────────────────────────
        if (pendingKey === "d") {
          event.preventDefault();
          if (key === "d") {
            const { state } = view;
            const { $from } = state.selection;
            const blockFrom = $from.before($from.depth);
            const blockTo = $from.after($from.depth);
            const text = $from.parent.textContent;
            const tr = state.tr.delete(blockFrom, blockTo).setMeta(VIM_KEY, {
              ...vimState,
              yankBuffer: text,
              isLineYank: true,
              pendingKey: "",
            });
            view.dispatch(tr);
          } else {
            updateVimState(view, { pendingKey: "" });
          }
          return true;
        }

        // ── Pending combo: y_ ─────────────────────────────────────────────
        if (pendingKey === "y") {
          event.preventDefault();
          if (key === "y") {
            const { $from } = view.state.selection;
            const text = $from.parent.textContent;
            updateVimState(view, {
              yankBuffer: text,
              isLineYank: true,
              pendingKey: "",
            });
          } else {
            updateVimState(view, { pendingKey: "" });
          }
          return true;
        }

        // ── Pending combo: r{char} ────────────────────────────────────────
        if (pendingKey === "r") {
          event.preventDefault();
          if (key.length === 1) {
            const { state } = view;
            const pos = state.selection.from;
            const $pos = state.doc.resolve(pos);
            const nodeAfter = $pos.nodeAfter;
            if (nodeAfter?.isText && pos < $pos.end()) {
              const tr = state.tr
                .replaceWith(
                  pos,
                  pos + 1,
                  state.schema.text(key, nodeAfter.marks),
                )
                .setMeta(VIM_KEY, { ...vimState, pendingKey: "" });
              view.dispatch(tr);
            } else {
              updateVimState(view, { pendingKey: "" });
            }
          } else {
            updateVimState(view, { pendingKey: "" });
          }
          return true;
        }

        // ── Main normal-mode dispatch ─────────────────────────────────────
        event.preventDefault();

        switch (key) {
          // Motions
          case "h": {
            const { state } = view;
            const pos = state.selection.head;
            const $pos = state.doc.resolve(pos);
            moveTo(view, Math.max($pos.start(), pos - 1));
            return true;
          }
          case "l": {
            const { state } = view;
            const pos = state.selection.head;
            const $pos = state.doc.resolve(pos);
            moveTo(view, Math.min($pos.end(), pos + 1));
            return true;
          }
          case "j":
            moveDown(view);
            return true;
          case "k":
            moveUp(view);
            return true;
          case "w":
            moveTo(
              view,
              findNextWordStart(view.state, view.state.selection.head),
            );
            return true;
          case "b":
            moveTo(
              view,
              findPrevWordStart(view.state, view.state.selection.head),
            );
            return true;
          case "e":
            moveTo(view, findWordEnd(view.state, view.state.selection.head));
            return true;
          case "0": {
            const $pos = view.state.doc.resolve(view.state.selection.head);
            moveTo(view, $pos.start());
            return true;
          }
          case "$": {
            const $pos = view.state.doc.resolve(view.state.selection.head);
            moveTo(view, $pos.end());
            return true;
          }
          case "g":
            updateVimState(view, { pendingKey: "g" });
            return true;
          case "G": {
            moveTo(view, view.state.doc.content.size - 1);
            return true;
          }

          // Insert mode entry
          case "i":
            updateVimState(view, { mode: "INSERT", pendingKey: "" });
            return true;
          case "a": {
            const { state } = view;
            const pos = state.selection.head;
            const $pos = state.doc.resolve(pos);
            moveTo(view, Math.min($pos.end(), pos + 1));
            updateVimState(view, { mode: "INSERT", pendingKey: "" });
            return true;
          }
          case "I": {
            const $pos = view.state.doc.resolve(view.state.selection.head);
            moveTo(view, $pos.start());
            updateVimState(view, { mode: "INSERT", pendingKey: "" });
            return true;
          }
          case "A": {
            const $pos = view.state.doc.resolve(view.state.selection.head);
            moveTo(view, $pos.end());
            updateVimState(view, { mode: "INSERT", pendingKey: "" });
            return true;
          }
          case "o": {
            const { state } = view;
            const { $from } = state.selection;
            const insertPos = $from.after($from.depth);
            const paragraph = state.schema.nodes.paragraph?.create();
            if (paragraph) {
              const tr = state.tr.insert(insertPos, paragraph);
              tr.setSelection(TextSelection.create(tr.doc, insertPos + 1));
              tr.setMeta(VIM_KEY, {
                ...vimState,
                mode: "INSERT",
                pendingKey: "",
              });
              view.dispatch(tr);
            } else {
              updateVimState(view, { mode: "INSERT", pendingKey: "" });
            }
            return true;
          }
          case "O": {
            const { state } = view;
            const { $from } = state.selection;
            const insertPos = $from.before($from.depth);
            const paragraph = state.schema.nodes.paragraph?.create();
            if (paragraph) {
              const tr = state.tr.insert(insertPos, paragraph);
              tr.setSelection(TextSelection.create(tr.doc, insertPos + 1));
              tr.setMeta(VIM_KEY, {
                ...vimState,
                mode: "INSERT",
                pendingKey: "",
              });
              view.dispatch(tr);
            } else {
              updateVimState(view, { mode: "INSERT", pendingKey: "" });
            }
            return true;
          }

          // Delete
          case "x": {
            const { state } = view;
            const pos = state.selection.from;
            const $pos = state.doc.resolve(pos);
            if (pos < $pos.end()) {
              view.dispatch(state.tr.delete(pos, pos + 1));
            }
            return true;
          }
          case "d":
            updateVimState(view, { pendingKey: "d" });
            return true;

          // Yank
          case "y":
            updateVimState(view, { pendingKey: "y" });
            return true;

          // Paste
          case "p": {
            if (!yankBuffer) return true;
            const { state } = view;
            const { $from } = state.selection;
            if (isLineYank) {
              const insertPos = $from.after($from.depth);
              const paragraph = state.schema.nodes.paragraph?.createAndFill(
                null,
                yankBuffer ? state.schema.text(yankBuffer) : undefined,
              );
              if (paragraph) {
                const tr = state.tr.insert(insertPos, paragraph);
                tr.setSelection(TextSelection.create(tr.doc, insertPos + 1));
                view.dispatch(tr);
              }
            } else {
              view.dispatch(
                state.tr.insertText(yankBuffer, state.selection.from),
              );
            }
            return true;
          }
          case "P": {
            if (!yankBuffer) return true;
            const { state } = view;
            const { $from } = state.selection;
            if (isLineYank) {
              const insertPos = $from.before($from.depth);
              const paragraph = state.schema.nodes.paragraph?.createAndFill(
                null,
                yankBuffer ? state.schema.text(yankBuffer) : undefined,
              );
              if (paragraph) {
                const tr = state.tr.insert(insertPos, paragraph);
                tr.setSelection(TextSelection.create(tr.doc, insertPos + 1));
                view.dispatch(tr);
              }
            } else {
              const pos = Math.max(0, state.selection.from - 1);
              view.dispatch(state.tr.insertText(yankBuffer, pos));
            }
            return true;
          }

          // Replace single char
          case "r":
            updateVimState(view, { pendingKey: "r" });
            return true;

          // Visual mode
          case "v": {
            const pos = view.state.selection.head;
            updateVimState(view, {
              mode: "VISUAL",
              visualAnchor: pos,
              pendingKey: "",
            });
            return true;
          }

          // Escape: clear pending, stay in NORMAL
          case "Escape":
            updateVimState(view, { pendingKey: "" });
            return true;

          default:
            // Consume everything else in NORMAL mode
            return true;
        }
      },
    },
  });
});
