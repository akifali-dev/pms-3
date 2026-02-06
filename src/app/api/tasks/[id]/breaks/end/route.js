import { prisma } from "@/lib/prisma";
import {
  buildError,
  buildSuccess,
  ensureAuthenticated,
  getAuthContext,
  isManagementRole,
} from "@/lib/api";

async function getTask(taskId) {
  return prisma.task.findUnique({
    where: { id: taskId },
    select: {
      id: true,
      ownerId: true,
    },
  });
}

function canManageBreak(context, task) {
  if (!task) {
    return false;
  }
  if (isManagementRole(context.role)) {
    return false;
  }
  return task.ownerId === context.user.id;
}

export async function POST(request, { params }) {
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

  if (!canManageBreak(context, task)) {
    return buildError("You do not have permission to manage breaks.", 403);
  }

  const activeBreaks = await prisma.taskBreak.findMany({
    where: { taskId, userId: context.user.id, endedAt: null },
    orderBy: { startedAt: "desc" },
  });

  if (!activeBreaks.length) {
    console.info("No active break found for task resume.", {
      taskId,
      userId: context.user.id,
      filters: { taskId, userId: context.user.id, endedAt: null },
    });
    return buildSuccess("No active break found for this task.", { break: null });
  }

  const now = new Date();
  if (activeBreaks.length > 1) {
    console.warn("Multiple active breaks detected; closing all.", {
      taskId,
      userId: context.user.id,
      count: activeBreaks.length,
    });
  }

  const activeSession = await prisma.taskWorkSession.findFirst({
    where: { taskId, userId: context.user.id, endedAt: null },
    orderBy: { startedAt: "desc" },
  });

  const { updatedBreaks, updatedTask } = await prisma.$transaction(
    async (tx) => {
      const updatedBreaks = await Promise.all(
        activeBreaks.map((brk) => {
          const startedAt = new Date(brk.startedAt);
          const durationSeconds = Math.max(
            0,
            Math.floor((now.getTime() - startedAt.getTime()) / 1000)
          );
          return tx.taskBreak.update({
            where: { id: brk.id },
            data: { endedAt: now, durationSeconds },
          });
        })
      );

      const updatedTask = activeSession
        ? await tx.task.update({
            where: { id: taskId },
            data: { lastStartedAt: now },
            select: {
              id: true,
              title: true,
              estimatedHours: true,
              status: true,
              milestoneId: true,
              milestone: { select: { projectId: true } },
              totalTimeSpent: true,
            },
          })
        : await tx.task.findUnique({
            where: { id: taskId },
            select: {
              id: true,
              title: true,
              estimatedHours: true,
              status: true,
              milestoneId: true,
              milestone: { select: { projectId: true } },
              totalTimeSpent: true,
            },
          });

      return { updatedBreaks, updatedTask };
    }
  );

  const updatedBreak = updatedBreaks[0];

  return buildSuccess("Break ended.", {
    break: updatedBreak,
    session: updatedTask
      ? {
          active: Boolean(activeSession),
          task: {
            id: updatedTask.id,
            title: updatedTask.title,
            estimatedSeconds: Math.max(
              0,
              Math.round(Number(updatedTask.estimatedHours ?? 0) * 3600)
            ),
            status: updatedTask.status,
            milestoneId: updatedTask.milestoneId,
            projectId: updatedTask.milestone?.projectId ?? null,
          },
          accumulatedSeconds: Math.max(0, Number(updatedTask.totalTimeSpent ?? 0)),
          runningStartedAt: activeSession ? now.toISOString() : null,
          isPaused: false,
          activeBreak: null,
          serverNow: now.toISOString(),
        }
      : null,
  });
}
