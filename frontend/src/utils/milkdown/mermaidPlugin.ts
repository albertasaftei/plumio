import { $prose } from "@milkdown/utils";
import { Plugin, PluginKey, Selection } from "@milkdown/prose/state";
import { Decoration, DecorationSet } from "@milkdown/prose/view";

// ── Mermaid lazy-loading & rendering helpers ──
let mermaidModule: any = null;
let mermaidIdCounter = 0;

const getMermaid = async () => {
  if (!mermaidModule) {
    const m = await import("mermaid");
    mermaidModule = m.default;
    // Re-initialize every time the module is first loaded in this session
    // so that our config is guaranteed to be applied.
    mermaidModule.initialize({
      startOnLoad: false,
      theme: document.documentElement.classList.contains("light")
        ? "default"
        : "dark",
      suppressErrorRendering: true,
      flowchart: { htmlLabels: false, useMaxWidth: false },
      er: { htmlLabels: false, useMaxWidth: false },
      sequence: { useMaxWidth: false },
    });
  }
  return mermaidModule;
};

/**
 * Tracks active mermaid preview widgets so we can update them
 * without recreating DOM on every keystroke.
 */
const previewCache = new Map<
  number,
  {
    dom: HTMLElement;
    text: string;
    timer: ReturnType<typeof setTimeout> | null;
    end: number;
  }
>();

const renderMermaidPreview = async (
  dom: HTMLElement,
  text: string,
  pos: number,
) => {
  if (!text.trim()) {
    dom.innerHTML =
      '<div class="mermaid-placeholder">Enter mermaid diagram code from the Plain view</div>';
    dom.classList.remove("mermaid-error");
    return;
  }
  try {
    const mermaid = await getMermaid();
    const id = `mermaid-${pos}-${mermaidIdCounter++}`;
    const { svg } = await mermaid.render(id, text.trim());
    dom.innerHTML = svg;

    // Post-process: make all labels fully visible regardless of node box size.
    const svgEl = dom.querySelector("svg");
    if (svgEl) {
      // Remove all clip-path constraints
      svgEl
        .querySelectorAll("[clip-path]")
        .forEach((el) => el.removeAttribute("clip-path"));
      svgEl.querySelectorAll("clipPath").forEach((el) => el.remove());

      // For htmlLabels mode: foreignObject elements have fixed width/height
      // that clips the inner <p> text. Remove the size limits.
      svgEl.querySelectorAll("foreignObject").forEach((fo) => {
        fo.removeAttribute("width");
        fo.removeAttribute("height");
        fo.setAttribute("style", "overflow: visible;");
      });

      // Also let the inner label divs/paragraphs overflow naturally
      svgEl
        .querySelectorAll("foreignObject div, foreignObject p")
        .forEach((el) => {
          (el as HTMLElement).style.setProperty("overflow", "visible");
          (el as HTMLElement).style.setProperty("white-space", "nowrap");
          (el as HTMLElement).style.setProperty("margin", "0", "important");
          (el as HTMLElement).style.setProperty("padding", "0", "important");
        });
    }

    dom.classList.remove("mermaid-error");
  } catch {
    dom.innerHTML =
      '<div class="mermaid-error-message">Invalid mermaid syntax</div>';
    dom.classList.add("mermaid-error");
  }
};

/**
 * Schedule a debounced re-render for a given position's preview widget.
 */
const scheduleRender = (pos: number, text: string) => {
  const entry = previewCache.get(pos);
  if (!entry) return;
  if (entry.text === text) return; // no change
  entry.text = text;
  if (entry.timer) clearTimeout(entry.timer);
  entry.timer = setTimeout(() => {
    entry.timer = null;
    renderMermaidPreview(entry.dom, text, pos);
  }, 300);
};

/**
 * Build a widget decoration for a mermaid code_block at `pos` that ends
 * at `end`. The widget is inserted right after the code block node.
 */
const createMermaidWidget = (pos: number, end: number, text: string) => {
  return Decoration.widget(
    end,
    () => {
      // Reuse existing DOM if possible (same position)
      let entry = previewCache.get(pos);
      if (entry) {
        // Position still exists — just trigger re-render if text changed
        scheduleRender(pos, text);
        return entry.dom;
      }

      const dom = document.createElement("div");
      dom.className = "mermaid-preview";
      dom.contentEditable = "false";
      // Store end position so the click handler can find it
      (dom as any).__mermaidEnd = end;

      previewCache.set(pos, { dom, text: "", timer: null, end });
      // Render immediately for the first time
      renderMermaidPreview(dom, text, pos);
      previewCache.get(pos)!.text = text;

      return dom;
    },
    {
      // Key by position so ProseMirror can match old ↔ new decorations
      key: `mermaid-preview-${pos}`,
      side: 1, // render after the node
      ignoreSelection: true,
    },
  );
};

/**
 * Scan the document for mermaid code blocks and build a DecorationSet.
 */
const buildDecorations = (doc: any): DecorationSet => {
  const decorations: Decoration[] = [];
  const seenPositions = new Set<number>();

  doc.descendants((node: any, pos: number) => {
    if (node.type.name === "code_block" && node.attrs.language === "mermaid") {
      const end = pos + node.nodeSize;
      decorations.push(createMermaidWidget(pos, end, node.textContent));
      seenPositions.add(pos);
    }
  });

  // Clean up cached previews for positions that no longer hold mermaid blocks
  for (const cachedPos of previewCache.keys()) {
    if (!seenPositions.has(cachedPos)) {
      const entry = previewCache.get(cachedPos)!;
      if (entry.timer) clearTimeout(entry.timer);
      previewCache.delete(cachedPos);
    }
  }

  return DecorationSet.create(doc, decorations);
};

/**
 * Mermaid preview plugin.
 *
 * Uses ProseMirror Decorations (widget) to render a mermaid diagram
 * preview directly below any code_block with language "mermaid".
 *
 * The code block itself stays fully editable via the normal
 * codeBlockViewPlugin — this plugin only adds the visual preview
 * as a separate, non-editable widget decoration after it.
 */
export const mermaidPreviewPlugin = $prose(() => {
  const pluginKey = new PluginKey("mermaidPreview");

  return new Plugin({
    key: pluginKey,

    state: {
      init(_, { doc }) {
        return buildDecorations(doc);
      },
      apply(tr, decorationSet) {
        if (tr.docChanged) {
          return buildDecorations(tr.doc);
        }
        return decorationSet;
      },
    },

    props: {
      decorations(state) {
        return pluginKey.getState(state);
      },

      handleDOMEvents: {
        click(view, event) {
          const target = event.target as HTMLElement;
          const preview = target.closest(
            ".mermaid-preview",
          ) as HTMLElement | null;
          if (!preview) return false;

          const insertPos: number | undefined = (preview as any).__mermaidEnd;
          if (insertPos == null) return false;

          event.preventDefault();

          const { state } = view;
          const { tr, schema } = state;

          if (insertPos >= state.doc.content.size) {
            // Block is at the end — insert a new paragraph
            const paragraph = schema.nodes.paragraph.create();
            tr.insert(insertPos, paragraph);
            tr.setSelection(Selection.near(tr.doc.resolve(insertPos + 1)));
          } else {
            // Block is not last — just move the cursor after it
            tr.setSelection(Selection.near(state.doc.resolve(insertPos)));
          }

          view.dispatch(tr);
          view.focus();
          return true;
        },
      },
    },
  });
});
