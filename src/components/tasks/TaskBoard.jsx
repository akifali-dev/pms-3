"use client";

import { useMemo, useState } from "react";
import ActionButton from "@/components/ui/ActionButton";
import { useToast } from "@/components/ui/ToastProvider";
import { TASK_STATUSES, getNextStatuses, getStatusLabel } from "@/lib/kanban";
import { canMoveTask, roles } from "@/lib/roles";

export default function TaskBoard({ tasks, role, currentUserId }) {
  const { addToast } = useToast();
  const [taskItems, setTaskItems] = useState(tasks);
  const [pendingTaskId, setPendingTaskId] = useState(null);
  const [pendingChecklistId, setPendingChecklistId] = useState(null);
  const [scope, setScope] = useState(currentUserId ? "mine" : "all");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [ownerFilter, setOwnerFilter] = useState("ALL");

  const ownerOptions = useMemo(() => {
    const owners = new Map();
    taskItems.forEach((task) => {
      if (task.owner) {
        owners.set(task.owner.id, task.owner.name);
      }
    });
    return Array.from(owners.entries()).map(([id, name]) => ({ id, name }));
  }, [taskItems]);

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

    setPendingTaskId(task.id);
    const response = await fetch(`/api/tasks/${task.id}`, {
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

  const canEditChecklist = (task) => {
    if (!currentUserId) {
      return false;
    }

    if (task.ownerId === currentUserId) {
      return true;
    }

    return [roles.PM, roles.CTO, roles.SENIOR_DEV].includes(role);
  };

  const renderActions = (task) => {
    const isPending = pendingTaskId === task.id;
    const buttonClass = isPending ? "pointer-events-none opacity-60" : "";

    if (task.status === "TESTING") {
      if (role === roles.PM) {
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
        <p className="text-xs text-white/50">
          Awaiting PM approval for testing.
        </p>
      );
    }

    if (task.status === "DONE") {
      return <p className="text-xs text-emerald-300">Completed</p>;
    }

    if (task.status === "REJECTED") {
      if (!canMoveTask(role)) {
        return (
          <p className="text-xs text-white/50">
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

    if (!canMoveTask(role)) {
      return (
        <p className="text-xs text-white/50">
          You do not have permission to move this task.
        </p>
      );
    }

    const nextStatus = getNextStatuses(task.status)[0];

    if (task.status === "DEV_TEST" && !isChecklistComplete(task)) {
      return (
        <p className="text-xs text-amber-200">
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

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-white/10 bg-white/5 p-4">
        <div className="flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-white/40">
          Filters
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className={`rounded-full border px-3 py-1 text-xs font-semibold transition ${
              scope === "mine"
                ? "border-white/60 bg-white/10 text-white"
                : "border-white/10 text-white/60 hover:border-white/30"
            }`}
            onClick={() => setScope("mine")}
          >
            My Tasks
          </button>
          <button
            type="button"
            className={`rounded-full border px-3 py-1 text-xs font-semibold transition ${
              scope === "all"
                ? "border-white/60 bg-white/10 text-white"
                : "border-white/10 text-white/60 hover:border-white/30"
            }`}
            onClick={() => setScope("all")}
          >
            All Tasks
          </button>
        </div>
        <label className="flex items-center gap-2 text-xs text-white/70">
          Status
          <select
            className="rounded-lg border border-white/10 bg-slate-950/70 px-3 py-2 text-xs text-white"
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
        <label className="flex items-center gap-2 text-xs text-white/70">
          Owner
          <select
            className="rounded-lg border border-white/10 bg-slate-950/70 px-3 py-2 text-xs text-white"
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

      <div className="flex gap-4 overflow-x-auto pb-2">
        {TASK_STATUSES.map((status) => (
          <div
            key={status.id}
            className="min-w-[220px] flex-1 space-y-3 rounded-2xl border border-white/10 bg-slate-950/50 p-4"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-white">
                {status.label}
              </h3>
              <span className="rounded-full border border-white/10 px-2 py-1 text-xs text-white/60">
                {groupedTasks[status.id]?.length ?? 0}
              </span>
            </div>
            <div className="space-y-3">
              {(groupedTasks[status.id] ?? []).map((task) => (
                <div
                  key={task.id}
                  className="rounded-xl border border-white/10 bg-slate-900/70 p-4"
                >
                  <p className="text-sm font-semibold text-white">
                    {task.title}
                  </p>
                  <p className="mt-1 text-xs text-white/60">
                    {task.milestone?.title ?? "No milestone"} ·{" "}
                    {task.owner?.name ?? "Unassigned"}
                  </p>
                  <div className="mt-3 flex flex-col gap-3">
                    <span className="w-fit rounded-full border border-white/10 px-3 py-1 text-xs text-white/60">
                      {getStatusLabel(task.status)}
                    </span>
                    <div className="rounded-xl border border-white/10 bg-slate-950/40 p-3">
                      <div className="flex items-center justify-between text-xs text-white/60">
                        <span className="font-semibold uppercase tracking-[0.2em]">
                          Checklist
                        </span>
                        <span>
                          {task.checklistItems?.filter((item) => item.isCompleted)
                            .length ?? 0}
                          /{task.checklistItems?.length ?? 0}
                        </span>
                      </div>
                      {task.checklistItems?.length ? (
                        <ul className="mt-3 space-y-2">
                          {task.checklistItems.map((item) => {
                            const isUpdating = pendingChecklistId === item.id;
                            const isEditable = canEditChecklist(task);
                            return (
                              <li
                                key={item.id}
                                className={`flex items-start gap-2 text-xs text-white/70 ${
                                  isUpdating ? "opacity-60" : ""
                                }`}
                              >
                                <input
                                  type="checkbox"
                                  checked={item.isCompleted}
                                  disabled={!isEditable || isUpdating}
                                  onChange={(event) =>
                                    handleChecklistToggle(
                                      task.id,
                                      item,
                                      event.target.checked
                                    )
                                  }
                                  className="mt-0.5 h-4 w-4 rounded border-white/30 bg-transparent text-emerald-400"
                                />
                                <span
                                  className={
                                    item.isCompleted
                                      ? "line-through text-white/40"
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
                        <p className="mt-2 text-xs text-white/40">
                          No checklist items assigned.
                        </p>
                      )}
                      {task.status === "TESTING" && role === roles.PM && (
                        <p className="mt-3 text-xs text-sky-200">
                          PM review checklist for testing sign-off.
                        </p>
                      )}
                    </div>
                    {renderActions(task)}
                  </div>
                </div>
              ))}
              {(groupedTasks[status.id] ?? []).length === 0 && (
                <p className="text-xs text-white/40">No tasks here.</p>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
