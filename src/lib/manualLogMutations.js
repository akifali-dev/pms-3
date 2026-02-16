function normalizeDate(value) {
  if (!value) {
    return null;
  }
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }
  return date;
}

export function getManualLogStatus(log) {
  return log?.endAt ? "COMPLETED" : "RUNNING";
}

export function withManualLogStatus(log) {
  if (!log) {
    return log;
  }
  return {
    ...log,
    status: getManualLogStatus(log),
  };
}

export async function findConflictingManualLog(prismaClient, {
  userId,
  startAt,
  endAt,
  excludeId,
}) {
  const start = normalizeDate(startAt);
  const end = normalizeDate(endAt);
  if (!prismaClient || !userId || !start) {
    return null;
  }

  const overlapWhere = {
    userId,
    type: "MANUAL",
    ...(excludeId ? { id: { not: excludeId } } : {}),
    OR: [
      {
        endAt: null,
        ...(end ? { startAt: { lt: end } } : {}),
      },
      {
        endAt: { gt: start },
        ...(end ? { startAt: { lt: end } } : {}),
      },
    ],
  };

  return prismaClient.activityLog.findFirst({
    where: overlapWhere,
    select: { id: true, startAt: true, endAt: true },
  });
}

export async function findRunningManualLog(prismaClient, { userId, excludeId }) {
  if (!prismaClient || !userId) {
    return null;
  }

  return prismaClient.activityLog.findFirst({
    where: {
      userId,
      type: "MANUAL",
      endAt: null,
      ...(excludeId ? { id: { not: excludeId } } : {}),
    },
    select: { id: true, startAt: true },
    orderBy: { startAt: "desc" },
  });
}
