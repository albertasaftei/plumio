import { $remark } from "@milkdown/utils";
import { onMount, onCleanup, createEffect, createSignal } from "solid-js";
import type { EditorProps } from "~/types/Editor.types";
import EditorToolbar from "~/components/EditorToolbar";
import { exitMarkKeymap } from "~/utils/milkdown/highlight/exitMarkKeymap";
import { markInputRule } from "~/utils/milkdown/highlight/inputRule";
import { markSchema } from "~/utils/milkdown/highlight/markSchema";
import { remarkMarkColor } from "~/utils/milkdown/highlight/remarkMarkColor";
import { textColorSchema } from "~/utils/milkdown/textColor/textColorSchema";
import { remarkTextColor } from "~/utils/milkdown/textColor/remarkTextColor";
import { fontFamilySchema } from "~/utils/milkdown/fontFamily/fontFamilySchema";
import { remarkFontFamily } from "~/utils/milkdown/fontFamily/remarkFontFamily";
import { taskListInputPlugin } from "~/utils/milkdown/taskListInputPlugin";
import { codeBlockViewPlugin } from "~/utils/milkdown/codeBlockView";
import {
  MERMAID_PREVIEW_OPEN_EVENT,
  type MermaidPreviewOpenDetail,
} from "~/utils/milkdown/mermaidPlugin";
import { pdfImagePlugin } from "~/utils/milkdown/pdfImagePlugin";
import LinkPopup from "./LinkPopup";
import { api } from "~/lib/api";
import AttachmentPanel from "./AttachmentPanel";
import MermaidViewer from "./MermaidViewer";

const milkdownMarkColorPlugin = $remark("markColor", () => remarkMarkColor);
const milkdownTextColorPlugin = $remark("textColor", () => remarkTextColor);
const milkdownFontFamilyPlugin = $remark("fontFamily", () => remarkFontFamily);

// Normalize href: add https:// if no protocol is provided
const normalizeUrl = (url: string): string => {
  const trimmed = url.trim();
  if (!trimmed.match(/^[a-z][a-z0-9+.-]*:\/\//i)) {
    return "https://" + trimmed;
  }
  return trimmed;
};

export default function MarkdownEditor(props: EditorProps) {
  let editorRef: HTMLDivElement | undefined;
  let editorInstance: any = null;
  let isUpdatingFromProps = false;
  const [hasSelection, setHasSelection] = createSignal(false);
  const [showLinkPopup, setShowLinkPopup] = createSignal(false);
  const [showAttachments, setShowAttachments] = createSignal(false);
  const [currentLinkData, setCurrentLinkData] = createSignal<{
    href: string;
    title?: string;
  }>({ href: "" });
  const [mermaidViewer, setMermaidViewer] = createSignal({
    isOpen: false,
    source: "",
  });
  const [activeState, setActiveState] = createSignal({
    bold: false,
    italic: false,
    strikethrough: false,
    inlineCode: false,
    highlight: false,
    link: false,
    textColor: null as string | null,
    fontFamily: null as string | null,
    headingLevel: null as number | null,
    bulletList: false,
    orderedList: false,
    taskList: false,
    blockquote: false,
    codeBlock: false,
  });

  const updateSelectionState = async () => {
    if (!editorInstance) return;

    await editorInstance.action(async (ctx: any) => {
      const { editorViewCtx } = await import("@milkdown/core");
      const { state } = ctx.get(editorViewCtx);
      const { from, to, empty, $from } = state.selection;
      setHasSelection(!empty);

      // Detect active marks
      const marks = empty ? state.storedMarks || $from.marks() : [];
      const hasMark = (markName: string): boolean => {
        if (empty) {
          return marks.some((m: any) => m.type.name === markName);
        }
        const markType = state.schema.marks[markName];
        if (!markType) return false;
        return state.doc.rangeHasMark(from, to, markType);
      };

      // Detect active nodes
      let headingLevel: number | null = null;
      let bulletList = false;
      let orderedList = false;
      let taskList = false;
      let blockquote = false;
      let codeBlock = false;

      for (let d = $from.depth; d > 0; d--) {
        const node = $from.node(d);
        const name = node.type.name;
        if (name === "heading") headingLevel = node.attrs.level;
        if (name === "bullet_list") bulletList = true;
        if (name === "ordered_list") orderedList = true;
        if (name === "list_item" && node.attrs.checked != null) taskList = true;
        if (name === "blockquote") blockquote = true;
        if (name === "code_block") codeBlock = true;
      }

      // Detect active text color
      let textColor: string | null = null;
      if (empty) {
        const tcMark = (state.storedMarks || $from.marks()).find(
          (m: any) => m.type.name === "textColor",
        );
        textColor = tcMark?.attrs.color ?? null;
      } else {
        state.doc.nodesBetween(from, to, (node: any) => {
          if (!textColor && node.marks) {
            const tcMark = node.marks.find(
              (m: any) => m.type.name === "textColor",
            );
            if (tcMark) textColor = tcMark.attrs.color ?? null;
          }
        });
      }

      // Detect active font family
      let fontFamily: string | null = null;
      if (empty) {
        const ffMark = (state.storedMarks || $from.marks()).find(
          (m: any) => m.type.name === "fontFamily",
        );
        fontFamily = ffMark?.attrs.family ?? null;
      } else {
        state.doc.nodesBetween(from, to, (node: any) => {
          if (!fontFamily && node.marks) {
            const ffMark = node.marks.find(
              (m: any) => m.type.name === "fontFamily",
            );
            if (ffMark) fontFamily = ffMark.attrs.family ?? null;
          }
        });
      }

      const linkActive = hasMark("link");
      setActiveState({
        bold: hasMark("strong"),
        italic: hasMark("emphasis"),
        strikethrough: hasMark("strike_through"),
        inlineCode: hasMark("inlineCode") || hasMark("code_inline"),
        highlight: hasMark("mark"),
        link: linkActive,
        textColor,
        fontFamily,
        headingLevel,
        bulletList,
        orderedList,
        taskList,
        blockquote,
        codeBlock,
      });

      // Update link data
      if (linkActive && !empty) {
        state.doc.nodesBetween(from, to, (node: any) => {
          if (node.marks) {
            node.marks.forEach((mark: any) => {
              if (mark.type.name === "link") {
                setCurrentLinkData({
                  href: mark.attrs.href || "",
                  title: mark.attrs.title,
                });
              }
            });
          }
        });
      } else if (!linkActive) {
        setCurrentLinkData({ href: "" });
      }
    });
  };

  const handleLinkSubmit = async (href: string, title?: string) => {
    if (!editorInstance || !href) return;

    try {
      await editorInstance.action(async (ctx: any) => {
        const { editorViewCtx } = await import("@milkdown/core");
        const view = ctx.get(editorViewCtx);
        view.focus();
        const { state, dispatch } = view;
        const { from, to } = state.selection;
        const linkMarkType = state.schema.marks.link;
        if (!linkMarkType || from === to) return;

        const tr = state.tr
          .removeMark(from, to, linkMarkType)
          .addMark(
            from,
            to,
            linkMarkType.create({ href, title: title || null }),
          );
        dispatch(tr);
      });

      setShowLinkPopup(false);
    } catch (error) {
      console.error("Failed to update link:", error);
    }
  };

  const handleRemoveLink = async () => {
    if (!editorInstance) return;

    try {
      await editorInstance.action(async (ctx: any) => {
        const { editorViewCtx } = await import("@milkdown/core");
        const view = ctx.get(editorViewCtx);
        view.focus();
        const { state, dispatch } = view;
        const { from, to } = state.selection;
        const linkMarkType = state.schema.marks.link;
        if (linkMarkType) {
          dispatch(state.tr.removeMark(from, to, linkMarkType));
        }
      });

      setShowLinkPopup(false);
    } catch (error) {
      console.error("Failed to remove link:", error);
    }
  };

  const handleCommand = async (command: string, payload?: any) => {
    if (!editorInstance) return;

    // Link button opens popup (for both add and edit)
    if (command === "toggleLink") {
      setShowLinkPopup(true);
      return;
    }

    // Attachment panel toggle
    if (command === "toggleAttachments") {
      setShowAttachments((v) => !v);
      return;
    }

    // Insert attachment (image or file link) at cursor
    if (command === "insertAttachment") {
      const {
        url,
        filename,
        isImage: isImg,
      } = payload as {
        url: string;
        filename: string;
        isImage: boolean;
      };
      try {
        const { editorViewCtx } = await import("@milkdown/core");
        await editorInstance.action((ctx: any) => {
          const view = ctx.get(editorViewCtx);
          view.focus();
          const { state, dispatch } = view;

          if (isImg) {
            // Insert as a proper image node — the pdfImagePlugin NodeView
            // will render PDFs as <embed> and regular images as <img>.
            const imageNode = state.schema.nodes.image?.create({
              src: url,
              alt: filename,
              title: null,
            });
            if (imageNode) {
              dispatch(state.tr.replaceSelectionWith(imageNode));
            }
          } else {
            // Insert as linked text — use replaceWith(from, to) so the
            // link mark is preserved on the inline text node.
            const linkMark = state.schema.marks.link?.create({
              href: url,
              title: null,
            });
            if (linkMark) {
              const textNode = state.schema.text(filename, [linkMark]);
              const { from, to } = state.selection;
              dispatch(state.tr.replaceWith(from, to, textNode));
            }
          }
        });
      } catch (err) {
        console.error("Failed to insert attachment:", err);
      }
      return;
    }

    try {
      const { callCommand } = await import("@milkdown/utils");
      const { editorViewCtx } = await import("@milkdown/core");

      await editorInstance.action(async (ctx: any) => {
        const view = ctx.get(editorViewCtx);
        view.focus();

        switch (command) {
          case "undo": {
            const { undo } = await import("@milkdown/prose/history");
            undo(view.state, view.dispatch);
            break;
          }
          case "redo": {
            const { redo } = await import("@milkdown/prose/history");
            redo(view.state, view.dispatch);
            break;
          }
          case "toggleBold": {
            const { toggleStrongCommand } =
              await import("@milkdown/preset-commonmark");
            callCommand(toggleStrongCommand.key)(ctx);
            break;
          }
          case "toggleItalic": {
            const { toggleEmphasisCommand } =
              await import("@milkdown/preset-commonmark");
            callCommand(toggleEmphasisCommand.key)(ctx);
            break;
          }
          case "toggleStrikethrough": {
            const { toggleStrikethroughCommand } =
              await import("@milkdown/preset-gfm");
            callCommand(toggleStrikethroughCommand.key)(ctx);
            break;
          }
          case "toggleInlineCode": {
            const { toggleInlineCodeCommand } =
              await import("@milkdown/preset-commonmark");
            callCommand(toggleInlineCodeCommand.key)(ctx);
            break;
          }
          case "toggleHighlight": {
            const highlightMarkType = markSchema.type(ctx);
            const { state: s, dispatch: d } = view;
            const { from, to } = s.selection;
            if (from === to) {
              // Cursor — toggle via storedMarks
              const hasStored = (
                s.storedMarks ?? s.selection.$from.marks()
              ).some((m: any) => m.type === highlightMarkType);
              if (hasStored) {
                d(s.tr.removeStoredMark(highlightMarkType));
              } else {
                d(s.tr.addStoredMark(highlightMarkType.create()));
              }
            } else {
              if (s.doc.rangeHasMark(from, to, highlightMarkType)) {
                d(s.tr.removeMark(from, to, highlightMarkType));
              } else {
                d(s.tr.addMark(from, to, highlightMarkType.create()));
              }
            }
            break;
          }
          case "setTextColor": {
            const tcMarkType = textColorSchema.type(ctx);
            const { state: s, dispatch: d } = view;
            const { from, to } = s.selection;
            if (from === to) {
              // Cursor (no selection) — manipulate storedMarks so the
              // next typed character picks up the change immediately.
              if (!payload) {
                d(s.tr.removeStoredMark(tcMarkType));
              } else {
                d(
                  s.tr
                    .removeStoredMark(tcMarkType)
                    .addStoredMark(tcMarkType.create({ color: payload })),
                );
              }
            } else {
              // Range selection — patch the mark on existing text.
              if (!payload) {
                d(s.tr.removeMark(from, to, tcMarkType));
              } else {
                d(
                  s.tr
                    .removeMark(from, to, tcMarkType)
                    .addMark(from, to, tcMarkType.create({ color: payload })),
                );
              }
            }
            break;
          }
          case "setFontFamily": {
            const ffMarkType = fontFamilySchema.type(ctx);
            const { state: s, dispatch: d } = view;
            const { from, to } = s.selection;
            if (from === to) {
              if (!payload) {
                d(s.tr.removeStoredMark(ffMarkType));
              } else {
                d(
                  s.tr
                    .removeStoredMark(ffMarkType)
                    .addStoredMark(ffMarkType.create({ family: payload })),
                );
              }
            } else {
              if (!payload) {
                d(s.tr.removeMark(from, to, ffMarkType));
              } else {
                d(
                  s.tr
                    .removeMark(from, to, ffMarkType)
                    .addMark(from, to, ffMarkType.create({ family: payload })),
                );
              }
            }
            break;
          }
          case "setHeading": {
            const level = payload as number;
            if (level >= 1 && level <= 6) {
              const { wrapInHeadingCommand } =
                await import("@milkdown/preset-commonmark");
              callCommand(wrapInHeadingCommand.key, level)(ctx);
            }
            break;
          }
          case "toggleBulletList": {
            const { state } = view;
            const { $from } = state.selection;
            let inBulletList = false;

            // Check if we're in a bullet list
            for (let d = $from.depth; d > 0; d--) {
              const node = $from.node(d);
              if (node.type.name === "bullet_list") {
                inBulletList = true;
                break;
              }
            }

            if (inBulletList) {
              // Already in bullet list, lift out
              const { liftListItemCommand } =
                await import("@milkdown/preset-commonmark");
              callCommand(liftListItemCommand.key)(ctx);
            } else {
              // Not in bullet list, wrap
              const { wrapInBulletListCommand } =
                await import("@milkdown/preset-commonmark");
              callCommand(wrapInBulletListCommand.key)(ctx);
            }
            break;
          }
          case "toggleOrderedList": {
            const { state } = view;
            const { $from } = state.selection;
            let inOrderedList = false;

            // Check if we're in an ordered list
            for (let d = $from.depth; d > 0; d--) {
              const node = $from.node(d);
              if (node.type.name === "ordered_list") {
                inOrderedList = true;
                break;
              }
            }

            if (inOrderedList) {
              // Already in ordered list, lift out
              const { liftListItemCommand } =
                await import("@milkdown/preset-commonmark");
              callCommand(liftListItemCommand.key)(ctx);
            } else {
              // Not in ordered list, wrap
              const { wrapInOrderedListCommand } =
                await import("@milkdown/preset-commonmark");
              callCommand(wrapInOrderedListCommand.key)(ctx);
            }
            break;
          }
          case "toggleTaskList": {
            const { state } = view;
            const { $from } = state.selection;
            let handled = false;
            for (let d = $from.depth; d > 0; d--) {
              const node = $from.node(d);
              if (node.type.name === "list_item") {
                const pos = $from.before(d);
                if (node.attrs.checked != null) {
                  // Already a task list item, lift out entirely
                  const { liftListItemCommand } =
                    await import("@milkdown/preset-commonmark");
                  callCommand(liftListItemCommand.key)(ctx);
                } else {
                  // Regular list item, convert to task list item
                  view.dispatch(
                    state.tr.setNodeMarkup(pos, undefined, {
                      ...node.attrs,
                      checked: false,
                    }),
                  );
                }
                handled = true;
                break;
              }
            }
            if (!handled) {
              // Not in a list: wrap in bullet list first, then convert
              const { wrapInBulletListCommand } =
                await import("@milkdown/preset-commonmark");
              callCommand(wrapInBulletListCommand.key)(ctx);
              const newState = view.state;
              const { $from: $f } = newState.selection;
              for (let d = $f.depth; d > 0; d--) {
                const node = $f.node(d);
                if (node.type.name === "list_item") {
                  view.dispatch(
                    newState.tr.setNodeMarkup($f.before(d), undefined, {
                      ...node.attrs,
                      checked: false,
                    }),
                  );
                  break;
                }
              }
            }
            break;
          }
          case "toggleBlockquote": {
            const { wrapInBlockquoteCommand } =
              await import("@milkdown/preset-commonmark");
            callCommand(wrapInBlockquoteCommand.key)(ctx);
            break;
          }
          case "toggleCodeBlock": {
            const { createCodeBlockCommand } =
              await import("@milkdown/preset-commonmark");
            callCommand(createCodeBlockCommand.key)(ctx);
            break;
          }
          case "insertHorizontalRule": {
            const hrType = view.state.schema.nodes.hr;
            if (hrType) {
              const tr = view.state.tr.replaceSelectionWith(hrType.create());
              view.dispatch(tr);
            }
            break;
          }
        }
      });

      // Update selection state after command
      await updateSelectionState();
    } catch (error) {
      console.error("Failed to execute command:", error);
    }
  };

  onMount(async () => {
    if (!editorRef || typeof window === "undefined") return;

    const handleMermaidPreviewOpen = (event: Event) => {
      const detail = (event as CustomEvent<MermaidPreviewOpenDetail>).detail;
      if (!detail?.source?.trim()) return;
      setMermaidViewer({ isOpen: true, source: detail.source });
    };

    window.addEventListener(
      MERMAID_PREVIEW_OPEN_EVENT,
      handleMermaidPreviewOpen as EventListener,
    );

    onCleanup(() => {
      window.removeEventListener(
        MERMAID_PREVIEW_OPEN_EVENT,
        handleMermaidPreviewOpen as EventListener,
      );
    });

    try {
      // Dynamic import to avoid SSR issues
      const { Editor, rootCtx, defaultValueCtx } =
        await import("@milkdown/core");
      const { commonmark } = await import("@milkdown/preset-commonmark");
      const { gfm } = await import("@milkdown/preset-gfm");
      const { listener, listenerCtx } =
        await import("@milkdown/plugin-listener");
      const { history } = await import("@milkdown/plugin-history");
      const { prism } = await import("@milkdown/plugin-prism");
      const { indent } = await import("@milkdown/plugin-indent");
      const { upload } = await import("@milkdown/plugin-upload");
      const { math } = await import("@milkdown/plugin-math");

      await import("katex/dist/katex.min.css");
      await import("../styles/milkdown-theme.css");

      editorInstance = await Editor.make()
        .config((ctx) => {
          ctx.set(rootCtx, editorRef);
          ctx.set(defaultValueCtx, props.content || "");

          ctx.get(listenerCtx).markdownUpdated((ctx, markdown) => {
            if (!isUpdatingFromProps) {
              props.onChange(markdown);
            }
            updateSelectionState();
          });
        })
        .use(commonmark)
        .use(gfm)
        .use(listener)
        .use(history)
        .use(prism)
        .use(indent)
        .use(upload)
        .use(math)
        .use(milkdownMarkColorPlugin)
        .use(milkdownTextColorPlugin)
        .use(milkdownFontFamilyPlugin)
        .use(markSchema)
        .use(textColorSchema)
        .use(fontFamilySchema)
        .use(markInputRule)
        .use(exitMarkKeymap)
        .use(taskListInputPlugin)
        .use(codeBlockViewPlugin)
        .use(pdfImagePlugin)
        .create();

      if (editorRef) {
        editorRef.classList.add("milkdown-theme-dark");

        // Prevent links from being opened
        editorRef.addEventListener("mousedown", (e) => {
          const target = e.target as HTMLElement;
          if (target.tagName === "A") {
            e.preventDefault();
          }
        });

        editorRef.addEventListener("mouseup", (e) => {
          const target = e.target as HTMLElement;
          if (target.tagName === "A") {
            e.preventDefault();
          }
        });

        editorRef.addEventListener("click", (e) => {
          const target = e.target as HTMLElement;
          if (target.tagName === "A") {
            e.preventDefault();
            e.stopPropagation();
          }
          updateSelectionState();
        });

        // Add hover tooltip for links
        const activeTooltips = new Map<HTMLElement, HTMLElement>();
        let tooltipTimeout: any = null;

        const removeTooltip = (link: HTMLElement) => {
          const tooltip = activeTooltips.get(link);
          if (tooltip && tooltip.parentElement) {
            tooltip.remove();
            activeTooltips.delete(link);
          }
        };

        // Create tooltip handler generator
        const attachTooltipHandler = (link: any) => {
          if (link._tooltipSetup) return;
          link._tooltipSetup = true;

          const href = link.getAttribute("href");
          if (!href) return;

          link.addEventListener("mouseenter", () => {
            const normalizedHref = normalizeUrl(href);

            if (tooltipTimeout) {
              clearTimeout(tooltipTimeout);
              tooltipTimeout = null;
            }

            if (activeTooltips.has(link)) {
              return;
            }

            for (const [otherLink, t] of activeTooltips.entries()) {
              if (otherLink !== link) removeTooltip(otherLink);
            }

            const rect = link.getBoundingClientRect();
            const tooltip = document.createElement("div");
            tooltip.className =
              "fixed bg-[var(--color-bg-surface)] text-[var(--color-text-primary)] px-3 py-2 rounded shadow-lg text-sm z-50 border border-[var(--color-border)]";
            tooltip.style.left = rect.left + "px";
            tooltip.style.top = rect.bottom + 8 + "px";

            const linkText = document.createElement("div");
            linkText.className =
              "truncate max-w-xs mb-2 text-[var(--color-text-secondary)]";
            linkText.textContent = normalizedHref;

            const buttonContainer = document.createElement("div");
            buttonContainer.className = "flex gap-2";
            const openBtn = document.createElement("button");
            openBtn.className =
              "px-3 py-1.5 bg-elevated border border-[var(--color-border)] hover:bg-surface rounded text-xs cursor-pointer transition-colors font-medium flex items-center gap-1.5";
            openBtn.innerHTML = `
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 32 32"><path fill="currentColor" d="M26 28H6a2.003 2.003 0 0 1-2-2V6a2.003 2.003 0 0 1 2-2h10v2H6v20h20V16h2v10a2.003 2.003 0 0 1-2 2"/><path fill="currentColor" d="M20 2v2h6.586L18 12.586L19.414 14L28 5.414V12h2V2z"/></svg>
            `;
            openBtn.onmousedown = (e: any) => {
              e.preventDefault();
              e.stopPropagation();
            };
            openBtn.onclick = (e: any) => {
              e.preventDefault();
              e.stopPropagation();
              window.open(normalizedHref, "_blank", "noopener,noreferrer");
              removeTooltip(link);
            };

            const editBtn = document.createElement("button");
            editBtn.className =
              "px-3 py-1.5 bg-elevated border border-[var(--color-border)] hover:bg-surface rounded text-xs cursor-pointer transition-colors font-medium flex items-center gap-1.5";
            editBtn.innerHTML = `
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 32 32"><path fill="currentColor" d="M2 26h28v2H2zM25.4 9c.8-.8.8-2 0-2.8l-3.6-3.6c-.8-.8-2-.8-2.8 0l-15 15V24h6.4zm-5-5L24 7.6l-3 3L17.4 7zM6 22v-3.6l10-10l3.6 3.6l-10 10z"/></svg>
            `;
            editBtn.onmousedown = (e: any) => {
              e.preventDefault();
              e.stopPropagation();
            };
            editBtn.onclick = async (e: any) => {
              e.preventDefault();
              e.stopPropagation();
              if (editorInstance) {
                await editorInstance.action(async (ctx: any) => {
                  const { editorViewCtx } = await import("@milkdown/core");
                  const { TextSelection } =
                    await import("@milkdown/prose/state");
                  const view = ctx.get(editorViewCtx);
                  const start = view.posAtDOM(link, 0);
                  const end = view.posAtDOM(link, link.childNodes.length);
                  const tr = view.state.tr.setSelection(
                    TextSelection.create(view.state.doc, start, end),
                  );
                  view.dispatch(tr);
                  setCurrentLinkData({
                    href: normalizedHref,
                    title: link.getAttribute("title") || undefined,
                  });
                  setShowLinkPopup(true);
                });
              }
              removeTooltip(link);
            };

            const removeBtn = document.createElement("button");
            removeBtn.className =
              "px-3 py-1.5 bg-elevated border border-[var(--color-border)] hover:bg-surface rounded text-xs cursor-pointer transition-colors font-medium flex items-center gap-1.5";
            removeBtn.innerHTML = `
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 32 32"><path fill="currentColor" d="M12 12h2v12h-2zm6 0h2v12h-2z"/><path fill="currentColor" d="M4 6v2h2v20a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V8h2V6Zm4 22V8h16v20Zm4-26h8v2h-8z"/></svg>
            `;
            removeBtn.onmousedown = (e: any) => {
              e.preventDefault();
              e.stopPropagation();
            };
            removeBtn.onclick = async (e: any) => {
              e.preventDefault();
              e.stopPropagation();
              if (editorInstance) {
                await editorInstance.action(async (ctx: any) => {
                  const view = ctx.get(
                    (await import("@milkdown/core")).editorViewCtx,
                  );
                  let found = false;
                  view.state.doc.nodesBetween(
                    0,
                    view.state.doc.content.size,
                    (node: any, pos: number) => {
                      if (!found && node.isText && node.marks) {
                        const linkMark = node.marks.find(
                          (m: any) => m.type.name === "link",
                        );
                        if (
                          linkMark &&
                          (linkMark.attrs.href === href ||
                            linkMark.attrs.href === normalizedHref)
                        ) {
                          view.dispatch(
                            view.state.tr.removeMark(
                              pos,
                              pos + node.nodeSize,
                              view.state.schema.marks.link,
                            ),
                          );
                          found = true;
                        }
                      }
                    },
                  );
                  view.focus();
                });
              }
              removeTooltip(link);
            };

            buttonContainer.appendChild(openBtn);
            buttonContainer.appendChild(editBtn);
            buttonContainer.appendChild(removeBtn);
            tooltip.appendChild(linkText);
            tooltip.appendChild(buttonContainer);
            document.body.appendChild(tooltip);
            activeTooltips.set(link, tooltip);

            const handleMouseLeave = () => {
              tooltipTimeout = setTimeout(() => {
                removeTooltip(link);
              }, 150);
            };

            link.addEventListener("mouseleave", handleMouseLeave, {
              once: true,
            });
            tooltip.addEventListener("mouseenter", () => {
              if (tooltipTimeout) {
                clearTimeout(tooltipTimeout);
                tooltipTimeout = null;
              }
            });
            tooltip.addEventListener("mouseleave", handleMouseLeave);
          });
        };

        // Initial setup for existing links
        const links = editorRef?.querySelectorAll("a");
        links?.forEach(attachTooltipHandler);

        // Task list checkbox click handler
        const setupTaskListItem = (li: HTMLElement) => {
          if ((li as any)._taskSetup) return;
          (li as any)._taskSetup = true;

          li.addEventListener("click", async (e) => {
            const rect = li.getBoundingClientRect();
            const clickX = e.clientX - rect.left;
            if (clickX > 30) return; // Only toggle when clicking the checkbox area

            e.preventDefault();
            e.stopPropagation();
            if (!editorInstance) return;

            await editorInstance.action(async (ctx: any) => {
              const { editorViewCtx } = await import("@milkdown/core");
              const view = ctx.get(editorViewCtx);
              const pos = view.posAtDOM(li, 0);
              const $pos = view.state.doc.resolve(pos);
              for (let d = $pos.depth; d >= 0; d--) {
                const node = $pos.node(d);
                if (
                  node.type.name === "list_item" &&
                  node.attrs.checked != null
                ) {
                  const nodePos = $pos.before(d);
                  view.dispatch(
                    view.state.tr.setNodeMarkup(nodePos, undefined, {
                      ...node.attrs,
                      checked: !node.attrs.checked,
                    }),
                  );
                  break;
                }
              }
            });
          });
        };

        // Initial setup for existing task list items
        editorRef
          ?.querySelectorAll('li[data-item-type="task"]')
          .forEach((li) => setupTaskListItem(li as HTMLElement));

        // Watch for newly added links via MutationObserver
        const observer = new MutationObserver((mutations) => {
          mutations.forEach((mutation) => {
            mutation.addedNodes.forEach((node) => {
              if (node.nodeType === Node.ELEMENT_NODE) {
                const element = node as HTMLElement;
                if (element.tagName === "A") {
                  attachTooltipHandler(element);
                } else if (
                  element.tagName === "LI" &&
                  element.dataset.itemType === "task"
                ) {
                  setupTaskListItem(element);
                } else {
                  element.querySelectorAll("a").forEach(attachTooltipHandler);
                  element
                    .querySelectorAll('li[data-item-type="task"]')
                    .forEach((li) => setupTaskListItem(li as HTMLElement));
                }
              }
            });
          });
        });

        // Start observing for node additions only (more efficient)
        observer.observe(editorRef, {
          childList: true,
          subtree: true,
        });

        // Cleanup observer on unmount
        onCleanup(() => {
          observer.disconnect();
        });
      }
    } catch (error) {
      console.error("Failed to initialize Milkdown editor:", error);
    }
  });

  // Update editor content when props change
  createEffect(() => {
    if (!editorInstance || !props.content) return;

    const updateContent = async () => {
      try {
        const { defaultValueCtx } = await import("@milkdown/core");
        isUpdatingFromProps = true;
        await editorInstance.action((ctx: any) => {
          const view = ctx.get(defaultValueCtx);
          if (view !== props.content) {
            ctx.set(defaultValueCtx, props.content);
          }
        });
        isUpdatingFromProps = false;
      } catch (error) {
        console.error("Error updating content:", error);
        isUpdatingFromProps = false;
      }
    };

    updateContent();
  });

  // Auto-open the attachment panel when the document has attachments,
  // and close it when navigating to a document that has none.
  createEffect(() => {
    const docPath = props.documentPath;
    if (!docPath) return;
    setShowAttachments(false);
    api
      .listAttachments(docPath)
      .then((result: any) => {
        if ((result.attachments || []).length > 0) {
          setShowAttachments(true);
        }
      })
      .catch(() => {
        /* ignore */
      });
  });

  onCleanup(() => {
    if (editorInstance) {
      editorInstance.destroy();
      editorInstance = null;
    }
  });

  return (
    <div class="flex-1 min-h-0 flex flex-col not-prose">
      <EditorToolbar
        onCommand={handleCommand}
        hasSelection={hasSelection()}
        activeState={activeState()}
        showAttachments={showAttachments()}
      />
      <LinkPopup
        show={showLinkPopup()}
        isEdit={activeState().link}
        initialData={currentLinkData()}
        onSubmit={handleLinkSubmit}
        onRemove={handleRemoveLink}
        onClose={() => setShowLinkPopup(false)}
      />
      <AttachmentPanel
        show={showAttachments()}
        documentPath={props.documentPath || ""}
        onInsert={(url, filename, isImage) =>
          handleCommand("insertAttachment", { url, filename, isImage })
        }
        onClose={() => setShowAttachments(false)}
      />
      <MermaidViewer
        isOpen={mermaidViewer().isOpen}
        source={mermaidViewer().source}
        onClose={() => setMermaidViewer({ isOpen: false, source: "" })}
      />
      <div class="flex-1 min-h-0 overflow-auto">
        <div
          ref={editorRef}
          class="milkdown-editor-wrapper max-w-5xl mx-auto p-4 sm:pt-8 sm:pb-32 scrollbar-hidden"
        />
      </div>
    </div>
  );
}
