import { prisma } from "@/lib/prisma";
import {
  buildError,
  buildSuccess,
  ensureAuthenticated,
  getAuthContext,
  isAdminRole,
} from "@/lib/api";
import { getStatusLabel, isValidTransition } from "@/lib/kanban";

async function getTask(taskId) {
  return prisma.task.findUnique({
    where: { id: taskId },
    include: {
      owner: { select: { id: true, name: true, email: true, role: true } },
      milestone: {
        select: { id: true, title: true, projectId: true },
      },
      checklistItems: true,
      statusHistory: true,
    },
  });
}

function canAccessTask(context, task) {
  if (!task) {
    return false;
  }

  if (isAdminRole(context.role)) {
    return true;
  }

  return task.ownerId === context.user.id;
}

function getTimeUpdates(task, nextStatus) {
  const updates = {};
  const now = new Date();

  if (nextStatus === "IN_PROGRESS") {
    updates.lastStartedAt = now;
  }

  if (task.status === "IN_PROGRESS" && nextStatus !== "IN_PROGRESS") {
    const lastStartedAt = task.lastStartedAt
      ? new Date(task.lastStartedAt)
      : null;
    if (lastStartedAt && !Number.isNaN(lastStartedAt.getTime())) {
      const elapsedSeconds = Math.max(
        0,
        Math.floor((now.getTime() - lastStartedAt.getTime()) / 1000)
      );
      updates.totalTimeSpent = (task.totalTimeSpent ?? 0) + elapsedSeconds;
    }
    updates.lastStartedAt = null;
  }

  return updates;
}

export async function PATCH(request, { params }) {
  const { id: taskId } = await params;

  const context = await getAuthContext();
  const authError = ensureAuthenticated(context);
  if (authError) {
    return authError;
  }

  if (!taskId) {
    return buildError("Task id is required.", 400);
  }

  const task = await getTask(taskId);
  if (!task) {
    return buildError("Task not found.", 404);
  }

  if (!canAccessTask(context, task)) {
    return buildError("You do not have permission to update this task.", 403);
  }

  const body = await request.json();
  const nextStatus = body?.status;

  if (!nextStatus) {
    return buildError("Task status is required.", 400);
  }

  if (nextStatus === task.status) {
    return buildSuccess("Task already in status.", { task });
  }

  const allowedTransition = isValidTransition(task.status, nextStatus);
  if (!allowedTransition) {
    return buildError(
      `Invalid transition from ${getStatusLabel(
        task.status
      )} to ${getStatusLabel(nextStatus)}.`,
      400
    );
  }

  if (["DONE", "REJECTED"].includes(nextStatus)) {
    if (!["PM", "CTO"].includes(context.role)) {
      return buildError("Only PMs and CTOs can approve or reject tasks.", 403);
    }
  }

  if (nextStatus === "TESTING") {
    const checklistComplete =
      task.checklistItems.length > 0 &&
      task.checklistItems.every((item) => item.isCompleted);

    if (!checklistComplete) {
      return buildError(
        "Complete the checklist before moving the task to testing.",
        400
      );
    }
  }

  const updates = {
    status: nextStatus,
    ...getTimeUpdates(task, nextStatus),
  };

  if (nextStatus === "REJECTED") {
    updates.reworkCount = task.reworkCount + 1;
  }

  const updated = await prisma.$transaction(async (tx) => {
    await tx.task.update({
      where: { id: taskId },
      data: updates,
    });

    await tx.taskStatusHistory.create({
      data: {
        taskId,
        fromStatus: task.status,
        toStatus: nextStatus,
        changedById: context.user.id,
      },
    });

    const actorName = context.user?.name || context.user?.email || "A teammate";

    await tx.activityLog.create({
      data: {
        userId: task.ownerId,
        taskId,
        category: "TASK",
        hoursSpent: 0,
        description: `Task status updated by ${actorName}: ${task.title} moved from ${task.status ?? "new"} to ${nextStatus}.`,
      },
    });

    return tx.task.findUnique({
      where: { id: taskId },
      include: {
        owner: { select: { id: true, name: true, email: true, role: true } },
        milestone: {
          select: { id: true, title: true, projectId: true },
        },
        checklistItems: true,
        statusHistory: true,
      },
    });
  });

  return buildSuccess("Task updated.", { task: updated });
}
