import { Show, For, createMemo } from "solid-js";
import Button from "~/components/Button";
import AlertDialog from "~/components/AlertDialog";
import { useI18n } from "~/i18n";
import { PERMISSION_GROUPS, PERMISSION_LABEL_KEYS } from "./types";

interface CreateApiKeyDialogProps {
  show: boolean;
  name: string;
  setName: (v: string) => void;
  permissions: string[];
  setPermissions: (v: string[]) => void;
  expiresAt: string;
  setExpiresAt: (v: string) => void;
  saving: boolean;
  error: string;
  onClose: () => void;
  onSubmit: (e: Event) => void;
}

export default function CreateApiKeyDialog(props: CreateApiKeyDialogProps) {
  const { t } = useI18n();

  const togglePermission = (perm: string) => {
    if (props.permissions.includes(perm)) {
      props.setPermissions(props.permissions.filter((p) => p !== perm));
    } else {
      props.setPermissions([...props.permissions, perm]);
    }
  };

  const toggleGroup = (perms: readonly string[]) => {
    const allSelected = perms.every((p) => props.permissions.includes(p));
    if (allSelected) {
      props.setPermissions(props.permissions.filter((p) => !perms.includes(p)));
    } else {
      const toAdd = perms.filter((p) => !props.permissions.includes(p));
      props.setPermissions([...props.permissions, ...toAdd]);
    }
  };

  // Minimum date for expiry input = tomorrow
  const minDate = () => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return d.toISOString().split("T")[0];
  };

  return (
    <AlertDialog
      isOpen={props.show}
      title={t("apiKeys.formTitle")}
      showActions={false}
      showCloseIcon
      onCancel={props.onClose}
      dialogClass="max-w-lg"
    >
      <form onSubmit={props.onSubmit} class="space-y-4">
        {/* Name */}
        <div>
          <label class="block text-sm font-medium text-secondary-body mb-1">
            {t("apiKeys.formName")}
          </label>
          <input
            type="text"
            value={props.name}
            onInput={(e) => props.setName(e.currentTarget.value)}
            placeholder={t("apiKeys.formNamePlaceholder")}
            class="w-full px-3 py-2 bg-base border border-base rounded-md text-body text-sm placeholder:text-muted-body focus:outline-none focus:border-primary"
          />
        </div>

        {/* Expiry */}
        <div>
          <label class="block text-sm font-medium text-secondary-body mb-1">
            {t("apiKeys.formExpiry")}
          </label>
          <input
            type="date"
            value={props.expiresAt}
            min={minDate()}
            onInput={(e) => props.setExpiresAt(e.currentTarget.value)}
            class="w-full px-3 py-2 bg-base border border-base rounded-md text-body text-sm focus:outline-none focus:border-primary"
          />
        </div>

        {/* Permissions */}
        <div>
          <label class="block text-sm font-medium text-secondary-body mb-2">
            {t("apiKeys.formPermissions")}
          </label>
          <div class="space-y-3">
            <For each={PERMISSION_GROUPS}>
              {(group) => {
                const groupSelected = () =>
                  group.permissions.every((p) => props.permissions.includes(p));
                return (
                  <div class="bg-base rounded-md p-3 border border-base">
                    <button
                      type="button"
                      onClick={() => toggleGroup(group.permissions)}
                      class="flex items-center gap-2 mb-2 text-sm font-medium text-body hover:text-primary cursor-pointer transition-colors"
                    >
                      <div
                        class="w-4 h-4 flex-shrink-0"
                        classList={{
                          "i-carbon-checkbox-checked text-primary":
                            groupSelected(),
                          "i-carbon-checkbox": !groupSelected(),
                        }}
                      />
                      {t(group.labelKey as any)}
                    </button>
                    <div class="grid grid-cols-2 gap-1 pl-1">
                      <For each={group.permissions}>
                        {(perm) => (
                          <label class="flex items-center gap-2 cursor-pointer group">
                            <input
                              type="checkbox"
                              checked={props.permissions.includes(perm)}
                              onChange={() => togglePermission(perm)}
                              class="sr-only"
                            />
                            <div
                              class="w-4 h-4 flex-shrink-0 transition-colors"
                              classList={{
                                "i-carbon-checkbox-checked text-primary":
                                  props.permissions.includes(perm),
                                "i-carbon-checkbox text-muted-body group-hover:text-body":
                                  !props.permissions.includes(perm),
                              }}
                            />
                            <div class="flex-1 min-w-0">
                              <div class="text-xs text-secondary-body font-mono">
                                {t(
                                  PERMISSION_LABEL_KEYS[
                                    perm as keyof typeof PERMISSION_LABEL_KEYS
                                  ] as any,
                                )}
                              </div>
                            </div>
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
        <Show when={props.error}>
          <p class="text-sm text-red-400">{props.error}</p>
        </Show>

        {/* Actions */}
        <div class="flex justify-end gap-2 pt-1">
          <Button
            type="button"
            variant="ghost"
            size="md"
            onClick={props.onClose}
            disabled={props.saving}
          >
            {t("common.cancel")}
          </Button>
          <Button
            type="submit"
            variant="primary"
            size="md"
            disabled={props.saving}
          >
            {props.saving ? t("apiKeys.formCreating") : t("apiKeys.formCreate")}
          </Button>
        </div>
      </form>
    </AlertDialog>
  );
}
