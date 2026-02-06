import { prisma } from "@/lib/prisma";
import {
  buildError,
  buildSuccess,
  ensureAuthenticated,
  getAuthContext,
  isManagementRole,
} from "@/lib/api";

const ALLOWED_STATUSES = ["IN_PROGRESS", "DEV_TEST"];
const BREAK_REASONS = [
  "NAMAZ",
  "LUNCH",
  "MEAL",
  "DINNER",
  "REFRESHMENT",
  "OTHER",
];

async function getTask(taskId) {
  return prisma.task.findUnique({
    where: { id: taskId },
    select: {
      id: true,
      status: true,
      ownerId: true,
      totalTimeSpent: true,
      lastStartedAt: true,
      estimatedHours: true,
      milestoneId: true,
      milestone: { select: { projectId: true } },
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

  if (!ALLOWED_STATUSES.includes(task.status)) {
    return buildError("Breaks are only allowed during active work.", 400);
  }

  const body = await request.json();
  const reason = body?.reason;
  const note = body?.note?.trim();

  if (!BREAK_REASONS.includes(reason)) {
    return buildError("Break reason is required.", 400);
  }

  const normalizedReason = reason === "DINNER" ? "MEAL" : reason;

  const existingBreak = await prisma.taskBreak.findFirst({
    where: { taskId, userId: context.user.id, endedAt: null },
    orderBy: { startedAt: "desc" },
  });

  if (existingBreak) {
    return buildError("A break is already in progress for this task.", 409);
  }

  const activeSession = await prisma.taskWorkSession.findFirst({
    where: { taskId, userId: context.user.id, endedAt: null },
    orderBy: { startedAt: "desc" },
  });

  if (!activeSession) {
    return buildError("No active work session found for this task.", 409);
  }

  const now = new Date();
  const candidateStart = task.lastStartedAt
    ? new Date(task.lastStartedAt)
    : new Date(activeSession.startedAt);
  const startedAt = Number.isNaN(candidateStart.getTime())
    ? new Date(activeSession.startedAt)
    : candidateStart;
  const deltaSeconds = Math.max(
    0,
    Math.floor((now.getTime() - startedAt.getTime()) / 1000)
  );

  const { updatedTask, createdBreak } = await prisma.$transaction(async (tx) => {
    const updatedTask = await tx.task.update({
      where: { id: taskId },
      data: {
        totalTimeSpent: { increment: deltaSeconds },
        lastStartedAt: null,
      },
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

    const createdBreak = await tx.taskBreak.create({
      data: {
        taskId,
        userId: context.user.id,
        reason: normalizedReason,
        note: note || null,
        startedAt: now,
        endedAt: null,
      },
    });

    return { updatedTask, createdBreak };
  });

  return buildSuccess(
    "Break started.",
    {
      break: createdBreak,
      session: {
        active: true,
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
        runningStartedAt: null,
        isPaused: true,
        activeBreak: {
          id: createdBreak.id,
          reason: createdBreak.reason,
          startedAt: createdBreak.startedAt,
        },
        serverNow: now.toISOString(),
      },
    },
    201
  );
}
