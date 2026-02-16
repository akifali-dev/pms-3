"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import ActionButton from "@/components/ui/ActionButton";
import Drawer from "@/components/ui/Drawer";
import CommentThread from "@/components/comments/CommentThread";
import { useToast } from "@/components/ui/ToastProvider";
import { TASK_STATUSES, getNextStatuses, getStatusLabel } from "@/lib/kanban";
import { canMarkTaskDone, roles } from "@/lib/roles";
import { BREAK_TYPES, formatBreakTypes } from "@/lib/breakTypes";

const formatDurationShort = (totalSeconds = 0) => {
  const seconds = Math.max(0, Number(totalSeconds) || 0);
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (hours > 0 && minutes > 0) {
    return `${hours}h ${minutes}m`;
  }
  if (hours > 0) {
    return `${hours}h`;
  }
  return `${minutes}m`;
};

const formatEstimatedTime = (hoursValue = 0) => {
  const hours = Math.max(0, Number(hoursValue) || 0);
  const wholeHours = Math.floor(hours);
  const minutes = Math.round((hours - wholeHours) * 60);
  if (wholeHours > 0 && minutes > 0) {
    return `${wholeHours}h ${minutes}m`;
  }
  if (wholeHours > 0) {
    return `${wholeHours}h`;
  }
  return minutes > 0 ? `${minutes}m` : "0m";
};

const formatBreakReason = (reasons, fallback = null) => formatBreakTypes(reasons, fallback);

const getPresenceLabel = (task) => {
  const status = task?.presenceStatusNow;
  if (status === "IN_OFFICE") {
    return "In office";
  }
  if (status === "WFH") {
    return "WFH";
  }
  if (status === "OFF_DUTY") {
    return "Off duty";
  }
  return task?.isWFHNow
    ? "WFH"
    : task?.isOnDutyNow
      ? "In office"
      : "Off duty";
};

const getProgressState = (task) => {
  if (task.status === "DONE") {
    return "completed";
  }
  const estimatedSeconds = Math.max(0, (task.estimatedHours ?? 0) * 3600);
  const spentSeconds = Number(
    task.spentTimeSeconds ?? task.totalTimeSpent ?? 0
  );
  if (estimatedSeconds > 0 && spentSeconds > estimatedSeconds) {
    return "overdue";
  }
  return "onTrack";
};

const getProgressColor = (state) => {
  if (state === "completed") {
    return "stroke-emerald-400";
  }
  if (state === "overdue") {
    return "stroke-rose-400";
  }
  return "stroke-sky-400";
};

const getTypeBadge = (type) => {
  switch (type) {
    case "AUTH":
      return "bg-amber-500/20 text-amber-300 border-amber-500/30";
    case "API":
      return "bg-sky-500/20 text-sky-300 border-sky-500/30";
    case "REFACTOR":
      return "bg-rose-500/20 text-rose-300 border-rose-500/30";
    case "CHART":
      return "bg-emerald-500/20 text-emerald-300 border-emerald-500/30";
    default:
      return "bg-violet-500/20 text-violet-300 border-violet-500/30";
  }
};

export default function TaskBoard({
  tasks,
  role,
  currentUserId,
  onEditTask,
}) {
  const { addToast } = useToast();
  const searchParams = useSearchParams();
  const [taskItems, setTaskItems] = useState(tasks);
  const [pendingTaskId, setPendingTaskId] = useState(null);
  const [pendingChecklistId, setPendingChecklistId] = useState(null);
  const [draggingTaskId, setDraggingTaskId] = useState(null);
  const [dragOverStatus, setDragOverStatus] = useState(null);
  // Default to all tasks so milestone boards don't appear empty for managers.
  const [scope, setScope] = useState("all");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [ownerFilter, setOwnerFilter] = useState("ALL");
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [selectedTaskId, setSelectedTaskId] = useState(null);
  const [activeTab, setActiveTab] = useState("overview");
  const [timeRequestOpen, setTimeRequestOpen] = useState(false);
  const [timeRequestForm, setTimeRequestForm] = useState({
    hours: "",
    minutes: "",
    reason: "",
  });
  const [timeRequests, setTimeRequests] = useState([]);
  const [timeRequestsLoading, setTimeRequestsLoading] = useState(false);
  const [timeRequestActionId, setTimeRequestActionId] = useState(null);
  const [requestSubmitting, setRequestSubmitting] = useState(false);
  const [breakForm, setBreakForm] = useState({
    reasons: ["NAMAZ"],
    note: "",
  });
  const [breakPanelOpen, setBreakPanelOpen] = useState(false);
  const [breakSubmitting, setBreakSubmitting] = useState(false);

  useEffect(() => {
    setTaskItems(tasks);
  }, [tasks]);

  useEffect(() => {
    const taskId = searchParams?.get("taskId");
    if (!taskId) {
      return;
    }
    setSelectedTaskId(taskId);
  }, [searchParams]);

  const ownerOptions = useMemo(() => {
    const owners = new Map();
    taskItems.forEach((task) => {
      if (task.owner) {
        owners.set(task.owner.id, task.owner.name);
      }
    });
    return Array.from(owners.entries()).map(([id, name]) => ({ id, name }));
  }, [taskItems]);

  const mentionUsers = useMemo(() => {
    const users = new Map();
    taskItems.forEach((task) => {
      if (task.owner) {
        users.set(task.owner.id, task.owner);
      }
    });
    return Array.from(users.values());
  }, [taskItems]);

  const selectedTask = useMemo(
    () => taskItems.find((task) => task.id === selectedTaskId) ?? null,
    [taskItems, selectedTaskId]
  );
  const selectedSpentSeconds = Number(selectedTask?.spentTimeSeconds ?? 0);

  const isManager = [roles.PM, roles.CTO].includes(role);

  const isTaskOwner = (task) => {
    if (!currentUserId || !task) {
      return false;
    }

    return task.ownerId === currentUserId;
  };

  const loadTimeRequests = useCallback(async (taskId) => {
    if (!taskId) {
      setTimeRequests([]);
      return;
    }
    setTimeRequestsLoading(true);
    try {
      const response = await fetch(`/api/tasks/${taskId}/time-requests`);
      const data = await response.json();
      if (response.ok) {
        setTimeRequests(data?.requests ?? []);
      } else {
        setTimeRequests([]);
      }
    } catch (error) {
      setTimeRequests([]);
    } finally {
      setTimeRequestsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (selectedTask?.id) {
      const tab = searchParams?.get("tab") || "overview";
      setActiveTab(tab);
      setTimeRequestOpen(false);
      setBreakPanelOpen(false);
    }
  }, [selectedTask?.id, searchParams]);

  useEffect(() => {
    if (!selectedTask?.id) {
      setTimeRequests([]);
      return;
    }
    const isOwner = selectedTask.ownerId === currentUserId;
    if (!isManager && !isOwner) {
      setTimeRequests([]);
      return;
    }
    loadTimeRequests(selectedTask.id);
  }, [
    selectedTask?.id,
    selectedTask?.ownerId,
    isManager,
    currentUserId,
    loadTimeRequests,
  ]);

  useEffect(() => {
    if (selectedTaskId && !selectedTask && taskItems.length > 0) {
      setSelectedTaskId(null);
    }
  }, [selectedTaskId, selectedTask, taskItems.length]);

  const filteredTasks = useMemo(() => {
    return taskItems.filter((task) => {
      if (scope === "mine" && currentUserId) {
        if (task.ownerId !== currentUserId) {
          return false;
        }
      }

      if (statusFilter !== "ALL" && task.status !== statusFilter) {
        return false;
      }

      if (ownerFilter !== "ALL" && task.ownerId !== ownerFilter) {
        return false;
      }

      return true;
    });
  }, [taskItems, scope, currentUserId, statusFilter, ownerFilter]);

  const groupedTasks = useMemo(() => {
    const buckets = {};
    TASK_STATUSES.forEach((status) => {
      buckets[status.id] = [];
    });
    filteredTasks.forEach((task) => {
      if (!buckets[task.status]) {
        buckets[task.status] = [];
      }
      buckets[task.status].push(task);
    });
    return buckets;
  }, [filteredTasks]);

  const handleStatusChange = async (task, nextStatus) => {
    if (!nextStatus) {
      return;
    }

    if (!canMoveTaskForTask(task)) {
      addToast({
        title: "Move blocked",
        message: "You can only move tasks assigned to you.",
        variant: "error",
      });
      return;
    }

    setPendingTaskId(task.id);
    const response = await fetch(`/api/tasks/${task.id}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: nextStatus }),
    });

    const responseText = await response.text();
    let data = null;
    if (responseText) {
      try {
        data = JSON.parse(responseText);
      } catch (error) {
        data = null;
      }
    }

    if (!response.ok) {
      addToast({
        title: "Action blocked",
        message: data?.error ?? "This action is not permitted.",
        variant: "error",
      });
      setPendingTaskId(null);
      return;
    }

    if (!data?.task) {
      addToast({
        title: "Update failed",
        message: "Unable to refresh task details after the move.",
        variant: "error",
      });
      setPendingTaskId(null);
      return;
    }

    setTaskItems((prev) =>
      prev.map((item) => (item.id === task.id ? data.task : item))
    );

    if (data?.warning) {
      addToast({
        title: "Off duty",
        message: data.warning,
        variant: "warning",
      });
    }

    addToast({
      title: "Task moved",
      message: `Moved to ${getStatusLabel(nextStatus)}.`,
      variant: "success",
    });
    setPendingTaskId(null);
  };

  const updateTaskState = (taskId, updater) => {
    setTaskItems((prev) =>
      prev.map((item) => (item.id === taskId ? updater(item) : item))
    );
  };

  const refreshTask = useCallback(async (taskId) => {
    if (!taskId) {
      return null;
    }
    try {
      const response = await fetch(`/api/tasks/${taskId}`);
      const data = await response.json();
      if (!response.ok || !data?.task) {
        return null;
      }
      setTaskItems((prev) =>
        prev.map((item) => (item.id === taskId ? data.task : item))
      );
      return data.task;
    } catch (error) {
      return null;
    }
  }, []);

  const handleRequestTimeSubmit = async (task) => {
    if (!task) {
      return;
    }
    const hours = Number(timeRequestForm.hours || 0);
    const minutes = Number(timeRequestForm.minutes || 0);
    const totalSeconds = Math.max(0, Math.round(hours * 3600 + minutes * 60));
    if (!totalSeconds) {
      addToast({
        title: "Time needed",
        message: "Add hours or minutes to request more time.",
        variant: "error",
      });
      return;
    }
    if (!timeRequestForm.reason.trim()) {
      addToast({
        title: "Reason required",
        message: "Please share a reason for the extra time.",
        variant: "error",
      });
      return;
    }
    setRequestSubmitting(true);
    const response = await fetch(`/api/tasks/${task.id}/time-requests`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        requestedSeconds: totalSeconds,
        reason: timeRequestForm.reason.trim(),
      }),
    });
    const data = await response.json();
    if (!response.ok) {
      addToast({
        title: "Request failed",
        message: data?.error ?? "Unable to request more time.",
        variant: "error",
      });
      setRequestSubmitting(false);
      return;
    }
    addToast({
      title: "Request sent",
      message: "PM/CTO have been notified.",
      variant: "success",
    });
    setTimeRequests((prev) => [data.request, ...prev]);
    setTimeRequestForm({ hours: "", minutes: "", reason: "" });
    setTimeRequestOpen(false);
    setRequestSubmitting(false);
  };

  const handleReviewTimeRequest = async (request, nextStatus) => {
    if (!request?.id || !selectedTask?.id) {
      return;
    }
    setTimeRequestActionId(request.id);
    const response = await fetch(`/api/time-requests/${request.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: nextStatus }),
    });
    const data = await response.json();
    if (!response.ok) {
      addToast({
        title: "Review failed",
        message: data?.error ?? "Unable to review time request.",
        variant: "error",
      });
      setTimeRequestActionId(null);
      return;
    }

    setTimeRequests((prev) =>
      prev.map((item) => (item.id === request.id ? data.request : item))
    );

    if (nextStatus === "APPROVED") {
      const addedHours = Number(request.requestedSeconds ?? 0) / 3600;
      updateTaskState(selectedTask.id, (item) => ({
        ...item,
        estimatedHours: (item.estimatedHours ?? 0) + addedHours,
      }));
    }

    addToast({
      title: "Request updated",
      message:
        nextStatus === "APPROVED"
          ? "Extra time approved."
          : "Request rejected.",
      variant: "success",
    });
    setTimeRequestActionId(null);
  };

  const handlePause = async (task) => {
    if (!task?.id) {
      return;
    }
    if (!breakForm.reasons.length) {
      addToast({
        title: "Select break types",
        message: "Please select at least one break type.",
        variant: "error",
      });
      return;
    }
    setBreakSubmitting(true);
    const response = await fetch(`/api/tasks/${task.id}/breaks/start`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        reasons: breakForm.reasons,
        note: breakForm.note?.trim() || null,
      }),
    });
    const data = await response.json();
    if (!response.ok) {
      const message =
        response.status === 403
          ? "You are not allowed."
          : response.status === 409
            ? "Task is already paused."
            : data?.error ?? "Unable to start break.";
      addToast({
        title: "Pause failed",
        message,
        variant: "error",
      });
      setBreakSubmitting(false);
      return;
    }
    const refreshedTask = await refreshTask(task.id);
    if (!refreshedTask) {
      updateTaskState(task.id, (item) => ({
        ...item,
        breaks: [data.break, ...(item.breaks ?? [])],
        activeBreak: data.break,
      }));
    }
    setBreakPanelOpen(false);
    setBreakSubmitting(false);
  };

  const handleResume = async (task) => {
    if (!task?.id) {
      return;
    }
    setBreakSubmitting(true);
    const response = await fetch(`/api/tasks/${task.id}/breaks/end`, {
      method: "POST",
    });
    const data = await response.json();
    if (!response.ok) {
      const message =
        response.status === 403
          ? "You are not allowed."
          : response.status === 404
            ? "Task is not paused."
            : data?.error ?? "Unable to resume task.";
      addToast({
        title: "Resume failed",
        message,
        variant: "error",
      });
      setBreakSubmitting(false);
      return;
    }
    const refreshedTask = await refreshTask(task.id);
    if (!refreshedTask) {
      updateTaskState(task.id, (item) => ({
        ...item,
        breaks: data.break
          ? (item.breaks ?? []).map((brk) =>
              brk.id === data.break.id ? data.break : brk
            )
          : item.breaks ?? [],
        activeBreak: null,
      }));
    }
    setBreakSubmitting(false);
  };

  const handleChecklistToggle = async (taskId, item, nextValue) => {
    setPendingChecklistId(item.id);
    const response = await fetch(`/api/checklist-items/${item.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isCompleted: nextValue }),
    });

    const data = await response.json();

    if (!response.ok) {
      addToast({
        title: "Checklist update failed",
        message: data?.error ?? "Unable to update checklist item.",
        variant: "error",
      });
      setPendingChecklistId(null);
      return;
    }

    setTaskItems((prev) =>
      prev.map((task) => {
        if (task.id !== taskId) {
          return task;
        }

        return {
          ...task,
          checklistItems: task.checklistItems.map((existing) =>
            existing.id === item.id ? data.checklistItem : existing
          ),
        };
      })
    );

    setPendingChecklistId(null);
  };

  const isChecklistComplete = (task) =>
    task.checklistItems?.length > 0 &&
    task.checklistItems.every((item) => item.isCompleted);

  const canEditTask = (task) => {
    return Boolean(task) && isManager;
  };

  const canToggleChecklist = (task) => {
    if (!task) {
      return false;
    }

    return isManager || isTaskOwner(task);
  };

  const canMoveTaskForTask = (task) => {
    if (!currentUserId || !task) {
      return false;
    }

    if ([roles.PM, roles.CTO].includes(role)) {
      return true;
    }

    return task.ownerId === currentUserId;
  };

  const canRequestMoreTime = (task) => {
    if (!task) {
      return false;
    }

    return isTaskOwner(task) && [roles.DEV, roles.SENIOR_DEV].includes(role);
  };

  const canControlBreaks = (task) =>
    isTaskOwner(task) && ![roles.PM, roles.CTO].includes(role);

  const handleDragStart = (event, task) => {
    if (!canMoveTaskForTask(task)) {
      event.preventDefault();
      addToast({
        title: "Move blocked",
        message: "You can only move tasks assigned to you.",
        variant: "error",
      });
      return;
    }
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", task.id);
    setDraggingTaskId(task.id);
  };

  const handleDragEnd = () => {
    setDraggingTaskId(null);
    setDragOverStatus(null);
  };

  const handleDrop = (event, statusId) => {
    event.preventDefault();
    const taskId = event.dataTransfer.getData("text/plain");
    const task = taskItems.find((item) => item.id === taskId);
    setDragOverStatus(null);

    if (!task || task.status === statusId) {
      return;
    }

    if (!canMoveTaskForTask(task)) {
      addToast({
        title: "Move blocked",
        message: "You can only move tasks assigned to you.",
        variant: "error",
      });
      return;
    }

    handleStatusChange(task, statusId);
  };

  const renderActions = (task) => {
    const isPending = pendingTaskId === task.id;
    const buttonClass = isPending ? "pointer-events-none opacity-60" : "";

    if (task.status === "TESTING") {
      if (canMarkTaskDone(role)) {
        return (
          <div className="flex flex-wrap gap-2">
            <ActionButton
              label={isPending ? "Approving..." : "Approve"}
              size="sm"
              variant="success"
              className={buttonClass}
              onClick={() => handleStatusChange(task, "DONE")}
            />
            <ActionButton
              label={isPending ? "Rejecting..." : "Reject"}
              size="sm"
              variant="danger"
              className={buttonClass}
              onClick={() => handleStatusChange(task, "REJECTED")}
            />
          </div>
        );
      }

      return (
        <p className="text-xs text-[color:var(--color-text-subtle)]">
          Awaiting PM/CTO approval for testing.
        </p>
      );
    }

    if (task.status === "DONE") {
      return <p className="text-xs text-emerald-300">Completed</p>;
    }

    if (task.status === "REJECTED") {
      if (!canMoveTaskForTask(task)) {
        return (
          <p className="text-xs text-[color:var(--color-text-subtle)]">
            Rework required before resubmission.
          </p>
        );
      }

      return (
        <ActionButton
          label={isPending ? "Restarting..." : "Resume work"}
          size="sm"
          variant="warning"
          className={buttonClass}
          onClick={() => handleStatusChange(task, "IN_PROGRESS")}
        />
      );
    }

    if (!canMoveTaskForTask(task)) {
      return (
        <p className="text-xs text-[color:var(--color-text-subtle)]">
          You do not have permission to move this task.
        </p>
      );
    }

    const nextStatus = getNextStatuses(task.status)[0];

    if (task.status === "DEV_TEST" && !isChecklistComplete(task)) {
      return (
        <p className="text-xs text-amber-500">
          Complete the checklist before moving to testing.
        </p>
      );
    }

    return (
      <ActionButton
        label={isPending ? "Moving..." : "Move forward"}
        size="sm"
        variant="secondary"
        className={buttonClass}
        onClick={() => handleStatusChange(task, nextStatus)}
      />
    );
  };

  const ProgressRing = ({ progress, state }) => {
    const radius = 16;
    const circumference = 2 * Math.PI * radius;
    const offset = circumference * (1 - Math.min(Math.max(progress, 0), 1));
    return (
      <svg
        viewBox="0 0 40 40"
        className="h-10 w-10 -rotate-90"
        aria-hidden="true"
      >
        <circle
          cx="20"
          cy="20"
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth="3"
          className="text-[color:var(--color-border)]"
        />
        <circle
          cx="20"
          cy="20"
          r={radius}
          fill="none"
          strokeWidth="3"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className={getProgressColor(state)}
        />
      </svg>
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button
          type="button"
          onClick={() => setIsFilterOpen(true)}
          className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-[color:var(--color-border)] text-[color:var(--color-text-muted)] transition hover:border-[color:var(--color-accent)] hover:text-[color:var(--color-text)]"
          aria-label="Open filters"
          title="Filters"
        >
          <svg
            viewBox="0 0 24 24"
            className="h-4 w-4"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
          >
            <path
              d="M4 5h16l-6 7v5l-4 2v-7L4 5Z"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
      </div>

      <div className="flex gap-4 overflow-x-auto pb-2">
        {TASK_STATUSES.map((status) => (
          <div
            key={status.id}
            className={`min-w-[240px] flex-1 space-y-3 rounded-2xl border border-[color:var(--color-border)] bg-[color:var(--color-surface-muted)] p-4 transition ${
              dragOverStatus === status.id
                ? "border-[color:var(--color-accent)] bg-[color:var(--color-card)]"
                : ""
            }`}
            onDragOver={(event) => {
              event.preventDefault();
              setDragOverStatus(status.id);
            }}
            onDragLeave={() => setDragOverStatus(null)}
            onDrop={(event) => handleDrop(event, status.id)}
          >
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-[color:var(--color-text)]">
                {status.label}
              </h3>
              <span className="rounded-full border border-[color:var(--color-border)] px-2 py-1 text-xs text-[color:var(--color-text-muted)]">
                {groupedTasks[status.id]?.length ?? 0}
              </span>
            </div>
            <div className="space-y-3">
              {(groupedTasks[status.id] ?? []).map((task) => {
                const completedChecklistCount =
                  task.checklistItems?.filter((item) => item.isCompleted)
                    .length ?? 0;
                const checklistTotal = task.checklistItems?.length ?? 0;
                const estimatedSeconds = Math.max(
                  0,
                  (task.estimatedHours ?? 0) * 3600
                );
                const effectiveSpentSeconds = Number(
                  task.spentTimeSeconds ?? 0
                );
                const estimatedLabel =
                  estimatedSeconds > 0
                    ? formatEstimatedTime(task.estimatedHours)
                    : "No estimate";
                const progress =
                  estimatedSeconds > 0
                    ? effectiveSpentSeconds / estimatedSeconds
                    : 0;
                const progressState = getProgressState(task);
                return (
                  <div
                    key={task.id}
                    className={`cursor-pointer rounded-xl border border-[color:var(--color-border)] bg-[color:var(--color-card)] p-3 transition hover:border-[color:var(--color-accent)] ${
                      pendingTaskId === task.id ? "opacity-60" : ""
                    } ${draggingTaskId === task.id ? "opacity-70" : ""}`}
                    draggable={Boolean(currentUserId)}
                    onDragStart={(event) => handleDragStart(event, task)}
                    onDragEnd={handleDragEnd}
                    onClick={() => setSelectedTaskId(task.id)}
                  >
                    <p className="text-sm font-semibold text-[color:var(--color-text)]">
                      {task.title}
                    </p>
                    <div className="mt-3 flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[color:var(--color-muted-bg)] text-xs font-semibold text-[color:var(--color-text)]">
                          {(task.owner?.name ?? "U").charAt(0).toUpperCase()}
                        </span>
                        <div className="flex items-center gap-1 text-xs text-[color:var(--color-text-subtle)]">
                          <svg
                            viewBox="0 0 24 24"
                            className="h-3.5 w-3.5"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="1.8"
                          >
                            <path
                              d="M9 12h8M9 7h8M5 7h.01M5 12h.01M5 17h.01M9 17h8"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            />
                          </svg>
                          <span>
                            {completedChecklistCount}/{checklistTotal}
                          </span>
                        </div>
                      </div>
                      <div className="flex flex-col items-center text-[10px] text-[color:var(--color-text-subtle)]">
                        <ProgressRing
                          progress={progress}
                          state={progressState}
                        />
                        <span>{estimatedLabel}</span>
                        <span>{formatDurationShort(effectiveSpentSeconds)}</span>
                        <span>{getPresenceLabel(task)}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
              {(groupedTasks[status.id] ?? []).length === 0 && (
                <p className="text-xs text-[color:var(--color-text-subtle)]">
                  No tasks here.
                </p>
              )}
            </div>
          </div>
        ))}
      </div>

      <Drawer
        isOpen={isFilterOpen}
        title="Filters"
        onClose={() => setIsFilterOpen(false)}
      >
        <div className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className={`rounded-full border px-3 py-1 text-xs font-semibold transition ${
                scope === "mine"
                  ? "border-[color:var(--color-accent)] bg-[color:var(--color-accent-muted)] text-[color:var(--color-accent)]"
                  : "border-[color:var(--color-border)] text-[color:var(--color-text-muted)] hover:border-[color:var(--color-accent)]"
              }`}
              onClick={() => setScope("mine")}
            >
              My Tasks
            </button>
            <button
              type="button"
              className={`rounded-full border px-3 py-1 text-xs font-semibold transition ${
                scope === "all"
                  ? "border-[color:var(--color-accent)] bg-[color:var(--color-accent-muted)] text-[color:var(--color-accent)]"
                  : "border-[color:var(--color-border)] text-[color:var(--color-text-muted)] hover:border-[color:var(--color-accent)]"
              }`}
              onClick={() => setScope("all")}
            >
              All Tasks
            </button>
          </div>
          <label className="flex flex-col gap-2 text-xs text-[color:var(--color-text-muted)]">
            Status
            <select
              className="rounded-lg border border-[color:var(--color-border)] bg-[color:var(--color-input)] px-3 py-2 text-xs text-[color:var(--color-text)]"
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
            >
              <option value="ALL">All</option>
              {TASK_STATUSES.map((status) => (
                <option key={status.id} value={status.id}>
                  {status.label}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-2 text-xs text-[color:var(--color-text-muted)]">
            Owner
            <select
              className="rounded-lg border border-[color:var(--color-border)] bg-[color:var(--color-input)] px-3 py-2 text-xs text-[color:var(--color-text)]"
              value={ownerFilter}
              onChange={(event) => setOwnerFilter(event.target.value)}
            >
              <option value="ALL">All</option>
              {ownerOptions.map((owner) => (
                <option key={owner.id} value={owner.id}>
                  {owner.name}
                </option>
              ))}
            </select>
          </label>
        </div>
      </Drawer>

      <Drawer
        isOpen={Boolean(selectedTask)}
        title="Task details"
        onClose={() => setSelectedTaskId(null)}
        width="28rem"
      >
        {selectedTask ? (
          <div className="space-y-6">
            <div className="flex flex-wrap gap-2">
              {[
                { id: "overview", label: "Overview" },
                { id: "checklist", label: "Checklist" },
                { id: "comments", label: "Comments" },
              ].map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={`rounded-full border px-4 py-1.5 text-xs font-semibold transition ${
                    activeTab === tab.id
                      ? "border-[color:var(--color-accent)] bg-[color:var(--color-muted-bg)] text-[color:var(--color-text)]"
                      : "border-[color:var(--color-border)] text-[color:var(--color-text-subtle)] hover:border-[color:var(--color-accent)]"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {activeTab === "overview" ? (
              <div className="space-y-4 text-sm text-[color:var(--color-text)]">
                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-lg font-semibold text-[color:var(--color-text)]">
                      {selectedTask.title}
                    </p>
                    <div className="flex items-center gap-2">
                      <span
                        className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.2em] ${getTypeBadge(
                          selectedTask.type
                        )}`}
                      >
                        {selectedTask.type}
                      </span>
                      {canEditTask(selectedTask) && onEditTask ? (
                        <ActionButton
                          label="Edit task"
                          size="sm"
                          variant="secondary"
                          onClick={() => onEditTask(selectedTask)}
                        />
                      ) : null}
                    </div>
                  </div>
                  <p className="text-sm text-[color:var(--color-text-muted)]">
                    {selectedTask.description}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[color:var(--color-text-subtle)]">
                    Assigned developer
                  </p>
                  <div className="mt-2 flex items-center gap-3">
                    <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[color:var(--color-muted-bg)] text-sm font-semibold text-[color:var(--color-text)]">
                      {(selectedTask.owner?.name ?? "U").charAt(0).toUpperCase()}
                    </span>
                    <span className="text-sm text-[color:var(--color-text-muted)]">
                      {selectedTask.owner?.name ?? "Unassigned"}
                    </span>
                  </div>
                </div>

                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[color:var(--color-text-subtle)]">
                    Status
                  </p>
                  <span className="mt-2 inline-flex w-fit rounded-full border border-[color:var(--color-border)] px-3 py-1 text-xs text-[color:var(--color-text-muted)]">
                    {getStatusLabel(selectedTask.status)}
                  </span>
                </div>


                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[color:var(--color-text-subtle)]">
                    Time tracking
                  </p>
                  <div className="mt-3 flex items-center gap-4">
                    <ProgressRing
                      progress={
                        (selectedTask.estimatedHours ?? 0) > 0
                          ? selectedSpentSeconds /
                            ((selectedTask.estimatedHours ?? 0) * 3600)
                          : 0
                      }
                      state={getProgressState(selectedTask)}
                    />
                    <div className="space-y-1 text-xs text-[color:var(--color-text-muted)]">
                      <p>
                        Estimated{" "}
                        <span className="font-semibold text-[color:var(--color-text)]">
                          {formatEstimatedTime(selectedTask.estimatedHours)}
                        </span>
                      </p>
                      <p>
                        Spent{" "}
                        <span className="font-semibold text-[color:var(--color-text)]">
                          {formatDurationShort(selectedSpentSeconds)}
                        </span>
                      </p>
                      <p>
                        Status{" "}
                        <span className="font-semibold text-[color:var(--color-text)]">
                        {getPresenceLabel(selectedTask)}
                        </span>
                      </p>
                      {selectedTask.isOffDutyNow ? (
                        <p className="text-[11px] text-[color:var(--color-text-subtle)]">
                          Off duty – no time counted.
                        </p>
                      ) : null}
                    </div>
                  </div>
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    {canRequestMoreTime(selectedTask) ? (
                      <ActionButton
                        label="Request more time"
                        size="sm"
                        variant="secondary"
                        onClick={() => setTimeRequestOpen((prev) => !prev)}
                      />
                    ) : null}
                    {(() => {
                      const isAllowedStatus = ["IN_PROGRESS", "DEV_TEST"].includes(
                        selectedTask.status
                      );
                      const canControl = canControlBreaks(selectedTask);
                      const isDisabled = !(isAllowedStatus && canControl);
                      const tooltip = !canControl
                        ? "Only the assigned developer can pause or resume time."
                        : !isAllowedStatus
                          ? "Breaks are only available when a task is in progress or in dev test."
                          : undefined;
                      return (
                      <ActionButton
                        label={selectedTask.activeBreak ? "Resume" : "Pause"}
                        size="sm"
                        variant={selectedTask.activeBreak ? "success" : "warning"}
                        onClick={() =>
                          selectedTask.activeBreak
                            ? handleResume(selectedTask)
                            : setBreakPanelOpen((prev) => !prev)
                        }
                        disabled={isDisabled || breakSubmitting}
                        title={tooltip}
                        className={breakSubmitting ? "pointer-events-none opacity-60" : ""}
                      />
                      );
                    })()}
                  </div>
                  {selectedTask.activeBreak ? (
                    <p className="mt-2 text-xs text-amber-400">
                      Paused: {formatBreakReason(selectedTask.activeBreak.reasons, selectedTask.activeBreak.reason)} (
                      {new Date(
                        selectedTask.activeBreak.startedAt
                      ).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                      )
                    </p>
                  ) : null}
                </div>

                {timeRequestOpen ? (
                  <div className="rounded-2xl border border-[color:var(--color-border)] bg-[color:var(--color-muted-bg)] p-4">
                    <div className="flex flex-wrap gap-3">
                      <label className="flex flex-1 flex-col gap-2 text-xs text-[color:var(--color-text-muted)]">
                        Hours
                        <input
                          type="number"
                          min="0"
                          value={timeRequestForm.hours}
                          onChange={(event) =>
                            setTimeRequestForm((prev) => ({
                              ...prev,
                              hours: event.target.value,
                            }))
                          }
                          className="rounded-lg border border-[color:var(--color-border)] bg-[color:var(--color-input)] px-3 py-2 text-sm text-[color:var(--color-text)]"
                        />
                      </label>
                      <label className="flex flex-1 flex-col gap-2 text-xs text-[color:var(--color-text-muted)]">
                        Minutes
                        <input
                          type="number"
                          min="0"
                          max="59"
                          value={timeRequestForm.minutes}
                          onChange={(event) =>
                            setTimeRequestForm((prev) => ({
                              ...prev,
                              minutes: event.target.value,
                            }))
                          }
                          className="rounded-lg border border-[color:var(--color-border)] bg-[color:var(--color-input)] px-3 py-2 text-sm text-[color:var(--color-text)]"
                        />
                      </label>
                    </div>
                    <label className="mt-3 flex flex-col gap-2 text-xs text-[color:var(--color-text-muted)]">
                      Reason
                      <textarea
                        value={timeRequestForm.reason}
                        onChange={(event) =>
                          setTimeRequestForm((prev) => ({
                            ...prev,
                            reason: event.target.value,
                          }))
                        }
                        rows={3}
                        className="rounded-lg border border-[color:var(--color-border)] bg-[color:var(--color-input)] px-3 py-2 text-sm text-[color:var(--color-text)]"
                      />
                    </label>
                    <div className="mt-3 flex justify-end gap-2">
                      <ActionButton
                        label="Cancel"
                        size="sm"
                        variant="secondary"
                        onClick={() => setTimeRequestOpen(false)}
                      />
                      <ActionButton
                        label={requestSubmitting ? "Sending..." : "Submit"}
                        size="sm"
                        variant="primary"
                        onClick={() => handleRequestTimeSubmit(selectedTask)}
                        className={
                          requestSubmitting ? "pointer-events-none opacity-60" : ""
                        }
                      />
                    </div>
                  </div>
                ) : null}

                {selectedTask &&
                (isManager || isTaskOwner(selectedTask)) ? (
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[color:var(--color-text-subtle)]">
                      Time requests
                    </p>
                    {timeRequestsLoading ? (
                      <p className="mt-2 text-xs text-[color:var(--color-text-subtle)]">
                        Loading time requests...
                      </p>
                    ) : timeRequests.length ? (
                      <ul className="mt-3 space-y-3 text-xs text-[color:var(--color-text-muted)]">
                        {timeRequests.map((request) => {
                          const isPending = request.status === "PENDING";
                          const isActing = timeRequestActionId === request.id;
                          return (
                            <li
                              key={request.id}
                              className="rounded-xl border border-[color:var(--color-border)] bg-[color:var(--color-muted-bg)] px-3 py-2"
                            >
                              <div className="flex flex-wrap items-center justify-between gap-2">
                                <div>
                                  <p className="text-[color:var(--color-text)]">
                                    {request.reason}
                                  </p>
                                  <p className="mt-1 text-[color:var(--color-text-subtle)]">
                                    Requested{" "}
                                    <span className="font-semibold text-[color:var(--color-text)]">
                                      {formatDurationShort(
                                        request.requestedSeconds
                                      )}
                                    </span>{" "}
                                    by{" "}
                                    {request.requestedBy?.name ??
                                      request.requestedBy?.email ??
                                      "Requester"}
                                  </p>
                                </div>
                                <span className="rounded-full border border-[color:var(--color-border)] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.2em] text-[color:var(--color-text-subtle)]">
                                  {request.status}
                                </span>
                              </div>
                              {isManager && isPending ? (
                                <div className="mt-3 flex flex-wrap gap-2">
                                  <ActionButton
                                    label="Approve"
                                    size="sm"
                                    variant="success"
                                    onClick={() =>
                                      handleReviewTimeRequest(
                                        request,
                                        "APPROVED"
                                      )
                                    }
                                    disabled={isActing}
                                    className={
                                      isActing
                                        ? "pointer-events-none opacity-60"
                                        : ""
                                    }
                                  />
                                  <ActionButton
                                    label="Reject"
                                    size="sm"
                                    variant="danger"
                                    onClick={() =>
                                      handleReviewTimeRequest(
                                        request,
                                        "REJECTED"
                                      )
                                    }
                                    disabled={isActing}
                                    className={
                                      isActing
                                        ? "pointer-events-none opacity-60"
                                        : ""
                                    }
                                  />
                                </div>
                              ) : null}
                            </li>
                          );
                        })}
                      </ul>
                    ) : (
                      <p className="mt-2 text-xs text-[color:var(--color-text-subtle)]">
                        No time requests yet.
                      </p>
                    )}
                  </div>
                ) : null}

                {breakPanelOpen ? (
                  <div className="rounded-2xl border border-[color:var(--color-border)] bg-[color:var(--color-muted-bg)] p-4">
                    <div className="flex flex-col gap-2 text-xs text-[color:var(--color-text-muted)]">
                      <p>Break reason</p>
                      <div className="rounded-lg border border-[color:var(--color-border)] bg-[color:var(--color-input)] p-3">
                        <div className="grid gap-1">
                          {BREAK_TYPES.map((reason) => (
                            <label key={reason} className="flex items-center gap-2 text-sm text-[color:var(--color-text)]">
                              <input
                                type="checkbox"
                                checked={breakForm.reasons.includes(reason)}
                                onChange={() =>
                                  setBreakForm((prev) => ({
                                    ...prev,
                                    reasons: prev.reasons.includes(reason)
                                      ? prev.reasons.filter((item) => item !== reason)
                                      : [...prev.reasons, reason],
                                  }))
                                }
                              />
                              {formatBreakTypes([reason])}
                            </label>
                          ))}
                        </div>
                      </div>
                    </div>
                    {breakForm.reasons.includes("OTHER") ? (
                      <label className="mt-3 flex flex-col gap-2 text-xs text-[color:var(--color-text-muted)]">
                        Note
                        <textarea
                          value={breakForm.note}
                          onChange={(event) =>
                            setBreakForm((prev) => ({
                              ...prev,
                              note: event.target.value,
                            }))
                          }
                          rows={2}
                          className="rounded-lg border border-[color:var(--color-border)] bg-[color:var(--color-input)] px-3 py-2 text-sm text-[color:var(--color-text)]"
                        />
                      </label>
                    ) : null}
                    <div className="mt-3 flex justify-end gap-2">
                      <ActionButton
                        label="Cancel"
                        size="sm"
                        variant="secondary"
                        onClick={() => setBreakPanelOpen(false)}
                      />
                      <ActionButton
                        label={breakSubmitting ? "Pausing..." : "Pause"}
                        size="sm"
                        variant="warning"
                        onClick={() => handlePause(selectedTask)}
                        className={
                          breakSubmitting ? "pointer-events-none opacity-60" : ""
                        }
                      />
                    </div>
                  </div>
                ) : null}

                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[color:var(--color-text-subtle)]">
                    Time logs
                  </p>
                  {selectedTask.timeLogs?.length ? (
                    <ul className="mt-3 space-y-2 text-xs text-[color:var(--color-text-muted)]">
                      {selectedTask.timeLogs.map((log) => (
                        <li
                          key={log.id}
                          className="rounded-xl border border-[color:var(--color-border)] bg-[color:var(--color-muted-bg)] px-3 py-2"
                        >
                          <p className="text-[color:var(--color-text)]">
                            {getStatusLabel(log.status)}
                          </p>
                          <p className="mt-1 text-[color:var(--color-text-subtle)]">
                            {new Date(log.startedAt).toLocaleDateString()} ·{" "}
                            {formatDurationShort(
                              log.endedAt
                                ? (new Date(log.endedAt).getTime() -
                                    new Date(log.startedAt).getTime()) /
                                    1000
                                : (Date.now() -
                                    new Date(log.startedAt).getTime()) /
                                    1000
                            )}
                          </p>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="mt-2 text-xs text-[color:var(--color-text-subtle)]">
                      No time logs recorded yet.
                    </p>
                  )}
                </div>
              </div>
            ) : null}

            {activeTab === "checklist" ? (
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[color:var(--color-text-subtle)]">
                  Checklist
                </p>
                {selectedTask.checklistItems?.length ? (
                  <ul className="mt-3 space-y-2 text-xs text-[color:var(--color-text-muted)]">
                    {selectedTask.checklistItems.map((item) => {
                      const isUpdating = pendingChecklistId === item.id;
                      const isEditable = canToggleChecklist(selectedTask);
                      return (
                        <li
                          key={item.id}
                          className={`flex items-start gap-2 ${
                            isUpdating ? "opacity-60" : ""
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={item.isCompleted}
                            disabled={!isEditable || isUpdating}
                            onChange={(event) =>
                              handleChecklistToggle(
                                selectedTask.id,
                                item,
                                event.target.checked
                              )
                            }
                            className="mt-0.5 h-4 w-4 rounded border-[color:var(--color-border)] bg-transparent text-emerald-500"
                          />
                          <span
                            className={
                              item.isCompleted
                                ? "line-through text-[color:var(--color-text-subtle)]"
                                : ""
                            }
                          >
                            {item.label}
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                ) : (
                  <p className="mt-2 text-xs text-[color:var(--color-text-subtle)]">
                    No checklist items assigned.
                  </p>
                )}
                {selectedTask.status === "TESTING" && canMarkTaskDone(role) && (
                  <p className="mt-3 text-xs text-sky-500">
                    PM review checklist for testing sign-off.
                  </p>
                )}
              </div>
            ) : null}

            {activeTab === "comments" ? (
              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[color:var(--color-text-subtle)]">
                  Comments
                </p>
                <CommentThread
                  entityType="TASK"
                  entityId={selectedTask.id}
                  currentUser={{ id: currentUserId }}
                  users={mentionUsers}
                />
              </div>
            ) : null}

            <div>{renderActions(selectedTask)}</div>
          </div>
        ) : null}
      </Drawer>
    </div>
  );
}
