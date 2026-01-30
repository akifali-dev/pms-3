import { prisma } from "@/lib/prisma";
import {
  buildError,
  buildSuccess,
  ensureAuthenticated,
  getAuthContext,
  PROJECT_MANAGEMENT_ROLES,
} from "@/lib/api";
import { computeAttendanceDurationsForRecord } from "@/lib/dutyHours";
import { normalizeWfhInterval } from "@/lib/attendanceTimes";

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
  const { startAt, endAt } = normalizeWfhInterval({
    shiftDate: attendance.date,
    startTime: body?.startAt ?? body?.startTime,
    endTime: body?.endAt ?? body?.endTime,
  });

  if (!startAt || !endAt) {
    return buildError("WFH start and end times are required.", 400);
  }

  if (endAt <= startAt) {
    return buildError("WFH end time must be after start time.", 400);
  }

  if (attendance.inTime && attendance.outTime) {
    const officeStart = new Date(attendance.inTime);
    const officeEnd = new Date(attendance.outTime);
    if (
      !Number.isNaN(officeStart.getTime()) &&
      !Number.isNaN(officeEnd.getTime()) &&
      startAt < officeEnd &&
      endAt > officeStart
    ) {
      return buildError("WFH overlaps office time.", 400);
    }
  }

  if (Array.isArray(attendance.wfhIntervals)) {
    const overlap = attendance.wfhIntervals.some((interval) => {
      if (!interval?.startAt || !interval?.endAt) {
        return false;
      }
      const existingStart = new Date(interval.startAt);
      const existingEnd = new Date(interval.endAt);
      if (
        Number.isNaN(existingStart.getTime()) ||
        Number.isNaN(existingEnd.getTime())
      ) {
        return false;
      }
      return startAt < existingEnd && endAt > existingStart;
    });
    if (overlap) {
      return buildError("WFH interval overlaps another interval.", 400);
    }
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
    attendance: attachComputedDurations(updatedAttendance),
    interval: created,
  });
}
