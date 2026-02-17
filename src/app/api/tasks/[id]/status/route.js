import { prisma } from "@/lib/prisma";
import {
  buildError,
  buildSuccess,
  ensureAuthenticated,
  getAuthContext,
  isManagementRole,
} from "@/lib/api";
import { canTransition, getStatusLabel } from "@/lib/kanban";
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

const ACTIVE_WORK_STATUSES = new Set(["IN_PROGRESS"]);
const BLOCKED_TYPES = new Set(["CLIENT", "TEAM", "OTHER"]);
const HOLD_REASONS = new Set(["SWITCH_TASK", "BREAK", "WAITING", "OTHER"]);

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
      blockedReason: true,
      blockedType: true,
      holdReason: true,
      holdNote: true,
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
  const nextStatus = body?.toStatus ?? body?.status;
  const blockedReason = body?.blockedReason?.trim?.() || "";
  const blockedType = body?.blockedType || null;
  const holdReason = body?.holdReason || null;
  const holdNote = body?.note?.trim?.() || null;

  if (!nextStatus) {
    return buildError("Task status is required.", 400);
  }

  if (nextStatus === task.status) {
    return buildSuccess("Task already in status.", { task });
  }

  const transition = canTransition({
    from: task.status,
    to: nextStatus,
    role: context.role,
    isOwner: task.ownerId === context.user.id,
  });
  if (!transition.ok) {
    return buildError(transition.message, 400);
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

  if (nextStatus === "BLOCKED") {
    if (!blockedReason) {
      return buildError("Blocked reason is required.", 400);
    }
    if (!BLOCKED_TYPES.has(blockedType)) {
      return buildError("Blocked type must be CLIENT, TEAM, or OTHER.", 400);
    }
  }

  if (nextStatus === "ON_HOLD" && holdReason && !HOLD_REASONS.has(holdReason)) {
    return buildError("Hold reason is invalid.", 400);
  }

  const updates = {
    status: nextStatus,
    blockedReason: null,
    blockedType: null,
    holdReason: null,
    holdNote: null,
  };

  if (nextStatus === "BLOCKED") {
    updates.blockedReason = blockedReason;
    updates.blockedType = blockedType;
  }

  if (nextStatus === "ON_HOLD") {
    updates.holdReason = holdReason;
    updates.holdNote = holdNote;
  }

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
  const updatedTasks = [];
  let offDutyWarning = null;
  try {
    updated = await prisma.$transaction(
      async (tx) => {
        const currentTask = await tx.task.findUnique({
          where: { id: taskId },
          select: {
            id: true,
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

        let autoHeldTask = null;
        if (nextStatus === "IN_PROGRESS") {
          autoHeldTask = await tx.task.findFirst({
            where: {
              ownerId: task.ownerId,
              status: "IN_PROGRESS",
              id: { not: taskId },
            },
            orderBy: { updatedAt: "desc" },
            include: {
              owner: { select: { id: true, name: true, email: true, role: true } },
              milestone: {
                select: { id: true, title: true, projectId: true },
              },
              checklistItems: true,
              statusHistory: true,
              timeLogs: true,
              breaks: { orderBy: { startedAt: "desc" } },
              workSessions: {
                where: { endedAt: null, userId: task.ownerId, source: "AUTO" },
                orderBy: { startedAt: "desc" },
                take: 1,
              },
            },
          });
        }

        const activeLog = getActiveTimeLog(currentTask);

        if (nextStatus === "IN_PROGRESS" && !activeLog) {
          await tx.taskTimeLog.create({
            data: {
              taskId,
              status: nextStatus,
              startedAt: now,
            },
          });
        } else if (!shouldTrackWork && activeLog) {
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

        if (autoHeldTask) {
          await tx.task.update({
            where: { id: autoHeldTask.id },
            data: {
              status: "ON_HOLD",
              holdReason: "SWITCH_TASK",
              holdNote: "Auto moved to ON_HOLD because user started another task",
              blockedReason: null,
              blockedType: null,
            },
          });

          const autoHeldActiveLog = getActiveTimeLog(autoHeldTask);
          if (autoHeldActiveLog) {
            await tx.taskTimeLog.update({
              where: { id: autoHeldActiveLog.id },
              data: { endedAt: now },
            });
          }

          const autoHeldSession = autoHeldTask?.workSessions?.[0] ?? null;
          if (autoHeldSession) {
            await endWorkSession({
              prismaClient: tx,
              session: autoHeldSession,
              endedAt: now,
              includeBreaks: true,
            });
          }

          await tx.activityLog.create({
            data: {
              userId: task.ownerId,
              taskId: autoHeldTask.id,
              description:
                "Auto moved to ON_HOLD because user started another task",
            },
          });

          await tx.taskStatusHistory.create({
            data: {
              taskId: autoHeldTask.id,
              fromStatus: "IN_PROGRESS",
              toStatus: "ON_HOLD",
              changedById: context.user.id,
            },
          });

          const refreshedOldTask = await tx.task.findUnique({
            where: { id: autoHeldTask.id },
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
          if (refreshedOldTask) {
            updatedTasks.push(refreshedOldTask);
          }
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

  const computedUpdatedTask = {
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
    };

  const computedOtherTasks = await Promise.all(
    updatedTasks.map(async (item) => {
      const computedItem = await computeTaskSpentTime(prisma, item.id, item.ownerId);
      return {
        ...item,
        spentTimeSeconds: computedItem.effectiveSpentSeconds,
        breakSeconds: computedItem.breakSeconds,
        dutyOverlapSeconds: computedItem.dutyOverlapSeconds,
        rawWorkSeconds: computedItem.rawWorkSeconds,
        lastComputedAt: computedItem.lastComputedAt,
        presenceStatusNow: computedItem.presenceStatusNow,
        isOnDutyNow: computedItem.isOnDutyNow,
        isWFHNow: computedItem.isWFHNow,
        isOffDutyNow: computedItem.isOffDutyNow,
        activeBreak:
          item.breaks?.find((brk) => !brk.endedAt && brk.userId === item.ownerId) ??
          null,
      };
    })
  );

  return buildSuccess("Task updated.", {
    task: computedUpdatedTask,
    updatedTasks: [computedUpdatedTask, ...computedOtherTasks],
    warning: offDutyWarning,
  });
}
