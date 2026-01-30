import { sumBreakSeconds } from "@/lib/timeLogs";
import {
  findDutyWindowForTime,
  getCutoffTime,
  getDutyWindows,
} from "@/lib/dutyHours";

export async function getOnDutyStatus(prismaClient, userId, time = new Date()) {
  const windows = await getDutyWindows(prismaClient, userId, time);
  const activeWindow = findDutyWindowForTime(windows, time);
  return {
    windows,
    activeWindow,
    onDuty: Boolean(activeWindow),
  };
}

export async function endWorkSession({
  prismaClient,
  session,
  endedAt,
  includeBreaks = true,
}) {
  if (!session || !endedAt) {
    return null;
  }

  const endTime = new Date(endedAt);
  const startTime = new Date(session.startedAt);
  if (Number.isNaN(endTime.getTime()) || Number.isNaN(startTime.getTime())) {
    return null;
  }

  if (endTime <= startTime) {
    return null;
  }

  let breakSeconds = 0;
  if (includeBreaks) {
    const activeBreaks = await prismaClient.taskBreak.findMany({
      where: { taskId: session.taskId, endedAt: null },
    });

    const endedBreaks = await Promise.all(
      activeBreaks.map((brk) => {
        const brkStart = new Date(brk.startedAt);
        if (Number.isNaN(brkStart.getTime()) || brkStart > endTime) {
          return brk;
        }
        return prismaClient.taskBreak.update({
          where: { id: brk.id },
          data: {
            endedAt: endTime,
            durationSeconds: Math.max(
              0,
              Math.floor((endTime.getTime() - brkStart.getTime()) / 1000)
            ),
          },
        });
      })
    );

    const breaksInSession = await prismaClient.taskBreak.findMany({
      where: {
        taskId: session.taskId,
        startedAt: { gte: startTime, lte: endTime },
        endedAt: { not: null },
      },
    });

    breakSeconds = sumBreakSeconds(
      [...breaksInSession, ...endedBreaks],
      startTime,
      endTime
    );
  }

  const sessionSeconds = Math.max(
    0,
    Math.floor((endTime.getTime() - startTime.getTime()) / 1000)
  );
  const durationSeconds = Math.max(0, sessionSeconds - breakSeconds);

  const updatedSession = await prismaClient.taskWorkSession.update({
    where: { id: session.id },
    data: {
      endedAt: endTime,
      durationSeconds,
    },
  });

  await prismaClient.task.update({
    where: { id: session.taskId },
    data: {
      totalTimeSpent: { increment: durationSeconds },
      lastStartedAt: null,
    },
  });

  return updatedSession;
}

export async function endActiveSessionsAtTime(prismaClient, userId, endedAt) {
  if (!userId || !endedAt) {
    return [];
  }
  const cutoffTime = new Date(endedAt);
  if (Number.isNaN(cutoffTime.getTime())) {
    return [];
  }

  const activeSessions = await prismaClient.taskWorkSession.findMany({
    where: {
      userId,
      endedAt: null,
      source: "AUTO",
      startedAt: { lte: cutoffTime },
    },
  });

  const ended = [];
  for (const session of activeSessions) {
    const updated = await endWorkSession({
      prismaClient,
      session,
      endedAt: cutoffTime,
      includeBreaks: true,
    });
    if (updated) {
      ended.push(updated);
    }
  }

  return ended;
}

export async function endSessionsPastCutoff(prismaClient, userId, now = new Date()) {
  if (!userId) {
    return [];
  }
  const nowDate = new Date(now);
  if (Number.isNaN(nowDate.getTime())) {
    return [];
  }

  const activeSessions = await prismaClient.taskWorkSession.findMany({
    where: {
      userId,
      endedAt: null,
      source: "AUTO",
    },
  });

  const ended = [];
  for (const session of activeSessions) {
    const windows = await getDutyWindows(prismaClient, userId, session.startedAt);
    const activeWindow = findDutyWindowForTime(windows, session.startedAt);
    const fallbackCutoff = getCutoffTime(session.startedAt);
    const windowEnd = activeWindow?.end ?? fallbackCutoff;
    if (!windowEnd) {
      continue;
    }
    if (nowDate > windowEnd) {
      const updated = await endWorkSession({
        prismaClient,
        session,
        endedAt: windowEnd,
        includeBreaks: true,
      });
      if (updated) {
        ended.push(updated);
      }
    }
  }

  return ended;
}

export async function clampSessionEndToDutyWindow(
  prismaClient,
  userId,
  sessionStart,
  proposedEnd
) {
  const windows = await getDutyWindows(prismaClient, userId, sessionStart);
  const window = findDutyWindowForTime(windows, sessionStart);
  if (!window) {
    return proposedEnd;
  }
  const endTime = new Date(proposedEnd);
  if (Number.isNaN(endTime.getTime())) {
    return proposedEnd;
  }
  return endTime > window.end ? window.end : endTime;
}
