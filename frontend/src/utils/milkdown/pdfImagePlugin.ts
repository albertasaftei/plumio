import { $prose } from "@milkdown/utils";
import { Plugin, PluginKey } from "@milkdown/prose/state";

/**
 * Replace the `token=` query param in attachment URLs with the current session
 * token. Attachment URLs are baked into the document markdown at upload time, so
 * the embedded token can expire if the user stays logged in beyond 30 days or
 * switches orgs. Refreshing it at render time keeps images/PDFs working without
 * any change to the stored content.
 */
function refreshAttachmentToken(src: string): string {
  if (!src.includes("/api/attachments/file")) return src;
  try {
    const url = new URL(src, window.location.href);
    // The `api` export is a Proxy that wraps every property in an async
    // function, so reading `api.token` returns a closure, not the value.
    // Read the token directly from localStorage instead.
    const currentToken =
      typeof window !== "undefined"
        ? localStorage.getItem("plumio_token")
        : null;
    if (currentToken) {
      url.searchParams.set("token", currentToken);
    }
    // Return as absolute URL only when src was already absolute, otherwise
    // return just pathname+search so relative URLs stay relative.
    return src.startsWith("http") ? url.toString() : url.pathname + url.search;
  } catch {
    return src;
  }
}

function isPdfSrc(src: string): boolean {
  // 1. Straightforward: path ends with .pdf before query/hash
  const pathPart = src.split("?")[0].split("#")[0];
  if (/\.pdf$/i.test(pathPart)) return true;
  // 2. Attachment URLs embed the filename in the ?path= query param
  try {
    const url = new URL(src, window.location.href);
    const pathParam = url.searchParams.get("path") || "";
    return /\.pdf$/i.test(pathParam.split("?")[0]);
  } catch {
    return false;
  }
}

// Initialise the PDF.js worker once across all NodeView instances
let workerReady = false;
async function getPdfjsLib() {
  const pdfjsLib = await import("pdfjs-dist");
  if (!workerReady) {
    pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
      "pdfjs-dist/build/pdf.worker.min.mjs",
      import.meta.url,
    ).href;
    workerReady = true;
  }
  return pdfjsLib;
}

/** Render one page onto a canvas at device-pixel-ratio quality. */
async function renderPage(
  pdfDoc: any,
  pageNum: number,
  canvas: HTMLCanvasElement,
  containerWidth: number,
) {
  const page = await pdfDoc.getPage(pageNum);
  const dpr = window.devicePixelRatio || 1;
  const viewport = page.getViewport({ scale: 1 });
  const scale = (containerWidth / viewport.width) * dpr;
  const scaled = page.getViewport({ scale });

  canvas.width = scaled.width;
  canvas.height = scaled.height;
  canvas.style.width = `${scaled.width / dpr}px`;
  canvas.style.height = `${scaled.height / dpr}px`;

  await page.render({
    canvasContext: canvas.getContext("2d")!,
    viewport: scaled,
  }).promise;
}

/**
 * Milkdown NodeView plugin that replaces the default `image` rendering with:
 *  - Canvas-based PDF preview (multi-page with prev/next) via PDF.js
 *  - Plain <img> for all other images
 */
export const pdfImagePlugin = $prose(() => {
  return new Plugin({
    key: new PluginKey("pdfImageView"),
    props: {
      nodeViews: {
        image(node) {
          const src = (node.attrs.src as string) || "";
          const alt = (node.attrs.alt as string) || "";
          const title = (node.attrs.title as string) || "";

          // ── Regular image ─────────────────────────────────────────
          if (!isPdfSrc(src)) {
            const img = document.createElement("img");
            img.src = refreshAttachmentToken(src);
            img.alt = alt;
            if (title) img.title = title;
            img.style.cssText =
              "max-width:100%;display:block;border-radius:4px;";
            return {
              dom: img,
              update(u: any) {
                if (u.type !== node.type) return false;
                img.src = refreshAttachmentToken(u.attrs.src || "");
                img.alt = u.attrs.alt || "";
                img.title = u.attrs.title || "";
                return true;
              },
              ignoreMutation: () => true,
            };
          }

          // ── PDF preview via PDF.js ────────────────────────────────
          const container = document.createElement("div");
          container.contentEditable = "false";
          container.style.cssText =
            "width:100%;margin:12px 0;border:1px solid var(--color-border);" +
            "border-radius:8px;overflow:hidden;user-select:none;" +
            "background:var(--color-bg-surface);";

          // Toolbar
          const toolbar = document.createElement("div");
          toolbar.style.cssText =
            "display:flex;align-items:center;gap:8px;padding:6px 12px;" +
            "background:var(--color-bg-elevated);border-bottom:1px solid var(--color-border);";

          const labelEl = document.createElement("span");
          labelEl.style.cssText =
            "font-size:12px;color:var(--color-text-secondary);flex:1;" +
            "overflow:hidden;text-overflow:ellipsis;white-space:nowrap;";
          labelEl.textContent = alt || "PDF";

          const pageInfo = document.createElement("span");
          pageInfo.style.cssText =
            "font-size:11px;color:var(--color-text-muted);white-space:nowrap;";
          pageInfo.textContent = "Loading…";

          const btnStyle =
            "padding:1px 8px;border-radius:4px;border:1px solid var(--color-border);" +
            "background:var(--color-bg-surface);color:var(--color-text-primary);" +
            "cursor:pointer;font-size:14px;line-height:1.5;display:none;";

          const prevBtn = document.createElement("button");
          prevBtn.textContent = "‹";
          prevBtn.style.cssText = btnStyle;
          const nextBtn = document.createElement("button");
          nextBtn.textContent = "›";
          nextBtn.style.cssText = btnStyle;

          const openLink = document.createElement("button");

          openLink.style.cssText =
            "font-size:11px;color:var(--color-primary);text-decoration:none;" +
            "white-space:nowrap;padding:2px 7px;border-radius:4px;flex-shrink:0;" +
            "background:var(--color-bg-surface);border:1px solid var(--color-border);" +
            "cursor:pointer;transition:all 0.2s ease;";
          openLink.onmouseover = () => {
            openLink.style.background = "var(--color-bg-elevated)";
            openLink.style.borderColor = "var(--color-primary)";
          };
          openLink.onmouseout = () => {
            openLink.style.background = "var(--color-bg-surface)";
            openLink.style.borderColor = "var(--color-border)";
          };
          openLink.textContent = "Open ↗";
          openLink.onmousedown = (e) => e.stopPropagation();
          openLink.onclick = (e) => {
            window.open(src, "_blank", "noopener,noreferrer");
            e.stopPropagation();
          };
          toolbar.appendChild(labelEl);
          toolbar.appendChild(prevBtn);
          toolbar.appendChild(pageInfo);
          toolbar.appendChild(nextBtn);
          toolbar.appendChild(openLink);

          // Canvas wrapper
          const canvasWrap = document.createElement("div");
          canvasWrap.style.cssText =
            "overflow:auto;max-height:620px;background:#525659;" +
            "display:flex;justify-content:center;padding:12px;";

          const canvas = document.createElement("canvas");
          canvas.style.cssText =
            "display:block;box-shadow:0 2px 8px rgba(0,0,0,.4);border-radius:2px;";
          canvasWrap.appendChild(canvas);

          container.appendChild(toolbar);
          container.appendChild(canvasWrap);

          // Error helper
          const showError = (msg: string) => {
            canvasWrap.innerHTML = "";
            const err = document.createElement("div");
            err.style.cssText =
              "padding:24px;color:var(--color-text-muted);font-size:13px;text-align:center;";
            err.textContent = `⚠️  ${msg}`;
            canvasWrap.appendChild(err);
            pageInfo.textContent = "";
          };

          let pdfDoc: any = null;
          let currentPage = 1;
          let totalPages = 0;
          let rendering = false;

          const doRender = async (pageNum: number) => {
            if (!pdfDoc || rendering) return;
            rendering = true;
            try {
              canvasWrap.innerHTML = "";
              canvasWrap.appendChild(canvas);
              const cw = container.getBoundingClientRect().width || 680;
              await renderPage(pdfDoc, pageNum, canvas, Math.max(300, cw - 24));
              pageInfo.textContent = `${pageNum} / ${totalPages}`;
              const multi = totalPages > 1;
              prevBtn.style.display = multi ? "" : "none";
              nextBtn.style.display = multi ? "" : "none";
              (prevBtn as HTMLButtonElement).disabled = pageNum <= 1;
              (nextBtn as HTMLButtonElement).disabled = pageNum >= totalPages;
            } catch {
              showError("Failed to render page.");
            } finally {
              rendering = false;
            }
          };

          prevBtn.onmousedown = (e) => {
            e.stopPropagation();
            e.preventDefault();
          };
          prevBtn.onclick = (e) => {
            e.stopPropagation();
            if (currentPage > 1) {
              currentPage--;
              doRender(currentPage);
            }
          };
          nextBtn.onmousedown = (e) => {
            e.stopPropagation();
            e.preventDefault();
          };
          nextBtn.onclick = (e) => {
            e.stopPropagation();
            if (currentPage < totalPages) {
              currentPage++;
              doRender(currentPage);
            }
          };

          // Load asynchronously after insertion
          (async () => {
            try {
              const lib = await getPdfjsLib();
              pdfDoc = await lib.getDocument({
                url: refreshAttachmentToken(src),
              }).promise;
              totalPages = pdfDoc.numPages;
              await doRender(1);
            } catch (err: any) {
              console.error("PDF.js load error:", err);
              showError(
                err?.message?.includes("password")
                  ? "PDF is password-protected."
                  : "Could not load PDF.",
              );
            }
          })();

          return {
            dom: container,
            update(u: any) {
              return u.type === node.type && u.attrs.src === src;
            },
            ignoreMutation: () => true,
            destroy() {
              pdfDoc?.destroy?.();
            },
          };
        },
      },
    },
  });
});
