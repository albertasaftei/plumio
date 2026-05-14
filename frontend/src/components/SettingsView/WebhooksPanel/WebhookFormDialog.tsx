import { Show, For } from "solid-js";
import Button from "~/components/Button";
import AlertDialog from "~/components/AlertDialog";
import { EVENT_GROUPS, type FormState } from "./types";

interface WebhookFormDialogProps {
  show: boolean;
  editingId: number | null;
  form: FormState;
  setForm: (f: FormState) => void;
  saving: boolean;
  formError: string;
  showSecret: boolean;
  setShowSecret: (v: boolean) => void;
  onClose: () => void;
  onSubmit: (e: Event) => void;
  onToggleEvent: (event: string) => void;
  onToggleGroupEvents: (events: readonly string[]) => void;
}

export default function WebhookFormDialog(props: WebhookFormDialogProps) {
  return (
    <AlertDialog
      isOpen={props.show}
      title={props.editingId ? "Edit webhook" : "New webhook"}
      showActions={false}
      showCloseIcon
      onCancel={props.onClose}
      dialogClass="max-w-2xl max-h-[90vh] overflow-y-auto"
    >
      <form onSubmit={props.onSubmit} class="space-y-4">
        {/* Name */}
        <div>
          <label class="block text-sm font-medium text-secondary-body mb-1">
            Name
          </label>
          <input
            type="text"
            value={props.form.name}
            onInput={(e) =>
              props.setForm({ ...props.form, name: e.currentTarget.value })
            }
            placeholder="My webhook"
            class="w-full px-3 py-2 bg-base border border-base rounded-md text-body text-sm placeholder:text-muted-body focus:outline-none focus:border-primary"
          />
        </div>

        {/* URL */}
        <div>
          <label class="block text-sm font-medium text-secondary-body mb-1">
            Payload URL
          </label>
          <input
            type="url"
            value={props.form.url}
            onInput={(e) =>
              props.setForm({ ...props.form, url: e.currentTarget.value })
            }
            placeholder="https://example.com/webhook"
            class="w-full px-3 py-2 bg-base border border-base rounded-md text-body text-sm placeholder:text-muted-body focus:outline-none focus:border-primary"
          />
        </div>

        {/* Secret */}
        <div>
          <label class="block text-sm font-medium text-secondary-body mb-1">
            Secret
            {props.editingId ? " (leave blank to keep unchanged)" : ""}
          </label>
          <div class="relative">
            <input
              type={props.showSecret ? "text" : "password"}
              value={props.form.secret}
              onInput={(e) =>
                props.setForm({
                  ...props.form,
                  secret: e.currentTarget.value,
                })
              }
              placeholder={
                props.editingId
                  ? "Enter new secret to change"
                  : "Min. 8 characters"
              }
              class="w-full px-3 py-2 pr-10 bg-base border border-base rounded-md text-body text-sm placeholder:text-muted-body focus:outline-none focus:border-primary"
            />
            <button
              type="button"
              onClick={() => props.setShowSecret(!props.showSecret)}
              class="absolute right-2 top-1/2 -translate-y-1/2 text-muted-body hover:text-body"
            >
              <div
                class="w-4 h-4"
                classList={{
                  "i-carbon-view": !props.showSecret,
                  "i-carbon-view-off": props.showSecret,
                }}
              />
            </button>
          </div>
          <p class="text-xs text-muted-body mt-1">
            Used to sign requests via{" "}
            <code class="bg-base px-1 rounded text-xs">X-Plumio-Signature</code>
            . Verify it on your server to confirm authenticity.
          </p>
        </div>

        {/* Events */}
        <div>
          <label class="block text-sm font-medium text-secondary-body mb-2">
            Events
          </label>
          <div class="space-y-3">
            <For each={EVENT_GROUPS}>
              {(group) => {
                const groupSelected = () =>
                  group.events.every((e) => props.form.events.includes(e));
                return (
                  <div class="bg-base rounded-md p-3 border border-base">
                    <button
                      type="button"
                      onClick={() => props.onToggleGroupEvents(group.events)}
                      class="flex items-center gap-2 mb-2 text-sm font-medium text-body hover:text-blue-400 cursor-pointer transition-colors"
                    >
                      <div
                        class="w-4 h-4 flex-shrink-0"
                        classList={{
                          "i-carbon-checkbox-checked text-blue-400":
                            groupSelected(),
                          "i-carbon-checkbox": !groupSelected(),
                        }}
                      />
                      {group.label}
                    </button>
                    <div class="grid grid-cols-2 gap-1">
                      <For each={group.events as unknown as string[]}>
                        {(event) => (
                          <label class="flex items-center gap-2 cursor-pointer group">
                            <input
                              type="checkbox"
                              checked={props.form.events.includes(event)}
                              onChange={() => props.onToggleEvent(event)}
                              class="sr-only"
                            />
                            <div
                              class="w-4 h-4 flex-shrink-0 transition-colors"
                              classList={{
                                "i-carbon-checkbox-checked text-blue-400":
                                  props.form.events.includes(event),
                                "i-carbon-checkbox text-muted-body group-hover:text-body":
                                  !props.form.events.includes(event),
                              }}
                            />
                            <span class="text-xs text-secondary-body font-mono">
                              {event}
                            </span>
                          </label>
                        )}
                      </For>
                    </div>
                  </div>
                );
              }}
            </For>
          </div>
        </div>

        {/* Error */}
        <Show when={props.formError}>
          <p class="text-sm text-red-400">{props.formError}</p>
        </Show>

        {/* Actions */}
        <div class="flex gap-3 justify-end pt-2">
          <Button
            onClick={props.onClose}
            variant="secondary"
            size="md"
            type="button"
          >
            Cancel
          </Button>
          <Button
            type="submit"
            variant="primary"
            size="md"
            disabled={props.saving}
          >
            {props.saving
              ? "Saving…"
              : props.editingId
                ? "Save changes"
                : "Create webhook"}
          </Button>
        </div>
      </form>
    </AlertDialog>
  );
}
