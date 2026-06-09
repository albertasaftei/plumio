import { createSignal, Show, For, Switch, Match, onMount } from "solid-js";
import Button from "~/components/Button";
import Toast from "~/components/Toast";
import Toggle from "~/components/Toggle";
import { api } from "~/lib/api";

type Provider = "s3" | "s3-compatible" | "dropbox" | "gdrive" | "onedrive";
type Schedule = "manual" | "0 * * * *" | "0 */6 * * *" | "0 0 * * *";

interface SyncStatus {
  configured: boolean;
  enabled: boolean;
  schedule: string | null;
  scheduleLabel: string | null;
  lastSyncAt: string | null;
  lastLog: {
    id: number;
    status: "running" | "success" | "error";
    files_uploaded: number;
    error_message: string | null;
    started_at: string;
    completed_at: string | null;
  } | null;
}

interface SyncLog {
  id: number;
  provider: string;
  status: "running" | "success" | "error";
  files_uploaded: number;
  error_message: string | null;
  started_at: string;
  completed_at: string | null;
}

interface CurrentConfig {
  provider: Provider;
  enabled: boolean;
  schedule: string;
  remotePrefix: string;
  credentials: Record<string, string>;
}

const PROVIDERS: Array<{ value: Provider; label: string; icon: string }> = [
  { value: "s3", label: "AWS S3", icon: "i-carbon-cloud-upload" },
  {
    value: "s3-compatible",
    label: "S3-Compatible (R2, MinIO, B2)",
    icon: "i-carbon-cloud-upload",
  },
  { value: "dropbox", label: "Dropbox", icon: "i-carbon-logo-dropbox" },
  { value: "gdrive", label: "Google Drive", icon: "i-carbon-cloud" },
  { value: "onedrive", label: "OneDrive / Microsoft", icon: "i-carbon-cloud" },
];

const SCHEDULES: Array<{ value: Schedule; label: string }> = [
  { value: "manual", label: "Manual only" },
  { value: "0 * * * *", label: "Every hour" },
  { value: "0 */6 * * *", label: "Every 6 hours" },
  { value: "0 0 * * *", label: "Daily" },
];

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString();
}

function StatusBadge(props: { status: "running" | "success" | "error" }) {
  const cls = {
    running: "bg-blue-500/20 text-blue-400 border-blue-500/30",
    success: "bg-green-500/20 text-green-400 border-green-500/30",
    error: "bg-red-500/20 text-red-400 border-red-500/30",
  }[props.status];
  const label = { running: "Running", success: "Success", error: "Error" }[
    props.status
  ];
  return (
    <span class={`text-xs px-2 py-0.5 rounded-full border font-medium ${cls}`}>
      {label}
    </span>
  );
}

export default function SyncPanel() {
  const [status, setStatus] = createSignal<SyncStatus | null>(null);
  const [logs, setLogs] = createSignal<SyncLog[]>([]);
  const [currentConfig, setCurrentConfig] = createSignal<CurrentConfig | null>(
    null,
  );
  const [loading, setLoading] = createSignal(true);
  const [triggering, setTriggering] = createSignal(false);
  const [saving, setSaving] = createSignal(false);
  const [testing, setTesting] = createSignal(false);
  const [showForm, setShowForm] = createSignal(false);
  const [toast, setToast] = createSignal<{
    message: string;
    type: "success" | "error" | "info" | "warning";
  } | null>(null);

  // Form state
  const [provider, setProvider] = createSignal<Provider>("s3");
  const [schedule, setSchedule] = createSignal<Schedule>("manual");
  const [remotePrefix, setRemotePrefix] = createSignal("");
  const [enabled, setEnabled] = createSignal(true);

  // Credentials form fields
  const [s3AccessKey, setS3AccessKey] = createSignal("");
  const [s3SecretKey, setS3SecretKey] = createSignal("");
  const [s3Bucket, setS3Bucket] = createSignal("");
  const [s3Region, setS3Region] = createSignal("us-east-1");
  const [s3Endpoint, setS3Endpoint] = createSignal("");
  const [dbxAppKey, setDbxAppKey] = createSignal("");
  const [dbxAppSecret, setDbxAppSecret] = createSignal("");
  const [gdClientId, setGdClientId] = createSignal("");
  const [gdClientSecret, setGdClientSecret] = createSignal("");
  const [gdFolderId, setGdFolderId] = createSignal("");
  const [odClientId, setOdClientId] = createSignal("");
  const [odClientSecret, setOdClientSecret] = createSignal("");
  const [odTenantId, setOdTenantId] = createSignal("common");
  const [odFolderId, setOdFolderId] = createSignal("");

  const loadData = async () => {
    setLoading(true);
    try {
      const [statusData, configData, logsData] = await Promise.all([
        api.getSyncStatus(),
        api.getSyncConfig(),
        api.getSyncLog(10),
      ]);
      setStatus(statusData);
      setLogs(logsData.logs);
      if (configData.config) {
        setCurrentConfig(configData.config as CurrentConfig);
      }
    } catch {
      setToast({ message: "Failed to load sync configuration", type: "error" });
    } finally {
      setLoading(false);
    }
  };

  onMount(() => {
    loadData();
    // Check if we're returning from an OAuth flow
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const connected = params.get("sync_connected");
      const error = params.get("sync_error");
      if (connected) {
        setToast({
          message: `Successfully connected to ${connected}! Sync is now configured.`,
          type: "success",
        });
        window.history.replaceState({}, "", window.location.pathname);
      } else if (error) {
        setToast({ message: `OAuth error: ${error}`, type: "error" });
        window.history.replaceState({}, "", window.location.pathname);
      }
    }
  });

  const openForm = () => {
    const cfg = currentConfig();
    if (cfg) {
      setProvider(cfg.provider);
      setSchedule((cfg.schedule as Schedule) ?? "manual");
      setRemotePrefix(cfg.remotePrefix ?? "");
      setEnabled(cfg.enabled);
    }
    setShowForm(true);
  };

  const buildCredentials = (): Record<string, string> => {
    switch (provider()) {
      case "s3":
      case "s3-compatible":
        return {
          accessKeyId: s3AccessKey(),
          secretAccessKey: s3SecretKey(),
          bucket: s3Bucket(),
          region: s3Region(),
          ...(s3Endpoint() ? { endpoint: s3Endpoint() } : {}),
        };
      case "dropbox":
        return {
          appKey: dbxAppKey(),
          appSecret: dbxAppSecret(),
        };
      case "gdrive":
        return {
          clientId: gdClientId(),
          clientSecret: gdClientSecret(),
          ...(gdFolderId() ? { folderId: gdFolderId() } : {}),
        };
      case "onedrive":
        return {
          clientId: odClientId(),
          clientSecret: odClientSecret(),
          tenantId: odTenantId(),
          ...(odFolderId() ? { folderId: odFolderId() } : {}),
        };
    }
  };

  const handleTest = async () => {
    setTesting(true);
    try {
      await api.testSyncConnection({
        provider: provider(),
        credentials: buildCredentials(),
        schedule: schedule(),
        remotePrefix: remotePrefix(),
      });
      setToast({ message: "Connection successful!", type: "success" });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Connection failed";
      setToast({ message: msg, type: "error" });
    } finally {
      setTesting(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.saveSyncConfig({
        provider: provider(),
        credentials: buildCredentials(),
        enabled: enabled(),
        schedule: schedule(),
        remotePrefix: remotePrefix(),
      });
      setToast({ message: "Sync configuration saved", type: "success" });
      setShowForm(false);
      await loadData();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to save";
      setToast({ message: msg, type: "error" });
    } finally {
      setSaving(false);
    }
  };

  const handleRemove = async () => {
    if (
      !confirm("Remove sync configuration? This will stop all scheduled syncs.")
    )
      return;
    try {
      await api.deleteSyncConfig();
      setCurrentConfig(null);
      setShowForm(false);
      setToast({ message: "Sync configuration removed", type: "success" });
      await loadData();
    } catch {
      setToast({ message: "Failed to remove configuration", type: "error" });
    }
  };

  const handleTrigger = async () => {
    setTriggering(true);
    try {
      await api.triggerSync();
      setToast({ message: "Sync started", type: "info" });
      setTimeout(loadData, 2000);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to start sync";
      setToast({ message: msg, type: "error" });
    } finally {
      setTriggering(false);
    }
  };

  const isOAuthProvider = () =>
    provider() === "dropbox" ||
    provider() === "gdrive" ||
    provider() === "onedrive";

  const handleOAuthConnect = async () => {
    setSaving(true);
    try {
      const p = provider() as "dropbox" | "gdrive" | "onedrive";
      const connectData: Parameters<typeof api.initSyncOAuth>[0] = {
        provider: p,
        clientId:
          p === "dropbox"
            ? dbxAppKey()
            : p === "gdrive"
              ? gdClientId()
              : odClientId(),
        clientSecret:
          p === "dropbox"
            ? dbxAppSecret()
            : p === "gdrive"
              ? gdClientSecret()
              : odClientSecret(),
        schedule: schedule(),
        remotePrefix: remotePrefix(),
        enabled: enabled(),
      };
      if (p === "gdrive" && gdFolderId()) connectData.folderId = gdFolderId();
      if (p === "onedrive") {
        connectData.tenantId = odTenantId();
        if (odFolderId()) connectData.folderId = odFolderId();
      }
      const { authUrl } = await api.initSyncOAuth(connectData);
      window.location.href = authUrl;
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : "Failed to initiate OAuth";
      setToast({ message: msg, type: "error" });
      setSaving(false);
    }
  };

  const inputClass =
    "w-full bg-input border border-subtle rounded-lg px-3 py-2 text-sm text-body focus:outline-none focus:ring-2 focus:ring-brand/50";
  const labelClass = "block text-sm font-medium text-body mb-1";

  return (
    <div class="space-y-6">
      {/* Toast */}
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
      <div>
        <p class="text-sm text-muted-body mt-1">
          Push your organization's documents to an external storage provider on
          a schedule or on demand. Only org admins can configure sync.
        </p>
      </div>

      <Show
        when={!loading()}
        fallback={<div class="text-sm text-muted-body">Loading…</div>}
      >
        {/* Status card */}
        <Show when={status()?.configured && !showForm()}>
          <div class="border border-subtle rounded-xl p-5 bg-surface space-y-4">
            <div class="flex items-center justify-between">
              <div class="flex items-center gap-3">
                <div class="i-carbon-cloud-upload w-5 h-5 text-primary" />
                <div>
                  <p class="font-medium text-body text-sm">
                    {PROVIDERS.find(
                      (p) => p.value === currentConfig()?.provider,
                    )?.label ?? currentConfig()?.provider}
                  </p>
                  <p class="text-xs text-muted-body">
                    {status()?.scheduleLabel ?? "Manual"} ·{" "}
                    {status()?.enabled ? "Enabled" : "Disabled"}
                  </p>
                </div>
              </div>

              <div class="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="md"
                  onClick={handleTrigger}
                  disabled={triggering()}
                >
                  <div class="i-carbon-play w-4 h-4 mr-1" />
                  {triggering() ? "Syncing…" : "Sync now"}
                </Button>
                <Button variant="secondary" size="md" onClick={openForm}>
                  <div class="i-carbon-settings w-4 h-4 mr-1" />
                  Configure
                </Button>
              </div>
            </div>

            <div class="grid grid-cols-2 gap-4 text-sm border-t border-subtle pt-4">
              <div>
                <p class="text-muted-body text-xs mb-0.5">Last sync</p>
                <p class="text-body">
                  {formatDate(status()?.lastSyncAt ?? null)}
                </p>
              </div>
              <Show when={status()?.lastLog}>
                {(log) => (
                  <div>
                    <p class="text-muted-body text-xs mb-0.5">Last result</p>
                    <div class="flex items-center gap-2">
                      <StatusBadge status={log().status} />
                      <Show when={log().status === "success"}>
                        <span class="text-xs text-muted-body">
                          {log().files_uploaded} files uploaded
                        </span>
                      </Show>
                      <Show when={log().status === "error"}>
                        <span
                          class="text-xs text-red-400 truncate max-w-40"
                          title={log().error_message ?? ""}
                        >
                          {log().error_message}
                        </span>
                      </Show>
                    </div>
                  </div>
                )}
              </Show>
            </div>
          </div>
        </Show>

        {/* Not configured yet */}
        <Show when={!status()?.configured && !showForm()}>
          <div class="border border-dashed border-subtle rounded-xl p-8 text-center">
            <div class="i-carbon-cloud-upload w-10 h-10 text-muted-body mx-auto mb-3 opacity-50" />
            <p class="text-body font-medium mb-1">No sync configured</p>
            <p class="text-sm text-muted-body mb-4">
              Connect a storage provider to automatically back up your
              documents.
            </p>
            <Button
              variant="primary"
              size="md"
              onClick={() => setShowForm(true)}
            >
              <div class="i-carbon-add w-4 h-4 mr-1" />
              Set up sync
            </Button>
          </div>
        </Show>

        {/* Configuration form */}
        <Show when={showForm()}>
          <div class="border border-subtle rounded-xl p-5 bg-surface space-y-5">
            <div class="flex items-center justify-between">
              <h3 class="font-semibold text-body">Sync Configuration</h3>
              <Button
                variant="ghost"
                size="md"
                onClick={() => setShowForm(false)}
              >
                <div class="i-carbon-close w-4 h-4" />
              </Button>
            </div>

            {/* Provider selector */}
            <div>
              <label class={labelClass}>Storage Provider</label>
              <div class="grid grid-cols-2 gap-2 sm:grid-cols-3">
                <For each={PROVIDERS}>
                  {(p) => (
                    <button
                      onClick={() => setProvider(p.value)}
                      class={`flex items-center gap-2 px-3 py-2.5 rounded-lg border text-sm text-left transition-colors ${
                        provider() === p.value
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-subtle bg-transparent text-muted-body hover:border-primary/50 hover:text-body"
                      }`}
                    >
                      <div class={`${p.icon} w-4 h-4 flex-shrink-0`} />
                      <span class="truncate">{p.label}</span>
                    </button>
                  )}
                </For>
              </div>
            </div>

            {/* Credential fields */}
            <div>
              <label class={labelClass}>Credentials</label>
              <Switch>
                <Match
                  when={provider() === "s3" || provider() === "s3-compatible"}
                >
                  <div class="space-y-3">
                    <div class="grid grid-cols-2 gap-3">
                      <div>
                        <label class={labelClass}>Access Key ID</label>
                        <input
                          class={inputClass}
                          type="text"
                          placeholder="AKIAIOSFODNN7EXAMPLE"
                          value={s3AccessKey()}
                          onInput={(e) => setS3AccessKey(e.currentTarget.value)}
                        />
                      </div>
                      <div>
                        <label class={labelClass}>Secret Access Key</label>
                        <input
                          class={inputClass}
                          type="password"
                          placeholder="••••••••••••••••••••"
                          value={s3SecretKey()}
                          onInput={(e) => setS3SecretKey(e.currentTarget.value)}
                        />
                      </div>
                    </div>
                    <div class="grid grid-cols-2 gap-3">
                      <div>
                        <label class={labelClass}>Bucket Name</label>
                        <input
                          class={inputClass}
                          type="text"
                          placeholder="my-plumio-backup"
                          value={s3Bucket()}
                          onInput={(e) => setS3Bucket(e.currentTarget.value)}
                        />
                      </div>
                      <div>
                        <label class={labelClass}>Region</label>
                        <input
                          class={inputClass}
                          type="text"
                          placeholder="us-east-1"
                          value={s3Region()}
                          onInput={(e) => setS3Region(e.currentTarget.value)}
                        />
                      </div>
                    </div>
                    <Show when={provider() === "s3-compatible"}>
                      <div>
                        <label class={labelClass}>Custom Endpoint URL</label>
                        <input
                          class={inputClass}
                          type="text"
                          placeholder="https://your-account.r2.cloudflarestorage.com"
                          value={s3Endpoint()}
                          onInput={(e) => setS3Endpoint(e.currentTarget.value)}
                        />
                        <p class="text-xs text-muted-body mt-1">
                          Required for Cloudflare R2, MinIO, Backblaze B2, etc.
                        </p>
                      </div>
                    </Show>
                  </div>
                </Match>

                <Match when={provider() === "dropbox"}>
                  <div class="space-y-3">
                    <div class="p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg text-xs text-blue-300 space-y-1">
                      <p>
                        Create an app at{" "}
                        <a
                          href="https://www.dropbox.com/developers/apps"
                          target="_blank"
                          rel="noopener noreferrer"
                          class="underline"
                        >
                          dropbox.com/developers/apps
                        </a>
                        . Set the app to use <strong>Full Dropbox</strong>{" "}
                        access and add the redirect URI below in the OAuth 2
                        settings.
                      </p>
                      <p class="font-mono text-blue-200 bg-black/20 px-2 py-1 rounded select-all break-all">
                        {typeof window !== "undefined"
                          ? window.location.origin
                          : ""}
                        /api/sync/oauth/callback/dropbox
                      </p>
                    </div>
                    <div class="grid grid-cols-2 gap-3">
                      <div>
                        <label class={labelClass}>App Key</label>
                        <input
                          class={inputClass}
                          type="text"
                          value={dbxAppKey()}
                          onInput={(e) => setDbxAppKey(e.currentTarget.value)}
                        />
                      </div>
                      <div>
                        <label class={labelClass}>App Secret</label>
                        <input
                          class={inputClass}
                          type="password"
                          value={dbxAppSecret()}
                          onInput={(e) =>
                            setDbxAppSecret(e.currentTarget.value)
                          }
                        />
                      </div>
                    </div>
                  </div>
                </Match>

                <Match when={provider() === "gdrive"}>
                  <div class="space-y-3">
                    <div class="p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg text-xs text-blue-300 space-y-1">
                      <p>
                        Create <strong>Web application</strong> OAuth 2.0
                        credentials at{" "}
                        <a
                          href="https://console.cloud.google.com/apis/credentials"
                          target="_blank"
                          rel="noopener noreferrer"
                          class="underline"
                        >
                          console.cloud.google.com
                        </a>
                        . Enable the Google Drive API and add the redirect URI
                        below as an Authorized redirect URI.
                      </p>
                      <p class="font-mono text-blue-200 bg-black/20 px-2 py-1 rounded select-all break-all">
                        {typeof window !== "undefined"
                          ? window.location.origin
                          : ""}
                        /api/sync/oauth/callback/gdrive
                      </p>
                    </div>
                    <div class="grid grid-cols-2 gap-3">
                      <div>
                        <label class={labelClass}>Client ID</label>
                        <input
                          class={inputClass}
                          type="text"
                          value={gdClientId()}
                          onInput={(e) => setGdClientId(e.currentTarget.value)}
                        />
                      </div>
                      <div>
                        <label class={labelClass}>Client Secret</label>
                        <input
                          class={inputClass}
                          type="password"
                          value={gdClientSecret()}
                          onInput={(e) =>
                            setGdClientSecret(e.currentTarget.value)
                          }
                        />
                      </div>
                    </div>
                    <div>
                      <label class={labelClass}>
                        Destination Folder ID{" "}
                        <span class="text-muted-body font-normal">
                          (optional)
                        </span>
                      </label>
                      <input
                        class={inputClass}
                        type="text"
                        placeholder="Root of My Drive"
                        value={gdFolderId()}
                        onInput={(e) => setGdFolderId(e.currentTarget.value)}
                      />
                    </div>
                  </div>
                </Match>

                <Match when={provider() === "onedrive"}>
                  <div class="space-y-3">
                    <div class="p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg text-xs text-blue-300 space-y-1">
                      <p>
                        Register an app in{" "}
                        <a
                          href="https://portal.azure.com/#view/Microsoft_AAD_RegisteredApps"
                          target="_blank"
                          rel="noopener noreferrer"
                          class="underline"
                        >
                          Azure App registrations
                        </a>
                        . Add{" "}
                        <code class="bg-black/30 px-1 rounded">
                          Files.ReadWrite
                        </code>{" "}
                        and{" "}
                        <code class="bg-black/30 px-1 rounded">
                          offline_access
                        </code>{" "}
                        delegated permissions and add the redirect URI below.
                      </p>
                      <p class="font-mono text-blue-200 bg-black/20 px-2 py-1 rounded select-all break-all">
                        {typeof window !== "undefined"
                          ? window.location.origin
                          : ""}
                        /api/sync/oauth/callback/onedrive
                      </p>
                    </div>
                    <div class="grid grid-cols-2 gap-3">
                      <div>
                        <label class={labelClass}>Client ID</label>
                        <input
                          class={inputClass}
                          type="text"
                          value={odClientId()}
                          onInput={(e) => setOdClientId(e.currentTarget.value)}
                        />
                      </div>
                      <div>
                        <label class={labelClass}>Client Secret</label>
                        <input
                          class={inputClass}
                          type="password"
                          value={odClientSecret()}
                          onInput={(e) =>
                            setOdClientSecret(e.currentTarget.value)
                          }
                        />
                      </div>
                    </div>
                    <div>
                      <label class={labelClass}>Tenant ID</label>
                      <input
                        class={inputClass}
                        type="text"
                        placeholder="common"
                        value={odTenantId()}
                        onInput={(e) => setOdTenantId(e.currentTarget.value)}
                      />
                    </div>
                    <div>
                      <label class={labelClass}>
                        Destination Folder ID{" "}
                        <span class="text-muted-body font-normal">
                          (optional)
                        </span>
                      </label>
                      <input
                        class={inputClass}
                        type="text"
                        placeholder="Root of OneDrive"
                        value={odFolderId()}
                        onInput={(e) => setOdFolderId(e.currentTarget.value)}
                      />
                    </div>
                  </div>
                </Match>
              </Switch>
            </div>

            {/* Schedule */}
            <div class="grid grid-cols-2 gap-4">
              <div>
                <label class={labelClass}>Sync Schedule</label>
                <select
                  class={inputClass}
                  value={schedule()}
                  onChange={(e) =>
                    setSchedule(e.currentTarget.value as Schedule)
                  }
                >
                  <For each={SCHEDULES}>
                    {(s) => <option value={s.value}>{s.label}</option>}
                  </For>
                </select>
              </div>

              <div>
                <label class={labelClass}>
                  Remote Path Prefix{" "}
                  <span class="text-muted-body font-normal">(optional)</span>
                </label>
                <input
                  class={inputClass}
                  type="text"
                  placeholder="plumio-backup"
                  value={remotePrefix()}
                  onInput={(e) => setRemotePrefix(e.currentTarget.value)}
                />
              </div>
            </div>

            {/* Enabled toggle */}
            <div class="flex items-center justify-between py-2 border-t border-subtle">
              <div>
                <p class="text-sm font-medium text-body">Enable sync</p>
                <p class="text-xs text-muted-body">
                  Disable to pause without removing configuration
                </p>
              </div>
              <Toggle enabled={enabled()} onChange={setEnabled} />
            </div>

            {/* Action buttons */}
            <div class="flex items-center justify-between border-t border-subtle pt-4">
              <Show when={currentConfig()}>
                <Button
                  variant="ghost"
                  size="md"
                  onClick={handleRemove}
                  class="text-red-400 hover:text-red-300 hover:bg-red-950/30"
                >
                  <div class="i-carbon-trash-can w-4 h-4 mr-1" />
                  Remove
                </Button>
              </Show>
              <Show when={!currentConfig()}>
                <div />
              </Show>

              <div class="flex gap-2">
                <Show when={!isOAuthProvider()}>
                  <Button
                    variant="secondary"
                    size="md"
                    onClick={handleTest}
                    disabled={testing()}
                  >
                    {testing() ? "Testing…" : "Test connection"}
                  </Button>
                </Show>
                <Show when={!isOAuthProvider()}>
                  <Button
                    variant="primary"
                    size="md"
                    onClick={handleSave}
                    disabled={saving()}
                  >
                    {saving() ? "Saving…" : "Save"}
                  </Button>
                </Show>
                <Show when={isOAuthProvider()}>
                  <Button
                    variant="primary"
                    size="md"
                    onClick={handleOAuthConnect}
                    disabled={saving()}
                  >
                    <div class="i-carbon-locked w-4 h-4 mr-1" />
                    {saving()
                      ? "Redirecting…"
                      : provider() === "gdrive"
                        ? "Connect with Google Drive"
                        : provider() === "dropbox"
                          ? "Connect with Dropbox"
                          : "Connect with Microsoft"}
                  </Button>
                </Show>
              </div>
            </div>
          </div>
        </Show>

        {/* Sync history log */}
        <Show when={logs().length > 0}>
          <div>
            <h3 class="text-sm font-semibold text-body mb-3">Sync History</h3>
            <div class="space-y-2">
              <For each={logs()}>
                {(log) => (
                  <div class="flex items-center gap-3 px-3 py-2.5 rounded-lg bg-surface border border-subtle text-sm">
                    <StatusBadge status={log.status} />
                    <span class="text-muted-body text-xs flex-1">
                      {formatDate(log.started_at)}
                    </span>
                    <Show when={log.status === "success"}>
                      <span class="text-muted-body text-xs">
                        {log.files_uploaded} files
                      </span>
                    </Show>
                    <Show when={log.status === "error"}>
                      <span
                        class="text-red-400 text-xs truncate max-w-56"
                        title={log.error_message ?? ""}
                      >
                        {log.error_message}
                      </span>
                    </Show>
                  </div>
                )}
              </For>
            </div>
          </div>
        </Show>
      </Show>
    </div>
  );
}
