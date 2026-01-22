"use client";

import { useState } from "react";
import ActionButton from "@/components/ui/ActionButton";
import { canMarkTaskDone, canMoveTask } from "@/lib/roles";
import { useToast } from "@/components/ui/ToastProvider";

export default function TaskBoard({ tasks, role }) {
  const { addToast } = useToast();
  const [pendingTask, setPendingTask] = useState(null);

  const handleAction = async (task, action) => {
    const canMove = canMoveTask(role);
    const canMarkDone = canMarkTaskDone(role);

    if (action === "move" && !canMove) {
      addToast({
        title: "Access denied",
        message: "Your role cannot move tasks.",
        variant: "error",
      });
      return;
    }

    if (action === "mark-done" && !canMarkDone) {
      addToast({
        title: "Access denied",
        message: "Your role cannot mark tasks as done.",
        variant: "error",
      });
      return;
    }

    setPendingTask(task.title);
    const response = await fetch(`/api/tasks/${action}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ task }),
    });

    if (!response.ok) {
      const data = await response.json();
      addToast({
        title: "Action blocked",
        message: data?.error ?? "This action is not permitted.",
        variant: "error",
      });
      setPendingTask(null);
      return;
    }

    addToast({
      title: "Task updated",
      message:
        action === "move"
          ? "The task has been moved to the next stage."
          : "The task has been marked as done.",
      variant: "success",
    });
    setPendingTask(null);
  };

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {tasks.map((task) => (
        <div
          key={task.title}
          className="rounded-2xl border border-white/10 bg-slate-900/60 p-5"
        >
          <p className="text-sm font-semibold text-white">{task.title}</p>
          <p className="mt-1 text-xs text-white/60">{task.team}</p>
          <div className="mt-4 flex flex-col gap-3">
            <span className="w-fit rounded-full border border-white/10 px-3 py-1 text-xs text-white/60">
              {task.status}
            </span>
            <div className="flex flex-wrap gap-2">
              <ActionButton
                label={
                  pendingTask === task.title ? "Moving..." : "Move task"
                }
                size="sm"
                variant="secondary"
                onClick={() => handleAction(task, "move")}
              />
              <ActionButton
                label={
                  pendingTask === task.title ? "Updating..." : "Mark done"
                }
                size="sm"
                variant="success"
                onClick={() => handleAction(task, "mark-done")}
              />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
