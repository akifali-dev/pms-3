import { prisma } from "@/lib/prisma";
import {
  ALL_ROLES,
  buildError,
  buildSuccess,
  ensureAuthenticated,
  ensureRole,
  getAuthContext,
} from "@/lib/api";
import { createNotification, getTaskMemberIds } from "@/lib/notifications";
import {
  buildManualLogTimes,
  isManualLogDateAllowed,
  MANUAL_LOG_CATEGORIES,
  normalizeManualCategories,
} from "@/lib/manualLogs";

export async function GET(request) {
  const context = await getAuthContext();
  const authError = ensureAuthenticated(context);
  if (authError) {
    return authError;
  }

  const { searchParams } = new URL(request.url);
  const scope = searchParams.get("scope");
  const userId = searchParams.get("userId");
  const startDate = searchParams.get("startDate");
  const endDate = searchParams.get("endDate");
  const category = searchParams.get("category");
  const taskId = searchParams.get("taskId");

  const where = {};
  const canViewAll = ["CEO", "PM", "CTO"].includes(context.role);

  if (canViewAll && scope === "all") {
    if (userId) {
      where.userId = userId;
    }
  } else {
    where.userId = context.user.id;
  }

  if (category) {
    const normalized = category.toString().trim().toUpperCase();
    if (normalized === "TASK") {
      where.taskId = { not: null };
    } else {
      where.categories = { has: normalized };
    }
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
      user: {
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
        },
      },
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
  const rawCategories = body?.categories;
  const date = body?.date ? new Date(body.date) : new Date();
  const startTime = body?.startTime;
  const endTime = body?.endTime;

  if (!description) {
    return buildError("Description is required.", 400);
  }

  if (Number.isNaN(date.getTime())) {
    return buildError("Date must be valid.", 400);
  }

  if (!isManualLogDateAllowed(date)) {
    return buildError(
      "Manual logs can only be added/edited for today or last 2 days.",
      403
    );
  }

  const categories = normalizeManualCategories(rawCategories);
  if (!categories) {
    return buildError(
      `Categories must include at least one of: ${MANUAL_LOG_CATEGORIES.join(
        ", "
      ).toLowerCase()}.`,
      400
    );
  }

  const { startAt, endAt, durationSeconds, error: timeError } =
    buildManualLogTimes({ date, startTime, endTime });
  if (timeError) {
    return buildError(timeError, 400);
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
        categories,
        userId: context.user.id,
        taskId,
        type: "MANUAL",
        startAt,
        endAt,
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
