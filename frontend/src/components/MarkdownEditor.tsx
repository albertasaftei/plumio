import { $remark } from "@milkdown/utils";
import { onMount, onCleanup, createEffect, createSignal } from "solid-js";
import type { EditorProps } from "~/types/Editor.types";
import EditorToolbar from "~/components/EditorToolbar";
import { exitMarkKeymap } from "~/utils/milkdown/highlight/exitMarkKeymap";
import { markInputRule } from "~/utils/milkdown/highlight/inputRule";
import { markSchema } from "~/utils/milkdown/highlight/markSchema";
import { remarkMarkColor } from "~/utils/milkdown/highlight/remarkMarkColor";
import { taskListInputPlugin } from "~/utils/milkdown/taskListInputPlugin";
import { codeBlockViewPlugin } from "~/utils/milkdown/codeBlockView";
import LinkPopup from "./LinkPopup";
// import {
//   colorPickerTooltip,
//   colorPickerTooltipConfig,
// } from "~/utils/milkdown/highlight/colorPicker";

const milkdownMarkColorPlugin = $remark("markColor", () => remarkMarkColor);

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
  const [currentLinkData, setCurrentLinkData] = createSignal<{
    href: string;
    title?: string;
  }>({ href: "" });
  const [activeState, setActiveState] = createSignal({
    bold: false,
    italic: false,
    strikethrough: false,
    inlineCode: false,
    highlight: false,
    link: false,
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

      const linkActive = hasMark("link");
      setActiveState({
        bold: hasMark("strong"),
        italic: hasMark("emphasis"),
        strikethrough: hasMark("strike_through"),
        inlineCode: hasMark("inlineCode") || hasMark("code_inline"),
        highlight: hasMark("mark"),
        link: linkActive,
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
            if (s.doc.rangeHasMark(from, to, highlightMarkType)) {
              d(s.tr.removeMark(from, to, highlightMarkType));
            } else {
              d(s.tr.addMark(from, to, highlightMarkType.create()));
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
      const { block } = await import("@milkdown/plugin-block");
      const { indent } = await import("@milkdown/plugin-indent");
      const { upload } = await import("@milkdown/plugin-upload");
      const { math } = await import("@milkdown/plugin-math");

      await import("@milkdown/theme-nord/style.css");
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
        // .config(colorPickerTooltipConfig)
        // .use(colorPickerTooltip)
        .use(commonmark)
        .use(gfm)
        .use(listener)
        .use(history)
        .use(prism)
        .use(block)
        .use(indent)
        .use(upload)
        .use(math)
        .use(milkdownMarkColorPlugin)
        .use(markSchema)
        .use(markInputRule)
        .use(exitMarkKeymap)
        .use(taskListInputPlugin)
        .use(codeBlockViewPlugin)
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
              "fixed bg-neutral-800 text-white px-3 py-2 rounded shadow-lg text-sm z-50 border border-neutral-600";
            tooltip.style.left = rect.left + "px";
            tooltip.style.top = rect.bottom + 8 + "px";

            const linkText = document.createElement("div");
            linkText.className = "truncate max-w-xs mb-2 text-neutral-300";
            linkText.textContent = normalizedHref;

            const buttonContainer = document.createElement("div");
            buttonContainer.className = "flex gap-2";

            const openBtn = document.createElement("button");
            openBtn.className =
              "px-2 py-1 bg-blue-600 hover:bg-blue-700 rounded text-xs cursor-pointer transition-colors";
            openBtn.textContent = "Open";
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
              "px-2 py-1 bg-green-600 hover:bg-green-700 rounded text-xs cursor-pointer transition-colors";
            editBtn.textContent = "Edit";
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
              "px-2 py-1 bg-red-600 hover:bg-red-700 rounded text-xs cursor-pointer transition-colors";
            removeBtn.textContent = "Remove";
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

  onCleanup(() => {
    if (editorInstance) {
      editorInstance.destroy();
      editorInstance = null;
    }
  });

  return (
    <div class="w-full h-full flex flex-col not-prose">
      <EditorToolbar
        onCommand={handleCommand}
        hasSelection={hasSelection()}
        activeState={activeState()}
      />
      <LinkPopup
        show={showLinkPopup()}
        isEdit={activeState().link}
        initialData={currentLinkData()}
        onSubmit={handleLinkSubmit}
        onRemove={handleRemoveLink}
        onClose={() => setShowLinkPopup(false)}
      />
      <div class="overflow-auto">
        <div
          ref={editorRef}
          class="milkdown-editor-wrapper max-w-5xl mx-auto p-4 sm:pt-8 sm:pb-32 scrollbar-hidden"
        />
      </div>
    </div>
  );
}
