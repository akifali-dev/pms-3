"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import ActionButton from "@/components/ui/ActionButton";
import Modal from "@/components/ui/Modal";
import { useToast } from "@/components/ui/ToastProvider";
import TaskBoard from "@/components/tasks/TaskBoard";
import PageHeader from "@/components/layout/PageHeader";
import { TASK_STATUSES } from "@/lib/kanban";
import { TASK_TYPE_CHECKLISTS } from "@/lib/taskChecklists";
import { roles } from "@/lib/roles";

const buildErrorMessage = (data) =>
  data?.error ?? data?.message ?? "Unable to load milestone.";

export default function MilestoneDetailView({
  milestoneId,
  role,
  currentUserId,
}) {
  const { addToast } = useToast();
  const [milestone, setMilestone] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [status, setStatus] = useState({ loading: true, error: null });
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [savingTask, setSavingTask] = useState(false);
  const [editingTaskId, setEditingTaskId] = useState(null);
  const [users, setUsers] = useState([]);
  const [taskForm, setTaskForm] = useState({
    title: "",
    description: "",
    status: TASK_STATUSES[0]?.id ?? "BACKLOG",
    type: Object.keys(TASK_TYPE_CHECKLISTS)[0] ?? "UI",
    estimatedTime: "",
    ownerId: "",
    checklistItems: [],
  });

  const taskTypes = useMemo(() => Object.keys(TASK_TYPE_CHECKLISTS), []);
  const canManageAssignments = useMemo(
    () =>
      [roles.CEO, roles.PM, roles.CTO, roles.SENIOR_DEV].includes(role),
    [role]
  );

  const loadMilestone = useCallback(async () => {
    setStatus({ loading: true, error: null });
    try {
      const [milestoneResponse, tasksResponse] = await Promise.all([
        fetch(`/api/milestones/${milestoneId}`),
        fetch(`/api/tasks?milestoneId=${milestoneId}`),
      ]);
      const milestoneData = await milestoneResponse.json();
      const tasksData = await tasksResponse.json();

      if (!milestoneResponse.ok) {
        throw new Error(buildErrorMessage(milestoneData));
      }
      if (!tasksResponse.ok) {
        throw new Error(buildErrorMessage(tasksData));
      }

      setMilestone(milestoneData?.milestone ?? null);
      setTasks(tasksData?.tasks ?? []);
      setStatus({ loading: false, error: null });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unable to load milestone.";
      setStatus({ loading: false, error: message });
      addToast({
        title: "Milestone unavailable",
        message,
        variant: "error",
      });
    }
  }, [addToast, milestoneId]);

  useEffect(() => {
    loadMilestone();
  }, [loadMilestone]);

  useEffect(() => {
    if (!canManageAssignments) {
      return;
    }

    const loadUsers = async () => {
      try {
        const response = await fetch("/api/users?isActive=true");
        const data = await response.json();
        if (response.ok) {
          setUsers(data?.users ?? []);
        }
      } catch (error) {
        setUsers([]);
      }
    };

    loadUsers();
  }, [canManageAssignments]);

  const resetTaskForm = () => {
    setTaskForm({
      title: "",
      description: "",
      status: TASK_STATUSES[0]?.id ?? "BACKLOG",
      type: Object.keys(TASK_TYPE_CHECKLISTS)[0] ?? "UI",
      estimatedTime: "",
      ownerId: "",
      checklistItems: [],
    });
    setEditingTaskId(null);
  };

  const parseEstimatedTime = (value) => {
    if (!value) return 0;
    const input = value.toLowerCase().trim();
    if (!input) return 0;
    const hourMatch = input.match(/(\d+(?:\.\d+)?)\s*(h|hr|hrs|hour|hours)/);
    const minuteMatch = input.match(
      /(\d+(?:\.\d+)?)\s*(m|min|mins|minute|minutes)/
    );
    let hours = 0;
    let minutes = 0;
    let hasMatch = false;
    if (hourMatch) {
      hours = Number.parseFloat(hourMatch[1]);
      hasMatch = true;
    }
    if (minuteMatch) {
      minutes = Number.parseFloat(minuteMatch[1]);
      hasMatch = true;
    }
    if (!hasMatch) {
      const numeric = Number.parseFloat(input);
      if (Number.isFinite(numeric)) {
        hours = numeric;
        hasMatch = true;
      } else {
        return NaN;
      }
    }
    return Number.isFinite(hours + minutes / 60)
      ? Math.max(0, hours + minutes / 60)
      : NaN;
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
    return minutes > 0 ? `${minutes}m` : "";
  };

  const openEditTask = (task) => {
    setEditingTaskId(task.id);
    setTaskForm({
      title: task.title ?? "",
      description: task.description ?? "",
      status: task.status ?? (TASK_STATUSES[0]?.id ?? "BACKLOG"),
      type: task.type ?? (Object.keys(TASK_TYPE_CHECKLISTS)[0] ?? "UI"),
      estimatedTime: formatEstimatedTime(task.estimatedHours ?? 0),
      ownerId: task.ownerId ?? "",
      checklistItems: (task.checklistItems ?? []).map((item) => ({
        id: item.id,
        label: item.label,
        isCompleted: item.isCompleted,
      })),
    });
    setIsModalOpen(true);
  };

  const handleTaskSubmit = async (event) => {
    event.preventDefault();
    if (!taskForm.title.trim() || !taskForm.description.trim()) {
      addToast({
        title: "Task details needed",
        message: "Add a title and description to continue.",
        variant: "warning",
      });
      return;
    }

    const estimatedHours = parseEstimatedTime(taskForm.estimatedTime);
    if (!Number.isFinite(estimatedHours)) {
      addToast({
        title: "Estimated time invalid",
        message: "Enter a time like 2 hours 30 minutes or 20 minutes.",
        variant: "warning",
      });
      return;
    }

    setSavingTask(true);
    try {
      const payload = {
        title: taskForm.title,
        description: taskForm.description,
        type: taskForm.type,
        estimatedHours,
        ownerId: taskForm.ownerId || undefined,
      };

      const response = await fetch(
        editingTaskId ? `/api/tasks/${editingTaskId}` : "/api/tasks",
        {
          method: editingTaskId ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(
            editingTaskId
              ? {
                  ...payload,
                  checklistItems: taskForm.checklistItems,
                }
              : {
                  ...payload,
                  status: taskForm.status,
                  milestoneId,
                }
          ),
        }
      );
      const data = await response.json();

      if (!response.ok) {
        throw new Error(buildErrorMessage(data));
      }

      addToast({
        title: editingTaskId ? "Task updated" : "Task created",
        message: editingTaskId
          ? "Task changes have been saved."
          : "Task added to milestone execution queue.",
        variant: "success",
      });
      resetTaskForm();
      setIsModalOpen(false);
      if (editingTaskId) {
        setTasks((prev) =>
          prev.map((task) => (task.id === data.task.id ? data.task : task))
        );
      } else {
        loadMilestone();
      }
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : editingTaskId
            ? "Unable to update task."
            : "Unable to create task.";
      addToast({
        title: editingTaskId ? "Task update failed" : "Task creation failed",
        message,
        variant: "error",
      });
    } finally {
      setSavingTask(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={milestone?.project?.name ?? "Project milestones"}
        title={milestone?.title ?? "Milestone overview"}
        backHref={
          milestone?.project?.id
            ? `/projects/${milestone.project.id}`
            : "/milestones"
        }
        backLabel="Back to milestones"
        actions={
          <ActionButton
            label="Create task"
            variant="success"
            onClick={() => {
              resetTaskForm();
              setIsModalOpen(true);
            }}
          />
        }
      />

      {status.loading && (
        <div className="rounded-2xl border border-[color:var(--color-border)] bg-[color:var(--color-card)] p-6 text-sm text-[color:var(--color-text-muted)]">
          Loading milestone...
        </div>
      )}

      {!status.loading && status.error && (
        <div className="space-y-3 rounded-2xl border border-rose-500/30 bg-rose-500/10 p-6 text-sm text-rose-200">
          <p>{status.error}</p>
          <ActionButton label="Retry" variant="secondary" onClick={loadMilestone} />
        </div>
      )}

      {!status.loading && !status.error && milestone && (
        <>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-[color:var(--color-text)]">
                Task board
              </p>
              <span className="text-xs text-[color:var(--color-text-muted)]">
                {tasks.length} total
              </span>
            </div>
            {tasks.length ? (
              <TaskBoard
                tasks={tasks}
                role={role}
                currentUserId={currentUserId}
                onEditTask={openEditTask}
              />
            ) : (
              <div className="rounded-2xl border border-dashed border-[color:var(--color-border)] bg-[color:var(--color-card)] p-6 text-center text-sm text-[color:var(--color-text-muted)]">
                No tasks yet.
              </div>
            )}
          </div>
        </>
      )}

      <Modal
        isOpen={isModalOpen}
        title={editingTaskId ? "Edit task" : "Create task"}
        description={
          editingTaskId
            ? "Update the task details and checklist."
            : "Tasks created here are tied to this milestone."
        }
        onClose={
          savingTask
            ? undefined
            : () => {
                setIsModalOpen(false);
                resetTaskForm();
              }
        }
      >
        <form onSubmit={handleTaskSubmit} className="flex max-h-[60vh] flex-col">
          <div className="space-y-4 overflow-y-auto pr-1">
            <label className="text-xs text-[color:var(--color-text-muted)]">
              Task title
              <input
                className="mt-1 w-full rounded-xl border border-[color:var(--color-border)] bg-[color:var(--color-input)] px-3 py-2 text-sm text-[color:var(--color-text)]"
                value={taskForm.title}
                onChange={(event) =>
                  setTaskForm((prev) => ({ ...prev, title: event.target.value }))
                }
              />
            </label>
            <label className="text-xs text-[color:var(--color-text-muted)]">
              Description
              <textarea
                className="mt-1 w-full rounded-xl border border-[color:var(--color-border)] bg-[color:var(--color-input)] px-3 py-2 text-sm text-[color:var(--color-text)]"
                rows={4}
                value={taskForm.description}
                onChange={(event) =>
                  setTaskForm((prev) => ({
                    ...prev,
                    description: event.target.value,
                  }))
                }
              />
            </label>
            <div className="grid gap-3 md:grid-cols-2">
              {!editingTaskId ? (
                <label className="text-xs text-[color:var(--color-text-muted)]">
                  Status
                  <select
                    className="mt-1 w-full rounded-xl border border-[color:var(--color-border)] bg-[color:var(--color-input)] px-3 py-2 text-sm text-[color:var(--color-text)]"
                    value={taskForm.status}
                    onChange={(event) =>
                      setTaskForm((prev) => ({
                        ...prev,
                        status: event.target.value,
                      }))
                    }
                  >
                    {TASK_STATUSES.map((statusOption) => (
                      <option key={statusOption.id} value={statusOption.id}>
                        {statusOption.label}
                      </option>
                    ))}
                  </select>
                </label>
              ) : null}
              <label className="text-xs text-[color:var(--color-text-muted)]">
                Type
                <select
                  className="mt-1 w-full rounded-xl border border-[color:var(--color-border)] bg-[color:var(--color-input)] px-3 py-2 text-sm text-[color:var(--color-text)]"
                  value={taskForm.type}
                  onChange={(event) =>
                    setTaskForm((prev) => ({
                      ...prev,
                      type: event.target.value,
                    }))
                  }
                >
                  {taskTypes.map((taskType) => (
                    <option key={taskType} value={taskType}>
                      {taskType}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <label className="text-xs text-[color:var(--color-text-muted)]">
              Assignee
              <select
                className="mt-1 w-full rounded-xl border border-[color:var(--color-border)] bg-[color:var(--color-input)] px-3 py-2 text-sm text-[color:var(--color-text)]"
                value={taskForm.ownerId}
                onChange={(event) =>
                  setTaskForm((prev) => ({
                    ...prev,
                    ownerId: event.target.value,
                  }))
                }
                disabled={!canManageAssignments}
              >
                <option value="">
                  {canManageAssignments ? "Select developer" : "Unassigned"}
                </option>
                {users.map((user) => (
                  <option key={user.id} value={user.id}>
                    {user.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-xs text-[color:var(--color-text-muted)]">
              Estimated time
              <input
                className="mt-1 w-full rounded-xl border border-[color:var(--color-border)] bg-[color:var(--color-input)] px-3 py-2 text-sm text-[color:var(--color-text)]"
                placeholder="2 hours 30 minutes"
                value={taskForm.estimatedTime}
                onChange={(event) =>
                  setTaskForm((prev) => ({
                    ...prev,
                    estimatedTime: event.target.value,
                  }))
                }
              />
            </label>
            {editingTaskId ? (
              <div className="space-y-3 rounded-xl border border-[color:var(--color-border)] bg-[color:var(--color-surface-muted)] p-3">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[color:var(--color-text-subtle)]">
                  Checklist
                </p>
                <div className="space-y-2">
                  {taskForm.checklistItems.length ? (
                    taskForm.checklistItems.map((item, index) => (
                      <div
                        key={item.id ?? `new-${index}`}
                        className="flex items-center gap-2"
                      >
                        <input
                          type="checkbox"
                          checked={item.isCompleted}
                          onChange={(event) =>
                            setTaskForm((prev) => ({
                              ...prev,
                              checklistItems: prev.checklistItems.map(
                                (existing, itemIndex) =>
                                  itemIndex === index
                                    ? {
                                        ...existing,
                                        isCompleted: event.target.checked,
                                      }
                                    : existing
                              ),
                            }))
                          }
                          className="h-4 w-4 rounded border-[color:var(--color-border)] bg-transparent text-emerald-500"
                        />
                        <input
                          className="flex-1 rounded-lg border border-[color:var(--color-border)] bg-[color:var(--color-input)] px-2 py-1 text-xs text-[color:var(--color-text)]"
                          value={item.label}
                          onChange={(event) =>
                            setTaskForm((prev) => ({
                              ...prev,
                              checklistItems: prev.checklistItems.map(
                                (existing, itemIndex) =>
                                  itemIndex === index
                                    ? {
                                        ...existing,
                                        label: event.target.value,
                                      }
                                    : existing
                              ),
                            }))
                          }
                        />
                        <button
                          type="button"
                          className="rounded-lg border border-[color:var(--color-border)] px-2 py-1 text-[10px] text-[color:var(--color-text-muted)] transition hover:border-rose-400 hover:text-rose-300"
                          onClick={() =>
                            setTaskForm((prev) => ({
                              ...prev,
                              checklistItems: prev.checklistItems.filter(
                                (_, itemIndex) => itemIndex !== index
                              ),
                            }))
                          }
                        >
                          Remove
                        </button>
                      </div>
                    ))
                  ) : (
                    <p className="text-xs text-[color:var(--color-text-subtle)]">
                      No checklist items yet.
                    </p>
                  )}
                </div>
                <button
                  type="button"
                  className="w-fit rounded-lg border border-[color:var(--color-border)] px-3 py-1 text-xs text-[color:var(--color-text-muted)] transition hover:border-[color:var(--color-accent)] hover:text-[color:var(--color-text)]"
                  onClick={() =>
                    setTaskForm((prev) => ({
                      ...prev,
                      checklistItems: [
                        ...prev.checklistItems,
                        { label: "", isCompleted: false },
                      ],
                    }))
                  }
                >
                  Add checklist item
                </button>
              </div>
            ) : null}
          </div>
          <div className="sticky bottom-0 mt-4 flex flex-wrap justify-end gap-2 border-t border-[color:var(--color-border)] bg-[color:var(--color-card)] pt-4">
            <ActionButton
              label="Cancel"
              variant="secondary"
              onClick={() => setIsModalOpen(false)}
              className={savingTask ? "pointer-events-none opacity-60" : ""}
            />
            <ActionButton
              label={
                savingTask
                  ? "Saving..."
                  : editingTaskId
                    ? "Save changes"
                    : "Create Task"
              }
              variant="primary"
              type="submit"
              className={savingTask ? "pointer-events-none opacity-60" : ""}
            />
          </div>
        </form>
      </Modal>
    </div>
  );
}
