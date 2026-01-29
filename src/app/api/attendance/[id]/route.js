import { prisma } from "@/lib/prisma";
import {
  PROJECT_MANAGEMENT_ROLES,
  buildError,
  buildSuccess,
  ensureAuthenticated,
  getAuthContext,
} from "@/lib/api";

function isLeader(role) {
  return PROJECT_MANAGEMENT_ROLES.includes(role);
}

function normalizeDateOnly(value) {
  if (!value) {
    return null;
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }
  return new Date(Date.UTC(parsed.getUTCFullYear(), parsed.getUTCMonth(), parsed.getUTCDate()));
}

function parseDateTime(value) {
  if (!value) {
    return null;
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }
  return parsed;
}

function normalizeNote(note) {
  if (note === undefined) {
    return undefined;
  }
  if (!note) {
    return null;
  }
  const trimmed = note.trim();
  return trimmed ? trimmed : null;
}

export async function PATCH(request, { params }) {
  const context = await getAuthContext();
  const authError = ensureAuthenticated(context);
  if (authError) {
    return authError;
  }

  const attendanceId = params?.id;
  if (!attendanceId) {
    return buildError("Attendance id is required.", 400);
  }

  const existing = await prisma.attendance.findUnique({
    where: { id: attendanceId },
    include: { user: { select: { id: true } } },
  });

  if (!existing) {
    return buildError("Attendance record not found.", 404);
  }

  const leader = isLeader(context.role);
  if (!leader && existing.userId !== context.user.id) {
    return buildError("You do not have permission to update this record.", 403);
  }

  const body = await request.json();
  const nextDate = body?.date ? normalizeDateOnly(body.date) : existing.date;
  if (body?.date && !nextDate) {
    return buildError("Date must be valid.", 400);
  }

  const inTime = body?.inTime !== undefined ? parseDateTime(body.inTime) : existing.inTime;
  const outTime = body?.outTime !== undefined ? parseDateTime(body.outTime) : existing.outTime;

  if (body?.inTime !== undefined && body?.inTime && !inTime) {
    return buildError("In time must be valid.", 400);
  }

  if (body?.outTime !== undefined && body?.outTime && !outTime) {
    return buildError("Out time must be valid.", 400);
  }

  if (inTime && outTime && outTime < inTime) {
    return buildError("Out time cannot be before in time.", 400);
  }

  let targetUserId = existing.userId;
  if (leader && body?.userId) {
    const userExists = await prisma.user.findUnique({
      where: { id: body.userId },
      select: { id: true },
    });
    if (!userExists) {
      return buildError("User not found.", 404);
    }
    targetUserId = body.userId;
  }

  try {
    const attendance = await prisma.attendance.update({
      where: { id: attendanceId },
      data: {
        date: nextDate,
        inTime,
        outTime,
        note: normalizeNote(body?.note),
        userId: targetUserId,
      },
      include: {
        user: { select: { id: true, name: true, role: true, email: true } },
      },
    });

    return buildSuccess("Attendance saved.", { attendance });
  } catch (error) {
    return buildError("Unable to update attendance.", 400);
  }
}
