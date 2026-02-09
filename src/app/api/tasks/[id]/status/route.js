import { prisma } from "@/lib/prisma";
import {
  buildError,
  buildSuccess,
  ensureAuthenticated,
  getAuthContext,
  isManagementRole,
} from "@/lib/api";
import { getStatusLabel, isValidTransition } from "@/lib/kanban";
import { computeTaskSpentTime } from "@/lib/taskTimeCalculator";
import {
  createNotification,
  getLeadershipUserIds,
} from "@/lib/notifications";
import { getDutyDate } from "@/lib/dutyHours";
import { getTimeZoneNow } from "@/lib/attendanceTimes";
import {
  endActiveSessionsAtTime,
  endWorkSession,
} from "@/lib/taskWorkSessions";

const ACTIVE_WORK_STATUSES = new Set(["IN_PROGRESS", "DEV_TEST"]);

async function getTask(taskId) {
  return prisma.task.findUnique({
    where: { id: taskId },
    select: {
      id: true,
      title: true,
      description: true,
      status: true,
      type: true,
      ownerId: true,
      milestoneId: true,
      estimatedHours: true,
      reworkCount: true,
      totalTimeSpent: true,
      lastStartedAt: true,
      createdAt: true,
      owner: { select: { id: true, name: true, email: true, role: true } },
      milestone: {
        select: {
          id: true,
          title: true,
          projectId: true,
          project: { select: { members: { select: { userId: true } } } },
        },
      },
      checklistItems: true,
      statusHistory: true,
      timeLogs: true,
      workSessions: { orderBy: { startedAt: "desc" } },
      breaks: { orderBy: { startedAt: "desc" } },
    },
  });
}

function canAccessTask(context, task) {
  if (!task) {
    return false;
  }

  if (isManagementRole(context.role)) {
    return true;
  }

  if (
    !task.milestone?.project?.members?.some(
      (member) => member.userId === context.user.id
    )
  ) {
    return false;
  }

  return task.ownerId === context.user.id;
}

function canMoveTask(context, task) {
  if (!task) {
    return false;
  }

  if (["PM", "CTO"].includes(context.role)) {
    return true;
  }

  if (
    !task.milestone?.project?.members?.some(
      (member) => member.userId === context.user.id
    )
  ) {
    return false;
  }

  return task.ownerId === context.user.id;
}

function getActiveTimeLog(task) {
  return task?.timeLogs?.find((log) => !log.endedAt) ?? null;
}

function getDutyDateBounds(dutyDate) {
  if (!dutyDate) {
    return null;
  }
  const parsed = new Date(dutyDate);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }
  const start = new Date(parsed);
  start.setHours(0, 0, 0, 0);
  const end = new Date(parsed);
  end.setHours(23, 59, 59, 999);
  return { start, end };
}

export async function PATCH(request, { params }) {
  const { id: taskId } = await params;

  const context = await getAuthContext();
  const authError = ensureAuthenticated(context);
  if (authError) {
    return authError;
  }

  if (!taskId) {
    return buildError("Task id is required.", 400);
  }

  const task = await getTask(taskId);
  if (!task) {
    return buildError("Task not found.", 404);
  }

  if (!canAccessTask(context, task)) {
    return buildError("You do not have permission to update this task.", 403);
  }

  if (!canMoveTask(context, task)) {
    return buildError("You do not have permission to move this task.", 403);
  }

  const body = await request.json();
  const nextStatus = body?.status;

  if (!nextStatus) {
    return buildError("Task status is required.", 400);
  }

  if (nextStatus === task.status) {
    return buildSuccess("Task already in status.", { task });
  }

  const allowedTransition = isValidTransition(task.status, nextStatus);
  if (!allowedTransition) {
    return buildError(
      `Invalid transition from ${getStatusLabel(
        task.status
      )} to ${getStatusLabel(nextStatus)}.`,
      400
    );
  }

  if (["DONE", "REJECTED"].includes(nextStatus)) {
    if (!["PM", "CTO"].includes(context.role)) {
      return buildError("Only PMs and CTOs can approve or reject tasks.", 403);
    }
  }

  if (nextStatus === "TESTING") {
    const checklistComplete =
      task.checklistItems.length > 0 &&
      task.checklistItems.every((item) => item.isCompleted);

    if (!checklistComplete) {
      return buildError(
        "Complete the checklist before moving the task to testing.",
        400
      );
    }
  }

  const updates = {
    status: nextStatus,
  };

  if (nextStatus === "REJECTED") {
    updates.reworkCount = task.reworkCount + 1;
  }

  const now = getTimeZoneNow();
  const shouldTrackWork = ACTIVE_WORK_STATUSES.has(nextStatus);
  const wasTrackingWork = ACTIVE_WORK_STATUSES.has(task.status);
  if (shouldTrackWork) {
    const dutyDate = getDutyDate(now);
    const bounds = getDutyDateBounds(dutyDate);
    if (!bounds) {
      return buildError("Unable to determine duty date.", 400);
    }
    const attendance = await prisma.attendance.findFirst({
      where: {
        userId: task.ownerId,
        date: { gte: bounds.start, lte: bounds.end },
      },
      select: { inTime: true, outTime: true },
    });
    if (!attendance?.inTime) {
      return buildError("You’re off duty. Start your duty to move tasks.", 403);
    }
    const inTime = new Date(attendance.inTime);
    if (Number.isNaN(inTime.getTime()) || inTime > now) {
      return buildError("You’re off duty. Start your duty to move tasks.", 403);
    }
    if (attendance.outTime) {
      const outTime = new Date(attendance.outTime);
      if (!Number.isNaN(outTime.getTime()) && outTime <= now) {
        return buildError(
          "Your duty has ended. Start a new duty to move tasks.",
          403
        );
      }
    }
  }

  const actorName = context.user?.name || context.user?.email || "A teammate";
  let updated;
  let offDutyWarning = null;
  try {
    updated = await prisma.$transaction(
      async (tx) => {
        const currentTask = await tx.task.findUnique({
          where: { id: taskId },
          select: {
            timeLogs: true,
            workSessions: {
              where: { endedAt: null, userId: task.ownerId, source: "AUTO" },
              orderBy: { startedAt: "desc" },
              take: 1,
            },
          },
        });

        await tx.task.update({
          where: { id: taskId },
          data: updates,
        });

        const activeLog = getActiveTimeLog(currentTask);

        if (nextStatus === "IN_PROGRESS" && !activeLog) {
          await tx.taskTimeLog.create({
            data: {
              taskId,
              status: nextStatus,
              startedAt: now,
            },
          });
        } else if (nextStatus === "TESTING" && activeLog) {
          await tx.taskTimeLog.update({
            where: { id: activeLog.id },
            data: { endedAt: now },
          });
        } else if (activeLog && activeLog.status !== nextStatus) {
          await tx.taskTimeLog.update({
            where: { id: activeLog.id },
            data: { status: nextStatus },
          });
        }

        const statusActivityLog = await tx.activityLog.create({
          data: {
            userId: task.ownerId,
            taskId,
            description: `Task status updated by ${actorName}: ${task.title} moved from ${task.status ?? "new"} to ${nextStatus}.`,
          },
        });

        if (shouldTrackWork && !wasTrackingWork) {
          await endActiveSessionsAtTime(tx, task.ownerId, now);
          await tx.taskWorkSession.create({
            data: {
              taskId,
              userId: task.ownerId,
              activityLogId: statusActivityLog.id,
              startedAt: now,
              endedAt: null,
              source: "AUTO",
            },
          });
          await tx.task.update({
            where: { id: taskId },
            data: { lastStartedAt: now },
          });
        } else if (!shouldTrackWork && wasTrackingWork) {
          const activeSession = currentTask?.workSessions?.[0] ?? null;
          if (activeSession) {
            await endWorkSession({
              prismaClient: tx,
              session: activeSession,
              endedAt: now,
              includeBreaks: true,
            });
          }
        } else if (shouldTrackWork && !currentTask?.workSessions?.length) {
          await endActiveSessionsAtTime(tx, task.ownerId, now);
          await tx.taskWorkSession.create({
            data: {
              taskId,
              userId: task.ownerId,
              activityLogId: statusActivityLog.id,
              startedAt: now,
              endedAt: null,
              source: "AUTO",
            },
          });
          await tx.task.update({
            where: { id: taskId },
            data: { lastStartedAt: now },
          });
        }

        await tx.taskStatusHistory.create({
          data: {
            taskId,
            fromStatus: task.status,
            toStatus: nextStatus,
            changedById: context.user.id,
          },
        });

        return tx.task.findUnique({
          where: { id: taskId },
          include: {
            owner: { select: { id: true, name: true, email: true, role: true } },
            milestone: {
              select: { id: true, title: true, projectId: true },
            },
            checklistItems: true,
            statusHistory: true,
            timeLogs: true,
            breaks: { orderBy: { startedAt: "desc" } },
          },
        });
      },
      { timeout: 10000 }
    );
  } catch (error) {
    throw error;
  }

  const leaderIds = await getLeadershipUserIds(prisma);
  await createNotification({
    prismaClient: prisma,
    type: "TASK_MOVEMENT",
    actorId: context.user.id,
    message: `${actorName} moved ${task.title} from ${task.status ?? "new"} to ${nextStatus}.`,
    taskId,
    projectId: task.milestone?.projectId ?? null,
    milestoneId: task.milestone?.id ?? null,
    recipientIds: [task.ownerId, ...leaderIds],
  });

  const computed = await computeTaskSpentTime(
    prisma,
    updated.id,
    updated.ownerId
  );
  if (shouldTrackWork && !computed.isOnDutyNow) {
    offDutyWarning =
      "You’re off duty; time will not count until you’re on duty.";
  }

  return buildSuccess("Task updated.", {
    task: {
      ...updated,
      spentTimeSeconds: computed.effectiveSpentSeconds,
      breakSeconds: computed.breakSeconds,
      dutyOverlapSeconds: computed.dutyOverlapSeconds,
      rawWorkSeconds: computed.rawWorkSeconds,
      lastComputedAt: computed.lastComputedAt,
      presenceStatusNow: computed.presenceStatusNow,
      isOnDutyNow: computed.isOnDutyNow,
      isWFHNow: computed.isWFHNow,
      isOffDutyNow: computed.isOffDutyNow,
      activeBreak:
        updated.breaks?.find(
          (brk) => !brk.endedAt && brk.userId === updated.ownerId
        ) ?? null,
    },
    warning: offDutyWarning,
  });
}
