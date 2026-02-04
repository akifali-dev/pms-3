import {
  getDutyIntervals,
  getDutyIntervalsForRange,
  getDutyDate,
  getPresenceFromIntervals,
  mergeIntervals,
} from "@/lib/dutyHours";

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

function getOverlap(startA, endA, startB, endB) {
  const overlapStart = startA > startB ? startA : startB;
  const overlapEnd = endA < endB ? endA : endB;
  if (overlapEnd <= overlapStart) {
    return null;
  }
  return { start: overlapStart, end: overlapEnd };
}

function sumIntervalSeconds(intervals) {
  return (intervals ?? []).reduce((total, interval) => {
    if (!interval?.start || !interval?.end) {
      return total;
    }
    const start = normalizeDate(interval.start);
    const end = normalizeDate(interval.end);
    if (!start || !end || end <= start) {
      return total;
    }
    return total + Math.floor((end.getTime() - start.getTime()) / 1000);
  }, 0);
}

function buildWorkWindows(statusHistory, now) {
  if (!Array.isArray(statusHistory) || statusHistory.length === 0) {
    return [];
  }
  const events = [...statusHistory].sort((a, b) => {
    const aTime = new Date(a.changedAt).getTime();
    const bTime = new Date(b.changedAt).getTime();
    return aTime - bTime;
  });

  const windows = [];
  let activeStart = null;

  events.forEach((event) => {
    const changedAt = normalizeDate(event.changedAt);
    if (!changedAt) {
      return;
    }
    const nextStatus = event.toStatus;
    if (WORKING_STATUSES.has(nextStatus)) {
      if (!activeStart) {
        activeStart = changedAt;
      }
      return;
    }
    if (activeStart) {
      if (changedAt > activeStart) {
        windows.push({ start: activeStart, end: changedAt });
      }
      activeStart = null;
    }
  });

  if (activeStart) {
    windows.push({ start: activeStart, end: now });
  }

  return windows;
}

function normalizeBreakIntervals(breaks, now) {
  if (!Array.isArray(breaks)) {
    return [];
  }
  return breaks
    .map((brk) => {
      const start = normalizeDate(brk.startedAt);
      const end = normalizeDate(brk.endedAt) ?? now;
      if (!start || !end || end <= start) {
        return null;
      }
      return { start, end };
    })
    .filter(Boolean);
}

export async function computeTaskSpentTime(prismaClient, taskId, userId) {
  const now = new Date();
  if (!taskId || !userId) {
    return {
      effectiveSpentSeconds: 0,
      rawWorkSeconds: 0,
      breakSeconds: 0,
      dutyOverlapSeconds: 0,
      lastComputedAt: now,
      isOnDutyNow: false,
      isWFHNow: false,
      isOffDutyNow: true,
    };
  }

  const task = await prismaClient.task.findUnique({
    where: { id: taskId },
    include: {
      statusHistory: true,
      breaks: { where: { userId } },
    },
  });

  if (!task) {
    return {
      effectiveSpentSeconds: 0,
      rawWorkSeconds: 0,
      breakSeconds: 0,
      dutyOverlapSeconds: 0,
      lastComputedAt: now,
      isOnDutyNow: false,
      isWFHNow: false,
      isOffDutyNow: true,
    };
  }

  const workWindows = buildWorkWindows(task.statusHistory, now);
  const rawWorkSeconds = sumIntervalSeconds(workWindows);

  let dutyIntervals = [];
  if (workWindows.length > 0) {
    const earliestStart = workWindows.reduce(
      (min, window) => (window.start < min ? window.start : min),
      workWindows[0].start
    );
    const latestEnd = workWindows.reduce(
      (max, window) => (window.end > max ? window.end : max),
      workWindows[0].end
    );
    dutyIntervals = await getDutyIntervalsForRange(
      prismaClient,
      userId,
      earliestStart,
      latestEnd,
      now
    );
  }

  const mergedDutyIntervals = mergeIntervals(dutyIntervals);
  const breakIntervals = mergeIntervals(normalizeBreakIntervals(task.breaks, now));

  let dutyOverlapSeconds = 0;
  let breakSeconds = 0;

  workWindows.forEach((workWindow) => {
    mergedDutyIntervals.forEach((dutyWindow) => {
      const overlap = getOverlap(
        workWindow.start,
        workWindow.end,
        dutyWindow.start,
        dutyWindow.end
      );
      if (!overlap) {
        return;
      }
      dutyOverlapSeconds += Math.floor(
        (overlap.end.getTime() - overlap.start.getTime()) / 1000
      );
      breakIntervals.forEach((brk) => {
        const breakOverlap = getOverlap(
          overlap.start,
          overlap.end,
          brk.start,
          brk.end
        );
        if (!breakOverlap) {
          return;
        }
        breakSeconds += Math.floor(
          (breakOverlap.end.getTime() - breakOverlap.start.getTime()) / 1000
        );
      });
    });
  });

  const effectiveSpentSeconds = Math.max(0, dutyOverlapSeconds - breakSeconds);

  const dutyDate = getDutyDate(now);
  const dutyDateValue = dutyDate ? new Date(dutyDate) : null;
  const presenceDate =
    dutyDateValue && !Number.isNaN(dutyDateValue.getTime()) ? dutyDateValue : now;
  const todayIntervals = await getDutyIntervals(prismaClient, userId, presenceDate, now);
  const presence = getPresenceFromIntervals(todayIntervals, now);
  const isWFHNow = presence.status === "WFH";
  const isOnDutyNow = presence.status !== "OFF_DUTY";

  return {
    effectiveSpentSeconds,
    rawWorkSeconds,
    breakSeconds,
    dutyOverlapSeconds,
    lastComputedAt: now,
    presenceStatusNow: presence.status,
    isOnDutyNow,
    isWFHNow,
    isOffDutyNow: presence.status === "OFF_DUTY",
  };
}
