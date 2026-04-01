let mermaidModule: any = null;
let mermaidIdCounter = 0;

export type PanzoomInstance = {
  destroy: () => void;
  getScale?: () => number;
  reset: () => void;
  zoomIn: () => void;
  zoomOut: () => void;
  zoomWithWheel: (event: WheelEvent) => void;
};

export type PanzoomFactory = (
  element: HTMLElement | SVGElement,
  options?: Record<string, unknown>,
) => PanzoomInstance;

let panzoomFactory: PanzoomFactory | null = null;

export const getMermaidTheme = () => {
  if (typeof window === "undefined") return "default";
  return document.documentElement.classList.contains("light")
    ? "default"
    : "dark";
};

const initializeMermaid = (mod: any) => {
  mod.initialize({
    startOnLoad: false,
    theme: getMermaidTheme(),
    suppressErrorRendering: true,
    htmlLabels: false,
    flowchart: { htmlLabels: false, useMaxWidth: false },
    er: { htmlLabels: false, useMaxWidth: false },
    sequence: { useMaxWidth: false },
  });
};

export const refreshMermaidTheme = () => {
  if (mermaidModule) {
    initializeMermaid(mermaidModule);
  }
};

export const getMermaid = async () => {
  if (!mermaidModule) {
    const m = await import("mermaid");
    mermaidModule = m.default;
    initializeMermaid(mermaidModule);
  }
  return mermaidModule;
};

export const renderMermaidSvg = async (text: string, key: string) => {
  const mermaid = await getMermaid();
  refreshMermaidTheme();
  const id = `mermaid-${key}-${mermaidIdCounter++}`;
  const { svg } = await mermaid.render(id, text.trim());
  return svg as string;
};

export const getPanzoomFactory = async (): Promise<PanzoomFactory> => {
  if (panzoomFactory) return panzoomFactory;

  const module = await import("@panzoom/panzoom");
  panzoomFactory = ((module as any).default ?? module) as PanzoomFactory;
  return panzoomFactory;
};

export const postProcessMermaidSvg = (root: ParentNode) => {
  const svgEl = root.querySelector("svg");
  if (!svgEl) return;

  svgEl
    .querySelectorAll("[clip-path]")
    .forEach((el) => el.removeAttribute("clip-path"));
  svgEl.querySelectorAll("clipPath").forEach((el) => el.remove());

  svgEl.querySelectorAll("foreignObject").forEach((fo) => {
    fo.removeAttribute("width");
    fo.removeAttribute("height");
    fo.setAttribute("style", "overflow: visible;");
  });

  svgEl.querySelectorAll("foreignObject div, foreignObject p").forEach((el) => {
    (el as HTMLElement).style.setProperty("overflow", "visible");
    (el as HTMLElement).style.setProperty("white-space", "nowrap");
    (el as HTMLElement).style.setProperty("margin", "0", "important");
    (el as HTMLElement).style.setProperty("padding", "0", "important");
  });
};
