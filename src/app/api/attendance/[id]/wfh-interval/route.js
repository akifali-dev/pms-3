import { prisma } from "@/lib/prisma";
import {
  buildError,
  buildSuccess,
  ensureAuthenticated,
  getAuthContext,
  PROJECT_MANAGEMENT_ROLES,
} from "@/lib/api";
import { getDayBounds } from "@/lib/dutyHours";

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
  return new Date(
    Date.UTC(parsed.getUTCFullYear(), parsed.getUTCMonth(), parsed.getUTCDate())
  );
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

export async function POST(request, { params }) {
  const { id: attendanceId } = await params;

  const context = await getAuthContext();
  const authError = ensureAuthenticated(context);
  if (authError) {
    return authError;
  }

  if (!attendanceId) {
    return buildError("Attendance id is required.", 400);
  }

  const attendance = await prisma.attendance.findUnique({
    where: { id: attendanceId },
    include: { user: { select: { id: true } }, wfhIntervals: true },
  });

  if (!attendance) {
    return buildError("Attendance record not found.", 404);
  }

  const leader = isLeader(context.role);
  if (!leader && attendance.userId !== context.user.id) {
    return buildError("You do not have permission to update this record.", 403);
  }

  if (!attendance.inTime || !attendance.outTime) {
    return buildError(
      "Add WFH time only after in time and out time are recorded.",
      400
    );
  }

  const today = normalizeDateOnly(new Date());
  const attendanceDate = normalizeDateOnly(attendance.date);
  if (!today || !attendanceDate || attendanceDate.getTime() !== today.getTime()) {
    return buildError("WFH intervals can only be added for today.", 400);
  }

  const body = await request.json();
  const startAt = parseDateTime(body?.startAt);
  const endAt = parseDateTime(body?.endAt);

  if (!startAt || !endAt) {
    return buildError("WFH start and end times are required.", 400);
  }

  if (endAt <= startAt) {
    return buildError("WFH end time must be after start time.", 400);
  }

  const bounds = getDayBounds(attendance.date);
  if (!bounds || startAt < bounds.start || endAt > bounds.end) {
    return buildError("WFH interval must be within the attendance date.", 400);
  }

  const created = await prisma.attendanceWFHInterval.create({
    data: {
      attendanceId: attendance.id,
      startAt,
      endAt,
    },
  });

  const updatedAttendance = await prisma.attendance.findUnique({
    where: { id: attendanceId },
    include: {
      user: { select: { id: true, name: true, role: true, email: true } },
      wfhIntervals: { orderBy: { startAt: "asc" } },
    },
  });

  return buildSuccess("WFH interval added.", {
    attendance: updatedAttendance,
    interval: created,
  });
}
