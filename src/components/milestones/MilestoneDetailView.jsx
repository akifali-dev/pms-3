"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import ActionButton from "@/components/ui/ActionButton";
import Modal from "@/components/ui/Modal";
import { useToast } from "@/components/ui/ToastProvider";
import MilestoneCard from "@/components/milestones/MilestoneCard";
import TaskBoard from "@/components/tasks/TaskBoard";
import PageHeader from "@/components/layout/PageHeader";
import { TASK_STATUSES } from "@/lib/kanban";
import { TASK_TYPE_CHECKLISTS } from "@/lib/taskChecklists";

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
  const [taskForm, setTaskForm] = useState({
    title: "",
    description: "",
    status: TASK_STATUSES[0]?.id ?? "BACKLOG",
    type: Object.keys(TASK_TYPE_CHECKLISTS)[0] ?? "UI",
  });

  const taskTypes = useMemo(() => Object.keys(TASK_TYPE_CHECKLISTS), []);

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

  const resetTaskForm = () => {
    setTaskForm({
      title: "",
      description: "",
      status: TASK_STATUSES[0]?.id ?? "BACKLOG",
      type: Object.keys(TASK_TYPE_CHECKLISTS)[0] ?? "UI",
    });
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

    setSavingTask(true);
    try {
      const response = await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: taskForm.title,
          description: taskForm.description,
          status: taskForm.status,
          type: taskForm.type,
          milestoneId,
        }),
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(buildErrorMessage(data));
      }

      addToast({
        title: "Task created",
        message: "Task added to milestone execution queue.",
        variant: "success",
      });
      resetTaskForm();
      setIsModalOpen(false);
      loadMilestone();
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unable to create task.";
      addToast({
        title: "Task creation failed",
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
        eyebrow="Milestone detail"
        title={milestone?.title ?? "Milestone overview"}
        subtitle="Track execution progress and milestone-specific tasks."
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
            onClick={() => setIsModalOpen(true)}
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
          <div className="grid gap-4 lg:grid-cols-[2fr,1fr]">
            <MilestoneCard milestone={milestone} />
            <div className="rounded-2xl border border-[color:var(--color-border)] bg-[color:var(--color-card)] p-5">
              <p className="text-sm font-semibold text-[color:var(--color-text)]">
                Project
              </p>
              <p className="mt-2 text-sm text-[color:var(--color-text-muted)]">
                {milestone.project?.name ?? "Project details unavailable"}
              </p>
              <p className="mt-2 text-xs text-[color:var(--color-text-subtle)]">
                Linked project ID: {milestone.project?.id ?? "--"}
              </p>
            </div>
          </div>

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
        title="Create task"
        description="Tasks created here are tied to this milestone."
        onClose={savingTask ? undefined : () => setIsModalOpen(false)}
      >
        <form onSubmit={handleTaskSubmit} className="space-y-4">
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
          <div className="flex flex-wrap justify-end gap-2">
            <ActionButton
              label="Cancel"
              variant="secondary"
              onClick={() => setIsModalOpen(false)}
              className={savingTask ? "pointer-events-none opacity-60" : ""}
            />
            <ActionButton
              label={savingTask ? "Saving..." : "Create Task"}
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
