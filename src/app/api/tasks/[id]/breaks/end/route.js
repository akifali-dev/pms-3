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
  const {id:taskId} = await params;
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
    console.warn("No active break found for task resume.", {
      taskId,
      userId: context.user.id,
      filters: { taskId, userId: context.user.id, endedAt: null },
    });
    return buildError("No active break found for this task.", 404);
  }

  const now = new Date();
  if (activeBreaks.length > 1) {
    console.warn("Multiple active breaks detected; closing all.", {
      taskId,
      userId: context.user.id,
      count: activeBreaks.length,
    });
  }

  const updatedBreaks = await prisma.$transaction(
    activeBreaks.map((brk) => {
      const startedAt = new Date(brk.startedAt);
      const durationSeconds = Math.max(
        0,
        Math.floor((now.getTime() - startedAt.getTime()) / 1000)
      );
      return prisma.taskBreak.update({
        where: { id: brk.id },
        data: { endedAt: now, durationSeconds },
      });
    })
  );

  const updatedBreak = updatedBreaks[0];

  return buildSuccess("Break ended.", { break: updatedBreak });
}
