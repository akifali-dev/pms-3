import { prisma } from "@/lib/prisma";
import {
  buildError,
  buildSuccess,
  ensureAuthenticated,
  getAuthContext,
} from "@/lib/api";
import {
  buildManualLogTimes,
  formatManualLogTime,
  isManualLogInFuture,
  isManualLogDateAllowed,
  MANUAL_LOG_CATEGORIES,
  normalizeManualCategories,
} from "@/lib/manualLogs";
import {
  findConflictingManualLog,
  withManualLogStatus,
} from "@/lib/manualLogMutations";

async function getManualLog(logId) {
  return prisma.activityLog.findUnique({
    where: { id: logId },
    include: {
      user: { select: { id: true, name: true, email: true, role: true } },
      task: { select: { id: true, title: true, ownerId: true } },
    },
  });
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

  const log = await getManualLog(logId);
  if (!log) {
    return buildError("Activity log not found.", 404);
  }

  if (log.taskId) {
    return buildError("Only manual logs can be edited here.", 400);
  }

  if (log.userId !== context.user.id) {
    return buildError("You do not have permission to update this log.", 403);
  }

  const body = await request.json();
  const updates = {};
  const targetDateInput = log.date;
  const existingStartTime = log.startAt
    ? formatManualLogTime(log.startAt)
    : null;

  if (body?.description) {
    updates.description = body.description.trim();
  }

  if (body?.date) {
    return buildError("Date cannot be changed for manual activity logs.", 400);
  }

  if (body?.startTime) {
    return buildError("Start time cannot be changed for manual activity logs.", 400);
  }

  const hasTimeUpdate = Object.prototype.hasOwnProperty.call(body ?? {}, "endTime");
  if (
    hasTimeUpdate &&
    isManualLogInFuture({
      date: targetDateInput,
      startTime: existingStartTime,
      endTime: body.endTime,
    })
  ) {
    return buildError("Manual logs cannot be in the future.", 400);
  }

  if (!isManualLogDateAllowed(log.date)) {
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
    if (!body?.endTime) {
      return buildError("End time is required to complete this manual activity.", 400);
    }
    const { startAt, endAt, durationSeconds, error: timeError } =
      buildManualLogTimes({
        date: targetDateInput,
        startTime: existingStartTime,
        endTime: body.endTime,
      });
    if (timeError) {
      return buildError(timeError, 400);
    }
    updates.startAt = startAt;
    updates.endAt = endAt;
    updates.durationSeconds = durationSeconds;

    const conflict = await findConflictingManualLog(prisma, {
      userId: context.user.id,
      startAt,
      endAt,
      excludeId: logId,
    });
    if (conflict) {
      return buildError("Manual activity overlaps with another log.", 409);
    }
  }

  if (Object.keys(updates).length === 0) {
    return buildError("No valid updates provided.", 400);
  }

  const activityLog = await prisma.activityLog.update({
    where: { id: logId },
    data: updates,
    include: {
      user: { select: { id: true, name: true, email: true, role: true } },
      task: { select: { id: true, title: true, ownerId: true } },
    },
  });

  return buildSuccess("Activity log updated.", { activityLog: withManualLogStatus(activityLog) });
}
