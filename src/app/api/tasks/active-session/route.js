import { prisma } from "@/lib/prisma";
import {
  buildSuccess,
  ensureAuthenticated,
  getAuthContext,
} from "@/lib/api";
import { computeTaskSpentTime } from "@/lib/taskTimeCalculator";

function toEstimatedSeconds(hoursValue) {
  const hours = Number(hoursValue ?? 0);
  if (!Number.isFinite(hours) || hours <= 0) {
    return 0;
  }
  return Math.max(0, Math.round(hours * 3600));
}

export async function GET() {
  const context = await getAuthContext();
  const authError = ensureAuthenticated(context);
  if (authError) {
    return authError;
  }

  const activeTask = await prisma.task.findFirst({
    where: {
      ownerId: context.user.id,
      timeLogs: {
        some: {
          endedAt: null,
        },
      },
    },
    orderBy: {
      updatedAt: "desc",
    },
    select: {
      id: true,
      title: true,
      status: true,
      ownerId: true,
      estimatedHours: true,
      milestoneId: true,
      milestone: { select: { id: true, projectId: true } },
      timeLogs: {
        where: { endedAt: null },
        orderBy: { startedAt: "desc" },
        take: 1,
        select: { id: true, startedAt: true },
      },
    },
  });

  const activeLog = activeTask?.timeLogs?.[0] ?? null;
  if (!activeTask || !activeLog) {
    return buildSuccess("No active task session.", { active: false });
  }

  const activeBreak = await prisma.taskBreak.findFirst({
    where: {
      taskId: activeTask.id,
      userId: context.user.id,
      endedAt: null,
    },
    orderBy: { startedAt: "desc" },
  });

  const serverNow = new Date();
  const computed = await computeTaskSpentTime(
    prisma,
    activeTask.id,
    activeTask.ownerId
  );
  const totalEffectiveSeconds = Math.max(
    0,
    Number(computed.effectiveSpentSeconds ?? 0)
  );

  const runningStartedAt = activeBreak ? null : new Date(activeLog.startedAt);
  let accumulatedSeconds = totalEffectiveSeconds;

  if (runningStartedAt) {
    const runningElapsedSeconds = Math.max(
      0,
      Math.floor((serverNow.getTime() - runningStartedAt.getTime()) / 1000)
    );
    accumulatedSeconds = Math.max(
      0,
      totalEffectiveSeconds - runningElapsedSeconds
    );
  }

  return buildSuccess("Active task session loaded.", {
    active: true,
    task: {
      id: activeTask.id,
      title: activeTask.title,
      estimatedSeconds: toEstimatedSeconds(activeTask.estimatedHours),
      status: activeTask.status,
      milestoneId: activeTask.milestone?.id ?? activeTask.milestoneId,
      projectId: activeTask.milestone?.projectId ?? null,
    },
    accumulatedSeconds,
    runningStartedAt: runningStartedAt ? runningStartedAt.toISOString() : null,
    isPaused: Boolean(activeBreak),
    activeBreak: activeBreak
      ? {
          id: activeBreak.id,
          reason: activeBreak.reason,
          startedAt: activeBreak.startedAt,
        }
      : null,
    serverNow: serverNow.toISOString(),
  });
}
