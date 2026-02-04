import { prisma } from "@/lib/prisma";
import {
  buildError,
  buildSuccess,
  ensureAuthenticated,
  getAuthContext,
} from "@/lib/api";
import {
  buildManualLogTimes,
  buildManualLogDate,
  isManualLogInFuture,
  isManualLogDateAllowed,
  MANUAL_LOG_CATEGORIES,
  normalizeManualCategories,
} from "@/lib/manualLogs";

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

  return buildSuccess("Activity log updated.", { activityLog });
}
