import {
  createSignal,
  createEffect,
  onCleanup,
  Show,
  For,
  onMount,
} from "solid-js";
import { Popover } from "@kobalte/core/popover";
import { api } from "~/lib/api";
import Button from "./Button";

interface NotificationItem {
  id: number;
  type: string;
  title: string;
  message: string | null;
  metadata: string | null;
  read: number;
  created_at: string;
}

export default function NotificationCenter() {
  const [notifications, setNotifications] = createSignal<NotificationItem[]>(
    [],
  );
  const [unreadCount, setUnreadCount] = createSignal(0);
  const [isOpen, setIsOpen] = createSignal(false);
  const [loading, setLoading] = createSignal(false);
  const [actionedIds, setActionedIds] = createSignal<Set<number>>(new Set());
  const [processingIds, setProcessingIds] = createSignal<Set<number>>(
    new Set(),
  );

  const fetchUnreadCount = async () => {
    try {
      const result = await api.getUnreadNotificationCount();
      setUnreadCount(result.count);
    } catch {
      // Silently ignore — may not be authenticated yet
    }
  };

  const fetchNotifications = async () => {
    setLoading(true);
    try {
      const result = await api.listNotifications(1, 20);
      setNotifications(result.notifications);
    } catch {
      // Silently ignore
    } finally {
      setLoading(false);
    }
  };

  const handleAccept = async (requestId: number, notificationId: number) => {
    setProcessingIds((s) => new Set([...s, notificationId]));
    try {
      await api.acceptJoinRequest(requestId);
      // Mark as read on interaction
      const n = notifications().find((n) => n.id === notificationId);
      if (n && !n.read) await api.markNotificationRead(notificationId);
      setActionedIds((s) => new Set([...s, notificationId]));
      setIsOpen(false);
      await fetchNotifications();
      await fetchUnreadCount();
    } catch (err: any) {
      console.error("Failed to accept join request:", err);
    } finally {
      setProcessingIds((s) => {
        const n = new Set(s);
        n.delete(notificationId);
        return n;
      });
    }
  };

  const handleReject = async (requestId: number, notificationId: number) => {
    setProcessingIds((s) => new Set([...s, notificationId]));
    try {
      await api.rejectJoinRequest(requestId);
      // Mark as read on interaction
      const n = notifications().find((n) => n.id === notificationId);
      if (n && !n.read) await api.markNotificationRead(notificationId);
      setActionedIds((s) => new Set([...s, notificationId]));
      setIsOpen(false);
      await fetchNotifications();
      await fetchUnreadCount();
    } catch (err: any) {
      console.error("Failed to reject join request:", err);
    } finally {
      setProcessingIds((s) => {
        const n = new Set(s);
        n.delete(notificationId);
        return n;
      });
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await api.markAllNotificationsRead();
      setNotifications((prev) => prev.map((n) => ({ ...n, read: 1 })));
      setUnreadCount(0);
    } catch {
      // ignore
    }
  };

  const handleMarkRead = async (id: number) => {
    try {
      await api.markNotificationRead(id);
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, read: 1 } : n)),
      );
      setUnreadCount((c) => Math.max(0, c - 1));
    } catch {
      // ignore
    }
  };

  const handleDelete = async (id: number) => {
    try {
      await api.deleteNotification(id);
      const deleted = notifications().find((n) => n.id === id);
      setNotifications((prev) => prev.filter((n) => n.id !== id));
      if (deleted && !deleted.read) {
        setUnreadCount((c) => Math.max(0, c - 1));
      }
    } catch {
      // ignore
    }
  };

  const getRelativeTime = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 1) return "just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays < 30) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  const getIcon = (type: string) => {
    switch (type) {
      case "join_request":
        return "i-carbon-user-follow";
      case "join_accepted":
        return "i-carbon-checkmark-filled";
      case "join_rejected":
        return "i-carbon-close-filled";
      default:
        return "i-carbon-notification";
    }
  };

  const getIconColor = (type: string) => {
    switch (type) {
      case "join_request":
        return "text-blue-400";
      case "join_accepted":
        return "text-green-400";
      case "join_rejected":
        return "text-red-400";
      default:
        return "text-[var(--color-text-muted)]";
    }
  };

  const parseMetadata = (
    metadata: string | null,
  ): { joinRequestId?: number; organizationId?: number } => {
    if (!metadata) return {};
    try {
      return JSON.parse(metadata);
    } catch {
      return {};
    }
  };

  // Poll for unread count
  onMount(() => {
    fetchUnreadCount();
  });

  createEffect(() => {
    const interval = setInterval(fetchUnreadCount, 30000);
    onCleanup(() => clearInterval(interval));
  });

  // Fetch notifications when popover opens
  createEffect(() => {
    if (isOpen()) {
      fetchNotifications();
    }
  });

  return (
    <Popover open={isOpen()} onOpenChange={setIsOpen}>
      <Popover.Trigger class="relative inline-flex items-center justify-center w-8 h-8 rounded-md transition-colors text-secondary-body hover:bg-[var(--color-bg-surface)] hover:text-[var(--color-text-primary)] cursor-pointer border-none bg-transparent">
        <div class="i-carbon-notification w-5 h-5 flex-shrink-0" />
        <Show when={unreadCount() > 0}>
          <span class="absolute -top-0.5 -right-0.5 min-w-4 h-4 px-1 rounded-full bg-[var(--color-primary)] text-white text-[10px] flex items-center justify-center font-semibold pointer-events-none">
            {unreadCount() > 99 ? "99+" : unreadCount()}
          </span>
        </Show>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content class="z-50 w-80 max-h-96 bg-elevated border border-base rounded-lg shadow-xl overflow-hidden flex flex-col">
          <Popover.Arrow />
          {/* Header */}
          <div class="flex items-center justify-between px-4 py-3 border-b border-[var(--color-border)]">
            <span class="font-semibold text-[var(--color-text-primary)] text-sm">
              Notifications
            </span>
            <Show when={unreadCount() > 0}>
              <button
                onClick={handleMarkAllRead}
                class="text-xs text-[var(--color-primary)] hover:underline cursor-pointer bg-transparent border-none"
              >
                Mark all read
              </button>
            </Show>
          </div>

          {/* List */}
          <div class="flex-1 overflow-y-auto">
            <Show
              when={!loading()}
              fallback={
                <div class="p-6 text-center text-[var(--color-text-muted)] text-sm">
                  <div class="i-carbon-circle-dash animate-spin w-5 h-5 mx-auto mb-2" />
                  Loading...
                </div>
              }
            >
              <Show
                when={notifications().length > 0}
                fallback={
                  <div class="p-6 text-center text-[var(--color-text-muted)] text-sm">
                    <div class="i-carbon-notification w-8 h-8 mx-auto mb-2 opacity-40" />
                    No notifications yet
                  </div>
                }
              >
                <For each={notifications()}>
                  {(notification) => {
                    const meta = parseMetadata(notification.metadata);
                    return (
                      <div
                        class={`px-4 py-3 border-b border-[var(--color-border)] last:border-b-0 transition-colors ${
                          notification.read
                            ? "opacity-60"
                            : "bg-[var(--color-primary)]/5"
                        }`}
                      >
                        <div class="flex gap-3">
                          <div
                            class={`${getIcon(notification.type)} w-5 h-5 flex-shrink-0 mt-0.5 ${getIconColor(notification.type)}`}
                          />
                          <div class="flex-1 min-w-0">
                            <div class="flex items-start justify-between gap-2">
                              <p class="text-sm font-medium text-[var(--color-text-primary)] truncate">
                                {notification.title}
                              </p>
                              <button
                                onClick={() => handleDelete(notification.id)}
                                class="flex-shrink-0 text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] cursor-pointer bg-transparent border-none p-0"
                                title="Delete"
                              >
                                <div class="i-carbon-close w-3.5 h-3.5" />
                              </button>
                            </div>
                            <Show when={notification.message}>
                              <p class="text-xs text-[var(--color-text-secondary)] mt-0.5 line-clamp-2">
                                {notification.message}
                              </p>
                            </Show>
                            <div class="flex items-center gap-2 mt-1.5">
                              <span class="text-[10px] text-[var(--color-text-muted)]">
                                {getRelativeTime(notification.created_at)}
                              </span>
                              <Show when={!notification.read}>
                                <button
                                  onClick={() =>
                                    handleMarkRead(notification.id)
                                  }
                                  class="text-[10px] text-[var(--color-primary)] hover:underline cursor-pointer bg-transparent border-none p-0"
                                >
                                  Mark read
                                </button>
                              </Show>
                            </div>
                            {/* Action buttons for join requests */}
                            <Show
                              when={
                                notification.type === "join_request" &&
                                meta.joinRequestId &&
                                !actionedIds().has(notification.id)
                              }
                            >
                              <div class="flex gap-2 mt-2">
                                <button
                                  onClick={() =>
                                    handleAccept(
                                      meta.joinRequestId!,
                                      notification.id,
                                    )
                                  }
                                  disabled={processingIds().has(
                                    notification.id,
                                  )}
                                  class="px-3 py-1 text-xs font-medium rounded bg-[var(--color-primary)] text-white hover:opacity-90 cursor-pointer border-none disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                  {processingIds().has(notification.id)
                                    ? "..."
                                    : "Accept"}
                                </button>
                                <button
                                  onClick={() =>
                                    handleReject(
                                      meta.joinRequestId!,
                                      notification.id,
                                    )
                                  }
                                  disabled={processingIds().has(
                                    notification.id,
                                  )}
                                  class="px-3 py-1 text-xs font-medium rounded bg-[var(--color-bg-base)] text-[var(--color-text-secondary)] hover:bg-[var(--color-border)] cursor-pointer border border-[var(--color-border)] disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                  Reject
                                </button>
                              </div>
                            </Show>
                          </div>
                        </div>
                      </div>
                    );
                  }}
                </For>
              </Show>
            </Show>
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover>
  );
}
