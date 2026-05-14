import {
  Component,
  createSignal,
  createEffect,
  Show,
  createMemo,
  For,
} from "solid-js";
import Button from "./Button";
import { api } from "~/lib/api";

interface LinkPopupProps {
  show: boolean;
  isEdit: boolean;
  initialData: { href: string; title?: string };
  onSubmit: (href: string, title?: string) => void;
  onRemove: () => void;
  onClose: () => void;
}

// Internal link: no protocol, starts with /
const isInternalPath = (url: string) =>
  url.startsWith("/") && !url.match(/^[a-z][a-z0-9+.-]*:\/\//i);

const LinkPopup: Component<LinkPopupProps> = (props) => {
  // Determine initial tab based on the existing href
  const getInitialTab = () =>
    props.initialData.href && isInternalPath(props.initialData.href)
      ? "document"
      : "url";

  const [tab, setTab] = createSignal<"url" | "document">(getInitialTab());
  const [href, setHref] = createSignal(props.initialData.href);
  const [title, setTitle] = createSignal(props.initialData.title || "");
  const [docSearch, setDocSearch] = createSignal("");
  const [allDocs, setAllDocs] = createSignal<{ name: string; path: string }[]>(
    [],
  );
  const [selectedDocPath, setSelectedDocPath] = createSignal(
    isInternalPath(props.initialData.href) ? props.initialData.href : "",
  );

  // Sync signals when initialData changes (e.g., switching between edit targets)
  createEffect(() => {
    setHref(props.initialData.href);
    setTitle(props.initialData.title || "");
    const isInternal = isInternalPath(props.initialData.href);
    setTab(isInternal ? "document" : "url");
    setSelectedDocPath(isInternal ? props.initialData.href : "");
    setDocSearch("");
  });

  // Load documents when the Document tab is opened
  createEffect(() => {
    if (tab() === "document" && allDocs().length === 0) {
      api.listAllDocuments().then((result: any) => {
        const files = (result.items || []).filter(
          (item: any) => item.type === "file",
        );
        setAllDocs(files.map((f: any) => ({ name: f.name, path: f.path })));
      });
    }
  });

  const filteredDocs = createMemo(() => {
    const q = docSearch().toLowerCase();
    if (!q) return allDocs();
    return allDocs().filter(
      (d) =>
        d.name.toLowerCase().includes(q) || d.path.toLowerCase().includes(q),
    );
  });

  // Compute normalized href whenever href changes (URL tab only)
  const normalizedHref = createMemo(() => {
    const url = href().trim();
    if (!url) return "";
    // Normalize URL: add https:// if no protocol is provided
    if (!url.match(/^[a-z][a-z0-9+.-]*:\/\//i)) {
      return "https://" + url;
    }
    return url;
  });

  const handleSubmit = () => {
    if (tab() === "document") {
      if (selectedDocPath()) {
        props.onSubmit(selectedDocPath(), title() || undefined);
      }
    } else {
      if (href().trim()) {
        props.onSubmit(normalizedHref(), title() || undefined);
      }
    }
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Enter") {
      handleSubmit();
    } else if (e.key === "Escape") {
      props.onClose();
    }
  };

  const canSubmit = () =>
    tab() === "document" ? !!selectedDocPath() : !!href().trim();

  return (
    <Show when={props.show}>
      <div class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div class="bg-surface rounded-lg shadow-xl border border-base p-6 w-96">
          <h2 class="text-lg font-semibold text-body mb-4">
            {props.isEdit ? "Edit Link" : "Add Link"}
          </h2>

          {/* Tab switcher */}
          <div class="flex border border-base rounded-md overflow-hidden mb-4">
            <button
              class={`flex-1 py-1.5 text-sm font-medium transition-colors ${tab() === "url" ? "bg-elevated text-body" : "text-muted-body hover:text-body"}`}
              onClick={() => setTab("url")}
            >
              URL
            </button>
            <button
              class={`flex-1 py-1.5 text-sm font-medium transition-colors ${tab() === "document" ? "bg-elevated text-body" : "text-muted-body hover:text-body"}`}
              onClick={() => setTab("document")}
            >
              Document
            </button>
          </div>

          <div class="space-y-4">
            <Show when={tab() === "url"}>
              <div>
                <label class="block text-sm font-medium text-secondary-body mb-2">
                  URL
                </label>
                <input
                  type="url"
                  value={href()}
                  onInput={(e) => setHref(e.currentTarget.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="https://example.com"
                  class="w-full px-3 py-2 bg-surface border border-base rounded text-body placeholder-muted-body focus:outline-none focus:border-[var(--color-primary)]"
                  autofocus
                />
                <Show when={normalizedHref() && normalizedHref() !== href()}>
                  <p class="mt-2 text-xs text-muted-body">
                    Will be saved as:{" "}
                    <span class="text-blue-400">{normalizedHref()}</span>
                  </p>
                </Show>
              </div>
            </Show>

            <Show when={tab() === "document"}>
              <div>
                <label class="block text-sm font-medium text-secondary-body mb-2">
                  Search documents
                </label>
                <input
                  type="text"
                  value={docSearch()}
                  onInput={(e) => setDocSearch(e.currentTarget.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Type to search..."
                  class="w-full px-3 py-2 bg-surface border border-base rounded text-body placeholder-muted-body focus:outline-none focus:border-[var(--color-primary)] mb-2"
                  autofocus
                />
                <div class="max-h-48 overflow-y-auto border border-base rounded">
                  <Show
                    when={filteredDocs().length > 0}
                    fallback={
                      <p class="px-3 py-2 text-sm text-muted-body">
                        No documents found
                      </p>
                    }
                  >
                    <For each={filteredDocs()}>
                      {(doc) => (
                        <button
                          class={`w-full text-left px-3 py-2 text-sm flex items-center gap-2 hover:bg-elevated transition-colors ${selectedDocPath() === doc.path ? "bg-elevated text-body" : "text-secondary-body"}`}
                          onClick={() => setSelectedDocPath(doc.path)}
                        >
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            width="14"
                            height="14"
                            viewBox="0 0 32 32"
                            style="flex-shrink:0"
                          >
                            <path
                              fill="currentColor"
                              d="M25.7 9.3l-7-7A.908.908 0 0 0 18 2H8a2.006 2.006 0 0 0-2 2v24a2.006 2.006 0 0 0 2 2h16a2.006 2.006 0 0 0 2-2V10a.908.908 0 0 0-.3-.7M18 4.4l5.6 5.6H18ZM24 28H8V4h8v6a2.006 2.006 0 0 0 2 2h6Z"
                            />
                          </svg>
                          <span class="truncate">{doc.name}</span>
                          <span class="ml-auto text-xs text-muted-body truncate max-w-28">
                            {doc.path}
                          </span>
                        </button>
                      )}
                    </For>
                  </Show>
                </div>
                <Show when={selectedDocPath()}>
                  <p class="mt-2 text-xs text-muted-body truncate">
                    Selected:{" "}
                    <span class="text-blue-400">{selectedDocPath()}</span>
                  </p>
                </Show>
              </div>
            </Show>
          </div>

          <div class="flex gap-3 mt-6">
            <div class="flex-1 flex gap-3">
              <Button
                variant="secondary"
                onClick={props.onClose}
                class="w-full justify-center"
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                onClick={handleSubmit}
                disabled={!canSubmit()}
                class="w-full justify-center"
              >
                {props.isEdit ? "Update" : "Add"}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </Show>
  );
};

export default LinkPopup;
