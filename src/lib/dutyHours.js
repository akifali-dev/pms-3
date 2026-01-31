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

export function formatDurationFromSeconds(seconds) {
  if (!seconds || seconds <= 0) {
    return "-";
  }
  const totalMinutes = Math.round(seconds / 60);
  if (totalMinutes <= 0) {
    return "-";
  }
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours && minutes) {
    return `${hours}h ${minutes}m`;
  }
  if (hours) {
    return `${hours}h`;
  }
  return `${minutes}m`;
}

export function computeAttendanceDurationsForRecord(attendance) {
  if (!attendance) {
    return {
      officeSeconds: 0,
      wfhSeconds: 0,
      dutySeconds: 0,
      officeHHMM: "-",
      wfhHHMM: "-",
      dutyHHMM: "-",
    };
  }
  let officeSeconds = 0;
  if (attendance.inTime && attendance.outTime) {
    const start = new Date(attendance.inTime);
    const end = new Date(attendance.outTime);
    if (!Number.isNaN(start.getTime()) && !Number.isNaN(end.getTime()) && end > start) {
      officeSeconds = Math.round((end - start) / 1000);
    }
  }
  let wfhSeconds = 0;
  if (Array.isArray(attendance.wfhIntervals)) {
    attendance.wfhIntervals.forEach((interval) => {
      if (!interval?.startAt || !interval?.endAt) {
        return;
      }
      const start = new Date(interval.startAt);
      const end = new Date(interval.endAt);
      if (!Number.isNaN(start.getTime()) && !Number.isNaN(end.getTime()) && end > start) {
        wfhSeconds += Math.round((end - start) / 1000);
      }
    });
  }
  const dutySeconds = officeSeconds + wfhSeconds;
  return {
    officeSeconds,
    wfhSeconds,
    dutySeconds,
    officeHHMM: formatDurationFromSeconds(officeSeconds),
    wfhHHMM: formatDurationFromSeconds(wfhSeconds),
    dutyHHMM: formatDurationFromSeconds(dutySeconds),
  };
}

export async function computeAttendanceDurations(prismaClient, attendanceId) {
  if (!prismaClient || !attendanceId) {
    return null;
  }
  const attendance = await prismaClient.attendance.findUnique({
    where: { id: attendanceId },
    include: { wfhIntervals: true },
  });
  if (!attendance) {
    return null;
  }
  return computeAttendanceDurationsForRecord(attendance);
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

export function getPresenceFromIntervals(intervals, now = new Date()) {
  if (!Array.isArray(intervals)) {
    return { status: "OFF_DUTY", dutyWindowInfo: null };
  }
  const officeIntervals = intervals.filter(
    (interval) => interval?.source === "ATTENDANCE"
  );
  const officeWindow = findDutyWindowForTime(officeIntervals, now);
  if (officeWindow) {
    return {
      status: "IN_OFFICE",
      dutyWindowInfo: { inAt: officeWindow.start, outAt: officeWindow.end },
    };
  }
  const wfhIntervals = intervals.filter((interval) => interval?.source === "WFH");
  const wfhWindow = findDutyWindowForTime(wfhIntervals, now);
  if (wfhWindow) {
    return {
      status: "WFH",
      dutyWindowInfo: { startAt: wfhWindow.start, endAt: wfhWindow.end },
    };
  }
  return { status: "OFF_DUTY", dutyWindowInfo: null };
}

export async function getUserPresenceNow(prismaClient, userId, now = new Date()) {
  if (!prismaClient || !userId) {
    return { status: "OFF_DUTY", dutyWindowInfo: null };
  }
  const intervals = await getDutyIntervals(prismaClient, userId, now, now);
  return getPresenceFromIntervals(intervals, now);
}

export async function getDutyIntervals(prismaClient, userId, date, now = new Date()) {
  const bounds = getDayBounds(date);
  if (!bounds || !userId) {
    return [];
  }
  const { start, end } = bounds;

  const attendance = await prismaClient.attendance.findFirst({
    where: {
      userId,
      date: { gte: start, lte: end },
    },
    include: {
      wfhIntervals: true,
    },
  });

  const intervals = [];

  if (attendance?.inTime) {
    const startTime = new Date(attendance.inTime);
    const cutoffTime = getCutoffTime(attendance.inTime);
    let endTime = attendance.outTime || null;
    if (!endTime && cutoffTime) {
      endTime = isSameUtcDate(attendance.date, now)
        ? now > cutoffTime
          ? cutoffTime
          : now
        : cutoffTime;
    }
    if (endTime) {
      intervals.push({
        start: startTime,
        end: endTime,
        source: "ATTENDANCE",
      });
    }
  }

  if (Array.isArray(attendance?.wfhIntervals)) {
    attendance.wfhIntervals.forEach((interval) => {
      if (interval.startAt && interval.endAt) {
        intervals.push({
          start: interval.startAt,
          end: interval.endAt,
          source: "WFH",
        });
      }
    });
  }

  return intervals;
}

export async function getDutyIntervalsForRange(
  prismaClient,
  userId,
  startTime,
  endTime,
  now = new Date()
) {
  if (!userId || !startTime || !endTime) {
    return [];
  }
  const startDate = new Date(startTime);
  const endDate = new Date(endTime);
  if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
    return [];
  }
  const startDay = new Date(
    Date.UTC(
      startDate.getUTCFullYear(),
      startDate.getUTCMonth(),
      startDate.getUTCDate()
    )
  );
  const endDay = new Date(
    Date.UTC(
      endDate.getUTCFullYear(),
      endDate.getUTCMonth(),
      endDate.getUTCDate()
    )
  );
  const attendances = await prismaClient.attendance.findMany({
    where: {
      userId,
      date: { gte: startDay, lte: endDay },
    },
    include: {
      wfhIntervals: true,
    },
  });

  const intervals = [];

  attendances.forEach((attendance) => {
    if (attendance?.inTime) {
      const start = new Date(attendance.inTime);
      const cutoffTime = getCutoffTime(attendance.inTime);
      let end = attendance.outTime || null;
      if (!end && cutoffTime) {
        end = isSameUtcDate(attendance.date, now)
          ? now > cutoffTime
            ? cutoffTime
            : now
          : cutoffTime;
      }
      if (end) {
        intervals.push({ start, end, source: "ATTENDANCE" });
      }
    }
    if (Array.isArray(attendance?.wfhIntervals)) {
      attendance.wfhIntervals.forEach((interval) => {
        if (interval.startAt && interval.endAt) {
          intervals.push({
            start: interval.startAt,
            end: interval.endAt,
            source: "WFH",
          });
        }
      });
    }
  });

  return intervals;
}

export async function getDutyWindows(prismaClient, userId, date, now = new Date()) {
  const intervals = await getDutyIntervals(prismaClient, userId, date, now);
  return mergeIntervals(intervals);
}
