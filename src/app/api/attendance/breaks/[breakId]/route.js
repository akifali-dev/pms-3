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
  if (value === undefined) {
    return undefined;
  }
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

export async function PATCH(request, { params }) {
  const { breakId } = await params;
  const context = await getAuthContext();
  const authError = ensureAuthenticated(context);
  if (authError) {
    return authError;
  }

  if (!breakId) {
    return buildError("Break id is required.", 400);
  }

  const existingBreak = await prisma.attendanceBreak.findUnique({
    where: { id: breakId },
    include: {
      attendance: true,
    },
  });

  if (!existingBreak) {
    return buildError("Break not found.", 404);
  }

  const now = getTimeZoneNow();
  if (!canManageBreak({ context, attendance: existingBreak.attendance, now })) {
    return buildError("You do not have permission to edit this break.", 403);
  }

  const body = await request.json();

  const baseTypes = normalizeBreakTypes(existingBreak.types, existingBreak.type);
  const shouldUpdateTypes = body?.types !== undefined || body?.type !== undefined;
  const types = shouldUpdateTypes
    ? normalizeBreakTypes(body?.types, body?.type)
    : baseTypes;

  if (!types.length) {
    return buildError("At least one break type is required.", 400);
  }

  const durationMinutes = normalizeDurationMinutes(body?.durationMinutes);
  if (durationMinutes === null) {
    return buildError("Duration must be a positive number of minutes.", 400);
  }

  const incomingNotes = normalizeNotes(body?.notes);
  const notes = incomingNotes === undefined ? existingBreak.notes : incomingNotes;

  const nextDuration = durationMinutes ?? existingBreak.durationMinutes;
  const startAt = body?.startTime
    ? combineShiftDateAndTime(existingBreak.attendance.date, body?.startTime)
    : new Date(existingBreak.startAt);
  if (!startAt) {
    return buildError("Break start time must be valid.", 400);
  }

  const endAt = new Date(startAt.getTime() + nextDuration * 60 * 1000);
  const window = getAttendanceWindow(existingBreak.attendance);
  if (!window) {
    return buildError("Attendance window is invalid.", 400);
  }

  if (startAt < window.start || endAt > window.end) {
    return buildError("Break must fall within the duty window.", 422);
  }

  await prisma.attendanceBreak.update({
    where: { id: breakId },
    data: {
      type: types[0],
      types,
      startAt,
      endAt,
      durationMinutes: nextDuration,
      notes,
    },
  });

  const updatedAttendance = await prisma.attendance.findUnique({
    where: { id: existingBreak.attendanceId },
    include: {
      user: { select: { id: true, name: true, role: true, email: true } },
      wfhIntervals: { orderBy: { startAt: "asc" } },
      breaks: { orderBy: { startAt: "asc" } },
    },
  });

  return buildSuccess("Break updated.", {
    attendance: attachComputedDurations(updatedAttendance),
  });
}

export async function DELETE(request, { params }) {
  const { breakId } = await params;
  const context = await getAuthContext();
  const authError = ensureAuthenticated(context);
  if (authError) {
    return authError;
  }

  if (!breakId) {
    return buildError("Break id is required.", 400);
  }

  const existingBreak = await prisma.attendanceBreak.findUnique({
    where: { id: breakId },
    include: { attendance: true },
  });

  if (!existingBreak) {
    return buildError("Break not found.", 404);
  }

  const now = getTimeZoneNow();
  if (!canManageBreak({ context, attendance: existingBreak.attendance, now })) {
    return buildError("You do not have permission to delete this break.", 403);
  }

  await prisma.attendanceBreak.delete({ where: { id: breakId } });

  const updatedAttendance = await prisma.attendance.findUnique({
    where: { id: existingBreak.attendanceId },
    include: {
      user: { select: { id: true, name: true, role: true, email: true } },
      wfhIntervals: { orderBy: { startAt: "asc" } },
      breaks: { orderBy: { startAt: "asc" } },
    },
  });

  return buildSuccess("Break deleted.", {
    attendance: attachComputedDurations(updatedAttendance),
  });
}
