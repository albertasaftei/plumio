import { createSignal, onMount, For, Show } from "solid-js";
import { api } from "~/lib/api";
import Button from "~/components/Button";
import AlertDialog from "~/components/AlertDialog";
import Toast from "~/components/Toast";
import Toggle from "~/components/Toggle";
import { formatAbsoluteDate } from "~/utils/date.utils";
import { useI18n } from "~/i18n";
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
  const { t } = useI18n();
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
      setToast({ message: t("webhooks.failedLoad"), type: "error" });
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
      setFormError(t("webhooks.errorNameRequired"));
      return;
    }
    if (!f.url.trim()) {
      setFormError(t("webhooks.errorUrlRequired"));
      return;
    }
    if (f.events.length === 0) {
      setFormError(t("webhooks.errorNoEvents"));
      return;
    }
    const id = editingId();
    if (!id && f.secret.length < 8) {
      setFormError(t("webhooks.errorSecretTooShort"));
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
        setToast({ message: t("webhooks.toastUpdated"), type: "success" });
      } else {
        const { webhook } = await api.createWebhook({
          name: f.name.trim(),
          url: f.url.trim(),
          secret: f.secret.trim(),
          events: f.events,
        });
        setWebhooks((prev) => [webhook, ...prev]);
        setToast({ message: t("webhooks.toastCreated"), type: "success" });
      }
      closeForm();
    } catch (err: any) {
      setFormError(err.message || t("webhooks.failedSave"));
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
      setToast({ message: t("webhooks.toastDeleted"), type: "success" });
    } catch (err: any) {
      setToast({
        message: err.message || t("webhooks.failedDelete"),
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
      setToast({ message: t("webhooks.toastTestPingSent"), type: "success" });
    } catch (err: any) {
      setToast({
        message: err.message || t("webhooks.failedTestPing"),
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
        message: err.message || t("webhooks.failedUpdate"),
        type: "error",
      });
    }
  };

  return (
    <div class="space-y-4">
      <Show when={toast()}>
        {(toastMsg) => (
          <Toast
            message={toastMsg().message}
            type={toastMsg().type}
            onClose={() => setToast(null)}
          />
        )}
      </Show>

      {/* Header */}
      <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <p class="text-sm text-muted-body">{t("webhooks.description")}</p>
        <Button
          onClick={openCreate}
          variant="primary"
          size="md"
          class="self-start sm:self-auto flex-shrink-0"
        >
          <div class="i-carbon-add w-4 h-4 mr-2" />
          {t("webhooks.addWebhook")}
        </Button>
      </div>

      {/* Webhook list */}
      <Show
        when={!loading()}
        fallback={
          <div class="text-muted-body text-sm py-8 text-center">
            {t("common.loading")}
          </div>
        }
      >
        <Show
          when={webhooks().length > 0}
          fallback={
            <div class="text-center py-12 border border-dashed border-base rounded-lg">
              <div class="i-carbon-webhook w-10 h-10 mx-auto mb-3 opacity-30 text-primary" />
              <p class="text-secondary-body text-sm">{t("webhooks.empty")}</p>
              <p class="text-muted-body text-xs mt-1">
                {t("webhooks.emptyHint")}
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
                      title={
                        wh.active === 1
                          ? t("webhooks.titleActive")
                          : t("webhooks.titleInactive")
                      }
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
                          {t(
                            wh.events.length !== 1
                              ? "webhooks.eventCount_other"
                              : "webhooks.eventCount_one",
                            { count: wh.events.length },
                          )}
                        </span>
                      </div>
                      <p
                        class="text-xs text-muted-body mt-0.5 truncate"
                        title={wh.url}
                      >
                        {wh.url}
                      </p>
                      <p class="text-xs text-muted-body mt-0.5">
                        {t("webhooks.createdAt", {
                          date: formatAbsoluteDate(wh.created_at),
                        })}
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
                        title={t("webhooks.titleTestPing")}
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
                        title={t("webhooks.titleViewDeliveries")}
                      >
                        <div class="i-carbon-data-table w-5 h-5" />
                      </Button>
                      <Button
                        onClick={() => openEdit(wh)}
                        variant="secondary"
                        size="sm"
                        title={t("webhooks.titleEdit")}
                      >
                        <div class="i-carbon-edit w-5 h-5" />
                      </Button>
                      <Button
                        onClick={() =>
                          setDeleteDialog({ isOpen: true, webhook: wh })
                        }
                        variant="secondary"
                        size="sm"
                        title={t("webhooks.titleDelete")}
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
        title={t("webhooks.deleteTitle")}
        message={t("webhooks.deleteConfirm", {
          name: deleteDialog().webhook?.name ?? "",
        })}
        onConfirm={handleDelete}
        onCancel={() => setDeleteDialog({ isOpen: false, webhook: null })}
        confirmText={deleting() ? t("webhooks.deleting") : t("common.delete")}
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
