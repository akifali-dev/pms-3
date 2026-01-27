"use client";

import { useEffect, useMemo, useState } from "react";
import ActionButton from "@/components/ui/ActionButton";
import Drawer from "@/components/ui/Drawer";
import { useToast } from "@/components/ui/ToastProvider";
import { TASK_STATUSES, getNextStatuses, getStatusLabel } from "@/lib/kanban";
import { canMarkTaskDone, roles } from "@/lib/roles";

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

const getProgressState = (task) => {
  if (task.status === "DONE") {
    return "completed";
  }
  const estimatedSeconds = Math.max(0, (task.estimatedHours ?? 0) * 3600);
  if (estimatedSeconds > 0 && task.totalTimeSpent > estimatedSeconds) {
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

  useEffect(() => {
    setTaskItems(tasks);
  }, [tasks]);

  const ownerOptions = useMemo(() => {
    const owners = new Map();
    taskItems.forEach((task) => {
      if (task.owner) {
        owners.set(task.owner.id, task.owner.name);
      }
    });
    return Array.from(owners.entries()).map(([id, name]) => ({ id, name }));
  }, [taskItems]);

  const selectedTask = useMemo(
    () => taskItems.find((task) => task.id === selectedTaskId) ?? null,
    [taskItems, selectedTaskId]
  );

  useEffect(() => {
    if (selectedTaskId && !selectedTask) {
      setSelectedTaskId(null);
    }
  }, [selectedTaskId, selectedTask]);

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

    const data = await response.json();

    if (!response.ok) {
      addToast({
        title: "Action blocked",
        message: data?.error ?? "This action is not permitted.",
        variant: "error",
      });
      setPendingTaskId(null);
      return;
    }

    setTaskItems((prev) =>
      prev.map((item) => (item.id === task.id ? data.task : item))
    );

    addToast({
      title: "Task moved",
      message: `Moved to ${getStatusLabel(nextStatus)}.`,
      variant: "success",
    });
    setPendingTaskId(null);
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
    if (!currentUserId) {
      return false;
    }

    return task.ownerId === currentUserId;
  };

  const canEditChecklist = (task) => {
    if (!currentUserId) {
      return false;
    }

    return task.ownerId === currentUserId;
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
                const progress =
                  estimatedSeconds > 0
                    ? task.totalTimeSpent / estimatedSeconds
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
                        <span>
                          {formatEstimatedTime(task.estimatedHours)}
                        </span>
                        <span>{formatDurationShort(task.totalTimeSpent)}</span>
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

            <div className="space-y-4 text-sm text-[color:var(--color-text)]">
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
                        ? selectedTask.totalTimeSpent /
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
                      Logged{" "}
                      <span className="font-semibold text-[color:var(--color-text)]">
                        {formatDurationShort(selectedTask.totalTimeSpent)}
                      </span>
                    </p>
                  </div>
                </div>
              </div>

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

              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[color:var(--color-text-subtle)]">
                  Checklist
                </p>
                {selectedTask.checklistItems?.length ? (
                  <ul className="mt-3 space-y-2 text-xs text-[color:var(--color-text-muted)]">
                    {selectedTask.checklistItems.map((item) => {
                      const isUpdating = pendingChecklistId === item.id;
                      const isEditable = canEditChecklist(selectedTask);
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
                {selectedTask.status === "TESTING" &&
                  canMarkTaskDone(role) && (
                  <p className="mt-3 text-xs text-sky-500">
                    PM review checklist for testing sign-off.
                  </p>
                )}
              </div>
            </div>

            <div>{renderActions(selectedTask)}</div>
          </div>
        ) : null}
      </Drawer>
    </div>
  );
}
