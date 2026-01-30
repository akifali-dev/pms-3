import { prisma } from "@/lib/prisma";
import {
  ALL_ROLES,
  buildError,
  buildSuccess,
  ensureAuthenticated,
  ensureRole,
  getAuthContext,
  isAdminRole,
} from "@/lib/api";
import { createNotification, getTaskMemberIds } from "@/lib/notifications";

export async function GET(request) {
  const context = await getAuthContext();
  const authError = ensureAuthenticated(context);
  if (authError) {
    return authError;
  }

  const { searchParams } = new URL(request.url);
  const userId = searchParams.get("userId");
  const startDate = searchParams.get("startDate");
  const endDate = searchParams.get("endDate");
  const category = searchParams.get("category");
  const taskId = searchParams.get("taskId");

  const where = {};

  if (isAdminRole(context.role)) {
    if (userId) {
      where.userId = userId;
    }
  } else {
    where.userId = context.user.id;
  }

  if (category) {
    where.category = category;
  }

  if (taskId) {
    where.taskId = taskId;
  }

  if (startDate || endDate) {
    where.date = {};
    if (startDate) {
      const parsedStart = new Date(startDate);
      if (!Number.isNaN(parsedStart.getTime())) {
        where.date.gte = parsedStart;
      }
    }
    if (endDate) {
      const parsedEnd = new Date(endDate);
      if (!Number.isNaN(parsedEnd.getTime())) {
        where.date.lte = parsedEnd;
      }
    }
  }

  const activityLogs = await prisma.activityLog.findMany({
    where,
    orderBy: { date: "desc" },
    include: {
      user: { select: { id: true, name: true, email: true, role: true } },
      task: { select: { id: true, title: true, ownerId: true } },
    },
  });

  return buildSuccess("Activity logs loaded.", { activityLogs });
}

export async function POST(request) {
  const context = await getAuthContext();
  const authError = ensureAuthenticated(context);
  if (authError) {
    return authError;
  }

  const roleError = ensureRole(context.role, ALL_ROLES);
  if (roleError) {
    return roleError;
  }

  const body = await request.json();
  const description = body?.description?.trim();
  const taskId = body?.taskId ?? null;
  const type = body?.type?.toString().trim().toUpperCase() || "MANUAL";
  const category = body?.category?.toString().trim().toUpperCase();
  const date = body?.date ? new Date(body.date) : new Date();

  if (!description) {
    return buildError("Description is required.", 400);
  }

  if (Number.isNaN(date.getTime())) {
    return buildError("Date must be valid.", 400);
  }

  if (!["MANUAL"].includes(type)) {
    return buildError("Log type must be manual.", 400);
  }

  const hoursSpent = Number(body?.hoursSpent ?? 0);
  const durationSeconds = 0;
  let resolvedCategory = category;

  if (!Number.isFinite(hoursSpent) || hoursSpent < 0) {
    return buildError("Hours spent must be a valid number.", 400);
  }
  if (!resolvedCategory || !["LEARNING", "RESEARCH", "IDLE"].includes(resolvedCategory)) {
    return buildError(
      "Category must be one of: learning, research, idle.",
      400
    );
  }

  if (taskId) {
    const task = await prisma.task.findUnique({
      where: { id: taskId },
      select: {
        id: true,
        milestone: {
          select: { project: { select: { members: { select: { userId: true } } } } },
        },
      },
    });

    if (!task) {
      return buildError("Task not found.", 404);
    }

    const isMember = task.milestone?.project?.members?.some(
      (member) => member.userId === context.user.id
    );
    if (!isMember) {
      return buildError("You do not have permission to log time for this task.", 403);
    }
  }

  const activityLog = await prisma.$transaction(async (tx) => {
    const createdLog = await tx.activityLog.create({
      data: {
        description,
        date,
        hoursSpent,
        userId: context.user.id,
        category: resolvedCategory,
        taskId,
        type,
        startTime: null,
        endTime: null,
        durationSeconds,
      },
      include: {
        user: { select: { id: true, name: true, email: true, role: true } },
        task: { select: { id: true, title: true, ownerId: true } },
      },
    });

    return createdLog;
  });

  if (activityLog.taskId) {
    const actorName = context.user?.name || context.user?.email || "A teammate";
    const taskMemberIds = await getTaskMemberIds(activityLog.taskId);
    await createNotification({
      type: "USER_LOG_COMMENT",
      actorId: context.user.id,
      message: `${actorName} logged activity on ${activityLog.task?.title ?? "a task"}.`,
      taskId: activityLog.taskId,
      recipientIds: taskMemberIds,
    });
  }

  return buildSuccess("Activity log created.", { activityLog }, 201);
}
