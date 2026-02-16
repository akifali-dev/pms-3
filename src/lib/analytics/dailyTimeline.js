import { DateTime } from "luxon";
import { mergeIntervals } from "@/lib/dutyHours";
import { normalizeAutoOffForAttendances, resolveAttendanceOutTime } from "@/lib/attendanceAutoOff";

const TIME_ZONE = "Asia/Karachi";
const TICK_HOURS = 2;
const WORKING_STATUSES = new Set(["IN_PROGRESS", "DEV_TEST"]);
const DEV_ROLES = new Set(["DEVELOPER", "SENIOR_DEVELOPER"]);
const MANAGEMENT_ROLES = new Set(["CEO", "PM", "CTO"]);

function normalizeDate(value) {
  if (!value) {
    return null;
  }
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) {
      return null;
    }
    return value;
  }
  if (typeof value === "string") {
    const parsed = DateTime.fromISO(value, { zone: TIME_ZONE, setZone: true });
    if (!parsed.isValid) {
      return null;
    }
    return parsed.toJSDate();
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }
  return date;
}

function getBaseWindow(dateValue) {
  const base = DateTime.fromISO(dateValue, { zone: TIME_ZONE });
  if (!base.isValid) {
    return null;
  }
  const start = base.set({ hour: 11, minute: 0, second: 0, millisecond: 0 });
  const end = start
    .plus({ days: 1 })
    .set({ hour: 3, minute: 0, second: 0, millisecond: 0 });
  return { start, end };
}

function buildTicks(windowStart, windowEnd) {
  const ticks = [];
  let cursor = windowStart;
  while (cursor <= windowEnd) {
    ticks.push(cursor.toISO());
    cursor = cursor.plus({ hours: TICK_HOURS });
  }
  return ticks;
}

function sumIntervalsSeconds(intervals) {
  return (intervals ?? []).reduce((total, interval) => {
    if (!interval?.start || !interval?.end) {
      return total;
    }
    return (
      total + Math.max(0, Math.floor((interval.end - interval.start) / 1000))
    );
  }, 0);
}

function clampInterval(interval, windowStart, windowEnd) {
  if (!interval?.start || !interval?.end) {
    return null;
  }
  const start = interval.start > windowStart ? interval.start : windowStart;
  const end = interval.end < windowEnd ? interval.end : windowEnd;
  if (end <= start) {
    return null;
  }
  return { ...interval, start, end };
}

function clampIntervals(intervals, windowStart, windowEnd) {
  return (intervals ?? [])
    .map((interval) => clampInterval(interval, windowStart, windowEnd))
    .filter(Boolean);
}

function subtractIntervals(baseIntervals, subtractIntervalsList) {
  if (!Array.isArray(baseIntervals) || baseIntervals.length === 0) {
    return [];
  }
  if (!Array.isArray(subtractIntervalsList) || subtractIntervalsList.length === 0) {
    return [...baseIntervals];
  }
  const subtracts = mergeIntervals(
    subtractIntervalsList.map((interval) => ({
      start: interval.start,
      end: interval.end,
    }))
  );
  const result = [];

  baseIntervals.forEach((interval) => {
    let segments = [{ ...interval }];
    subtracts.forEach((sub) => {
      segments = segments.flatMap((segment) => {
        if (sub.end <= segment.start || sub.start >= segment.end) {
          return [segment];
        }
        const parts = [];
        if (sub.start > segment.start) {
          parts.push({ ...segment, end: sub.start });
        }
        if (sub.end < segment.end) {
          parts.push({ ...segment, start: sub.end });
        }
        return parts;
      });
    });
    segments.forEach((segment) => {
      if (segment.end > segment.start) {
        result.push(segment);
      }
    });
  });

  return result;
}

function buildSegments({
  windowStart,
  windowEnd,
  dutyIntervals,
  workTaskIntervals,
  workManualIntervals,
  breakIntervals,
  wfhIntervals,
}) {
  const boundaries = new Set([
    windowStart.getTime(),
    windowEnd.getTime(),
  ]);

  const addBoundary = (interval) => {
    if (!interval?.start || !interval?.end) {
      return;
    }
    boundaries.add(interval.start.getTime());
    boundaries.add(interval.end.getTime());
  };

  [...dutyIntervals, ...workTaskIntervals, ...workManualIntervals, ...breakIntervals]
    .forEach(addBoundary);
  (wfhIntervals ?? []).forEach(addBoundary);

  const sorted = Array.from(boundaries)
    .sort((a, b) => a - b)
    .map((time) => new Date(time));

  const segments = [];

  for (let i = 0; i < sorted.length - 1; i += 1) {
    const start = sorted[i];
    const end = sorted[i + 1];
    if (end <= start) {
      continue;
    }

    const within = (interval) => start < interval.end && end > interval.start;
    const activeBreak = breakIntervals.find(within);
    const activeTask = workTaskIntervals.find(within);
    const activeManual = workManualIntervals.find(within);
    const activeDuty = dutyIntervals.find(within);
    const activeWfh = (wfhIntervals ?? []).some(within);

    let type = "NO_DUTY";
    let breakType = null;
    let breakReason = null;
    let label = "Off duty";

    if (activeBreak) {
      type = "BREAK";
      breakType = activeBreak.breakType ?? "ATTENDANCE";
      breakReason = activeBreak.reason ?? "OTHER";
      label = breakReason;
    } else if (activeTask) {
      type = "WORK_TASK";
      label = "Task";
    } else if (activeManual) {
      type = activeManual.isRunning ? "WORK_MANUAL_RUNNING" : "WORK_MANUAL";
      label = activeManual.isRunning ? "Manual (running)" : "Manual";
    } else if (activeDuty) {
      type = "IDLE";
      label = "Idle";
    }

    segments.push({
      startAt: start.toISOString(),
      endAt: end.toISOString(),
      type,
      breakType,
      breakReason,
      isWFH: activeWfh,
      label,
    });
  }

  const merged = [];
  segments.forEach((segment) => {
    const last = merged[merged.length - 1];
    if (
      last &&
      last.type === segment.type &&
      last.isWFH === segment.isWFH &&
      last.breakType === segment.breakType &&
      last.breakReason === segment.breakReason
    ) {
      last.endAt = segment.endAt;
      return;
    }
    merged.push({ ...segment });
  });

  return merged;
}

function calculateTotals({ dutyIntervals, workTaskIntervals, workManualIntervals, breakIntervals }) {
  const dutySeconds = sumIntervalsSeconds(dutyIntervals);
  const workTaskSeconds = sumIntervalsSeconds(workTaskIntervals);
  const workManualSeconds = sumIntervalsSeconds(workManualIntervals);
  const breakSeconds = sumIntervalsSeconds(breakIntervals);
  const idleSeconds = Math.max(
    0,
    dutySeconds - workTaskSeconds - workManualSeconds - breakSeconds
  );
  const utilizationPercent =
    dutySeconds > 0
      ? Number(((workTaskSeconds + workManualSeconds) / dutySeconds * 100).toFixed(1))
      : 0;

  return {
    dutySeconds,
    workTaskSeconds,
    workManualSeconds,
    breakSeconds,
    idleSeconds,
    utilizationPercent,
  };
}

function getLatestIntervalEnd(intervals) {
  return (intervals ?? []).reduce((latest, interval) => {
    if (!interval?.end) {
      return latest;
    }
    if (!latest || interval.end > latest) {
      return interval.end;
    }
    return latest;
  }, null);
}

async function buildUserIntervals(prismaClient, userId, windowStart, windowEnd, now) {
  let attendances = await prismaClient.attendance.findMany({
    where: {
      userId,
      inTime: { lte: windowEnd },
      OR: [{ outTime: null }, { outTime: { gte: windowStart } }],
    },
    include: { wfhIntervals: true, breaks: true },
    orderBy: { inTime: "asc" },
  });


  await normalizeAutoOffForAttendances(prismaClient, attendances, now);

  attendances = await prismaClient.attendance.findMany({
    where: {
      userId,
      inTime: { lte: windowEnd },
      OR: [{ outTime: null }, { outTime: { gte: windowStart } }],
    },
    include: { wfhIntervals: true, breaks: true },
    orderBy: { inTime: "asc" },
  });

  const dutyIntervals = [];
  const wfhIntervals = [];
  const breakIntervals = [];

  attendances.forEach((attendance) => {
    const inAt = normalizeDate(attendance.inTime);
    if (inAt) {
      const outAt = resolveAttendanceOutTime(attendance, now);
      if (outAt > inAt) {
        dutyIntervals.push({ start: inAt, end: outAt });
      }
    }

    (attendance.wfhIntervals ?? []).forEach((interval) => {
      const start = normalizeDate(interval.startAt);
      const end = normalizeDate(interval.endAt);
      if (start && end && end > start) {
        dutyIntervals.push({ start, end });
        wfhIntervals.push({ start, end });
      }
    });

    (attendance.breaks ?? []).forEach((brk) => {
      const start = normalizeDate(brk.startAt);
      const end = normalizeDate(brk.endAt) ?? now;
      if (start && end && end > start) {
        breakIntervals.push({
          start,
          end,
          reason: brk.type ?? "OTHER",
          breakType: "ATTENDANCE",
        });
      }
    });
  });

  const dutyWindows = mergeIntervals(dutyIntervals);
  const workLogs = await prismaClient.taskTimeLog.findMany({
    where: {
      status: { in: Array.from(WORKING_STATUSES) },
      startedAt: { lte: windowEnd },
      OR: [{ endedAt: null }, { endedAt: { gte: windowStart } }],
      task: { ownerId: userId },
    },
    select: { taskId: true, startedAt: true, endedAt: true },
  });

  const taskBreaks = await prismaClient.taskBreak.findMany({
    where: {
      userId,
      startedAt: { lte: windowEnd },
      OR: [{ endedAt: null }, { endedAt: { gte: windowStart } }],
    },
    select: { startedAt: true, endedAt: true, reason: true },
  });

  const rawTaskIntervals = workLogs
    .map((log) => {
      const start = normalizeDate(log.startedAt);
      const end = normalizeDate(log.endedAt) ?? now;
      if (!start || !end || end <= start) {
        return null;
      }
      return { start, end };
    })
    .filter(Boolean);

  const taskBreakIntervals = taskBreaks
    .map((brk) => {
      const start = normalizeDate(brk.startedAt);
      const end = normalizeDate(brk.endedAt) ?? now;
      if (!start || !end || end <= start) {
        return null;
      }
      return { start, end, reason: brk.reason ?? "OTHER", breakType: "TASK_PAUSE" };
    })
    .filter(Boolean);

  const taskIntervals = subtractIntervals(rawTaskIntervals, taskBreakIntervals);

  const manualLogs = await prismaClient.activityLog.findMany({
    where: {
      userId,
      type: "MANUAL",
      startAt: { lte: windowEnd },
      OR: [{ endAt: null }, { endAt: { gte: windowStart } }],
    },
    select: { startAt: true, endAt: true },
  });

  const manualIntervals = manualLogs
    .map((log) => {
      const start = normalizeDate(log.startAt);
      const end = normalizeDate(log.endAt) ?? now;
      if (!start || !end || end <= start) {
        return null;
      }
      return { start, end, isRunning: !log.endAt };
    })
    .filter(Boolean);

  return {
    dutyWindows,
    wfhIntervals,
    breakIntervals: [...breakIntervals, ...taskBreakIntervals],
    taskIntervals,
    manualIntervals,
  };
}

export async function buildDailyTimeline({
  prismaClient,
  date,
  viewerUserId,
  viewerRole,
  targetUserId,
  now = new Date(),
}) {
  if (!prismaClient || !viewerUserId) {
    return {
      window: null,
      rows: [],
    };
  }

  const baseWindow = getBaseWindow(date);
  if (!baseWindow) {
    return {
      window: null,
      rows: [],
    };
  }

  const isManager = MANAGEMENT_ROLES.has(viewerRole);
  let users = [];

  if (isManager) {
    if (targetUserId) {
      const user = await prismaClient.user.findUnique({
        where: { id: targetUserId },
        select: { id: true, name: true, role: true },
      });
      if (user) {
        users = [user];
      }
    } else {
      users = await prismaClient.user.findMany({
        where: { isActive: true, role: { in: Array.from(DEV_ROLES) } },
        select: { id: true, name: true, role: true },
        orderBy: { name: "asc" },
      });
    }
  } else {
    const user = await prismaClient.user.findUnique({
      where: { id: viewerUserId },
      select: { id: true, name: true, role: true },
    });
    if (user) {
      users = [user];
    }
  }

  if (!users.length) {
    return {
      window: {
        startAt: baseWindow.start.toISO(),
        endAt: baseWindow.end.toISO(),
        ticks: buildTicks(baseWindow.start, baseWindow.end),
      },
      rows: [],
    };
  }

  const baseStart = baseWindow.start.toJSDate();
  const baseEnd = baseWindow.end.toJSDate();

  const userIntervals = await Promise.all(
    users.map(async (user) => {
      const intervals = await buildUserIntervals(
        prismaClient,
        user.id,
        baseStart,
        baseEnd,
        now
      );
      const latestEnd = [
        getLatestIntervalEnd(intervals.dutyWindows),
        getLatestIntervalEnd(intervals.taskIntervals),
        getLatestIntervalEnd(intervals.manualIntervals),
        getLatestIntervalEnd(intervals.breakIntervals),
      ].reduce((latest, candidate) => {
        if (!candidate) {
          return latest;
        }
        if (!latest || candidate > latest) {
          return candidate;
        }
        return latest;
      }, null);

      return { user, intervals, latestEnd };
    })
  );

  const windowStart = baseStart;
  const windowEnd = baseEnd;

  const rows = userIntervals.map((entry) => {
    const dutyIntervals = mergeIntervals(
      clampIntervals(entry.intervals.dutyWindows, windowStart, windowEnd)
    );
    const wfhIntervals = clampIntervals(
      entry.intervals.wfhIntervals,
      windowStart,
      windowEnd
    );
    const breakIntervals = clampIntervals(
      entry.intervals.breakIntervals,
      windowStart,
      windowEnd
    );
    const workTaskIntervals = clampIntervals(
      entry.intervals.taskIntervals,
      windowStart,
      windowEnd
    );
    const workManualIntervals = clampIntervals(
      entry.intervals.manualIntervals,
      windowStart,
      windowEnd
    );

    const workTaskInDuty = workTaskIntervals
      .flatMap((interval) =>
        dutyIntervals.map((duty) => ({
          start: interval.start > duty.start ? interval.start : duty.start,
          end: interval.end < duty.end ? interval.end : duty.end,
        }))
      )
      .filter((interval) => interval.end > interval.start);

    const workManualInDuty = workManualIntervals
      .flatMap((interval) =>
        dutyIntervals.map((duty) => ({
          start: interval.start > duty.start ? interval.start : duty.start,
          end: interval.end < duty.end ? interval.end : duty.end,
        }))
      )
      .filter((interval) => interval.end > interval.start);

    const breakInDuty = breakIntervals
      .flatMap((interval) =>
        dutyIntervals.map((duty) => ({
          ...interval,
          start: interval.start > duty.start ? interval.start : duty.start,
          end: interval.end < duty.end ? interval.end : duty.end,
        }))
      )
      .filter((interval) => interval.end > interval.start);

    const segments = buildSegments({
      windowStart,
      windowEnd,
      dutyIntervals,
      workTaskIntervals: workTaskInDuty,
      workManualIntervals: workManualInDuty,
      breakIntervals: breakInDuty,
      wfhIntervals,
    });

    const totals = calculateTotals({
      dutyIntervals,
      workTaskIntervals: workTaskInDuty,
      workManualIntervals: workManualInDuty,
      breakIntervals: breakInDuty,
    });

    return {
      user: entry.user,
      segments,
      totals,
    };
  });

  return {
    window: {
      startAt: baseWindow.start.toISO(),
      endAt: baseWindow.end.toISO(),
      ticks: buildTicks(baseWindow.start, baseWindow.end),
    },
    rows,
  };
}
