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

export async function GET(request) {
  const context = await getAuthContext();
  const authError = ensureAuthenticated(context);
  if (authError) {
    return authError;
  }

  const { searchParams } = new URL(request.url);
  const userId = searchParams.get("userId");

  const where = {};

  if (isAdminRole(context.role)) {
    if (userId) {
      where.userId = userId;
    }
  } else {
    where.userId = context.user.id;
  }

  const activityLogs = await prisma.activityLog.findMany({
    where,
    orderBy: { date: "desc" },
    include: {
      user: { select: { id: true, name: true, email: true, role: true } },
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

  const allowedRoles = [...ADMIN_ROLES, "DEVELOPER"];
  const roleError = ensureRole(context.role, allowedRoles);
  if (roleError) {
    return roleError;
  }

  const body = await request.json();
  const description = body?.description?.trim();
  const date = body?.date ? new Date(body.date) : new Date();
  const hoursSpent = Number(body?.hoursSpent ?? 0);

  if (!description) {
    return buildError("Description is required.", 400);
  }

  if (!Number.isFinite(hoursSpent) || hoursSpent < 0) {
    return buildError("Hours spent must be a valid number.", 400);
  }

  if (Number.isNaN(date.getTime())) {
    return buildError("Date must be valid.", 400);
  }

  const activityLog = await prisma.activityLog.create({
    data: {
      description,
      date,
      hoursSpent,
      userId: context.user.id,
    },
    include: {
      user: { select: { id: true, name: true, email: true, role: true } },
    },
  });

  return buildSuccess("Activity log created.", { activityLog }, 201);
}
