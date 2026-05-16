import { createSignal, onMount, For, Show } from "solid-js";
import { api } from "~/lib/api";
import Button from "~/components/Button";
import AlertDialog from "~/components/AlertDialog";
import Toast from "~/components/Toast";
import { formatRelativeDate, formatAbsoluteDate } from "~/utils/date.utils";
import { useI18n } from "~/i18n";
import CreateApiKeyDialog from "./CreateApiKeyDialog";
import ApiKeyCreatedDialog from "./ApiKeyCreatedDialog";
import type { ApiKey } from "./types";

export default function ApiKeysPanel() {
  const { t } = useI18n();
  const [keys, setKeys] = createSignal<ApiKey[]>([]);
  const [loading, setLoading] = createSignal(true);
  const [toast, setToast] = createSignal<{
    message: string;
    type: "success" | "error" | "info" | "warning";
  } | null>(null);

  // Create form state
  const [showCreate, setShowCreate] = createSignal(false);
  const [formName, setFormName] = createSignal("");
  const [formPermissions, setFormPermissions] = createSignal<string[]>([]);
  const [formExpiresAt, setFormExpiresAt] = createSignal("");
  const [saving, setSaving] = createSignal(false);
  const [formError, setFormError] = createSignal("");

  // Created key one-time display
  const [createdKey, setCreatedKey] = createSignal("");
  const [showCreated, setShowCreated] = createSignal(false);

  // Revoke dialog
  const [revokeDialog, setRevokeDialog] = createSignal<{
    isOpen: boolean;
    key: ApiKey | null;
  }>({ isOpen: false, key: null });
  const [revoking, setRevoking] = createSignal(false);

  onMount(async () => {
    await loadKeys();
  });

  const loadKeys = async () => {
    setLoading(true);
    try {
      const { apiKeys } = await api.listApiKeys();
      setKeys(apiKeys);
    } catch {
      setToast({ message: t("apiKeys.failedLoad"), type: "error" });
    } finally {
      setLoading(false);
    }
  };

  const openCreate = () => {
    setFormName("");
    setFormPermissions([]);
    setFormExpiresAt("");
    setFormError("");
    setShowCreate(true);
  };

  const handleCreate = async (e: Event) => {
    e.preventDefault();
    if (!formName().trim()) {
      setFormError(t("apiKeys.errorNameRequired"));
      return;
    }
    if (formPermissions().length === 0) {
      setFormError(t("apiKeys.errorNoPermissions"));
      return;
    }
    setFormError("");
    setSaving(true);
    try {
      const { apiKey } = await api.createApiKey({
        name: formName().trim(),
        permissions: formPermissions(),
        expires_at: formExpiresAt() || null,
      });
      setKeys((prev) => [
        {
          id: apiKey.id,
          user_id: apiKey.user_id,
          name: apiKey.name,
          key_prefix: apiKey.key_prefix,
          permissions: apiKey.permissions,
          created_at: apiKey.created_at,
          last_used_at: apiKey.last_used_at,
          expires_at: apiKey.expires_at,
        },
        ...prev,
      ]);
      setShowCreate(false);
      setCreatedKey(apiKey.key);
      setShowCreated(true);
      setToast({ message: t("apiKeys.toastCreated"), type: "success" });
    } catch {
      setFormError(t("apiKeys.failedCreate"));
    } finally {
      setSaving(false);
    }
  };

  const openRevoke = (key: ApiKey) => {
    setRevokeDialog({ isOpen: true, key });
  };

  const handleRevoke = async () => {
    const key = revokeDialog().key;
    if (!key) return;
    setRevoking(true);
    try {
      await api.deleteApiKey(key.id);
      setKeys((prev) => prev.filter((k) => k.id !== key.id));
      setRevokeDialog({ isOpen: false, key: null });
      setToast({ message: t("apiKeys.toastRevoked"), type: "success" });
    } catch {
      setToast({ message: t("apiKeys.failedRevoke"), type: "error" });
    } finally {
      setRevoking(false);
    }
  };

  return (
    <div class="space-y-6">
      <Show when={toast()}>
        <Toast
          message={toast()?.message ?? ""}
          type={toast()?.type ?? "info"}
          onClose={() => setToast(null)}
        />
      </Show>

      <CreateApiKeyDialog
        show={showCreate()}
        name={formName()}
        setName={setFormName}
        permissions={formPermissions()}
        setPermissions={setFormPermissions}
        expiresAt={formExpiresAt()}
        setExpiresAt={setFormExpiresAt}
        saving={saving()}
        error={formError()}
        onClose={() => setShowCreate(false)}
        onSubmit={handleCreate}
      />

      <ApiKeyCreatedDialog
        show={showCreated()}
        keyValue={createdKey()}
        onClose={() => {
          setShowCreated(false);
          setCreatedKey("");
        }}
      />

      {/* Revoke confirmation */}
      <AlertDialog
        isOpen={revokeDialog().isOpen}
        title={t("apiKeys.revokeTitle")}
        confirmText={revoking() ? t("apiKeys.revoking") : t("apiKeys.revoke")}
        cancelText={t("common.cancel")}
        onConfirm={handleRevoke}
        onCancel={() => setRevokeDialog({ isOpen: false, key: null })}
        variant="danger"
      >
        <p class="text-sm text-secondary-body">
          {t("apiKeys.revokeConfirm").replace(
            "{{name}}",
            revokeDialog().key?.name ?? "",
          )}
        </p>
      </AlertDialog>

      {/* Header */}
      <div class="flex items-center justify-between">
        <p class="text-sm text-secondary-body">{t("apiKeys.description")}</p>
        <Button variant="primary" size="md" onClick={openCreate}>
          <div class="i-carbon-add w-4 h-4" />
          <span class="ml-1.5">{t("apiKeys.createKey")}</span>
        </Button>
      </div>

      {/* Key list */}
      <Show
        when={!loading()}
        fallback={<p class="text-sm text-muted-body">{t("common.loading")}</p>}
      >
        <Show
          when={keys().length > 0}
          fallback={
            <div class="text-center py-12 text-muted-body">
              <div class="i-carbon-api w-12 h-12 mx-auto mb-3 opacity-30" />
              <p class="font-medium">{t("apiKeys.empty")}</p>
              <p class="text-sm mt-1">{t("apiKeys.emptyHint")}</p>
            </div>
          }
        >
          <div class="space-y-3">
            <For each={keys()}>
              {(key) => (
                <div class="border border-base rounded-lg p-4 bg-surface">
                  <div class="flex items-start justify-between gap-4">
                    <div class="flex-1 min-w-0">
                      {/* Name + prefix */}
                      <div class="flex items-center gap-2 mb-1">
                        <span class="font-medium text-body">{key.name}</span>
                        <code class="text-xs bg-base border border-subtle px-1.5 py-0.5 rounded text-muted-body font-mono">
                          {key.key_prefix}…
                        </code>
                      </div>

                      {/* Permission badges */}
                      <div class="flex flex-wrap gap-1 mb-2">
                        <For each={key.permissions}>
                          {(perm) => (
                            <span class="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
                              {perm}
                            </span>
                          )}
                        </For>
                      </div>

                      {/* Dates */}
                      <div class="flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-muted-body">
                        <span>
                          {t("apiKeys.createdAt").replace(
                            "{{date}}",
                            formatAbsoluteDate(key.created_at),
                          )}
                        </span>
                        <span>
                          {key.last_used_at
                            ? t("apiKeys.lastUsed").replace(
                                "{{date}}",
                                formatRelativeDate(key.last_used_at),
                              )
                            : t("apiKeys.neverUsed")}
                        </span>
                        <span>
                          {key.expires_at
                            ? t("apiKeys.expires").replace(
                                "{{date}}",
                                formatAbsoluteDate(key.expires_at),
                              )
                            : t("apiKeys.noExpiry")}
                        </span>
                      </div>
                    </div>

                    {/* Revoke button */}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => openRevoke(key)}
                      title={t("apiKeys.revokeTooltip")}
                      class="text-red-400 hover:text-red-300 hover:bg-red-950/30 flex-shrink-0"
                    >
                      <div class="i-carbon-trash-can w-4 h-4" />
                    </Button>
                  </div>
                </div>
              )}
            </For>
          </div>
        </Show>
      </Show>
    </div>
  );
}
