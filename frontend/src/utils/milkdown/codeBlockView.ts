import { $prose } from "@milkdown/utils";
import { Plugin, PluginKey } from "@milkdown/prose/state";
import {
  getPanzoomFactory,
  getMermaidTheme,
  type PanzoomInstance,
  postProcessMermaidSvg,
  refreshMermaidTheme,
  renderMermaidSvg,
} from "./mermaidRenderer";
import { dispatchMermaidPreviewOpen } from "./mermaidPlugin";
import { getStroke } from "perfect-freehand";

// ── Sketch helpers ──────────────────────────────────────────────────────────

interface SketchStroke {
  color: string;
  size: number;
  opacity: number;
  points: [number, number, number][];
}

interface SketchData {
  strokes: SketchStroke[];
}

const SVG_NS = "http://www.w3.org/2000/svg";
const SKETCH_WIDTH = 1600;
const SKETCH_HEIGHT = 600;

function getSvgPathFromStroke(stroke: number[][]): string {
  if (!stroke.length) return "";
  const [first] = stroke;
  let d = `M ${first[0].toFixed(2)} ${first[1].toFixed(2)} `;
  for (let i = 1; i < stroke.length - 1; i++) {
    const [x0, y0] = stroke[i];
    const [x1, y1] = stroke[i + 1];
    d += `Q ${x0.toFixed(2)} ${y0.toFixed(2)} ${((x0 + x1) / 2).toFixed(2)} ${((y0 + y1) / 2).toFixed(2)} `;
  }
  d += "Z";
  return d;
}

function strokeToPath(stroke: SketchStroke): SVGPathElement {
  const outline = getStroke(stroke.points, {
    size: stroke.size,
    thinning: 0.5,
    smoothing: 0.5,
    streamline: 0.5,
  });
  const path = document.createElementNS(SVG_NS, "path");
  path.setAttribute("d", getSvgPathFromStroke(outline));
  path.setAttribute("fill", stroke.color);
  path.setAttribute("opacity", String(stroke.opacity ?? 1));
  return path;
}

function parseSketchData(text: string): SketchData {
  try {
    const parsed = JSON.parse(text);
    if (parsed && Array.isArray(parsed.strokes)) return parsed as SketchData;
  } catch {
    // ignore
  }
  return { strokes: [] };
}

const MERMAID_ZOOM_MIN = 0.5;
const MERMAID_ZOOM_MAX = 4;

const LANGUAGES = [
  { value: "", label: "Plain Text" },
  { value: "javascript", label: "JavaScript" },
  { value: "typescript", label: "TypeScript" },
  { value: "html", label: "HTML" },
  { value: "css", label: "CSS" },
  { value: "scss", label: "SCSS" },
  { value: "json", label: "JSON" },
  { value: "python", label: "Python" },
  { value: "java", label: "Java" },
  { value: "c", label: "C" },
  { value: "cpp", label: "C++" },
  { value: "csharp", label: "C#" },
  { value: "go", label: "Go" },
  { value: "rust", label: "Rust" },
  { value: "ruby", label: "Ruby" },
  { value: "php", label: "PHP" },
  { value: "swift", label: "Swift" },
  { value: "kotlin", label: "Kotlin" },
  { value: "sql", label: "SQL" },
  { value: "bash", label: "Bash" },
  { value: "shell", label: "Shell" },
  { value: "yaml", label: "YAML" },
  { value: "toml", label: "TOML" },
  { value: "markdown", label: "Markdown" },
  { value: "graphql", label: "GraphQL" },
  { value: "xml", label: "XML" },
  { value: "lua", label: "Lua" },
  { value: "r", label: "R" },
  { value: "dart", label: "Dart" },
  { value: "elixir", label: "Elixir" },
  { value: "scala", label: "Scala" },
  { value: "haskell", label: "Haskell" },
  { value: "mermaid", label: "Mermaid" },
  { value: "sketch", label: "Sketch" },
];

/**
 * ProseMirror NodeView plugin for code blocks.
 *
 * Renders code blocks with a header toolbar containing:
 * - A clickable language label (click to edit, Enter to confirm)
 * - A copy button (appears on hover)
 *
 * Using a NodeView prevents the infinite-loop problem that occurs when
 * injecting DOM into ProseMirror-managed nodes via MutationObserver.
 */
export const codeBlockViewPlugin = $prose(() => {
  return new Plugin({
    key: new PluginKey("codeBlockView"),
    props: {
      handleKeyDown(view, event) {
        if (event.key !== "Backspace" && event.key !== "Delete") return false;
        const { state } = view;
        const { $from, empty } = state.selection;
        if (!empty) return false;

        const depth = $from.depth;
        if (depth < 1) return false;
        const grandparent = $from.node(depth - 1);
        const index = $from.index(depth - 1);

        // Backspace: cursor at the very start of its parent node
        // → delete the preceding sibling if it's a sketch block
        if (
          event.key === "Backspace" &&
          $from.parentOffset === 0 &&
          index > 0
        ) {
          const prevNode = grandparent.child(index - 1);
          if (
            prevNode.type.name === "code_block" &&
            prevNode.attrs.language === "sketch"
          ) {
            const nodeEnd = $from.before(depth);
            view.dispatch(
              state.tr.delete(nodeEnd - prevNode.nodeSize, nodeEnd),
            );
            return true;
          }
        }

        // Delete: cursor at the very end of its parent node
        // → delete the following sibling if it's a sketch block
        if (
          event.key === "Delete" &&
          $from.parentOffset === $from.parent.content.size &&
          index < grandparent.childCount - 1
        ) {
          const nextNode = grandparent.child(index + 1);
          if (
            nextNode.type.name === "code_block" &&
            nextNode.attrs.language === "sketch"
          ) {
            const nodeStart = $from.after(depth);
            view.dispatch(
              state.tr.delete(nodeStart, nodeStart + nextNode.nodeSize),
            );
            return true;
          }
        }

        return false;
      },
      nodeViews: {
        code_block(initialNode, view, getPos) {
          let isDestroyed = false;
          let currentNode = initialNode;
          let panzoom: PanzoomInstance | null = null;
          let panzoomCleanup: (() => void) | null = null;
          let mermaidObserver: MutationObserver | null = null;
          let mermaidRenderTimer: ReturnType<typeof setTimeout> | null = null;
          let lastMermaidTheme = getMermaidTheme();
          let latestMermaidRender = 0;

          const clearPanzoom = () => {
            panzoomCleanup?.();
            panzoomCleanup = null;
            panzoom?.destroy();
            panzoom = null;
            mermaidZoomLabel.textContent = "100%";
          };

          const updateZoomLabel = () => {
            const scale =
              typeof panzoom?.getScale === "function" ? panzoom.getScale() : 1;
            mermaidZoomLabel.textContent = `${Math.round(scale * 100)}%`;
          };

          const setMermaidPreviewVisibility = (isMermaid: boolean) => {
            pre.style.display = isMermaid ? "none" : "";
            mermaidPreview.style.display = isMermaid ? "block" : "none";
            copyBtn.textContent = "Copy";
          };

          const getMermaidSource = () => currentNode.textContent || "";

          const getCurrentPosition = () => {
            try {
              const pos = getPos();
              return typeof pos === "number" ? pos : -1;
            } catch {
              return -1;
            }
          };

          const initializePanzoom = async () => {
            clearPanzoom();

            const svgEl = mermaidCanvas.querySelector("svg");
            if (!svgEl || isDestroyed) return;

            const createPanzoom = await getPanzoomFactory();
            if (isDestroyed || !mermaidViewport.isConnected) return;

            panzoom = createPanzoom(svgEl as unknown as HTMLElement, {
              minScale: MERMAID_ZOOM_MIN,
              maxScale: MERMAID_ZOOM_MAX,
              step: 0.2,
              startScale: 1,
              startX: 0,
              startY: 0,
              cursor: "grab",
            });

            const wheelHandler = (event: WheelEvent) => {
              if (!panzoom || (!event.ctrlKey && !event.metaKey)) return;
              event.preventDefault();
              panzoom.zoomWithWheel(event);
              updateZoomLabel();
            };

            mermaidViewport.addEventListener("wheel", wheelHandler, {
              passive: false,
            });

            svgEl.addEventListener(
              "panzoomchange",
              updateZoomLabel as EventListener,
            );

            panzoomCleanup = () => {
              mermaidViewport.removeEventListener("wheel", wheelHandler);
              svgEl.removeEventListener(
                "panzoomchange",
                updateZoomLabel as EventListener,
              );
            };

            panzoom.reset();
            updateZoomLabel();
          };

          const renderMermaidPreview = async () => {
            const source = getMermaidSource();
            if (currentNode.attrs.language !== "mermaid") {
              clearPanzoom();
              mermaidPreview.classList.remove("mermaid-error");
              mermaidCanvas.innerHTML = "";
              return;
            }

            if (!source.trim()) {
              clearPanzoom();
              mermaidCanvas.innerHTML =
                '<div class="mermaid-placeholder">Enter mermaid diagram code from the Plain view</div>';
              mermaidPreview.classList.remove("mermaid-error");
              return;
            }

            const renderId = ++latestMermaidRender;

            try {
              refreshMermaidTheme();
              const position = getCurrentPosition();
              const svg = await renderMermaidSvg(
                source,
                `${position}-${renderId}`,
              );
              if (isDestroyed || renderId !== latestMermaidRender) return;

              mermaidCanvas.innerHTML = svg;
              postProcessMermaidSvg(mermaidCanvas);
              mermaidPreview.classList.remove("mermaid-error");
              await initializePanzoom();
            } catch {
              if (isDestroyed || renderId !== latestMermaidRender) return;
              clearPanzoom();
              mermaidCanvas.innerHTML =
                '<div class="mermaid-error-message">Invalid mermaid syntax</div>';
              mermaidPreview.classList.add("mermaid-error");
            }
          };

          const scheduleMermaidRender = (delay = 180) => {
            if (mermaidRenderTimer) clearTimeout(mermaidRenderTimer);
            mermaidRenderTimer = setTimeout(() => {
              mermaidRenderTimer = null;
              void renderMermaidPreview();
            }, delay);
          };

          // ── Wrapper ──
          const wrapper = document.createElement("div");
          wrapper.className = "code-block-wrapper";

          // ── Header toolbar (non-editable) ──
          const header = document.createElement("div");
          header.contentEditable = "false";
          header.className = "code-block-header";

          const headerActions = document.createElement("div");
          headerActions.className = "code-block-header-actions";

          // Language label
          const langLabel = document.createElement("span");
          langLabel.className = "code-block-lang-label";
          const initLang = initialNode.attrs.language || "";
          langLabel.textContent =
            LANGUAGES.find((l) => l.value === initLang)?.label ||
            initLang ||
            "Plain Text";
          langLabel.title = "Click to change language";

          langLabel.onclick = (ev) => {
            ev.preventDefault();
            ev.stopPropagation();

            const select = document.createElement("select");
            select.className = "code-block-lang-select";

            const currentLang = currentNode.attrs.language || "";

            for (const lang of LANGUAGES) {
              const opt = document.createElement("option");
              opt.value = lang.value;
              opt.textContent = lang.label;
              if (lang.value === currentLang) opt.selected = true;
              select.appendChild(opt);
            }

            // If the current language isn't in our list, add it as an option
            if (
              currentLang &&
              !LANGUAGES.some((l) => l.value === currentLang)
            ) {
              const opt = document.createElement("option");
              opt.value = currentLang;
              opt.textContent = currentLang;
              opt.selected = true;
              select.insertBefore(opt, select.firstChild?.nextSibling || null);
            }

            let finished = false;
            const applyLanguage = () => {
              if (finished) return;
              finished = true;
              const newLang = select.value;
              const displayLabel =
                LANGUAGES.find((l) => l.value === newLang)?.label ||
                newLang ||
                "Plain Text";
              langLabel.textContent = displayLabel;
              if (select.parentElement === header) {
                header.replaceChild(langLabel, select);
              }
              const pos = getPos();
              if (pos != null) {
                view.dispatch(
                  view.state.tr.setNodeMarkup(pos, undefined, {
                    ...currentNode.attrs,
                    language: newLang,
                  }),
                );
              }
            };

            select.onchange = () => applyLanguage();
            select.onblur = () => applyLanguage();
            select.onkeydown = (kev) => {
              if (kev.key === "Escape") {
                kev.preventDefault();
                finished = true;
                if (select.parentElement === header) {
                  header.replaceChild(langLabel, select);
                }
              }
            };

            header.replaceChild(select, langLabel);
            select.focus();
          };

          // Copy button
          const copyBtn = document.createElement("button");
          copyBtn.className = "code-block-copy-btn";
          copyBtn.textContent = "Copy";
          copyBtn.onmousedown = (ev) => {
            ev.preventDefault();
            ev.stopPropagation();
          };
          copyBtn.onclick = async (ev) => {
            ev.preventDefault();
            ev.stopPropagation();
            const text = code.textContent;
            try {
              await navigator.clipboard.writeText(text || "");
              copyBtn.textContent = "Copied!";
              copyBtn.classList.add("copied");
              setTimeout(() => {
                copyBtn.textContent = "Copy";
                copyBtn.classList.remove("copied");
              }, 2000);
            } catch (err) {
              console.error("Failed to copy:", err);
            }
          };

          header.appendChild(langLabel);
          headerActions.appendChild(copyBtn);
          header.appendChild(headerActions);

          // ── Pre / Code elements (ProseMirror content goes in <code>) ──
          const pre = document.createElement("pre");
          const code = document.createElement("code");

          const mermaidPreview = document.createElement("div");
          mermaidPreview.className = "mermaid-preview";
          mermaidPreview.contentEditable = "false";

          const mermaidToolbar = document.createElement("div");
          mermaidToolbar.className = "mermaid-preview-toolbar";

          const mermaidToolbarMeta = document.createElement("div");
          mermaidToolbarMeta.className = "mermaid-preview-toolbar-meta";
          mermaidToolbarMeta.innerHTML =
            '<span class="mermaid-preview-toolbar-icon"></span><span class="mermaid-preview-toolbar-label"></span>';

          const mermaidToolbarActions = document.createElement("div");
          mermaidToolbarActions.className = "mermaid-preview-toolbar-actions";

          const createMermaidActionButton = (
            iconClass: string,
            label: string,
            onClick: () => void,
          ) => {
            const button = document.createElement("button");
            button.type = "button";
            button.className = "mermaid-preview-action";
            button.title = label;
            button.setAttribute("aria-label", label);

            const icon = document.createElement("span");
            icon.className = iconClass;
            button.appendChild(icon);

            button.onmousedown = (event) => {
              event.preventDefault();
              event.stopPropagation();
            };

            button.onclick = (event) => {
              event.preventDefault();
              event.stopPropagation();
              onClick();
            };

            return button;
          };

          const mermaidZoomLabel = document.createElement("span");
          mermaidZoomLabel.className = "mermaid-preview-zoom-label";
          mermaidZoomLabel.textContent = "100%";

          const mermaidViewport = document.createElement("div");
          mermaidViewport.className = "mermaid-preview-viewport";

          const mermaidCanvas = document.createElement("div");
          mermaidCanvas.className = "mermaid-preview-canvas";

          mermaidViewport.appendChild(mermaidCanvas);

          const zoomOutButton = createMermaidActionButton(
            "i-carbon-subtract",
            "Zoom out",
            () => {
              panzoom?.zoomOut();
              updateZoomLabel();
            },
          );

          const zoomResetButton = createMermaidActionButton(
            "i-carbon-reset",
            "Reset zoom",
            () => {
              panzoom?.reset();
              updateZoomLabel();
            },
          );

          const zoomInButton = createMermaidActionButton(
            "i-carbon-add",
            "Zoom in",
            () => {
              panzoom?.zoomIn();
              updateZoomLabel();
            },
          );

          const openViewerButton = createMermaidActionButton(
            "i-carbon-fit-to-screen",
            "Open fullscreen viewer",
            () => {
              const source = getMermaidSource();
              if (!source.trim()) return;
              dispatchMermaidPreviewOpen({
                source,
                position: getCurrentPosition(),
              });
            },
          );

          mermaidToolbarActions.appendChild(zoomOutButton);
          mermaidToolbarActions.appendChild(zoomResetButton);
          mermaidToolbarActions.appendChild(zoomInButton);
          mermaidToolbarActions.appendChild(mermaidZoomLabel);
          mermaidToolbarActions.appendChild(openViewerButton);

          mermaidToolbar.appendChild(mermaidToolbarMeta);
          mermaidToolbar.appendChild(mermaidToolbarActions);
          mermaidPreview.appendChild(mermaidToolbar);
          mermaidPreview.appendChild(mermaidViewport);

          if (initialNode.attrs.language) {
            pre.dataset.language = initialNode.attrs.language;
            code.className = `language-${initialNode.attrs.language}`;
          }

          pre.appendChild(code);

          // ── Sketch canvas ──────────────────────────────────────────────
          const sketchContainer = document.createElement("div");
          sketchContainer.className = "sketch-container";
          sketchContainer.contentEditable = "false";

          // Sketch state
          let sketchStrokes: SketchStroke[] = [];
          let currentSketchPoints: [number, number, number][] = [];
          let isSketchDrawing = false;
          let isSketchEraser = false;
          let sketchColor = "#f9fafb";
          let sketchSize = 6;
          let sketchOpacity = 1;
          let sketchDispatchTimer: ReturnType<typeof setTimeout> | null = null;

          const SKETCH_COLORS = [
            { name: "White", value: "#f9fafb" },
            { name: "Red", value: "#ef4444" },
            { name: "Orange", value: "#f97316" },
            { name: "Yellow", value: "#eab308" },
            { name: "Green", value: "#22c55e" },
            { name: "Teal", value: "#14b8a6" },
            { name: "Blue", value: "#3b82f6" },
            { name: "Purple", value: "#a855f7" },
            { name: "Pink", value: "#ec4899" },
            { name: "Black", value: "#1a1a1a" },
          ];

          const SKETCH_SIZES: { label: string; value: number }[] = [
            { label: "S", value: 4 },
            { label: "M", value: 8 },
            { label: "L", value: 16 },
          ];

          // Toolbar
          const sketchToolbar = document.createElement("div");
          sketchToolbar.className = "sketch-toolbar";

          // Color swatches
          const swatchRow = document.createElement("div");
          swatchRow.className = "sketch-toolbar-group";
          const swatchEls: HTMLButtonElement[] = [];
          for (const c of SKETCH_COLORS) {
            const btn = document.createElement("button");
            btn.type = "button";
            btn.className = "sketch-swatch";
            btn.title = c.name;
            btn.style.setProperty("--swatch-color", c.value);
            if (c.value === sketchColor) btn.classList.add("active");
            btn.onmousedown = (e) => {
              e.preventDefault();
              e.stopPropagation();
            };
            btn.onclick = (e) => {
              e.preventDefault();
              e.stopPropagation();
              sketchColor = c.value;
              isSketchEraser = false;
              swatchEls.forEach((s) => s.classList.remove("active"));
              btn.classList.add("active");
              sizeBtns.forEach((s) => s.classList.remove("active-eraser"));
              eraserBtn.classList.remove("active");
            };
            swatchEls.push(btn);
            swatchRow.appendChild(btn);
          }

          // Opacity slider
          const opacityLabel = document.createElement("span");
          opacityLabel.className = "sketch-toolbar-label";
          opacityLabel.textContent = "Opacity";
          const opacitySlider = document.createElement("input");
          opacitySlider.type = "range";
          opacitySlider.min = "0.1";
          opacitySlider.max = "1";
          opacitySlider.step = "0.05";
          opacitySlider.value = "1";
          opacitySlider.className = "sketch-opacity-slider";
          opacitySlider.title = "Stroke opacity";
          opacitySlider.onmousedown = (e) => e.stopPropagation();
          opacitySlider.oninput = () => {
            sketchOpacity = Number(opacitySlider.value);
          };

          // Size buttons
          const sizeRow = document.createElement("div");
          sizeRow.className = "sketch-toolbar-group";
          const sizeBtns: HTMLButtonElement[] = [];
          for (const s of SKETCH_SIZES) {
            const btn = document.createElement("button");
            btn.type = "button";
            btn.className = "sketch-size-btn";
            btn.textContent = s.label;
            btn.title = `Stroke size ${s.label}`;
            if (s.value === sketchSize) btn.classList.add("active");
            btn.onmousedown = (e) => {
              e.preventDefault();
              e.stopPropagation();
            };
            btn.onclick = (e) => {
              e.preventDefault();
              e.stopPropagation();
              sketchSize = s.value;
              sizeBtns.forEach((b) => b.classList.remove("active"));
              btn.classList.add("active");
            };
            sizeBtns.push(btn);
            sizeRow.appendChild(btn);
          }

          // Eraser button
          const eraserBtn = document.createElement("button");
          eraserBtn.type = "button";
          eraserBtn.className = "sketch-action-btn";
          eraserBtn.title = "Eraser";
          eraserBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 32 32"><path fill="currentColor" d="M27.09 8.27L23.73 4.9A3 3 0 0 0 21.61 4a3 3 0 0 0-2.13.88L4 20.35A3 3 0 0 0 4 24.6l3.38 3.28A3 3 0 0 0 9.5 28.9a.9.9 0 0 0 .16 0H28a1 1 0 0 0 0-2h-9.76l8.85-8.88a3 3 0 0 0 0-4.23zM9.5 26.89a1 1 0 0 1-.71-.3L5.41 23.3a1 1 0 0 1 0-1.42l8.09-8.09l5.71 5.71L11.07 27a1 1 0 0 1-.71.3a1 1 0 0 1-.86-.41zm16.18-9.94L20.63 22l-5.72-5.71l5.06-5.07l5.71 5.71z"/></svg>Eraser`;
          eraserBtn.onmousedown = (e) => {
            e.preventDefault();
            e.stopPropagation();
          };
          eraserBtn.onclick = (e) => {
            e.preventDefault();
            e.stopPropagation();
            isSketchEraser = !isSketchEraser;
            if (isSketchEraser) {
              eraserBtn.classList.add("active");
              swatchEls.forEach((s) => s.classList.remove("active"));
            } else {
              eraserBtn.classList.remove("active");
              const match = swatchEls.find(
                (_, i) => SKETCH_COLORS[i].value === sketchColor,
              );
              match?.classList.add("active");
            }
          };

          // Undo button
          const undoBtn = document.createElement("button");
          undoBtn.type = "button";
          undoBtn.className = "sketch-action-btn";
          undoBtn.title = "Undo last stroke";
          undoBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 32 32"><path fill="currentColor" d="M20 10H7.815l3.587-3.586L10 5l-6 6l6 6l1.402-1.414L7.818 12H20a6 6 0 0 1 0 12h-8v2h8a8 8 0 0 0 0-16"/></svg>Undo`;
          undoBtn.onmousedown = (e) => {
            e.preventDefault();
            e.stopPropagation();
          };
          undoBtn.onclick = (e) => {
            e.preventDefault();
            e.stopPropagation();
            if (!sketchStrokes.length) return;
            sketchStrokes = sketchStrokes.slice(0, -1);
            renderSketchStrokes();
            dispatchSketchData();
          };

          // Clear button
          const clearBtn = document.createElement("button");
          clearBtn.type = "button";
          clearBtn.className = "sketch-action-btn";
          clearBtn.title = "Clear all";
          clearBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 32 32"><path fill="currentColor" d="M12 12h2v12h-2zm6 0h2v12h-2z"/><path fill="currentColor" d="M4 6v2h2v20a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V8h2V6Zm4 22V8h16v20Zm4-26h8v2h-8z"/></svg>Clear`;
          clearBtn.onmousedown = (e) => {
            e.preventDefault();
            e.stopPropagation();
          };
          clearBtn.onclick = (e) => {
            e.preventDefault();
            e.stopPropagation();
            sketchStrokes = [];
            renderSketchStrokes();
            dispatchSketchData();
          };

          // Delete block button
          const deleteBlockBtn = document.createElement("button");
          deleteBlockBtn.type = "button";
          deleteBlockBtn.className = "sketch-action-btn sketch-delete-btn";
          deleteBlockBtn.title = "Delete sketch block";
          deleteBlockBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 32 32"><path fill="currentColor" d="M12 12h2v12h-2zm6 0h2v12h-2z"/><path fill="currentColor" d="M4 6v2h2v20a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V8h2V6Zm4 22V8h16v20Zm4-26h8v2h-8z"/></svg>`;
          deleteBlockBtn.onmousedown = (e) => {
            e.preventDefault();
            e.stopPropagation();
          };
          deleteBlockBtn.onclick = (e) => {
            e.preventDefault();
            e.stopPropagation();
            const pos = getPos();
            if (pos == null) return;
            view.dispatch(
              view.state.tr.delete(pos, pos + currentNode.nodeSize),
            );
            view.focus();
          };

          const actionsRow = document.createElement("div");
          actionsRow.className = "sketch-toolbar-group";
          actionsRow.appendChild(eraserBtn);
          actionsRow.appendChild(undoBtn);
          actionsRow.appendChild(clearBtn);

          const mkDivider = () => {
            const d = document.createElement("div");
            d.className = "sketch-toolbar-divider";
            return d;
          };

          // Right-aligned delete group pushed with auto margin via CSS
          const deleteRow = document.createElement("div");
          deleteRow.className =
            "sketch-toolbar-group sketch-toolbar-group--end";
          deleteRow.appendChild(deleteBlockBtn);

          sketchToolbar.appendChild(swatchRow);
          sketchToolbar.appendChild(mkDivider());
          sketchToolbar.appendChild(opacityLabel);
          sketchToolbar.appendChild(opacitySlider);
          sketchToolbar.appendChild(mkDivider());
          sketchToolbar.appendChild(sizeRow);
          sketchToolbar.appendChild(mkDivider());
          sketchToolbar.appendChild(actionsRow);
          sketchToolbar.appendChild(deleteRow);

          // SVG canvas
          const sketchSvg = document.createElementNS(SVG_NS, "svg");
          sketchSvg.setAttribute(
            "viewBox",
            `0 0 ${SKETCH_WIDTH} ${SKETCH_HEIGHT}`,
          );
          sketchSvg.setAttribute("xmlns", SVG_NS);
          sketchSvg.className.baseVal = "sketch-canvas";

          // Background rect (always present for eraser visual and export)
          const bgRect = document.createElementNS(SVG_NS, "rect");
          bgRect.setAttribute("width", String(SKETCH_WIDTH));
          bgRect.setAttribute("height", String(SKETCH_HEIGHT));
          bgRect.setAttribute("fill", "transparent");
          sketchSvg.appendChild(bgRect);

          // Group for committed strokes
          const strokesGroup = document.createElementNS(SVG_NS, "g");
          sketchSvg.appendChild(strokesGroup);

          // Live path for the current in-progress stroke
          const livePath = document.createElementNS(SVG_NS, "path");
          sketchSvg.appendChild(livePath);

          sketchContainer.appendChild(sketchToolbar);
          sketchContainer.appendChild(sketchSvg);

          // Helpers

          const renderSketchStrokes = () => {
            while (strokesGroup.firstChild)
              strokesGroup.removeChild(strokesGroup.firstChild);
            for (const s of sketchStrokes) {
              strokesGroup.appendChild(strokeToPath(s));
            }
          };

          const dispatchSketchData = () => {
            if (sketchDispatchTimer) clearTimeout(sketchDispatchTimer);
            sketchDispatchTimer = setTimeout(() => {
              sketchDispatchTimer = null;
              const pos = getPos();
              if (pos == null) return;
              const data: SketchData = { strokes: sketchStrokes };
              const text = JSON.stringify(data);
              const schema = view.state.schema;
              const textNode = text ? schema.text(text) : null;
              const newNode = schema.nodes.code_block.create(
                { ...currentNode.attrs },
                textNode ? [textNode] : [],
              );
              view.dispatch(
                view.state.tr.replaceWith(
                  pos,
                  pos + currentNode.nodeSize,
                  newNode,
                ),
              );
            }, 100);
          };

          // Get SVG coordinates from a pointer event.
          // Coordinates are rounded to integers and pressure to 2 dp to keep
          // stored JSON compact without any visible quality loss.
          const getSvgPoint = (e: PointerEvent): [number, number, number] => {
            const rect = sketchSvg.getBoundingClientRect();
            const scaleX = SKETCH_WIDTH / rect.width;
            const scaleY = SKETCH_HEIGHT / rect.height;
            return [
              Math.round((e.clientX - rect.left) * scaleX),
              Math.round((e.clientY - rect.top) * scaleY),
              Math.round((e.pressure || 0.5) * 100) / 100,
            ];
          };

          // Eraser: remove any stroke whose bounding area is near the point
          const eraseAt = (x: number, y: number) => {
            const ERASE_RADIUS = sketchSize * 3;
            const before = sketchStrokes.length;
            sketchStrokes = sketchStrokes.filter((s) => {
              return !s.points.some(
                ([px, py]) =>
                  Math.abs(px - x) < ERASE_RADIUS &&
                  Math.abs(py - y) < ERASE_RADIUS,
              );
            });
            if (sketchStrokes.length !== before) {
              renderSketchStrokes();
            }
          };

          sketchSvg.addEventListener("pointerdown", (e) => {
            if (e.button !== 0) return;
            e.preventDefault();
            e.stopPropagation();
            sketchSvg.setPointerCapture(e.pointerId);
            isSketchDrawing = true;
            currentSketchPoints = [getSvgPoint(e)];
            if (isSketchEraser) {
              const [x, y] = currentSketchPoints[0];
              eraseAt(x, y);
            }
          });

          // Minimum squared distance (in SVG units) between recorded points.
          // Skipping near-duplicate points cuts raw point count ~60-70%.
          const MIN_DIST_SQ = 9; // 3 SVG units

          sketchSvg.addEventListener("pointermove", (e) => {
            if (!isSketchDrawing) return;
            e.preventDefault();
            e.stopPropagation();
            const pt = getSvgPoint(e);
            const last = currentSketchPoints[currentSketchPoints.length - 1];
            if (last) {
              const dx = pt[0] - last[0];
              const dy = pt[1] - last[1];
              if (dx * dx + dy * dy < MIN_DIST_SQ) return;
            }
            currentSketchPoints.push(pt);
            if (isSketchEraser) {
              eraseAt(pt[0], pt[1]);
            } else {
              const outline = getStroke(currentSketchPoints, {
                size: sketchSize,
                thinning: 0.5,
                smoothing: 0.5,
                streamline: 0.5,
              });
              const d = getSvgPathFromStroke(outline);
              livePath.setAttribute("d", d);
              livePath.setAttribute("fill", sketchColor);
              livePath.setAttribute("opacity", String(sketchOpacity));
            }
          });

          const finalizeSketchStroke = (e: PointerEvent) => {
            if (!isSketchDrawing) return;
            e.preventDefault();
            e.stopPropagation();
            isSketchDrawing = false;

            if (!isSketchEraser && currentSketchPoints.length > 1) {
              sketchStrokes = [
                ...sketchStrokes,
                {
                  color: sketchColor,
                  size: sketchSize,
                  opacity: sketchOpacity,
                  points: [...currentSketchPoints],
                },
              ];
              renderSketchStrokes();
            } else if (isSketchEraser) {
              dispatchSketchData();
            }

            // Clear live path
            livePath.setAttribute("d", "");
            currentSketchPoints = [];

            if (!isSketchEraser) {
              dispatchSketchData();
            }
          };

          sketchSvg.addEventListener("pointerup", finalizeSketchStroke);
          sketchSvg.addEventListener("pointercancel", finalizeSketchStroke);

          const setSketchVisibility = (visible: boolean) => {
            sketchContainer.style.display = visible ? "flex" : "none";
            pre.style.display = visible ? "none" : "";
          };

          wrapper.appendChild(header);
          wrapper.appendChild(pre);
          wrapper.appendChild(mermaidPreview);
          wrapper.appendChild(sketchContainer);

          if (typeof window !== "undefined") {
            mermaidObserver = new MutationObserver(() => {
              const nextTheme = getMermaidTheme();
              if (nextTheme === lastMermaidTheme) return;
              lastMermaidTheme = nextTheme;
              if (currentNode.attrs.language === "mermaid") {
                scheduleMermaidRender(0);
              }
            });

            mermaidObserver.observe(document.documentElement, {
              attributes: true,
              attributeFilter: ["class"],
            });
          }

          setMermaidPreviewVisibility(initLang === "mermaid");
          if (initLang === "mermaid") {
            scheduleMermaidRender(0);
          }

          // Init sketch from stored data
          setSketchVisibility(initLang === "sketch");
          if (initLang === "sketch") {
            const data = parseSketchData(initialNode.textContent || "");
            sketchStrokes = data.strokes;
            renderSketchStrokes();
          }

          return {
            dom: wrapper,
            contentDOM: code,

            update(updatedNode) {
              if (updatedNode.type.name !== "code_block") return false;

              currentNode = updatedNode;
              const lang = updatedNode.attrs.language || "";
              langLabel.textContent =
                LANGUAGES.find((l) => l.value === lang)?.label ||
                lang ||
                "Plain Text";

              setMermaidPreviewVisibility(lang === "mermaid");
              setSketchVisibility(lang === "sketch");

              if (lang) {
                pre.dataset.language = lang;
                code.className = `language-${lang}`;
              } else {
                delete pre.dataset.language;
                code.className = "";
              }

              if (lang === "mermaid") {
                scheduleMermaidRender();
              } else {
                latestMermaidRender++;
                if (mermaidRenderTimer) clearTimeout(mermaidRenderTimer);
                mermaidRenderTimer = null;
                clearPanzoom();
                mermaidPreview.classList.remove("mermaid-error");
                mermaidCanvas.innerHTML = "";
              }

              // Reload sketch strokes from updated node content (e.g. undo/redo)
              if (lang === "sketch" && !isSketchDrawing) {
                const data = parseSketchData(updatedNode.textContent || "");
                sketchStrokes = data.strokes;
                renderSketchStrokes();
              }

              return true;
            },

            stopEvent(event) {
              if (header.contains(event.target as Node)) return true;
              if (mermaidPreview.contains(event.target as Node)) return true;
              if (sketchContainer.contains(event.target as Node)) return true;
              return false;
            },

            ignoreMutation(mutation) {
              if (header.contains(mutation.target)) return true;
              if (mermaidPreview.contains(mutation.target)) return true;
              if (sketchContainer.contains(mutation.target)) return true;
              return false;
            },

            destroy() {
              isDestroyed = true;
              latestMermaidRender++;
              if (mermaidRenderTimer) clearTimeout(mermaidRenderTimer);
              mermaidRenderTimer = null;
              if (sketchDispatchTimer) clearTimeout(sketchDispatchTimer);
              sketchDispatchTimer = null;
              mermaidObserver?.disconnect();
              mermaidObserver = null;
              clearPanzoom();
            },
          };
        },
      },
    },
  });
});
