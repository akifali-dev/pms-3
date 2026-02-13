import { prisma } from "@/lib/prisma";
import {
  computeAttendanceDurationsForRecord,
  getDutyDate,
  getUserPresenceNow,
} from "@/lib/dutyHours";
import { getTimeZoneNow, normalizeAttendanceTimes } from "@/lib/attendanceTimes";
import { normalizeAutoOffForAttendances } from "@/lib/attendanceAutoOff";
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

function normalizeDateRange(from, to) {
  const start = normalizeDateOnly(from);
  const end = normalizeDateOnly(to);
  if (!start && !end) {
    return null;
  }
  const range = {};
  if (start) {
    range.gte = start;
  }
  if (end) {
    const endOfDay = new Date(end);
    endOfDay.setUTCHours(23, 59, 59, 999);
    range.lte = endOfDay;
  }
  return range;
}

function getEditWindow() {
  const dutyDate = getDutyDate(getTimeZoneNow());
  const today = normalizeDateOnly(dutyDate ?? new Date());
  if (!today) {
    return null;
  }
  const earliest = new Date(today);
  earliest.setUTCDate(today.getUTCDate() - 2);
  return { earliest, today };
}

function isDateEditable(date) {
  const window = getEditWindow();
  if (!window || !date) {
    return false;
  }
  return date >= window.earliest && date <= window.today;
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
  if (!note) {
    return null;
  }
  const trimmed = note.trim();
  return trimmed ? trimmed : null;
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

export async function GET(request) {
  const context = await getAuthContext();
  const authError = ensureAuthenticated(context);
  if (authError) {
    return authError;
  }

  const { searchParams } = new URL(request.url);
  const from = searchParams.get("from");
  const to = searchParams.get("to");
  const requestedUserId = searchParams.get("userId");

  const where = {};

  if (isLeader(context.role)) {
    if (requestedUserId) {
      where.userId = requestedUserId;
    }
  } else {
    where.userId = context.user.id;
  }

  const range = normalizeDateRange(from, to);
  if (range) {
    where.date = range;
  }

  let attendance = await prisma.attendance.findMany({
    where,
    orderBy: { date: "desc" },
    include: {
      user: { select: { id: true, name: true, role: true, email: true } },
      wfhIntervals: { orderBy: { startAt: "asc" } },
      breaks: { orderBy: { startAt: "asc" } },
    },
  });

  await normalizeAutoOffForAttendances(prisma, attendance, getTimeZoneNow());

  attendance = await prisma.attendance.findMany({
    where,
    orderBy: { date: "desc" },
    include: {
      user: { select: { id: true, name: true, role: true, email: true } },
      wfhIntervals: { orderBy: { startAt: "asc" } },
      breaks: { orderBy: { startAt: "asc" } },
    },
  });

  const presenceUserId = requestedUserId ?? context.user.id;
  const presenceNow = presenceUserId
    ? await getUserPresenceNow(prisma, presenceUserId, getTimeZoneNow())
    : null;

  return buildSuccess("Attendance loaded.", {
    attendance: attendance.map((record) => attachComputedDurations(record)),
    presenceNow,
  });
}

export async function POST(request) {
  const context = await getAuthContext();
  const authError = ensureAuthenticated(context);
  if (authError) {
    return authError;
  }

  const body = await request.json();
  const date = normalizeDateOnly(body?.date);
  if (!date) {
    return buildError("Date is required.", 400);
  }

  const leader = isLeader(context.role);
  const targetUserId = leader && body?.userId ? body.userId : context.user.id;

  const { inAt, outAt } = normalizeAttendanceTimes({
    shiftDate: date,
    inTime: body?.inTime,
    outTime: body?.outTime,
  });
  const inTime = inAt ?? (body?.inTime ? parseDateTime(body?.inTime) : null);
  const outTime = outAt ?? (body?.outTime ? parseDateTime(body?.outTime) : null);

  if (!body?.inTime) {
    return buildError("In time is required.", 400);
  }

  if (body?.inTime && !inTime) {
    return buildError("In time must be valid.", 400);
  }

  if (body?.outTime && !outTime) {
    return buildError("Out time must be valid.", 400);
  }

  const now = getTimeZoneNow();
  if (inTime && inTime > now) {
    return buildError("In time cannot be in the future.", 422);
  }
  if (outTime && outTime > now) {
    return buildError("Out time cannot be in the future.", 422);
  }

  if (leader && body?.userId) {
    const userExists = await prisma.user.findUnique({
      where: { id: body.userId },
      select: { id: true },
    });
    if (!userExists) {
      return buildError("User not found.", 404);
    }
  }

  if (!leader && !isDateEditable(date)) {
    return buildError(
      "You can only edit attendance for today and the last 2 days.",
      403
    );
  }

  const attendance = await prisma.attendance.upsert({
    where: { userId_date: { userId: targetUserId, date } },
    update: {
      inTime,
      outTime,
      note: normalizeNote(body?.note),
      autoOff: false,
      autoOffReason: null,
      userId: targetUserId,
      date,
    },
    create: {
      userId: targetUserId,
      date,
      inTime,
      outTime,
      note: normalizeNote(body?.note),
      autoOff: false,
      autoOffReason: null,
    },
    include: {
      user: { select: { id: true, name: true, role: true, email: true } },
      wfhIntervals: { orderBy: { startAt: "asc" } },
      breaks: { orderBy: { startAt: "asc" } },
    },
  });

  return buildSuccess("Attendance saved.", {
    attendance: attachComputedDurations(attendance),
    presenceNow: await getUserPresenceNow(prisma, targetUserId, getTimeZoneNow()),
  });
}
