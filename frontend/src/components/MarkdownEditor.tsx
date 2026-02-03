import { onMount, onCleanup, createEffect } from "solid-js";
import type { EditorProps } from "~/types/Editor.types";

export default function MarkdownEditor(props: EditorProps) {
  let editorRef: HTMLDivElement | undefined;
  let editorInstance: any = null;
  let isUpdatingFromProps = false;

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
          });
        })
        .use(commonmark)
        .use(gfm)
        .use(listener)
        .use(history)
        .use(prism)
        .use(block)
        .use(indent)
        .use(upload)
        .use(math)
        .create();

      // Apply dark theme class after creation
      if (editorRef) {
        editorRef.classList.add("milkdown-theme-dark");

        editorRef.addEventListener("click", (e) => {
          const target = e.target as HTMLElement;
          if (target.tagName === "A" && target.getAttribute("href")) {
            e.preventDefault();
            const href = target.getAttribute("href");
            if (href) {
              window.open(href, "_blank", "noopener,noreferrer");
            }
          }
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
    <div class="w-full h-full overflow-auto not-prose">
      <div
        ref={editorRef}
        class="milkdown-editor-wrapper h-full max-w-5xl mx-auto p-4 sm:p-8"
      />
    </div>
  );
}
