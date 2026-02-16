import { prisma } from "@/lib/prisma";
import {
  buildError,
  buildSuccess,
  ensureAuthenticated,
  getAuthContext,
  isManagementRole,
} from "@/lib/api";
import { computeAttendanceDurationsForRecord, getCutoffTime } from "@/lib/dutyHours";
import { combineShiftDateAndTime, getTimeZoneNow } from "@/lib/attendanceTimes";
import { normalizeBreakTypes } from "@/lib/breakTypes";

function normalizeNotes(value) {
  if (value === undefined) {
    return undefined;
  }
  if (!value) {
    return null;
  }
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function normalizeDurationMinutes(value) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return null;
  }
  return parsed;
}

function getAttendanceWindow(attendance) {
  if (!attendance?.inTime) {
    return null;
  }
  const start = new Date(attendance.inTime);
  if (Number.isNaN(start.getTime())) {
    return null;
  }
  let end = attendance.outTime ? new Date(attendance.outTime) : getCutoffTime(start);
  if (!end || Number.isNaN(end.getTime())) {
    return null;
  }
  if (end <= start) {
    return null;
  }
  return { start, end };
}

function canManageBreak({ context, attendance, now }) {
  if (isManagementRole(context.role)) {
    return true;
  }
  if (!attendance || attendance.userId !== context.user.id) {
    return false;
  }
  if (!attendance.inTime || attendance.outTime) {
    return false;
  }
  const window = getAttendanceWindow(attendance);
  if (!window) {
    return false;
  }
  return now >= window.start && now <= window.end;
}

function attachComputedDurations(attendance) {
  if (!attendance) {
    return attendance;
  }
  const computed = computeAttendanceDurationsForRecord(attendance);
  return {
    ...attendance,
    computedOfficeSeconds: computed.officeSeconds,
    computedWfhSeconds: computed.wfhSeconds,
    computedDutySeconds: computed.dutySeconds,
    officeHHMM: computed.officeHHMM,
    wfhHHMM: computed.wfhHHMM,
    dutyHHMM: computed.dutyHHMM,
  };
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
    include: {
      breaks: { orderBy: { startAt: "asc" } },
      wfhIntervals: true,
    },
  });

  if (!attendance) {
    return buildError("Attendance record not found.", 404);
  }

  const now = getTimeZoneNow();
  if (!canManageBreak({ context, attendance, now })) {
    return buildError("You do not have permission to add breaks.", 403);
  }

  const body = await request.json();
  const types = normalizeBreakTypes(body?.types, body?.type);
  if (!types.length) {
    return buildError("At least one break type is required.", 400);
  }

  const notes = normalizeNotes(body?.notes);

  const durationMinutes = normalizeDurationMinutes(body?.durationMinutes);
  if (!durationMinutes) {
    return buildError("Duration must be a positive number of minutes.", 400);
  }

  const startAt = combineShiftDateAndTime(attendance.date, body?.startTime);
  if (!startAt) {
    return buildError("Break start time is required.", 400);
  }

  const endAt = new Date(startAt.getTime() + durationMinutes * 60 * 1000);
  const window = getAttendanceWindow(attendance);
  if (!window) {
    return buildError("Attendance window is invalid.", 400);
  }

  if (startAt < window.start || endAt > window.end) {
    return buildError("Break must fall within the duty window.", 422);
  }

  await prisma.attendanceBreak.create({
    data: {
      attendanceId: attendance.id,
      type: types[0],
      types,
      startAt,
      endAt,
      durationMinutes,
      notes,
      createdByUserId: context.user.id,
    },
  });

  const updatedAttendance = await prisma.attendance.findUnique({
    where: { id: attendanceId },
    include: {
      user: { select: { id: true, name: true, role: true, email: true } },
      wfhIntervals: { orderBy: { startAt: "asc" } },
      breaks: { orderBy: { startAt: "asc" } },
    },
  });

  return buildSuccess("Break added.", {
    attendance: attachComputedDurations(updatedAttendance),
  });
}
