import {
  Component,
  createSignal,
  createEffect,
  Show,
  createMemo,
} from "solid-js";

interface LinkPopupProps {
  show: boolean;
  isEdit: boolean;
  initialData: { href: string; title?: string };
  onSubmit: (href: string, title?: string) => void;
  onRemove: () => void;
  onClose: () => void;
}

const LinkPopup: Component<LinkPopupProps> = (props) => {
  const [href, setHref] = createSignal(props.initialData.href);
  const [title, setTitle] = createSignal(props.initialData.title || "");

  // Sync signals when initialData changes (e.g., switching between edit targets)
  createEffect(() => {
    setHref(props.initialData.href);
    setTitle(props.initialData.title || "");
  });

  // Compute normalized href whenever href changes
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
    if (href().trim()) {
      props.onSubmit(normalizedHref(), title() || undefined);
    }
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Enter") {
      handleSubmit();
    } else if (e.key === "Escape") {
      props.onClose();
    }
  };

  return (
    <Show when={props.show}>
      <div class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div class="bg-neutral-900 dark:bg-neutral-900 light:bg-white rounded-lg shadow-xl border border-neutral-700 dark:border-neutral-700 light:border-neutral-300 p-6 w-96">
          <h2 class="text-lg font-semibold text-white mb-4">
            {props.isEdit ? "Edit Link" : "Add Link"}
          </h2>

          <div class="space-y-4">
            <div>
              <label class="block text-sm font-medium text-neutral-300 mb-2">
                URL
              </label>
              <input
                type="url"
                value={href()}
                onInput={(e) => setHref(e.currentTarget.value)}
                onKeyDown={handleKeyDown}
                placeholder="https://example.com"
                class="w-full px-3 py-2 bg-neutral-800 border border-neutral-600 rounded text-white placeholder-neutral-500 focus:outline-none focus:border-blue-500"
                autofocus
              />
              <Show when={normalizedHref() && normalizedHref() !== href()}>
                <p class="mt-2 text-xs text-neutral-400">
                  Will be saved as:{" "}
                  <span class="text-blue-400">{normalizedHref()}</span>
                </p>
              </Show>
            </div>

            <div>
              <label class="block text-sm font-medium text-neutral-300 mb-2">
                Title (optional)
              </label>
              <input
                type="text"
                value={title()}
                onInput={(e) => setTitle(e.currentTarget.value)}
                onKeyDown={handleKeyDown}
                placeholder="Link title for tooltip"
                class="w-full px-3 py-2 bg-neutral-800 border border-neutral-600 rounded text-white placeholder-neutral-500 focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>

          <div class="flex gap-3 mt-6">
            <Show when={props.isEdit}>
              <button
                onClick={props.onRemove}
                class="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded transition-colors"
              >
                Remove
              </button>
            </Show>
            <div class="flex-1 flex gap-3">
              <button
                onClick={props.onClose}
                class="flex-1 px-4 py-2 bg-neutral-700 hover:bg-neutral-600 text-white rounded transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSubmit}
                disabled={!href().trim()}
                class="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-neutral-700 disabled:cursor-not-allowed text-white rounded transition-colors"
              >
                {props.isEdit ? "Update" : "Add"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </Show>
  );
};

export default LinkPopup;
