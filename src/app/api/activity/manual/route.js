import { prisma } from "@/lib/prisma";
import {
  ALL_ROLES,
  buildError,
  buildSuccess,
  ensureAuthenticated,
  ensureRole,
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
  const rawCategories = body?.categories;
  const dateInput = body?.date ?? new Date();
  const startTime = body?.startTime;
  const endTime = body?.endTime;

  if (!description) {
    return buildError("Description is required.", 400);
  }

  const date = buildManualLogDate(dateInput);
  if (!date) {
    return buildError("Date must be valid.", 400);
  }

  if (isManualLogInFuture({ date: dateInput, startTime, endTime })) {
    return buildError("Manual logs cannot be in the future.", 400);
  }

  if (!isManualLogDateAllowed(dateInput)) {
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
    buildManualLogTimes({ date: dateInput, startTime, endTime });
  if (timeError) {
    return buildError(timeError, 400);
  }

  const activityLog = await prisma.activityLog.create({
    data: {
      description,
      date,
      categories,
      userId: context.user.id,
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

  return buildSuccess("Activity log created.", { activityLog }, 201);
}
