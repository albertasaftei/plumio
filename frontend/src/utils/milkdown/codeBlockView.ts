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

          wrapper.appendChild(header);
          wrapper.appendChild(pre);
          wrapper.appendChild(mermaidPreview);

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

              return true;
            },

            stopEvent(event) {
              if (header.contains(event.target as Node)) return true;
              if (mermaidPreview.contains(event.target as Node)) return true;
              return false;
            },

            ignoreMutation(mutation) {
              if (header.contains(mutation.target)) return true;
              if (mermaidPreview.contains(mutation.target)) return true;
              return false;
            },

            destroy() {
              isDestroyed = true;
              latestMermaidRender++;
              if (mermaidRenderTimer) clearTimeout(mermaidRenderTimer);
              mermaidRenderTimer = null;
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
