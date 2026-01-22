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

async function getActivityLog(logId) {
  return prisma.activityLog.findUnique({
    where: { id: logId },
    include: {
      user: { select: { id: true, name: true, email: true, role: true } },
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

export async function GET(request, { params }) {
  const context = await getAuthContext();
  const authError = ensureAuthenticated(context);
  if (authError) {
    return authError;
  }

  const logId = params?.id;
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

  const logId = params?.id;
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

  if (body?.description) {
    updates.description = body.description.trim();
  }

  if (body?.date) {
    const parsedDate = new Date(body.date);
    if (Number.isNaN(parsedDate.getTime())) {
      return buildError("Date must be valid.", 400);
    }
    updates.date = parsedDate;
  }

  if (typeof body?.hoursSpent === "number") {
    if (body.hoursSpent < 0) {
      return buildError("Hours spent must be a valid number.", 400);
    }
    updates.hoursSpent = body.hoursSpent;
  }

  if (Object.keys(updates).length === 0) {
    return buildError("No valid updates provided.", 400);
  }

  const updated = await prisma.activityLog.update({
    where: { id: logId },
    data: updates,
    include: {
      user: { select: { id: true, name: true, email: true, role: true } },
    },
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

  const logId = params?.id;
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
    await prisma.activityLog.delete({ where: { id: logId } });
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
