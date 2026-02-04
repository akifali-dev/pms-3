import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  ADMIN_ROLES,
  buildError,
  buildSuccess,
  ensureAuthenticated,
  ensureRole,
  getAuthContext,
  isAdminRole,
} from "@/lib/api";
import {
  buildManualLogTimes,
  buildManualLogDate,
  isManualLogInFuture,
  isManualLogDateAllowed,
  MANUAL_LOG_CATEGORIES,
  normalizeManualCategories,
} from "@/lib/manualLogs";

async function getActivityLog(logId) {
  return prisma.activityLog.findUnique({
    where: { id: logId },
    include: {
      user: { select: { id: true, name: true, email: true, role: true } },
      task: { select: { id: true, title: true, ownerId: true } },
    },
  });
}

function canAccessLog(context, log) {
  if (!log) {
    return false;
  }

  if (isAdminRole(context.role)) {
    return true;
  }

  return log.userId === context.user.id;
}

function canEditManualLog(context, log) {
  if (!log) {
    return false;
  }
  return log.userId === context.user.id;
}

export async function GET(request, { params }) {
  const context = await getAuthContext();
  const authError = ensureAuthenticated(context);
  if (authError) {
    return authError;
  }

  const { id: logId } = await params;
  if (!logId) {
    return buildError("Activity log id is required.", 400);
  }

  const log = await getActivityLog(logId);
  if (!log) {
    return buildError("Activity log not found.", 404);
  }

  if (!canAccessLog(context, log)) {
    return buildError("You do not have permission to view this log.", 403);
  }

  return buildSuccess("Activity log loaded.", { activityLog: log });
}

export async function PATCH(request, { params }) {
  const context = await getAuthContext();
  const authError = ensureAuthenticated(context);
  if (authError) {
    return authError;
  }

  const { id: logId } = await params;
  if (!logId) {
    return buildError("Activity log id is required.", 400);
  }

  const log = await getActivityLog(logId);
  if (!log) {
    return buildError("Activity log not found.", 404);
  }

  if (!canAccessLog(context, log)) {
    return buildError("You do not have permission to update this log.", 403);
  }

  const body = await request.json();
  const updates = {};
  const isManualLog = !log.taskId;
  const targetDateInput = body?.date ?? log.date;
  const targetDate = buildManualLogDate(targetDateInput);

  if (body?.description) {
    updates.description = body.description.trim();
  }

  if (body?.date) {
    if (!targetDate) {
      return buildError("Date must be valid.", 400);
    }
    updates.date = targetDate;
  }

  if (isManualLog) {
    if (!canEditManualLog(context, log)) {
      return buildError("You do not have permission to update this log.", 403);
    }

    const hasTimeUpdate = body?.startTime || body?.endTime || body?.date;
    if (
      hasTimeUpdate &&
      isManualLogInFuture({
        date: targetDateInput,
        startTime: body.startTime,
        endTime: body.endTime,
      })
    ) {
      return buildError("Manual logs cannot be in the future.", 400);
    }

    if (!isManualLogDateAllowed(targetDateInput)) {
      return buildError(
        "Manual logs can only be added/edited for today or last 2 days.",
        403
      );
    }

    if (body?.categories) {
      const categories = normalizeManualCategories(body.categories);
      if (!categories) {
        return buildError(
          `Categories must include at least one of: ${MANUAL_LOG_CATEGORIES.join(
            ", "
          ).toLowerCase()}.`,
          400
        );
      }
      updates.categories = categories;
    }

    if (hasTimeUpdate) {
      if (!body?.startTime || !body?.endTime) {
        return buildError("Start and end time are required.", 400);
      }
      const { startAt, endAt, durationSeconds, error: timeError } =
        buildManualLogTimes({
          date: targetDateInput,
          startTime: body.startTime,
          endTime: body.endTime,
        });
      if (timeError) {
        return buildError(timeError, 400);
      }
      updates.startAt = startAt;
      updates.endAt = endAt;
      updates.durationSeconds = durationSeconds;
    }
  }

  if (Object.keys(updates).length === 0) {
    return buildError("No valid updates provided.", 400);
  }

  const updated = await prisma.$transaction(async (tx) => {
    const nextLog = await tx.activityLog.update({
      where: { id: logId },
      data: updates,
      include: {
        user: { select: { id: true, name: true, email: true, role: true } },
        task: { select: { id: true, title: true, ownerId: true } },
      },
    });

    return tx.activityLog.findUnique({
      where: { id: logId },
      include: {
        user: { select: { id: true, name: true, email: true, role: true } },
        task: { select: { id: true, title: true, ownerId: true } },
      },
    });
  });

  return buildSuccess("Activity log updated.", { activityLog: updated });
}

export async function DELETE(request, { params }) {
  const context = await getAuthContext();
  const authError = ensureAuthenticated(context);
  if (authError) {
    return authError;
  }

  const allowedRoles = [...ADMIN_ROLES, "DEVELOPER"];
  const roleError = ensureRole(context.role, allowedRoles);
  if (roleError) {
    return roleError;
  }

  const { id: logId } = await params;
  if (!logId) {
    return buildError("Activity log id is required.", 400);
  }

  const log = await getActivityLog(logId);
  if (!log) {
    return buildError("Activity log not found.", 404);
  }

  if (!canAccessLog(context, log)) {
    return buildError("You do not have permission to delete this log.", 403);
  }

  try {
    await prisma.$transaction(async (tx) => {
      await tx.activityLog.delete({ where: { id: logId } });
    });
    return buildSuccess("Activity log deleted.");
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === "P2025") {
        return buildError("Activity log not found.", 404);
      }
    }

    return buildError("Unable to delete activity log.", 500);
  }
}
