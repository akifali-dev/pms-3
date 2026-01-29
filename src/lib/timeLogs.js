export function calculateTotalTimeSpent(timeLogs, now = new Date()) {
  if (!Array.isArray(timeLogs)) {
    return 0;
  }

  const nowMs = now.getTime();
  return timeLogs.reduce((total, log) => {
    if (!log?.startedAt) {
      return total;
    }
    const startMs = new Date(log.startedAt).getTime();
    if (Number.isNaN(startMs)) {
      return total;
    }
    const endMs = log.endedAt ? new Date(log.endedAt).getTime() : nowMs;
    if (Number.isNaN(endMs)) {
      return total;
    }
    const elapsedSeconds = Math.max(0, Math.floor((endMs - startMs) / 1000));
    return total + elapsedSeconds;
  }, 0);
}

export function resolveTotalTimeSpent(task, now = new Date()) {
  if (!task) {
    return 0;
  }
  const stored = Number(task.totalTimeSpent ?? 0);
  if (stored > 0) {
    return stored;
  }
  const logs = task.timeLogs ?? [];
  const filteredLogs = task.lastStartedAt
    ? logs.filter((log) => log.endedAt)
    : logs;
  return calculateTotalTimeSpent(filteredLogs, now);
}

export function sumBreakSeconds(breaks, start, end) {
  if (!Array.isArray(breaks) || !start || !end) {
    return 0;
  }
  const startMs = start instanceof Date ? start.getTime() : new Date(start).getTime();
  const endMs = end instanceof Date ? end.getTime() : new Date(end).getTime();
  if (Number.isNaN(startMs) || Number.isNaN(endMs)) {
    return 0;
  }
  return breaks.reduce((total, brk) => {
    const startedAt = new Date(brk.startedAt).getTime();
    const endedAt = brk.endedAt ? new Date(brk.endedAt).getTime() : null;
    if (Number.isNaN(startedAt)) {
      return total;
    }
    const resolvedEnd = endedAt ?? endMs;
    if (Number.isNaN(resolvedEnd)) {
      return total;
    }
    if (startedAt < startMs || resolvedEnd > endMs) {
      return total;
    }
    const durationSeconds =
      Number(brk.durationSeconds ?? 0) > 0
        ? Number(brk.durationSeconds)
        : Math.max(0, Math.floor((resolvedEnd - startedAt) / 1000));
    return total + durationSeconds;
  }, 0);
}
