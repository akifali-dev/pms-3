import { prisma } from "@/lib/prisma";
import {
  buildError,
  buildSuccess,
  ensureAuthenticated,
  getAuthContext,
  isAdminRole,
} from "@/lib/api";
import { getStatusLabel, isValidTransition } from "@/lib/kanban";
import {
  calculateTotalTimeSpent,
  resolveTotalTimeSpent,
  sumBreakSeconds,
} from "@/lib/timeLogs";
import {
  createNotification,
  getLeadershipUserIds,
} from "@/lib/notifications";

async function getTask(taskId) {
  return prisma.task.findUnique({
    where: { id: taskId },
    include: {
      owner: { select: { id: true, name: true, email: true, role: true } },
      milestone: {
        select: {
          id: true,
          title: true,
          projectId: true,
          project: { select: { members: { select: { userId: true } } } },
        },
      },
      checklistItems: true,
      statusHistory: true,
      timeLogs: true,
      breaks: { orderBy: { startedAt: "desc" } },
    },
  });
}

function canAccessTask(context, task) {
  if (!task) {
    return false;
  }

  if (
    !task.milestone?.project?.members?.some(
      (member) => member.userId === context.user.id
    )
  ) {
    return false;
  }

  if (isAdminRole(context.role)) {
    return true;
  }

  return task.ownerId === context.user.id;
}

function canMoveTask(context, task) {
  if (!task) {
    return false;
  }

  if (
    !task.milestone?.project?.members?.some(
      (member) => member.userId === context.user.id
    )
  ) {
    return false;
  }

  if (["PM", "CTO"].includes(context.role)) {
    return true;
  }

  return task.ownerId === context.user.id;
}

function getActiveTimeLog(task) {
  return task?.timeLogs?.find((log) => !log.endedAt) ?? null;
}

function getTimeUpdates(task, nextStatus) {
  const updates = {};
  if (nextStatus === "IN_PROGRESS") {
    updates.lastStartedAt = new Date();
  }
  if (nextStatus === "TESTING") {
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

  if (!canMoveTask(context, task)) {
    return buildError("You do not have permission to move this task.", 403);
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
    const now = new Date();
    const shouldCloseSession =
      nextStatus === "TESTING" && task.lastStartedAt;

    if (shouldCloseSession) {
      const activeBreaks = await tx.taskBreak.findMany({
        where: { taskId, endedAt: null },
      });
      if (activeBreaks.length > 0) {
        await Promise.all(
          activeBreaks.map((brk) =>
            tx.taskBreak.update({
              where: { id: brk.id },
              data: {
                endedAt: now,
                durationSeconds: Math.max(
                  0,
                  Math.floor((now.getTime() - new Date(brk.startedAt).getTime()) / 1000)
                ),
              },
            })
          )
        );
      }

      const breaksInSession = await tx.taskBreak.findMany({
        where: {
          taskId,
          startedAt: { gte: task.lastStartedAt, lte: now },
          endedAt: { not: null },
        },
      });
      const breakSeconds = sumBreakSeconds(
        breaksInSession,
        task.lastStartedAt,
        now
      );
      const sessionSeconds = Math.max(
        0,
        Math.floor((now.getTime() - new Date(task.lastStartedAt).getTime()) / 1000)
      );
      const netSeconds = Math.max(0, sessionSeconds - breakSeconds);
      const existingTotal =
        Number(task.totalTimeSpent ?? 0) > 0
          ? Number(task.totalTimeSpent ?? 0)
          : calculateTotalTimeSpent(
              task.timeLogs?.filter((log) => log.endedAt) ?? [],
              now
            );

      await tx.task.update({
        where: { id: taskId },
        data: {
          ...updates,
          totalTimeSpent: existingTotal + netSeconds,
        },
      });
    } else {
      await tx.task.update({
        where: { id: taskId },
        data: updates,
      });
    }

    const activeLog = getActiveTimeLog(task);

    if (nextStatus === "IN_PROGRESS" && !activeLog) {
      await tx.taskTimeLog.create({
        data: {
          taskId,
          status: nextStatus,
          startedAt: now,
        },
      });
    } else if (nextStatus === "TESTING" && activeLog) {
      await tx.taskTimeLog.update({
        where: { id: activeLog.id },
        data: { endedAt: now },
      });
    } else if (activeLog && activeLog.status !== nextStatus) {
      await tx.taskTimeLog.update({
        where: { id: activeLog.id },
        data: { status: nextStatus },
      });
    }

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

    const leaderIds = await getLeadershipUserIds(tx);
    await createNotification({
      prismaClient: tx,
      type: "TASK_MOVEMENT",
      actorId: context.user.id,
      message: `${actorName} moved ${task.title} from ${task.status ?? "new"} to ${nextStatus}.`,
      taskId,
      projectId: task.milestone?.projectId ?? null,
      milestoneId: task.milestone?.id ?? null,
      recipientIds: [task.ownerId, ...leaderIds],
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
        timeLogs: true,
        breaks: { orderBy: { startedAt: "desc" } },
      },
    });
  });

  const totalTimeSpent = resolveTotalTimeSpent(updated);

  return buildSuccess("Task updated.", {
    task: {
      ...updated,
      totalTimeSpent,
      activeBreak: updated.breaks?.find((brk) => !brk.endedAt) ?? null,
    },
  });
}
