import { Show, createEffect, createSignal, onCleanup } from "solid-js";
import {
  getPanzoomFactory,
  type PanzoomInstance,
  postProcessMermaidSvg,
  refreshMermaidTheme,
  renderMermaidSvg,
} from "~/utils/milkdown/mermaidRenderer";

interface MermaidViewerProps {
  isOpen: boolean;
  source: string;
  onClose: () => void;
}

export default function MermaidViewer(props: MermaidViewerProps) {
  let viewportRef: HTMLDivElement | undefined;
  let canvasRef: HTMLDivElement | undefined;
  let panzoom: PanzoomInstance | null = null;
  let wheelCleanup: (() => void) | null = null;
  let latestRender = 0;

  const [loading, setLoading] = createSignal(false);
  const [error, setError] = createSignal<string | null>(null);
  const [zoomLabel, setZoomLabel] = createSignal("100%");

  const destroyPanzoom = () => {
    wheelCleanup?.();
    wheelCleanup = null;
    panzoom?.destroy();
    panzoom = null;
    setZoomLabel("100%");
  };

  const updateZoomLabel = () => {
    if (!panzoom) {
      setZoomLabel("100%");
      return;
    }

    const scale =
      typeof panzoom.getScale === "function" ? panzoom.getScale() : 1;
    setZoomLabel(`${Math.round(scale * 100)}%`);
  };

  const initializePanzoom = async () => {
    destroyPanzoom();

    const svgEl = canvasRef?.querySelector("svg");
    if (!svgEl || !viewportRef) return;

    const createPanzoom = await getPanzoomFactory();

    panzoom = createPanzoom(svgEl as unknown as HTMLElement, {
      minScale: 0.5,
      maxScale: 4,
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

    viewportRef.addEventListener("wheel", wheelHandler, { passive: false });
    wheelCleanup = () => {
      viewportRef?.removeEventListener("wheel", wheelHandler);
    };

    svgEl.addEventListener("panzoomchange", updateZoomLabel as EventListener);
    const previousCleanup = wheelCleanup;
    wheelCleanup = () => {
      previousCleanup?.();
      svgEl.removeEventListener(
        "panzoomchange",
        updateZoomLabel as EventListener,
      );
    };

    panzoom.reset();
    updateZoomLabel();
  };

  const renderDiagram = async () => {
    if (!props.isOpen || !props.source.trim() || !canvasRef) return;

    const renderId = ++latestRender;
    setLoading(true);
    setError(null);

    try {
      refreshMermaidTheme();
      const svg = await renderMermaidSvg(props.source, `viewer-${renderId}`);
      if (renderId !== latestRender || !canvasRef) return;

      canvasRef.innerHTML = svg;
      postProcessMermaidSvg(canvasRef);
      await initializePanzoom();
    } catch {
      if (renderId !== latestRender || !canvasRef) return;
      canvasRef.innerHTML = "";
      destroyPanzoom();
      setError("Invalid mermaid syntax");
    } finally {
      if (renderId === latestRender) {
        setLoading(false);
      }
    }
  };

  const closeViewer = () => {
    latestRender++;
    destroyPanzoom();
    props.onClose();
  };

  createEffect(() => {
    if (!props.isOpen || typeof document === "undefined") return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    onCleanup(() => {
      document.body.style.overflow = previousOverflow;
    });
  });

  createEffect(() => {
    if (!props.isOpen || typeof window === "undefined") return;

    const handleKeydown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        closeViewer();
      }
    };

    const observer = new MutationObserver(() => {
      if (props.isOpen) {
        renderDiagram();
      }
    });

    window.addEventListener("keydown", handleKeydown);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });

    onCleanup(() => {
      window.removeEventListener("keydown", handleKeydown);
      observer.disconnect();
    });
  });

  createEffect(() => {
    if (props.isOpen) {
      renderDiagram();
    } else {
      latestRender++;
      destroyPanzoom();
      setLoading(false);
      setError(null);
      if (canvasRef) {
        canvasRef.innerHTML = "";
      }
    }
  });

  onCleanup(() => {
    destroyPanzoom();
  });

  return (
    <Show when={props.isOpen}>
      <div class="mermaid-viewer-overlay" onClick={closeViewer}>
        <div
          class="mermaid-viewer-shell"
          onClick={(event) => event.stopPropagation()}
        >
          <div class="mermaid-viewer-toolbar">
            <div class="mermaid-viewer-title-group">
              <span class="i-carbon-diagram mermaid-viewer-title-icon" />
              <div>
                <div class="mermaid-viewer-title">Mermaid diagram</div>
                <div class="mermaid-viewer-subtitle">
                  Drag to pan. Use the toolbar or hold Ctrl/Cmd while scrolling.
                </div>
              </div>
            </div>

            <div class="mermaid-viewer-actions">
              <button
                type="button"
                class="mermaid-viewer-action"
                aria-label="Zoom out"
                onClick={() => {
                  panzoom?.zoomOut();
                  updateZoomLabel();
                }}
              >
                <span class="i-carbon-subtract" />
              </button>
              <button
                type="button"
                class="mermaid-viewer-action"
                aria-label="Reset zoom"
                onClick={() => {
                  panzoom?.reset();
                  updateZoomLabel();
                }}
              >
                <span class="i-carbon-reset" />
              </button>
              <button
                type="button"
                class="mermaid-viewer-action"
                aria-label="Zoom in"
                onClick={() => {
                  panzoom?.zoomIn();
                  updateZoomLabel();
                }}
              >
                <span class="i-carbon-add" />
              </button>
              <span class="mermaid-viewer-zoom-label">{zoomLabel()}</span>
              <button
                type="button"
                class="mermaid-viewer-action mermaid-viewer-close"
                aria-label="Close viewer"
                onClick={closeViewer}
              >
                <span class="i-carbon-close" />
              </button>
            </div>
          </div>

          <div ref={viewportRef} class="mermaid-viewer-viewport">
            <Show when={loading()}>
              <div class="mermaid-viewer-status">Rendering diagram…</div>
            </Show>
            <Show when={error()}>
              <div class="mermaid-viewer-status mermaid-viewer-status-error">
                {error()}
              </div>
            </Show>
            <div
              ref={canvasRef}
              class="mermaid-viewer-canvas"
              classList={{
                "is-loading": loading(),
                "has-error": !!error(),
              }}
            />
          </div>
        </div>
      </div>
    </Show>
  );
}
