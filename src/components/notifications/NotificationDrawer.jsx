"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Drawer from "@/components/ui/Drawer";

const TABS = [
  { id: "all", label: "All", query: null },
  { id: "taskMovement", label: "Task Movements", query: "taskMovement" },
  { id: "creation", label: "Creation / Assignment", query: "creation" },
  { id: "log", label: "User Logs / Comments", query: "log" },
];

const ICONS = {
  TASK_MOVEMENT: (
    <svg
      viewBox="0 0 24 24"
      className="h-4 w-4"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
    >
      <path
        d="M7 7h10M7 12h10M7 17h10"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  ),
  CREATION_ASSIGNMENT: (
    <svg
      viewBox="0 0 24 24"
      className="h-4 w-4"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
    >
      <path
        d="M12 5v14M5 12h14"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  ),
  USER_LOG_COMMENT: (
    <svg
      viewBox="0 0 24 24"
      className="h-4 w-4"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
    >
      <path
        d="M4 6h16v9H7l-3 3V6Z"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  ),
};

function formatTimeAgo(value) {
  if (!value) return "";
  const date = new Date(value);
  const diffMs = Date.now() - date.getTime();
  if (Number.isNaN(diffMs)) return "";
  const seconds = Math.max(1, Math.floor(diffMs / 1000));
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return date.toLocaleDateString();
}

export default function NotificationDrawer({ isOpen, onClose, onUnreadChange }) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState("all");
  const [notifications, setNotifications] = useState([]);
  const [counts, setCounts] = useState({
    total: 0,
    taskMovement: 0,
    creation: 0,
    log: 0,
  });
  const [isLoading, setIsLoading] = useState(false);

  const activeQuery = useMemo(
    () => TABS.find((tab) => tab.id === activeTab)?.query ?? null,
    [activeTab]
  );

  const loadNotifications = async () => {
    setIsLoading(true);
    const query = activeQuery ? `?tab=${activeQuery}` : "";
    const response = await fetch(`/api/notifications${query}`);
    if (!response.ok) {
      setIsLoading(false);
      return;
    }
    const data = await response.json();
    if (data?.ok) {
      setNotifications(data.notifications ?? []);
      setCounts({
        total: data.unreadCounts?.total ?? 0,
        taskMovement: data.unreadCounts?.taskMovement ?? 0,
        creation: data.unreadCounts?.creation ?? 0,
        log: data.unreadCounts?.log ?? 0,
      });
    }
    setIsLoading(false);
  };

  useEffect(() => {
    loadNotifications();
    const interval = setInterval(loadNotifications, 30000);
    return () => clearInterval(interval);
  }, [activeQuery]);

  useEffect(() => {
    if (onUnreadChange) {
      onUnreadChange(counts.total);
    }
  }, [counts.total, onUnreadChange]);

  const handleMarkAllRead = async () => {
    const response = await fetch("/api/notifications/mark-all-read", {
      method: "PATCH",
    });
    if (!response.ok) {
      return;
    }
    await loadNotifications();
  };

  const handleNotificationClick = async (notification) => {
    if (!notification?.readAt) {
      await fetch(`/api/notifications/${notification.id}/read`, {
        method: "PATCH",
      });
      await loadNotifications();
    }

    const link = notification.taskId
      ? `/projects/${notification.projectId}/milestones/${notification.milestoneId}`
      : notification.milestoneId
        ? `/projects/${notification.projectId}/milestones/${notification.milestoneId}`
        : notification.projectId
          ? `/projects/${notification.projectId}`
          : null;

    if (link) {
      router.push(link);
      onClose?.();
    }
  };

  return (
    <Drawer isOpen={isOpen} title="Notifications" onClose={onClose} width="28rem">
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex flex-wrap gap-2">
            {TABS.map((tab) => {
              const count =
                tab.id === "all"
                  ? counts.total
                  : tab.id === "taskMovement"
                    ? counts.taskMovement
                    : tab.id === "creation"
                      ? counts.creation
                      : counts.log;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                    isActive
                      ? "border-[color:var(--color-accent)] bg-[color:var(--color-muted-bg)] text-[color:var(--color-text)]"
                      : "border-[color:var(--color-border)] text-[color:var(--color-text-subtle)] hover:border-[color:var(--color-accent)]"
                  }`}
                >
                  <span>{tab.label}</span>
                  {count > 0 ? (
                    <span className="rounded-full bg-[color:var(--color-accent)] px-2 py-0.5 text-[10px] font-bold text-white">
                      {count}
                    </span>
                  ) : null}
                </button>
              );
            })}
          </div>
          <button
            type="button"
            onClick={handleMarkAllRead}
            className="text-xs font-semibold text-[color:var(--color-text-subtle)] transition hover:text-[color:var(--color-text)]"
          >
            Mark all read
          </button>
        </div>

        <div className="flex items-center justify-between text-xs text-[color:var(--color-text-subtle)]">
          <span>{isLoading ? "Refreshing…" : "Updated just now"}</span>
          <button
            type="button"
            onClick={loadNotifications}
            className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[color:var(--color-accent)]"
          >
            Refresh
          </button>
        </div>

        <div className="space-y-3">
          {notifications.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-[color:var(--color-border)] bg-[color:var(--color-muted-bg)] p-6 text-center text-sm text-[color:var(--color-text-subtle)]">
              No notifications yet.
            </div>
          ) : (
            notifications.map((notification) => (
              <button
                key={notification.id}
                type="button"
                onClick={() => handleNotificationClick(notification)}
                className={`flex w-full gap-3 rounded-2xl border p-4 text-left transition hover:border-[color:var(--color-accent)] ${
                  notification.readAt
                    ? "border-[color:var(--color-border)] bg-[color:var(--color-surface)]"
                    : "border-[color:var(--color-accent)] bg-[color:var(--color-muted-bg)]"
                }`}
              >
                <div className="mt-1 flex h-8 w-8 items-center justify-center rounded-full bg-[color:var(--color-card)] text-[color:var(--color-accent)]">
                  {ICONS[notification.type]}
                </div>
                <div className="flex-1 space-y-1">
                  <p
                    className={`text-sm ${
                      notification.readAt ? "text-[color:var(--color-text)]" : "font-semibold text-[color:var(--color-text)]"
                    }`}
                  >
                    {notification.message}
                  </p>
                  <div className="flex items-center gap-2 text-xs text-[color:var(--color-text-subtle)]">
                    <span>{formatTimeAgo(notification.createdAt)}</span>
                    {notification.actor?.name ? (
                      <span>• {notification.actor.name}</span>
                    ) : null}
                  </div>
                </div>
              </button>
            ))
          )}
        </div>
      </div>
    </Drawer>
  );
}
