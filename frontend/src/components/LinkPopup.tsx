import {
  Component,
  createSignal,
  createEffect,
  Show,
  createMemo,
} from "solid-js";
import Button from "./Button";

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
        <div class="bg-surface rounded-lg shadow-xl border border-base p-6 w-96">
          <h2 class="text-lg font-semibold text-[var(--color-text-primary)] mb-4">
            {props.isEdit ? "Edit Link" : "Add Link"}
          </h2>

          <div class="space-y-4">
            <div>
              <label class="block text-sm font-medium text-[var(--color-text-secondary)] mb-2">
                URL
              </label>
              <input
                type="url"
                value={href()}
                onInput={(e) => setHref(e.currentTarget.value)}
                onKeyDown={handleKeyDown}
                placeholder="https://example.com"
                class="w-full px-3 py-2 bg-[var(--color-bg-surface)] border border-[var(--color-border)] rounded text-[var(--color-text-primary)] placeholder-[var(--color-text-muted)] focus:outline-none focus:border-[var(--color-primary)]"
                autofocus
              />
              <Show when={normalizedHref() && normalizedHref() !== href()}>
                <p class="mt-2 text-xs text-[var(--color-text-muted)]">
                  Will be saved as:{" "}
                  <span class="text-blue-400">{normalizedHref()}</span>
                </p>
              </Show>
            </div>
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
                disabled={!href().trim()}
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
