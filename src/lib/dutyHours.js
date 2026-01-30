export const DUTY_CUTOFF_HOUR = 21;

export function getDayBounds(date) {
  const base = date instanceof Date ? new Date(date) : new Date(date);
  if (Number.isNaN(base.getTime())) {
    return null;
  }
  const start = new Date(base);
  start.setHours(0, 0, 0, 0);
  const end = new Date(base);
  end.setHours(23, 59, 59, 999);
  return { start, end };
}

export function getCutoffTime(date) {
  const base = date instanceof Date ? new Date(date) : new Date(date);
  if (Number.isNaN(base.getTime())) {
    return null;
  }
  const cutoff = new Date(base);
  cutoff.setHours(DUTY_CUTOFF_HOUR, 0, 0, 0);
  return cutoff;
}

function normalizeInterval(interval) {
  if (!interval?.start || !interval?.end) {
    return null;
  }
  const start = new Date(interval.start);
  const end = new Date(interval.end);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return null;
  }
  if (end <= start) {
    return null;
  }
  return { start, end, source: interval.source ?? null };
}

export function mergeIntervals(intervals) {
  const normalized = (intervals ?? [])
    .map((interval) => normalizeInterval(interval))
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

export function isWithinDutyWindow(windows, time) {
  if (!Array.isArray(windows) || !time) {
    return false;
  }
  const now = new Date(time);
  if (Number.isNaN(now.getTime())) {
    return false;
  }
  return windows.some((window) => now >= window.start && now <= window.end);
}

export function findDutyWindowForTime(windows, time) {
  if (!Array.isArray(windows) || !time) {
    return null;
  }
  const now = new Date(time);
  if (Number.isNaN(now.getTime())) {
    return null;
  }
  return windows.find((window) => now >= window.start && now <= window.end) ?? null;
}

export async function getDutyWindows(prismaClient, userId, date) {
  const bounds = getDayBounds(date);
  if (!bounds || !userId) {
    return [];
  }
  const { start, end } = bounds;

  const [attendance, wfhLogs] = await Promise.all([
    prismaClient.attendance.findFirst({
      where: {
        userId,
        date: { gte: start, lte: end },
      },
    }),
    prismaClient.activityLog.findMany({
      where: {
        userId,
        type: "WFH",
        startTime: { not: null },
        endTime: { not: null },
        date: { gte: start, lte: end },
      },
    }),
  ]);

  const intervals = [];

  if (attendance?.inTime) {
    const startTime = new Date(attendance.inTime);
    const endTime =
      attendance.outTime ||
      getCutoffTime(attendance.inTime) ||
      null;
    if (endTime) {
      intervals.push({
        start: startTime,
        end: endTime,
        source: "ATTENDANCE",
      });
    }
  }

  if (Array.isArray(wfhLogs)) {
    wfhLogs.forEach((log) => {
      if (log.startTime && log.endTime) {
        intervals.push({
          start: log.startTime,
          end: log.endTime,
          source: "WFH",
        });
      }
    });
  }

  return mergeIntervals(intervals);
}
