import { prisma } from "@/lib/prisma";
import {
  buildSuccess,
  ensureAuthenticated,
  getAuthContext,
} from "@/lib/api";
import { normalizeAutoOffForUser } from "@/lib/attendanceAutoOff";
import { normalizeBreakTypes } from "@/lib/breakTypes";

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

  await normalizeAutoOffForUser(prisma, context.user.id, new Date());

  const activeSession = await prisma.taskWorkSession.findFirst({
    where: {
      userId: context.user.id,
      endedAt: null,
    },
    orderBy: { startedAt: "desc" },
    include: {
      task: {
        select: {
          id: true,
          title: true,
          status: true,
          estimatedHours: true,
          milestoneId: true,
          milestone: { select: { projectId: true } },
          totalTimeSpent: true,
          lastStartedAt: true,
        },
      },
    },
  });

  if (!activeSession?.task) {
    return buildSuccess("No active task session.", { active: false });
  }

  const activeBreak = await prisma.taskBreak.findFirst({
    where: {
      taskId: activeSession.taskId,
      userId: context.user.id,
      endedAt: null,
    },
    orderBy: { startedAt: "desc" },
  });

  const serverNow = new Date();
  const runningStartedAt = activeBreak
    ? null
    : activeSession.task.lastStartedAt
      ? new Date(activeSession.task.lastStartedAt)
      : new Date(activeSession.startedAt);

  return buildSuccess("Active task session loaded.", {
    active: true,
    task: {
      id: activeSession.task.id,
      title: activeSession.task.title,
      estimatedSeconds: toEstimatedSeconds(activeSession.task.estimatedHours),
      status: activeSession.task.status,
      milestoneId: activeSession.task.milestoneId,
      projectId: activeSession.task.milestone?.projectId ?? null,
    },
    accumulatedSeconds: Math.max(0, Number(activeSession.task.totalTimeSpent ?? 0)),
    runningStartedAt:
      runningStartedAt && Number.isFinite(runningStartedAt.getTime())
        ? runningStartedAt.toISOString()
        : null,
    isPaused: Boolean(activeBreak),
    activeBreak: activeBreak
      ? {
          id: activeBreak.id,
          reasons: normalizeBreakTypes(activeBreak.reasons, activeBreak.reason),
          reason: activeBreak.reason,
          startedAt: activeBreak.startedAt,
        }
      : null,
    serverNow: serverNow.toISOString(),
  });
}
