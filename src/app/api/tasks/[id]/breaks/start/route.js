import { prisma } from "@/lib/prisma";
import {
  buildError,
  buildSuccess,
  ensureAuthenticated,
  getAuthContext,
} from "@/lib/api";

const ALLOWED_STATUSES = ["IN_PROGRESS", "DEV_TEST"];
const BREAK_REASONS = ["NAMAZ", "MEAL", "REFRESHMENT", "OTHER"];

async function getTask(taskId) {
  return prisma.task.findUnique({
    where: { id: taskId },
    select: {
      id: true,
      status: true,
      ownerId: true,
    },
  });
}

function canManageBreak(context, task) {
  if (!task) {
    return false;
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

  if (!ALLOWED_STATUSES.includes(task.status)) {
    return buildError("Breaks are only allowed during active work.", 400);
  }

  const body = await request.json();
  const reason = body?.reason;
  const note = body?.note?.trim();

  if (!BREAK_REASONS.includes(reason)) {
    return buildError("Break reason is required.", 400);
  }

  const existingBreak = await prisma.taskBreak.findFirst({
    where: { taskId, endedAt: null },
  });

  if (existingBreak) {
    return buildError("A break is already in progress for this task.", 400);
  }

  const createdBreak = await prisma.taskBreak.create({
    data: {
      taskId,
      userId: context.user.id,
      reason,
      note: note || null,
      startedAt: new Date(),
    },
  });

  return buildSuccess("Break started.", { break: createdBreak }, 201);
}
