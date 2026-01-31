import { getCutoffTime, getDayBounds, mergeIntervals } from "@/lib/dutyHours";

const WORKING_STATUSES = new Set(["IN_PROGRESS", "DEV_TEST"]);

function normalizeDate(value) {
  if (!value) {
    return null;
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }
  return date;
}

function isSameUtcDate(left, right) {
  if (!left || !right) {
    return false;
  }
  const leftDate = new Date(left);
  const rightDate = new Date(right);
  if (Number.isNaN(leftDate.getTime()) || Number.isNaN(rightDate.getTime())) {
    return false;
  }
  return (
    leftDate.getUTCFullYear() === rightDate.getUTCFullYear() &&
    leftDate.getUTCMonth() === rightDate.getUTCMonth() &&
    leftDate.getUTCDate() === rightDate.getUTCDate()
  );
}

function clampIntervalToBounds(interval, bounds) {
  if (!interval?.start || !interval?.end || !bounds?.start || !bounds?.end) {
    return null;
  }
  const start = interval.start > bounds.start ? interval.start : bounds.start;
  const end = interval.end < bounds.end ? interval.end : bounds.end;
  if (end <= start) {
    return null;
  }
  return { ...interval, start, end };
}

function sumIntervalsSeconds(intervals) {
  return (intervals ?? []).reduce((total, interval) => {
    if (!interval?.start || !interval?.end) {
      return total;
    }
    return (
      total + Math.floor((interval.end.getTime() - interval.start.getTime()) / 1000)
    );
  }, 0);
}

function buildAttendanceIntervals(attendance, bounds, now) {
  if (!attendance) {
    return { dutyIntervals: [], wfhIntervals: [] };
  }
  const dutyIntervals = [];
  const wfhIntervals = [];

  if (attendance.inTime) {
    const start = normalizeDate(attendance.inTime);
    if (start) {
      const cutoffTime = getCutoffTime(start);
      let end = attendance.outTime ? normalizeDate(attendance.outTime) : null;
      if (!end && cutoffTime) {
        end = isSameUtcDate(attendance.date, now)
          ? now > cutoffTime
            ? cutoffTime
            : now
          : cutoffTime;
      }
      if (end) {
        const clamped = clampIntervalToBounds({ start, end, source: "ATTENDANCE" }, bounds);
        if (clamped) {
          dutyIntervals.push(clamped);
        }
      }
    }
  }

  if (Array.isArray(attendance.wfhIntervals)) {
    attendance.wfhIntervals.forEach((interval) => {
      const start = normalizeDate(interval.startAt);
      const end = normalizeDate(interval.endAt);
      if (!start || !end || end <= start) {
        return;
      }
      const clamped = clampIntervalToBounds({ start, end, source: "WFH" }, bounds);
      if (clamped) {
        dutyIntervals.push(clamped);
        wfhIntervals.push(clamped);
      }
    });
  }

  return { dutyIntervals, wfhIntervals };
}

function intersectIntervalsWithWindows(intervals, windows) {
  if (!Array.isArray(intervals) || !Array.isArray(windows)) {
    return [];
  }
  const overlaps = [];
  intervals.forEach((interval) => {
    windows.forEach((window) => {
      const start = interval.start > window.start ? interval.start : window.start;
      const end = interval.end < window.end ? interval.end : window.end;
      if (end > start) {
        overlaps.push({ ...interval, start, end });
      }
    });
  });
  return overlaps;
}

function mergeSimpleIntervals(intervals) {
  const normalized = (intervals ?? [])
    .map((interval) => {
      if (!interval?.start || !interval?.end) {
        return null;
      }
      return { start: interval.start, end: interval.end };
    })
    .filter(Boolean)
    .sort((a, b) => a.start - b.start);

  const merged = [];
  normalized.forEach((interval) => {
    const last = merged[merged.length - 1];
    if (!last) {
      merged.push({ ...interval });
      return;
    }
    if (interval.start <= last.end) {
      if (interval.end > last.end) {
        last.end = interval.end;
      }
    } else {
      merged.push({ ...interval });
    }
  });
  return merged;
}

function subtractIntervals(baseIntervals, subtractIntervalsList) {
  if (!Array.isArray(baseIntervals) || baseIntervals.length === 0) {
    return [];
  }
  if (!Array.isArray(subtractIntervalsList) || subtractIntervalsList.length === 0) {
    return [...baseIntervals];
  }
  const subtracts = mergeSimpleIntervals(subtractIntervalsList);
  const result = [];

  baseIntervals.forEach((interval) => {
    let segments = [{ start: interval.start, end: interval.end, meta: interval.meta }];
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

function isIntervalOverlapping(interval, targets) {
  if (!interval?.start || !interval?.end) {
    return false;
  }
  return (targets ?? []).some(
    (target) =>
      target?.start &&
      target?.end &&
      interval.start < target.end &&
      interval.end > target.start
  );
}

function buildSegments({
  dutyWindows,
  workIntervals,
  breakIntervals,
  wfhIntervals,
}) {
  const mergedBreaks = mergeSimpleIntervals(breakIntervals);
  const workMinusBreaks = subtractIntervals(workIntervals, mergedBreaks);
  const occupied = mergeSimpleIntervals([...workMinusBreaks, ...mergedBreaks]);
  const idleIntervals = subtractIntervals(
    dutyWindows.map((window) => ({ start: window.start, end: window.end })),
    occupied
  );

  const segments = [];

  workMinusBreaks.forEach((interval) => {
    segments.push({
      startAt: interval.start,
      endAt: interval.end,
      type: "WORK",
      taskId: interval.taskId ?? null,
      isWFH: isIntervalOverlapping(interval, wfhIntervals),
    });
  });

  breakIntervals.forEach((interval) => {
    segments.push({
      startAt: interval.start,
      endAt: interval.end,
      type: "BREAK",
      reason: interval.reason ?? "OTHER",
      isWFH: isIntervalOverlapping(interval, wfhIntervals),
    });
  });

  idleIntervals.forEach((interval) => {
    segments.push({
      startAt: interval.start,
      endAt: interval.end,
      type: "IDLE",
      isWFH: isIntervalOverlapping(interval, wfhIntervals),
    });
  });

  return segments.sort((a, b) => a.startAt - b.startAt);
}

function calculateTotals({ dutyWindows, segments, breakIntervals, wfhIntervals }) {
  const dutySeconds = sumIntervalsSeconds(dutyWindows);
  const workSeconds = sumIntervalsSeconds(
    segments.filter((segment) => segment.type === "WORK").map((segment) => ({
      start: segment.startAt,
      end: segment.endAt,
    }))
  );
  const breakSeconds = sumIntervalsSeconds(
    mergeSimpleIntervals(
      breakIntervals.map((interval) => ({ start: interval.start, end: interval.end }))
    )
  );
  const idleSeconds = Math.max(0, dutySeconds - workSeconds - breakSeconds);
  const wfhSeconds = sumIntervalsSeconds(
    mergeSimpleIntervals(
      (wfhIntervals ?? []).map((interval) => ({ start: interval.start, end: interval.end }))
    )
  );
  const utilization =
    dutySeconds > 0 ? Number((workSeconds / dutySeconds).toFixed(3)) : 0;
  return {
    dutySeconds,
    workSeconds,
    breakSeconds,
    idleSeconds,
    wfhSeconds,
    utilization,
  };
}

function buildTimelineDetails({ dutyWindows, segments, breakIntervals, totals }) {
  const lostTimeSeconds = (totals?.idleSeconds ?? 0) + (totals?.breakSeconds ?? 0);
  const dutyStart = dutyWindows[0]?.start ?? null;
  const firstWork = segments.find((segment) => segment.type === "WORK") ?? null;
  const firstWorkStartDelaySeconds =
    dutyStart && firstWork
      ? Math.max(
          0,
          Math.floor((firstWork.startAt.getTime() - dutyStart.getTime()) / 1000)
        )
      : null;

  const pauseBreakdown = (breakIntervals ?? []).reduce((acc, brk) => {
    const key = brk.reason ?? "OTHER";
    if (!acc[key]) {
      acc[key] = { count: 0, seconds: 0 };
    }
    acc[key].count += 1;
    acc[key].seconds += Math.max(
      0,
      Math.floor((brk.end.getTime() - brk.start.getTime()) / 1000)
    );
    return acc;
  }, {});

  return {
    lostTimeSeconds,
    numberOfPauses: breakIntervals.length,
    pauseBreakdown,
    firstWorkStartDelaySeconds,
  };
}

export async function getUserDailyTimeline(prismaClient, userId, date, now = new Date()) {
  if (!prismaClient || !userId) {
    const totals = calculateTotals({
      dutyWindows: [],
      segments: [],
      breakIntervals: [],
      wfhIntervals: [],
    });
    return {
      segments: [],
      totals,
      details: buildTimelineDetails({
        dutyWindows: [],
        segments: [],
        breakIntervals: [],
        totals,
      }),
      dutyWindows: [],
      wfhWindows: [],
      message: "No attendance recorded.",
    };
  }
  const bounds = getDayBounds(date);
  if (!bounds) {
    const totals = calculateTotals({
      dutyWindows: [],
      segments: [],
      breakIntervals: [],
      wfhIntervals: [],
    });
    return {
      segments: [],
      totals,
      details: buildTimelineDetails({
        dutyWindows: [],
        segments: [],
        breakIntervals: [],
        totals,
      }),
      dutyWindows: [],
      wfhWindows: [],
      message: "Invalid date.",
    };
  }

  const attendances = await prismaClient.attendance.findMany({
    where: {
      userId,
      inTime: { lte: bounds.end },
      OR: [{ outTime: null }, { outTime: { gte: bounds.start } }],
    },
    include: { wfhIntervals: true },
    orderBy: { inTime: "asc" },
  });

  const attendanceIntervals = attendances.flatMap((attendance) => {
    const { dutyIntervals } = buildAttendanceIntervals(attendance, bounds, now);
    return dutyIntervals;
  });

  const wfhIntervals = attendances.flatMap((attendance) => {
    const { wfhIntervals: intervals } = buildAttendanceIntervals(attendance, bounds, now);
    return intervals;
  });

  const dutyIntervals = attendanceIntervals;

  const dutyWindows = mergeIntervals(dutyIntervals);
  if (dutyWindows.length === 0) {
    const totals = calculateTotals({
      dutyWindows: [],
      segments: [],
      breakIntervals: [],
      wfhIntervals: [],
    });
    return {
      segments: [],
      totals,
      details: buildTimelineDetails({
        dutyWindows: [],
        segments: [],
        breakIntervals: [],
        totals,
      }),
      dutyWindows: [],
      wfhWindows: wfhIntervals,
      message: "No attendance recorded.",
    };
  }

  const workLogs = await prismaClient.taskTimeLog.findMany({
    where: {
      status: { in: Array.from(WORKING_STATUSES) },
      startedAt: { lte: bounds.end },
      OR: [{ endedAt: null }, { endedAt: { gte: bounds.start } }],
      task: { ownerId: userId },
    },
    select: {
      id: true,
      taskId: true,
      startedAt: true,
      endedAt: true,
    },
  });

  const rawWorkIntervals = workLogs
    .map((log) => {
      const start = normalizeDate(log.startedAt);
      const end = normalizeDate(log.endedAt) ?? now;
      if (!start || !end || end <= start) {
        return null;
      }
      const clamped = clampIntervalToBounds({ start, end, taskId: log.taskId }, bounds);
      return clamped;
    })
    .filter(Boolean);

  const breaks = await prismaClient.taskBreak.findMany({
    where: {
      userId,
      startedAt: { lte: bounds.end },
      OR: [{ endedAt: null }, { endedAt: { gte: bounds.start } }],
    },
    select: {
      id: true,
      reason: true,
      startedAt: true,
      endedAt: true,
    },
  });

  const rawBreakIntervals = breaks
    .map((brk) => {
      const start = normalizeDate(brk.startedAt);
      const end = normalizeDate(brk.endedAt) ?? now;
      if (!start || !end || end <= start) {
        return null;
      }
      return clampIntervalToBounds(
        { start, end, reason: brk.reason ?? "OTHER" },
        bounds
      );
    })
    .filter(Boolean);

  const workIntervals = intersectIntervalsWithWindows(rawWorkIntervals, dutyWindows);
  const breakIntervals = intersectIntervalsWithWindows(rawBreakIntervals, dutyWindows);

  const segments = buildSegments({
    dutyWindows,
    workIntervals,
    breakIntervals,
    wfhIntervals,
  });

  const totals = calculateTotals({
    dutyWindows,
    segments,
    breakIntervals,
    wfhIntervals,
  });
  const details = buildTimelineDetails({
    dutyWindows,
    segments,
    breakIntervals,
    totals,
  });

  return {
    segments,
    totals,
    details,
    dutyWindows,
    wfhWindows: wfhIntervals,
    message: segments.length === 0 ? "No activity recorded." : null,
  };
}

export function getPeriodStart(date, period) {
  const base = normalizeDate(date) ?? new Date();
  const start = new Date(base);

  if (period === "weekly") {
    const day = start.getDay();
    const diff = (day + 6) % 7;
    start.setDate(start.getDate() - diff);
  } else if (period === "monthly") {
    start.setDate(1);
  }

  start.setHours(0, 0, 0, 0);
  return start;
}

export function getPeriodEnd(start, period) {
  const end = new Date(start);
  if (period === "weekly") {
    end.setDate(end.getDate() + 6);
  } else if (period === "monthly") {
    end.setMonth(end.getMonth() + 1, 0);
  }
  end.setHours(23, 59, 59, 999);
  return end;
}

export function buildDateList(start, end) {
  const dates = [];
  const cursor = new Date(start);
  cursor.setHours(0, 0, 0, 0);
  while (cursor <= end) {
    dates.push(new Date(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }
  return dates;
}
