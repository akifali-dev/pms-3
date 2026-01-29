import { prisma } from "@/lib/prisma";
import {
  PROJECT_MANAGEMENT_ROLES,
  buildError,
  buildSuccess,
  ensureAuthenticated,
  getAuthContext,
} from "@/lib/api";

function isLeader(role) {
  return PROJECT_MANAGEMENT_ROLES.includes(role);
}

async function getTask(taskId) {
  return prisma.task.findUnique({
    where: { id: taskId },
    select: {
      id: true,
      ownerId: true,
      milestone: {
        select: {
          project: { select: { members: { select: { userId: true } } } },
        },
      },
    },
  });
}

function canManageBreak(context, task) {
  if (!task) {
    return false;
  }
  const isMember = task.milestone?.project?.members?.some(
    (member) => member.userId === context.user.id
  );
  if (!isMember) {
    return false;
  }
  if (isLeader(context.role)) {
    return true;
  }
  return task.ownerId === context.user.id;
}

export async function POST(request, { params }) {
  const context = await getAuthContext();
  const authError = ensureAuthenticated(context);
  if (authError) {
    return authError;
  }

  const taskId = params?.id;
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

  const activeBreak = await prisma.taskBreak.findFirst({
    where: { taskId, endedAt: null },
  });

  if (!activeBreak) {
    return buildError("No active break found for this task.", 400);
  }

  const now = new Date();
  const durationSeconds = Math.max(
    0,
    Math.floor((now.getTime() - new Date(activeBreak.startedAt).getTime()) / 1000)
  );

  const updatedBreak = await prisma.taskBreak.update({
    where: { id: activeBreak.id },
    data: { endedAt: now, durationSeconds },
  });

  return buildSuccess("Break ended.", { break: updatedBreak });
}
