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
