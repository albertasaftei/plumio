import { Component, createSignal, createEffect, For, Show } from "solid-js";
import { api } from "~/lib/api";

interface Attachment {
  id: number;
  filename: string;
  original_name: string;
  mime_type: string;
  size: number;
  uploaded_at: string;
  path: string;
  url: string;
}

interface AttachmentPanelProps {
  show: boolean;
  documentPath: string;
  onInsert: (url: string, filename: string, isImage: boolean) => void;
  onClose: () => void;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function isImage(mimeType: string): boolean {
  return mimeType.startsWith("image/");
}

function isPdf(mimeType: string): boolean {
  return mimeType === "application/pdf";
}

// Files that can be embedded inline in the editor
function isInlineRenderable(mimeType: string): boolean {
  return isImage(mimeType) || isPdf(mimeType);
}

function fileIcon(mimeType: string): string {
  if (mimeType.startsWith("image/")) return "i-carbon-image";
  if (mimeType === "application/pdf") return "i-carbon-document-pdf";
  if (mimeType.startsWith("video/")) return "i-carbon-video";
  if (mimeType.startsWith("audio/")) return "i-carbon-music";
  if (mimeType.startsWith("text/")) return "i-carbon-document";
  return "i-carbon-document-attachment";
}

const AttachmentPanel: Component<AttachmentPanelProps> = (props) => {
  const [attachments, setAttachments] = createSignal<Attachment[]>([]);
  const [loading, setLoading] = createSignal(false);
  const [uploading, setUploading] = createSignal(false);
  const [error, setError] = createSignal<string | null>(null);

  let fileInputRef: HTMLInputElement | undefined;

  const loadAttachments = async () => {
    if (!props.documentPath) return;
    setLoading(true);
    setError(null);
    try {
      const result = await api.listAttachments(props.documentPath);
      // Resolve each attachment URL eagerly (api proxy is async)
      const withUrls = await Promise.all(
        (result.attachments || []).map(async (a: any) => {
          const attachPath = `org-${a.organization_id}/attachments/${a.filename}`;
          const url = await (api as any).getAttachmentUrl(attachPath);
          return { ...a, path: attachPath, url: url as string };
        }),
      );
      setAttachments(withUrls);
    } catch (err: any) {
      setError(err.message || "Failed to load attachments");
    } finally {
      setLoading(false);
    }
  };

  createEffect(() => {
    if (props.show && props.documentPath) {
      loadAttachments();
    }
  });

  const handleUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setUploading(true);
    setError(null);
    try {
      for (const file of Array.from(files)) {
        await api.uploadAttachment(props.documentPath, file);
      }
      await loadAttachments();
    } catch (err: any) {
      setError(err.message || "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (attachment: Attachment) => {
    if (!confirm(`Delete "${attachment.original_name}"?`)) return;
    try {
      await api.deleteAttachment(attachment.path);
      setAttachments((prev) => prev.filter((a) => a.id !== attachment.id));
    } catch (err: any) {
      setError(err.message || "Failed to delete");
    }
  };

  const handleInsert = (attachment: Attachment) => {
    if (isInlineRenderable(attachment.mime_type)) {
      // Images and PDFs are inserted as image nodes in the editor.
      // The pdfImagePlugin NodeView will render PDFs as <embed>.
      props.onInsert(attachment.url, attachment.original_name, true);
      props.onClose();
    } else {
      // For other files (Excel, Word, zip, etc.) trigger a download.
      // The browser passes it to the OS default app after download.
      handleOpenExternal(attachment);
    }
  };

  const handleOpenExternal = (attachment: Attachment) => {
    const a = document.createElement("a");
    a.href = attachment.url;
    a.download = attachment.original_name;
    a.target = "_blank";
    a.rel = "noopener noreferrer";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  return (
    <Show when={props.show}>
      <div class="border-b border-[var(--color-border)] bg-[var(--color-bg-base)] shrink-0">
        {/* Header */}
        <div class="flex items-center justify-between px-4 py-2 border-b border-[var(--color-border)]">
          <div class="flex items-center gap-2">
            <div class="i-carbon-attachment w-4 h-4 text-[var(--color-text-secondary)]" />
            <span class="text-sm font-medium text-[var(--color-text-primary)]">
              Attachments
            </span>
            <Show when={attachments().length > 0}>
              <span class="text-xs text-[var(--color-text-muted)] bg-[var(--color-bg-elevated)] px-1.5 py-0.5 rounded-full">
                {attachments().length}
              </span>
            </Show>
          </div>
          <div class="flex items-center gap-1">
            <button
              type="button"
              disabled={uploading()}
              onClick={() => fileInputRef?.click()}
              class="flex items-center gap-1.5 px-2.5 py-1 text-xs rounded bg-[var(--color-primary)] text-white hover:opacity-90 transition-opacity disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed"
            >
              <div
                class={`w-3 h-3 ${uploading() ? "i-carbon-circle-dash animate-spin" : "i-carbon-upload"}`}
              />
              {uploading() ? "Uploading…" : "Upload"}
            </button>
            <button
              type="button"
              onClick={props.onClose}
              class="p-1.5 rounded text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-elevated)] transition-colors cursor-pointer"
              title="Close attachments"
            >
              <div class="i-carbon-close w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Hidden file input */}
        <input
          ref={fileInputRef}
          type="file"
          multiple
          class="hidden"
          onChange={(e) => handleUpload(e.currentTarget.files)}
        />

        {/* Body */}
        <div class="px-4 py-2 max-h-48 overflow-y-auto">
          <Show when={error()}>
            <p class="text-xs text-red-400 mb-2">{error()}</p>
          </Show>

          <Show when={loading()}>
            <div class="flex items-center justify-center py-4">
              <div class="i-carbon-circle-dash animate-spin w-5 h-5 text-[var(--color-text-muted)]" />
            </div>
          </Show>

          <Show when={!loading() && attachments().length === 0}>
            <div
              class="flex flex-col items-center justify-center py-4 gap-2 border-2 border-dashed border-[var(--color-border)] rounded-lg cursor-pointer hover:border-[var(--color-primary)] transition-colors"
              onClick={() => fileInputRef?.click()}
            >
              <div class="i-carbon-cloud-upload w-6 h-6 text-[var(--color-text-muted)]" />
              <p class="text-xs text-[var(--color-text-muted)]">
                No attachments yet — click to upload
              </p>
            </div>
          </Show>

          <Show when={!loading() && attachments().length > 0}>
            <div class="flex flex-wrap gap-2">
              <For each={attachments()}>
                {(attachment) => (
                  <div class="group relative flex items-center gap-2 px-2 py-1.5 rounded border border-[var(--color-border)] bg-[var(--color-bg-surface)] hover:border-[var(--color-primary)] transition-colors max-w-[220px]">
                    {/* Icon or thumbnail */}
                    <Show
                      when={isImage(attachment.mime_type)}
                      fallback={
                        <div
                          class={`${fileIcon(attachment.mime_type)} w-5 h-5 shrink-0 text-[var(--color-text-secondary)]`}
                        />
                      }
                    >
                      <img
                        src={attachment.url}
                        alt={attachment.original_name}
                        class="w-8 h-8 object-cover rounded shrink-0"
                        loading="lazy"
                      />
                    </Show>

                    {/* Name + size */}
                    <div class="flex flex-col min-w-0 flex-1">
                      <span
                        class="text-xs text-[var(--color-text-primary)] truncate max-w-[120px] cursor-pointer hover:text-[var(--color-primary)]"
                        title={
                          isInlineRenderable(attachment.mime_type)
                            ? `Insert ${attachment.original_name}`
                            : `Download ${attachment.original_name}`
                        }
                        onClick={() => handleInsert(attachment)}
                      >
                        {attachment.original_name}
                      </span>
                      <span class="text-[10px] text-[var(--color-text-muted)]">
                        {formatBytes(attachment.size)}
                        {!isInlineRenderable(attachment.mime_type) && (
                          <span class="ml-1 opacity-60">↓ download</span>
                        )}
                        {isPdf(attachment.mime_type) && (
                          <span class="ml-1 opacity-60">PDF preview</span>
                        )}
                      </span>
                    </div>

                    {/* Action buttons */}
                    <div class="flex flex-col gap-0.5">
                      {/* For PDFs: open in new tab */}
                      <Show when={isPdf(attachment.mime_type)}>
                        <a
                          href={attachment.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          onMouseDown={(e) => e.stopPropagation()}
                          onClick={(e) => e.stopPropagation()}
                          class="p-0.5 rounded text-[var(--color-text-muted)] hover:text-blue-400 hover:bg-[var(--color-bg-elevated)] cursor-pointer"
                          title="Open PDF in new tab"
                        >
                          <div class="i-carbon-launch w-3 h-3" />
                        </a>
                      </Show>
                      {/* For non-renderable files: insert as link */}
                      <Show when={!isInlineRenderable(attachment.mime_type)}>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            props.onInsert(
                              attachment.url,
                              attachment.original_name,
                              false,
                            );
                            props.onClose();
                          }}
                          class="opacity-0 group-hover:opacity-100 transition-opacity p-0.5 rounded text-[var(--color-text-muted)] hover:text-[var(--color-primary)] hover:bg-[var(--color-bg-elevated)] cursor-pointer"
                          title="Insert as link in editor"
                        >
                          <div class="i-carbon-link w-3 h-3" />
                        </button>
                      </Show>
                      {/* Delete button */}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDelete(attachment);
                        }}
                        class="opacity-0 group-hover:opacity-100 transition-opacity p-0.5 rounded text-[var(--color-text-muted)] hover:text-red-400 hover:bg-[var(--color-bg-elevated)] cursor-pointer shrink-0"
                        title="Delete attachment"
                      >
                        <div class="i-carbon-trash-can w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                )}
              </For>
            </div>
          </Show>
        </div>
      </div>
    </Show>
  );
};

export default AttachmentPanel;
