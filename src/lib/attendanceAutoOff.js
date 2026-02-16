import { endWorkSession } from "@/lib/taskWorkSessions";

export const ATTENDANCE_AUTO_OFF_HOURS = 10;
export const ATTENDANCE_AUTO_OFF_REASON = "AUTO_OFF_10H";
const ATTENDANCE_AUTO_OFF_MS = ATTENDANCE_AUTO_OFF_HOURS * 60 * 60 * 1000;

function toDate(value) {
  if (!value) {
    return null;
  }
  const parsed = value instanceof Date ? new Date(value) : new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }
  return parsed;
}

export function getAttendanceAutoOffTime(inTime) {
  const start = toDate(inTime);
  if (!start) {
    return null;
  }
  return new Date(start.getTime() + ATTENDANCE_AUTO_OFF_MS);
}

export function resolveAttendanceOutTime(attendance, now = new Date()) {
  if (!attendance?.inTime) {
    return null;
  }
  const inAt = toDate(attendance.inTime);
  if (!inAt) {
    return null;
  }
  const explicitOut = toDate(attendance.outTime);
  if (explicitOut) {
    return explicitOut;
  }
  const autoOffAt = getAttendanceAutoOffTime(inAt);
  const nowDate = toDate(now) ?? new Date();
  if (!autoOffAt) {
    return nowDate > inAt ? nowDate : null;
  }
  if (nowDate <= inAt) {
    return null;
  }
  return nowDate > autoOffAt ? autoOffAt : nowDate;
}

export function shouldAutoOffAttendance(attendance, now = new Date()) {
  if (!attendance?.inTime || attendance?.outTime) {
    return false;
  }
  const autoOffAt = getAttendanceAutoOffTime(attendance.inTime);
  const nowDate = toDate(now) ?? new Date();
  return Boolean(autoOffAt && nowDate > autoOffAt);
}

export async function normalizeAttendanceAutoOff(prismaClient, attendance, now = new Date()) {
  if (!prismaClient || !attendance?.id || !shouldAutoOffAttendance(attendance, now)) {
    return null;
  }

  const autoOffAt = getAttendanceAutoOffTime(attendance.inTime);
  if (!autoOffAt) {
    return null;
  }

  return prismaClient.$transaction(async (tx) => {
    const fresh = await tx.attendance.findUnique({
      where: { id: attendance.id },
      include: { breaks: true },
    });

    if (!fresh || !shouldAutoOffAttendance(fresh, now)) {
      return null;
    }

    await tx.attendance.update({
      where: { id: fresh.id },
      data: {
        outTime: autoOffAt,
        autoOff: true,
        autoOffReason: ATTENDANCE_AUTO_OFF_REASON,
      },
    });

    await tx.attendanceBreak.updateMany({
      where: {
        attendanceId: fresh.id,
        OR: [{ endAt: null }, { endAt: { gt: autoOffAt } }],
      },
      data: {
        endAt: autoOffAt,
        endedBy: "AUTO_OFF",
      },
    });

    const activeSessions = await tx.taskWorkSession.findMany({
      where: {
        userId: fresh.userId,
        endedAt: null,
        startedAt: { lt: autoOffAt },
      },
    });

    for (const session of activeSessions) {
      await endWorkSession({
        prismaClient: tx,
        session,
        endedAt: autoOffAt,
        includeBreaks: true,
        endedBy: "AUTO_OFF",
      });
    }

    const runningManualLogs = await tx.activityLog.findMany({
      where: {
        userId: fresh.userId,
        type: "MANUAL",
        endAt: null,
        startAt: { lt: autoOffAt },
      },
      select: { id: true, startAt: true },
    });

    for (const log of runningManualLogs) {
      const startAt = log.startAt instanceof Date ? log.startAt : new Date(log.startAt);
      if (Number.isNaN(startAt.getTime()) || startAt >= autoOffAt) {
        continue;
      }
      const durationSeconds = Math.max(
        0,
        Math.floor((autoOffAt.getTime() - startAt.getTime()) / 1000)
      );
      await tx.activityLog.update({
        where: { id: log.id },
        data: {
          endAt: autoOffAt,
          durationSeconds,
        },
      });
    }

    return { id: fresh.id, outTime: autoOffAt };
  });
}

export async function normalizeAutoOffForAttendances(prismaClient, attendances, now = new Date()) {
  if (!prismaClient || !Array.isArray(attendances) || attendances.length === 0) {
    return 0;
  }
  let changes = 0;
  for (const attendance of attendances) {
    const updated = await normalizeAttendanceAutoOff(prismaClient, attendance, now);
    if (updated) {
      changes += 1;
    }
  }
  return changes;
}

export async function normalizeAutoOffForUser(prismaClient, userId, now = new Date()) {
  if (!prismaClient || !userId) {
    return 0;
  }
  const stale = await prismaClient.attendance.findMany({
    where: {
      userId,
      outTime: null,
      inTime: { lt: new Date((toDate(now) ?? new Date()).getTime() - ATTENDANCE_AUTO_OFF_MS) },
    },
    select: { id: true, inTime: true, outTime: true, userId: true },
  });
  return normalizeAutoOffForAttendances(prismaClient, stale, now);
}
