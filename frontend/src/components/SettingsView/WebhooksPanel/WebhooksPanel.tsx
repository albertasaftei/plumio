import { createSignal, onMount, For, Show } from "solid-js";
import { api } from "~/lib/api";
import Button from "~/components/Button";
import AlertDialog from "~/components/AlertDialog";
import Toast from "~/components/Toast";
import Toggle from "~/components/Toggle";
import { formatAbsoluteDate } from "~/utils/date.utils";
import WebhookFormDialog from "./WebhookFormDialog";
import DeliveriesDialog from "./DeliveriesDialog";
import type { Webhook, Delivery, FormState } from "./types";

function emptyForm(): FormState {
  return {
    name: "",
    url: "",
    secret: "",
    events: [],
    active: true,
  };
}

export default function WebhooksPanel() {
  const [webhooks, setWebhooks] = createSignal<Webhook[]>([]);
  const [loading, setLoading] = createSignal(true);
  const [toast, setToast] = createSignal<{
    message: string;
    type: "success" | "error" | "info" | "warning";
  } | null>(null);

  // Form state (shared for create + edit)
  const [showForm, setShowForm] = createSignal(false);
  const [editingId, setEditingId] = createSignal<number | null>(null);
  const [form, setForm] = createSignal(emptyForm());
  const [saving, setSaving] = createSignal(false);
  const [formError, setFormError] = createSignal("");
  const [showSecret, setShowSecret] = createSignal(false);

  // Delete dialog
  const [deleteDialog, setDeleteDialog] = createSignal<{
    isOpen: boolean;
    webhook: Webhook | null;
  }>({ isOpen: false, webhook: null });
  const [deleting, setDeleting] = createSignal(false);

  // Deliveries drawer
  const [deliveriesWebhook, setDeliveriesWebhook] =
    createSignal<Webhook | null>(null);
  const [deliveries, setDeliveries] = createSignal<Delivery[]>([]);
  const [deliveriesLoading, setDeliveriesLoading] = createSignal(false);

  // Test ping
  const [testingId, setTestingId] = createSignal<number | null>(null);

  onMount(async () => {
    await loadWebhooks();
  });

  const loadWebhooks = async () => {
    setLoading(true);
    try {
      const { webhooks: data } = await api.listWebhooks();
      setWebhooks(data);
    } catch {
      setToast({ message: "Failed to load webhooks", type: "error" });
    } finally {
      setLoading(false);
    }
  };

  const openCreate = () => {
    setEditingId(null);
    setForm(emptyForm());
    setFormError("");
    setShowSecret(false);
    setShowForm(true);
  };

  const openEdit = (wh: Webhook) => {
    setEditingId(wh.id);
    setForm({
      name: wh.name,
      url: wh.url,
      secret: "",
      events: [...wh.events],
      active: wh.active === 1,
    });
    setFormError("");
    setShowSecret(false);
    setShowForm(true);
  };

  const closeForm = () => {
    setShowForm(false);
    setEditingId(null);
  };

  const toggleEvent = (event: string) => {
    const current = form().events;
    if (current.includes(event)) {
      setForm({ ...form(), events: current.filter((e) => e !== event) });
    } else {
      setForm({ ...form(), events: [...current, event] });
    }
  };

  const toggleGroupEvents = (events: readonly string[]) => {
    const current = form().events;
    const allSelected = events.every((e) => current.includes(e));
    if (allSelected) {
      setForm({
        ...form(),
        events: current.filter((e) => !events.includes(e)),
      });
    } else {
      const toAdd = events.filter((e) => !current.includes(e));
      setForm({ ...form(), events: [...current, ...toAdd] });
    }
  };

  const handleSubmit = async (e: Event) => {
    e.preventDefault();
    const f = form();

    if (!f.name.trim()) {
      setFormError("Name is required.");
      return;
    }
    if (!f.url.trim()) {
      setFormError("URL is required.");
      return;
    }
    if (f.events.length === 0) {
      setFormError("Select at least one event.");
      return;
    }
    const id = editingId();
    if (!id && f.secret.length < 8) {
      setFormError("Secret must be at least 8 characters.");
      return;
    }

    setFormError("");
    setSaving(true);
    try {
      if (id) {
        const payload: Parameters<typeof api.updateWebhook>[1] = {
          name: f.name.trim(),
          url: f.url.trim(),
          events: f.events,
          active: f.active,
        };
        if (f.secret.trim()) {
          payload.secret = f.secret.trim();
        }
        const { webhook } = await api.updateWebhook(id, payload);
        setWebhooks((prev) => prev.map((w) => (w.id === id ? webhook : w)));
        setToast({ message: "Webhook updated", type: "success" });
      } else {
        const { webhook } = await api.createWebhook({
          name: f.name.trim(),
          url: f.url.trim(),
          secret: f.secret.trim(),
          events: f.events,
        });
        setWebhooks((prev) => [webhook, ...prev]);
        setToast({ message: "Webhook created", type: "success" });
      }
      closeForm();
    } catch (err: any) {
      setFormError(err.message || "Failed to save webhook.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    const wh = deleteDialog().webhook;
    if (!wh) return;
    setDeleting(true);
    try {
      await api.deleteWebhook(wh.id);
      setWebhooks((prev) => prev.filter((w) => w.id !== wh.id));
      setDeleteDialog({ isOpen: false, webhook: null });
      setToast({ message: "Webhook deleted", type: "success" });
    } catch (err: any) {
      setToast({
        message: err.message || "Failed to delete webhook",
        type: "error",
      });
    } finally {
      setDeleting(false);
    }
  };

  const handleTest = async (wh: Webhook) => {
    setTestingId(wh.id);
    try {
      await api.testWebhook(wh.id);
      setToast({ message: "Test ping sent", type: "success" });
    } catch (err: any) {
      setToast({
        message: err.message || "Failed to send test ping",
        type: "error",
      });
    } finally {
      setTestingId(null);
    }
  };

  const openDeliveries = async (wh: Webhook) => {
    setDeliveriesWebhook(wh);
    setDeliveriesLoading(true);
    try {
      const { deliveries: data } = await api.getWebhookDeliveries(wh.id);
      setDeliveries(data);
    } catch {
      setDeliveries([]);
    } finally {
      setDeliveriesLoading(false);
    }
  };

  const handleToggleActive = async (wh: Webhook) => {
    const newActive = wh.active !== 1;
    try {
      const { webhook } = await api.updateWebhook(wh.id, { active: newActive });
      setWebhooks((prev) => prev.map((w) => (w.id === wh.id ? webhook : w)));
    } catch (err: any) {
      setToast({
        message: err.message || "Failed to update webhook",
        type: "error",
      });
    }
  };

  return (
    <div class="space-y-4">
      <Show when={toast()}>
        {(t) => (
          <Toast
            message={t().message}
            type={t().type}
            onClose={() => setToast(null)}
          />
        )}
      </Show>

      {/* Header */}
      <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <p class="text-sm text-muted-body">
          Receive HTTP POST requests when events occur in your organization.
        </p>
        <Button
          onClick={openCreate}
          variant="primary"
          size="md"
          class="self-start sm:self-auto flex-shrink-0"
        >
          <div class="i-carbon-add w-4 h-4 mr-2" />
          Add webhook
        </Button>
      </div>

      {/* Webhook list */}
      <Show
        when={!loading()}
        fallback={
          <div class="text-muted-body text-sm py-8 text-center">Loading…</div>
        }
      >
        <Show
          when={webhooks().length > 0}
          fallback={
            <div class="text-center py-12 border border-dashed border-base rounded-lg">
              <div class="i-carbon-webhook w-10 h-10 mx-auto mb-3 opacity-30 text-primary" />
              <p class="text-secondary-body text-sm">No webhooks yet.</p>
              <p class="text-muted-body text-xs mt-1">
                Add one to start receiving event notifications.
              </p>
            </div>
          }
        >
          <div class="space-y-2">
            <For each={webhooks()}>
              {(wh) => (
                <div class="bg-elevated rounded-lg border border-base p-4 flex items-start gap-3">
                  {/* Status dot */}
                  <div class="mt-1.5 flex-shrink-0">
                    <div
                      class="w-2 h-2 rounded-full"
                      classList={{
                        "bg-green-400": wh.active === 1,
                        "bg-red-400": wh.active !== 1,
                      }}
                      title={wh.active === 1 ? "Active" : "Inactive"}
                    />
                  </div>

                  {/* Details + Actions */}
                  <div class="flex-1 min-w-0 flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
                    {/* Details */}
                    <div class="flex-1 min-w-0">
                      <div class="flex items-center gap-2 flex-wrap">
                        <span class="font-medium text-body text-sm">
                          {wh.name}
                        </span>
                        <span class="text-xs text-muted-body bg-surface px-2 py-0.5 rounded border border-base">
                          {wh.events.length} event
                          {wh.events.length !== 1 ? "s" : ""}
                        </span>
                      </div>
                      <p
                        class="text-xs text-muted-body mt-0.5 truncate"
                        title={wh.url}
                      >
                        {wh.url}
                      </p>
                      <p class="text-xs text-muted-body mt-0.5">
                        Created {formatAbsoluteDate(wh.created_at)}
                      </p>
                    </div>

                    {/* Actions */}
                    <div class="flex items-center gap-2 flex-wrap sm:flex-nowrap sm:flex-shrink-0">
                      <Toggle
                        enabled={wh.active === 1}
                        onChange={() => handleToggleActive(wh)}
                      />
                      <Button
                        onClick={() => handleTest(wh)}
                        variant="secondary"
                        size="sm"
                        title="Send test ping"
                        disabled={testingId() === wh.id}
                      >
                        <Show
                          when={testingId() !== wh.id}
                          fallback={
                            <div class="i-carbon-circle-dash w-5 h-5 animate-spin" />
                          }
                        >
                          <div class="i-carbon-send-alt w-5 h-5" />
                        </Show>
                      </Button>
                      <Button
                        onClick={() => openDeliveries(wh)}
                        variant="secondary"
                        size="sm"
                        title="View deliveries"
                      >
                        <div class="i-carbon-data-table w-5 h-5" />
                      </Button>
                      <Button
                        onClick={() => openEdit(wh)}
                        variant="secondary"
                        size="sm"
                        title="Edit"
                      >
                        <div class="i-carbon-edit w-5 h-5" />
                      </Button>
                      <Button
                        onClick={() =>
                          setDeleteDialog({ isOpen: true, webhook: wh })
                        }
                        variant="secondary"
                        size="sm"
                        title="Delete"
                        class="text-red-400 hover:text-red-300"
                      >
                        <div class="i-carbon-trash-can w-5 h-5" />
                      </Button>
                    </div>
                  </div>
                </div>
              )}
            </For>
          </div>
        </Show>
      </Show>

      <WebhookFormDialog
        show={showForm()}
        editingId={editingId()}
        form={form()}
        setForm={setForm}
        saving={saving()}
        formError={formError()}
        showSecret={showSecret()}
        setShowSecret={setShowSecret}
        onClose={closeForm}
        onSubmit={handleSubmit}
        onToggleEvent={toggleEvent}
        onToggleGroupEvents={toggleGroupEvents}
      />

      {/* Delete confirmation */}
      <AlertDialog
        isOpen={deleteDialog().isOpen}
        title="Delete webhook"
        message={`Delete "${deleteDialog().webhook?.name}"? This will also remove all delivery logs.`}
        onConfirm={handleDelete}
        onCancel={() => setDeleteDialog({ isOpen: false, webhook: null })}
        confirmText={deleting() ? "Deleting…" : "Delete"}
        variant="danger"
      />

      <DeliveriesDialog
        webhook={deliveriesWebhook()}
        deliveries={deliveries()}
        loading={deliveriesLoading()}
        onClose={() => setDeliveriesWebhook(null)}
      />
    </div>
  );
}
