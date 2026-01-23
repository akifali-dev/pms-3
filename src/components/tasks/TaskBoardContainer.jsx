"use client";

import { useCallback, useEffect, useState } from "react";
import ActionButton from "@/components/ui/ActionButton";
import TaskBoard from "@/components/tasks/TaskBoard";
import { useToast } from "@/components/ui/ToastProvider";

const buildErrorMessage = (data) =>
  data?.error ?? data?.message ?? "Unable to load tasks.";

export default function TaskBoardContainer({
  role,
  currentUserId,
  hasDatabase,
}) {
  const { addToast } = useToast();
  const [tasks, setTasks] = useState([]);
  const [status, setStatus] = useState({
    loading: true,
    error: null,
  });

  const loadTasks = useCallback(async () => {
    if (!hasDatabase) {
      setTasks([]);
      setStatus({ loading: false, error: null });
      return;
    }

    setStatus({ loading: true, error: null });
    try {
      const response = await fetch("/api/tasks");
      const data = await response.json();

      if (!response.ok) {
        throw new Error(buildErrorMessage(data));
      }

      setTasks(data?.tasks ?? []);
      setStatus({ loading: false, error: null });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unable to load tasks.";
      setStatus({ loading: false, error: message });
      addToast({
        title: "Tasks unavailable",
        message,
        variant: "error",
      });
    }
  }, [addToast, hasDatabase]);

  useEffect(() => {
    loadTasks();
  }, [loadTasks]);

  if (status.loading) {
    return (
      <div className="rounded-2xl border border-white/10 bg-white/5 p-6 text-sm text-white/60">
        Loading tasks from the workspace...
      </div>
    );
  }

  if (status.error) {
    return (
      <div className="space-y-3 rounded-2xl border border-rose-500/20 bg-rose-500/10 p-6 text-sm text-rose-100">
        <p>{status.error}</p>
        <ActionButton
          label="Retry"
          variant="secondary"
          onClick={loadTasks}
        />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {!tasks.length && (
        <div className="rounded-2xl border border-dashed border-white/20 bg-white/5 p-6 text-center text-sm text-white/60">
          No tasks have been assigned yet.
        </div>
      )}
      <TaskBoard
        tasks={tasks}
        role={role}
        currentUserId={currentUserId}
      />
    </div>
  );
}
