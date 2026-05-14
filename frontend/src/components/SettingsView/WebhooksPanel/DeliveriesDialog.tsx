import { For, Show } from "solid-js";
import AlertDialog from "~/components/AlertDialog";
import { formatAbsoluteDate } from "~/utils/date.utils";
import type { Webhook, Delivery } from "./types";

interface DeliveriesDialogProps {
  webhook: Webhook | null;
  deliveries: Delivery[];
  loading: boolean;
  onClose: () => void;
}

export default function DeliveriesDialog(props: DeliveriesDialogProps) {
  return (
    <AlertDialog
      isOpen={!!props.webhook}
      title="Recent deliveries"
      showActions={false}
      showCloseIcon
      onCancel={props.onClose}
      dialogClass="max-w-3xl max-h-[80vh] flex flex-col"
    >
      <p class="text-xs text-muted-body -mt-1 mb-3">{props.webhook?.url}</p>
      <div class="flex-1 overflow-y-auto min-h-0">
        <Show
          when={!props.loading}
          fallback={
            <p class="text-muted-body text-sm text-center py-8">Loading…</p>
          }
        >
          <Show
            when={props.deliveries.length > 0}
            fallback={
              <p class="text-muted-body text-sm text-center py-8">
                No deliveries yet.
              </p>
            }
          >
            <div class="overflow-x-auto">
              <table class="w-full text-sm min-w-[380px]">
                <thead>
                  <tr class="border-b border-base text-muted-body text-xs">
                    <th class="text-left pb-2 pr-4 font-medium">Event</th>
                    <th class="text-left pb-2 pr-4 font-medium">Status</th>
                    <th class="text-left pb-2 pr-4 font-medium">HTTP</th>
                    <th class="text-left pb-2 font-medium">Time</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-[var(--color-border)]">
                  <For each={props.deliveries}>
                    {(d) => (
                      <tr class="text-xs">
                        <td class="py-2 pr-4 font-mono text-secondary-body">
                          {d.event}
                        </td>
                        <td class="py-2 pr-4">
                          <span
                            class="px-2 py-0.5 rounded text-xs font-medium"
                            classList={{
                              "bg-green-500/20 text-green-400":
                                d.status === "success",
                              "bg-red-500/20 text-red-400":
                                d.status === "failed",
                              "bg-neutral-500/20 text-neutral-400":
                                d.status === "pending",
                            }}
                          >
                            {d.status}
                          </span>
                        </td>
                        <td class="py-2 pr-4 text-muted-body">
                          {d.response_status ?? "—"}
                        </td>
                        <td class="py-2 text-muted-body">
                          {d.created_at
                            ? formatAbsoluteDate(d.created_at)
                            : "—"}
                        </td>
                      </tr>
                    )}
                  </For>
                </tbody>
              </table>
            </div>
          </Show>
        </Show>
      </div>
    </AlertDialog>
  );
}
