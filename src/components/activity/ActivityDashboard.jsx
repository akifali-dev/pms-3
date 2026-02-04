"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import ActionButton from "@/components/ui/ActionButton";
import Drawer from "@/components/ui/Drawer";
import Modal from "@/components/ui/Modal";
import CommentThread from "@/components/comments/CommentThread";
import { useToast } from "@/components/ui/ToastProvider";
import PageHeader from "@/components/layout/PageHeader";
import useOutsideClick from "@/hooks/useOutsideClick";
import AnalyticsResults from "@/components/analytics/AnalyticsResults";
import ClientOnly from "@/components/ui/ClientOnly";

const periodOptions = [
  { id: "daily", label: "Daily" },
  { id: "weekly", label: "Weekly" },
  { id: "monthly", label: "Monthly" },
];

const badgeOptions = [
  { id: "all", label: "All" },
  { id: "task", label: "Task" },
  { id: "manual", label: "Manual Log" },
];

const manualCategories = [
  { id: "LEARNING", label: "Learning" },
  { id: "RESEARCH", label: "Research" },
  { id: "OTHER", label: "Other" },
];

const manualCategoryLabelMap = new Map(
  manualCategories.map((category) => [category.id, category.label])
);

function formatDateTime(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "-";
  }
  return date.toLocaleString();
}

function formatDateOnly(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }
  return date.toISOString().slice(0, 10);
}

function formatTimeOnly(value) {
  if (!value) {
    return "";
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }
  return date.toISOString().slice(11, 16);
}

function getManualLogDateBounds(baseDate = new Date()) {
  const maxDate = formatDateOnly(baseDate);
  const minDate = new Date(baseDate);
  minDate.setDate(minDate.getDate() - 2);
  return { min: formatDateOnly(minDate), max: maxDate };
}

function isManualLogDateAllowed(dateValue, bounds) {
  if (!dateValue || !bounds?.min || !bounds?.max) {
    return false;
  }
  return dateValue >= bounds.min && dateValue <= bounds.max;
}


function getPeriodRange(period, baseDate = new Date()) {
  const now = new Date(baseDate);
  const start = new Date(now);
  const end = new Date(now);

  if (period === "weekly") {
    const day = now.getDay();
    const diff = (day + 6) % 7;
    start.setDate(now.getDate() - diff);
    end.setDate(start.getDate() + 6);
  } else if (period === "monthly") {
    start.setDate(1);
    end.setMonth(start.getMonth() + 1, 0);
  }

  start.setHours(0, 0, 0, 0);
  end.setHours(23, 59, 59, 999);

  return { start, end };
}

const MANAGEMENT_ROLES = ["CEO", "PM", "CTO"];

function normalizeRole(role) {
  if (!role) {
    return null;
  }

  return role
    .toString()
    .trim()
    .replace(/\s+/g, "_")
    .replace(/-/g, "_")
    .toUpperCase();
}

function getAvatarLetter(user) {
  const raw = user?.avatarLetter || user?.name || user?.email || "";
  return raw.toString().trim().charAt(0).toUpperCase() || "?";
}

const ActivityMenu = ({ onLeaveComment }) => {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef(null);

  useOutsideClick(menuRef, () => setIsOpen(false), isOpen);

  return (
    <div className="relative" ref={menuRef}>
      <button
        type="button"
        onClick={(event) => {
          event.stopPropagation();
          setIsOpen((prev) => !prev);
        }}
        className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-[color:var(--color-border)] text-[color:var(--color-text-muted)] transition hover:border-[color:var(--color-accent)] hover:text-[color:var(--color-text)]"
        aria-label="Activity actions"
        title="Activity actions"
        aria-expanded={isOpen}
        aria-haspopup="menu"
      >
        <span className="text-lg leading-none">⋮</span>
      </button>
      {isOpen ? (
        <div
          className="absolute right-0 z-10 mt-2 w-44 rounded-xl border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-2 text-xs text-[color:var(--color-text)] shadow-xl"
          onClick={(event) => event.stopPropagation()}
        >
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              setIsOpen(false);
              onLeaveComment();
            }}
            className="flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-[color:var(--color-text)] hover:bg-[color:var(--color-muted-bg)]"
          >
            <svg
              viewBox="0 0 24 24"
              className="h-4 w-4"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
            >
              <path
                d="M7 8h10M7 12h7M5 5h14a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H8l-4 4v-4H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2Z"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            <span>Leave Comment</span>
          </button>
        </div>
      ) : null}
    </div>
  );
};

export default function ActivityDashboard({
  initialLogs,
  users,
  currentUser,
}) {
  const { addToast } = useToast();
  const isManager = MANAGEMENT_ROLES.includes(normalizeRole(currentUser?.role));
  const [period, setPeriod] = useState("daily");
  const [selectedDate, setSelectedDate] = useState("");
  const [activeBadge, setActiveBadge] = useState("all");
  const [logs, setLogs] = useState(initialLogs);
  const [status, setStatus] = useState({ loading: false, error: null });
  const [selectedUser, setSelectedUser] = useState(null);
  const [userQuery, setUserQuery] = useState("");
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [commentCounts, setCommentCounts] = useState({});
  const [taskDrawer, setTaskDrawer] = useState({ open: false, task: null });
  const [logModal, setLogModal] = useState({ open: false, mode: "create" });
  const [activeLog, setActiveLog] = useState(null);
  const [isHydrated, setIsHydrated] = useState(false);
  const userMenuRef = useRef(null);

  const [logForm, setLogForm] = useState({
    categories: ["LEARNING"],
    date: "",
    startTime: "",
    endTime: "",
    description: "",
    taskId: "",
  });

  useOutsideClick(userMenuRef, () => setIsUserMenuOpen(false), isUserMenuOpen);

  useEffect(() => {
    setIsHydrated(true);
    const today = formatDateOnly(new Date());
    setSelectedDate(today);
    setLogForm((prev) => ({ ...prev, date: today }));
  }, []);

  const filteredUsers = useMemo(() => {
    const query = userQuery.toLowerCase();
    if (!query) {
      return users;
    }
    return users.filter(
      (user) =>
        user.name.toLowerCase().includes(query) ||
        user.email.toLowerCase().includes(query)
    );
  }, [userQuery, users]);

  const fetchLogs = async ({ targetUserId } = {}) => {
    setStatus({ loading: true, error: null });
    setLogs([]);
    try {
      const { start, end } = getPeriodRange(period, selectedDate);
      const params = new URLSearchParams();
      params.set("startDate", start.toISOString());
      params.set("endDate", end.toISOString());
      params.set("scope", isManager ? "all" : "mine");
      if (targetUserId && isManager) {
        params.set("userId", targetUserId);
      }
      const response = await fetch(`/api/activity-logs?${params.toString()}`);
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.error ?? "Unable to load activity logs.");
      }
      setLogs(data?.activityLogs ?? []);
      setStatus({ loading: false, error: null });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unable to load activity logs.";
      setStatus({ loading: false, error: message });
      addToast({
        title: "Activity unavailable",
        message,
        variant: "error",
      });
    }
  };

  useEffect(() => {
    if (!isHydrated || !selectedDate) {
      return;
    }
    fetchLogs({ targetUserId: selectedUser?.id ?? "" });
  }, [period, selectedDate, selectedUser?.id, isManager, isHydrated]);

  useEffect(() => {
    const manualLogIds = logs
      .filter((log) => !log.taskId)
      .map((log) => log.id);
    if (manualLogIds.length === 0) {
      setCommentCounts({});
      return;
    }

    const loadCounts = async () => {
      try {
        const response = await fetch(
          `/api/comments?entityType=MANUAL_LOG&entityIds=${manualLogIds.join(",")}`
        );
        const data = await response.json();
        if (!response.ok) {
          return;
        }
        const counts = {};
        (data?.comments ?? []).forEach((comment) => {
          counts[comment.entityId] = (counts[comment.entityId] ?? 0) + 1;
        });
        setCommentCounts(counts);
      } catch (error) {
        setCommentCounts({});
      }
    };

    loadCounts();
  }, [logs]);

  const badgeCounts = useMemo(() => {
    const counts = { all: logs.length, task: 0, manual: 0 };
    logs.forEach((log) => {
      if (log.taskId) {
        counts.task += 1;
      } else {
        counts.manual += 1;
      }
    });
    return counts;
  }, [logs]);

  const filteredLogs = useMemo(() => {
    if (activeBadge === "task") {
      return logs.filter((log) => log.taskId);
    }
    if (activeBadge === "manual") {
      return logs.filter((log) => !log.taskId);
    }
    return logs;
  }, [activeBadge, logs]);

  const sortedLogs = useMemo(() => {
    return [...filteredLogs].sort(
      (a, b) => new Date(b.date) - new Date(a.date)
    );
  }, [filteredLogs]);

  const handleLogChange = (event) => {
    const { name, value } = event.target;
    setLogForm((prev) => ({ ...prev, [name]: value }));
  };

  const toggleCategory = (categoryId) => {
    setLogForm((prev) => {
      const next = prev.categories.includes(categoryId)
        ? prev.categories.filter((entry) => entry !== categoryId)
        : [...prev.categories, categoryId];
      return { ...prev, categories: next };
    });
  };

  const openCreateLogModal = () => {
    setLogForm({
      categories: ["LEARNING"],
      date: formatDateOnly(new Date()),
      startTime: "",
      endTime: "",
      description: "",
      taskId: "",
    });
    setActiveLog(null);
    setLogModal({ open: true, mode: "create" });
  };

  const openEditLogModal = (log) => {
    setActiveLog(log);
    setLogForm({
      categories:
        Array.isArray(log.categories) && log.categories.length
          ? log.categories
          : ["OTHER"],
      date: formatDateOnly(log.date),
      startTime: formatTimeOnly(log.startAt),
      endTime: formatTimeOnly(log.endAt),
      description: log.description ?? "",
      taskId: log.taskId ?? "",
    });
    setLogModal({ open: true, mode: "edit" });
  };

  const closeLogModal = () => {
    setLogModal({ open: false, mode: "create" });
    setActiveLog(null);
  };

  const handleSubmitLog = async (event) => {
    event.preventDefault();
    const dateBounds = getManualLogDateBounds();
    if (!logForm.description.trim()) {
      addToast({
        title: "Description required",
        message: "Please enter a summary before saving the log.",
        variant: "warning",
      });
      return;
    }
    if (!isManualLogDateAllowed(logForm.date, dateBounds)) {
      addToast({
        title: "Date not allowed",
        message:
          "Manual logs can only be added/edited for today or last 2 days.",
        variant: "error",
      });
      return;
    }
    if (!logForm.startTime || !logForm.endTime) {
      addToast({
        title: "Time required",
        message: "Please provide both a start and end time.",
        variant: "warning",
      });
      return;
    }
    if (logForm.startTime >= logForm.endTime) {
      addToast({
        title: "Invalid time range",
        message: "End time must be after start time.",
        variant: "warning",
      });
      return;
    }
    if (!logForm.categories.length) {
      addToast({
        title: "Category required",
        message: "Select at least one category for the manual log.",
        variant: "warning",
      });
      return;
    }
    const payload = {
      date: logForm.date,
      description: logForm.description,
      startTime: logForm.startTime,
      endTime: logForm.endTime,
    };
    payload.categories = logForm.categories;

    try {
      const response = await fetch(
        logModal.mode === "edit" && activeLog
          ? `/api/activity/manual/${activeLog.id}`
          : "/api/activity/manual",
        {
          method: logModal.mode === "edit" ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      );
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.error ?? "Unable to save activity log.");
      }
      addToast({
        title: logModal.mode === "edit" ? "Log updated" : "Log created",
        message:
          logModal.mode === "edit"
            ? "Manual activity updated."
            : "Manual activity saved to your timeline.",
        variant: "success",
      });
      closeLogModal();
      await fetchLogs({ targetUserId: selectedUser?.id ?? "" });
    } catch (error) {
      addToast({
        title: "Log failed",
        message:
          error instanceof Error
            ? error.message
            : "Unable to save activity log.",
        variant: "error",
      });
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Accountability"
        title="Activity & comment timeline"
        subtitle="Track daily logs, task auto-activity, and leadership feedback."
        actions={
          <ActionButton
            label="Manual Log Activity"
            variant="success"
            onClick={openCreateLogModal}
          />
        }
      />

      <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-[color:var(--color-border)] bg-[color:var(--color-card)] p-4">
        <div className="flex flex-wrap items-center gap-2">
          {badgeOptions.map((badge) => (
            <button
              key={badge.id}
              type="button"
              onClick={() => setActiveBadge(badge.id)}
              className={`flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold transition ${
                activeBadge === badge.id
                  ? "border-[color:var(--color-accent)] bg-[color:var(--color-accent-muted)] text-[color:var(--color-accent)]"
                  : "border-[color:var(--color-border)] text-[color:var(--color-text-muted)] hover:border-[color:var(--color-accent)]"
              }`}
            >
              <span>{badge.label}</span>
              <span className="rounded-full bg-[color:var(--color-muted-bg)] px-2 py-0.5 text-[10px] font-semibold text-[color:var(--color-text-muted)]">
                {badgeCounts[badge.id] ?? 0}
              </span>
            </button>
          ))}
          <div className="ml-2">
            <select
              value={period}
              onChange={(event) => setPeriod(event.target.value)}
              className="rounded-full border border-[color:var(--color-border)] bg-[color:var(--color-input)] px-3 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-[color:var(--color-text-muted)]"
            >
              {periodOptions.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
          <input
            type="date"
            value={selectedDate}
            onChange={(event) => setSelectedDate(event.target.value)}
            className="rounded-full border border-[color:var(--color-border)] bg-[color:var(--color-input)] px-3 py-2 text-xs font-semibold text-[color:var(--color-text-muted)]"
          />
        </div>

        {isManager ? (
          <div className="relative w-full max-w-xs" ref={userMenuRef}>
            <input
              value={userQuery}
              onChange={(event) => {
                setUserQuery(event.target.value);
                setIsUserMenuOpen(true);
                if (!event.target.value) {
                  setSelectedUser(null);
                }
              }}
              onFocus={() => setIsUserMenuOpen(true)}
              placeholder="Search user"
              className="w-full rounded-full border border-[color:var(--color-border)] bg-[color:var(--color-input)] px-4 py-2 text-sm text-[color:var(--color-text)] outline-none focus:border-[color:var(--color-accent)]"
            />
            {selectedUser ? (
              <button
                type="button"
                onClick={() => {
                  setSelectedUser(null);
                  setUserQuery("");
                  setIsUserMenuOpen(false);
                }}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[color:var(--color-text-muted)]"
                aria-label="Clear user filter"
              >
                ×
              </button>
            ) : null}
            {isUserMenuOpen ? (
              <div className="absolute right-0 z-10 mt-2 max-h-56 w-full overflow-y-auto rounded-xl border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-2 text-xs shadow-xl">
                {filteredUsers.length ? (
                  filteredUsers.map((user) => (
                    <button
                      key={user.id}
                      type="button"
                      onClick={() => {
                        setSelectedUser(user);
                        setUserQuery(user.name);
                        setIsUserMenuOpen(false);
                      }}
                      className="flex w-full flex-col gap-1 rounded-lg px-3 py-2 text-left text-[color:var(--color-text)] hover:bg-[color:var(--color-muted-bg)]"
                    >
                      <span className="text-sm font-semibold">{user.name}</span>
                      <span className="text-[11px] text-[color:var(--color-text-subtle)]">
                        {user.role}
                      </span>
                    </button>
                  ))
                ) : (
                  <p className="px-3 py-2 text-[color:var(--color-text-subtle)]">
                    No users found.
                  </p>
                )}
              </div>
            ) : null}
          </div>
        ) : null}
      </div>

      {status.loading ? (
        <div className="rounded-2xl border border-[color:var(--color-border)] bg-[color:var(--color-card)] p-6 text-sm text-[color:var(--color-text-muted)]">
          Loading activity...
        </div>
      ) : status.error ? (
        <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 p-6 text-sm text-rose-200">
          {status.error}
        </div>
      ) : (
        <div className="space-y-4">
          <div className="rounded-2xl border border-[color:var(--color-border)] bg-[color:var(--color-card)] p-4">
            <p className="text-sm font-semibold text-[color:var(--color-text)]">
              Workday analytics
            </p>
            <p className="mt-1 text-xs text-[color:var(--color-text-muted)]">
              Daily timeline, pauses, and utilization from attendance + task events.
            </p>
          </div>
          <ClientOnly
            fallback={
              <div className="rounded-2xl border border-[color:var(--color-border)] bg-[color:var(--color-card)] p-5 text-sm text-[color:var(--color-text-muted)]">
                Loading analytics...
              </div>
            }
          >
            <AnalyticsResults
              period={period}
              date={selectedDate}
              userId={selectedUser?.id ?? null}
            />
          </ClientOnly>
          {sortedLogs.length === 0 ? (
            <div className="rounded-2xl border border-[color:var(--color-border)] bg-[color:var(--color-card)] p-5 text-sm text-[color:var(--color-text-subtle)]">
              No activity in this range.
            </div>
          ) : (
            sortedLogs.map((log) => {
              const isManualLog = !log.taskId;
              const manualCategoryLabels = Array.isArray(log.categories)
                ? log.categories
                    .map((category) => manualCategoryLabelMap.get(category) ?? category)
                    .filter(Boolean)
                : [];
              const badgeLabel = isManualLog
                ? manualCategoryLabels.join(", ") || "Manual"
                : "TASK";
              const commentCount = isManualLog
                ? commentCounts[log.id] ?? 0
                : 0;
              const avatarLetter = getAvatarLetter(log.user);
              return (
                <div
                  key={log.id}
                  className="rounded-2xl border border-[color:var(--color-border)] bg-[color:var(--color-card)] p-5"
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[color:var(--color-muted-bg)] text-sm font-semibold text-[color:var(--color-text)]">
                        {avatarLetter}
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-[color:var(--color-text)]">
                          {log.user?.name ?? "Unknown user"}
                        </p>
                        <p className="text-xs text-[color:var(--color-text-subtle)]">
                          {log.user?.role ?? ""}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {commentCount > 0 ? (
                        <button
                          type="button"
                          onClick={() => openEditLogModal(log)}
                          className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-[color:var(--color-border)] text-[color:var(--color-text-muted)] hover:border-[color:var(--color-accent)]"
                          aria-label="View comments"
                        >
                          <svg
                            viewBox="0 0 24 24"
                            className="h-4 w-4"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="1.6"
                          >
                            <path
                              d="M7 8h10M7 12h7M5 5h14a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H8l-4 4v-4H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2Z"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            />
                          </svg>
                        </button>
                      ) : null}
                      <span className="rounded-full border border-[color:var(--color-border)] bg-[color:var(--color-card)] px-2 py-1 text-[10px] uppercase tracking-[0.2em] text-[color:var(--color-text-muted)]">
                        {badgeLabel}
                      </span>
                      <ActivityMenu
                        onLeaveComment={() => {
                          if (log.taskId && log.task) {
                            setTaskDrawer({ open: true, task: log.task });
                          } else {
                            openEditLogModal(log);
                          }
                        }}
                      />
                    </div>
                  </div>
                  <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-[color:var(--color-text-subtle)]">
                    <span suppressHydrationWarning>
                      {isHydrated ? formatDateTime(log.date) : ""}
                    </span>
                  </div>
                  <p className="mt-2 text-sm text-[color:var(--color-text)]">
                    {log.description}
                  </p>
                  {log.task ? (
                    <p className="mt-2 text-xs text-[color:var(--color-text-muted)]">
                      Task: {log.task.title}
                    </p>
                  ) : null}
                  {isManualLog && log.startAt && log.endAt ? (
                    <p className="mt-2 text-xs text-[color:var(--color-text-muted)]">
                      Time: {formatTimeOnly(log.startAt)} -{" "}
                      {formatTimeOnly(log.endAt)}
                    </p>
                  ) : null}
                  {isManualLog && manualCategoryLabels.length ? (
                    <p className="mt-2 text-xs text-[color:var(--color-text-muted)]">
                      Categories: {manualCategoryLabels.join(", ")}
                    </p>
                  ) : null}
                </div>
              );
            })
          )}
        </div>
      )}

      <Modal
        isOpen={logModal.open}
        title={logModal.mode === "edit" ? "Edit manual log" : "Manual log activity"}
        description={
          logModal.mode === "edit"
            ? "Update your manual activity log and review comments."
            : "Capture a manual activity entry for the timeline."
        }
        onClose={closeLogModal}
      >
        <form
          onSubmit={handleSubmitLog}
          className="flex h-full flex-col"
        >
          <div className="mt-4 flex-1 space-y-4 overflow-y-auto pr-1 hide-scrollbar">
            <div className="grid gap-3 lg:grid-cols-4">
              <div className="grid gap-2 text-xs text-[color:var(--color-text-muted)] lg:col-span-2">
                Categories
                <div className="flex flex-wrap gap-2">
                  {manualCategories.map((category) => (
                    <label
                      key={category.id}
                      className="flex items-center gap-2 rounded-full border border-[color:var(--color-border)] bg-[color:var(--color-input)] px-3 py-2 text-xs text-[color:var(--color-text)]"
                    >
                      <input
                        type="checkbox"
                        checked={logForm.categories.includes(category.id)}
                        onChange={() => toggleCategory(category.id)}
                        className="h-4 w-4 accent-[color:var(--color-accent)]"
                      />
                      <span>{category.label}</span>
                    </label>
                  ))}
                </div>
              </div>
              <label className="grid gap-2 text-xs text-[color:var(--color-text-muted)]">
                Date
                <input
                  type="date"
                  name="date"
                  value={logForm.date}
                  onChange={handleLogChange}
                  min={getManualLogDateBounds().min}
                  max={getManualLogDateBounds().max}
                  className="rounded-xl border border-[color:var(--color-border)] bg-[color:var(--color-input)] px-3 py-2 text-sm text-[color:var(--color-text)] outline-none focus:border-[color:var(--color-accent)]"
                />
                <span className="text-[11px] text-[color:var(--color-text-subtle)]">
                  Only today or the last 2 days are allowed.
                </span>
              </label>
              <label className="grid gap-2 text-xs text-[color:var(--color-text-muted)]">
                Start time
                <input
                  type="time"
                  name="startTime"
                  value={logForm.startTime}
                  onChange={handleLogChange}
                  className="rounded-xl border border-[color:var(--color-border)] bg-[color:var(--color-input)] px-3 py-2 text-sm text-[color:var(--color-text)] outline-none focus:border-[color:var(--color-accent)]"
                />
              </label>
              <label className="grid gap-2 text-xs text-[color:var(--color-text-muted)]">
                End time
                <input
                  type="time"
                  name="endTime"
                  value={logForm.endTime}
                  onChange={handleLogChange}
                  className="rounded-xl border border-[color:var(--color-border)] bg-[color:var(--color-input)] px-3 py-2 text-sm text-[color:var(--color-text)] outline-none focus:border-[color:var(--color-accent)]"
                />
              </label>
            </div>
            <label className="grid gap-2 text-xs text-[color:var(--color-text-muted)]">
              Description
              <textarea
                name="description"
                value={logForm.description}
                onChange={handleLogChange}
                rows={4}
                placeholder="Summarize what you worked on."
                className="rounded-xl border border-[color:var(--color-border)] bg-[color:var(--color-input)] px-3 py-2 text-sm text-[color:var(--color-text)] outline-none focus:border-[color:var(--color-accent)]"
              />
            </label>

            {logModal.mode === "edit" && activeLog ? (
              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[color:var(--color-text-subtle)]">
                  Comments
                </p>
                <CommentThread
                  entityType="MANUAL_LOG"
                  entityId={activeLog.id}
                  currentUser={currentUser}
                  variant="chat"
                  onCommentAdded={(comment) =>
                    setCommentCounts((prev) => ({
                      ...prev,
                      [comment.entityId]:
                        (prev[comment.entityId] ?? 0) + 1,
                    }))
                  }
                />
              </div>
            ) : null}
          </div>
          <div className="sticky bottom-0 mt-4 flex flex-wrap items-center justify-end gap-3 border-t border-[color:var(--color-border)] bg-[color:var(--color-card)] pt-4">
            <ActionButton
              label={logModal.mode === "edit" ? "Save changes" : "Save log"}
              variant="primary"
              type="submit"
              className="min-w-[140px]"
              disabled={!isManualLogDateAllowed(logForm.date, getManualLogDateBounds())}
            />
          </div>
        </form>
      </Modal>

      <Drawer
        isOpen={taskDrawer.open}
        title={taskDrawer.task?.title ? "Task comments" : "Task"}
        onClose={() => setTaskDrawer({ open: false, task: null })}
        width="28rem"
      >
        {taskDrawer.task ? (
          <div className="space-y-4">
            <p className="text-sm text-[color:var(--color-text-muted)]">
              Leave feedback on the task activity below.
            </p>
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[color:var(--color-text-subtle)]">
                Comments
              </p>
              <CommentThread
                entityType="TASK"
                entityId={taskDrawer.task.id}
                currentUser={currentUser}
                autoFocus
                users={users}
              />
            </div>
          </div>
        ) : null}
      </Drawer>
    </div>
  );
}
