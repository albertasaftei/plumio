export const MERMAID_PREVIEW_OPEN_EVENT = "plumio:mermaid-preview-open";

export interface MermaidPreviewOpenDetail {
  source: string;
  position: number;
}

export const dispatchMermaidPreviewOpen = (
  detail: MermaidPreviewOpenDetail,
) => {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent<MermaidPreviewOpenDetail>(MERMAID_PREVIEW_OPEN_EVENT, {
      detail,
    }),
  );
};
