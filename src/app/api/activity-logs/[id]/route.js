import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  ADMIN_ROLES,
  buildError,
  buildSuccess,
  ensureAuthenticated,
  ensureRole,
  getAuthContext,
  isAdminRole,
} from "@/lib/api";

async function getActivityLog(logId) {
  return prisma.activityLog.findUnique({
    where: { id: logId },
    include: {
      user: { select: { id: true, name: true, email: true, role: true } },
      task: { select: { id: true, title: true, ownerId: true } },
      workSession: true,
    },
  });
}

function canAccessLog(context, log) {
  if (!log) {
    return false;
  }

  if (isAdminRole(context.role)) {
    return true;
  }

  return log.userId === context.user.id;
}

export async function GET(request, { params }) {
  const context = await getAuthContext();
  const authError = ensureAuthenticated(context);
  if (authError) {
    return authError;
  }

  const { id: logId } = await params;
  if (!logId) {
    return buildError("Activity log id is required.", 400);
  }

  const log = await getActivityLog(logId);
  if (!log) {
    return buildError("Activity log not found.", 404);
  }

  if (!canAccessLog(context, log)) {
    return buildError("You do not have permission to view this log.", 403);
  }

  return buildSuccess("Activity log loaded.", { activityLog: log });
}

export async function PATCH(request, { params }) {
  const context = await getAuthContext();
  const authError = ensureAuthenticated(context);
  if (authError) {
    return authError;
  }

  const { id: logId } = await params;
  if (!logId) {
    return buildError("Activity log id is required.", 400);
  }

  const log = await getActivityLog(logId);
  if (!log) {
    return buildError("Activity log not found.", 404);
  }

  if (!canAccessLog(context, log)) {
    return buildError("You do not have permission to update this log.", 403);
  }

  const body = await request.json();
  const updates = {};

  if (body?.description) {
    updates.description = body.description.trim();
  }

  if (body?.date) {
    const parsedDate = new Date(body.date);
    if (Number.isNaN(parsedDate.getTime())) {
      return buildError("Date must be valid.", 400);
    }
    updates.date = parsedDate;
  }

  if (typeof body?.hoursSpent === "number") {
    if (body.hoursSpent < 0) {
      return buildError("Hours spent must be a valid number.", 400);
    }
    updates.hoursSpent = body.hoursSpent;
  }

  if (log.type === "WFH") {
    const startTime = body?.startTime ? new Date(body.startTime) : null;
    const endTime = body?.endTime ? new Date(body.endTime) : null;
    const nextTaskId = body?.taskId !== undefined ? body.taskId : log.taskId;

    if (body?.startTime && Number.isNaN(startTime.getTime())) {
      return buildError("Start time must be valid.", 400);
    }
    if (body?.endTime && Number.isNaN(endTime.getTime())) {
      return buildError("End time must be valid.", 400);
    }
    if (startTime && endTime && endTime <= startTime) {
      return buildError("End time must be after start time.", 400);
    }

    if (nextTaskId) {
      const task = await prisma.task.findUnique({
        where: { id: nextTaskId },
        select: {
          id: true,
          milestone: {
            select: { project: { select: { members: { select: { userId: true } } } } },
          },
        },
      });
      if (!task) {
        return buildError("Task not found.", 404);
      }
      const isMember = task.milestone?.project?.members?.some(
        (member) => member.userId === context.user.id
      );
      if (!isMember) {
        return buildError("You do not have permission to log time for this task.", 403);
      }
    }

    if (startTime) {
      updates.startTime = startTime;
    }
    if (endTime) {
      updates.endTime = endTime;
    }
    if (body?.taskId !== undefined) {
      updates.taskId = nextTaskId || null;
    }
  } else if (body?.category) {
    const category = body.category.toString().trim().toUpperCase();
    if (!["LEARNING", "RESEARCH", "IDLE"].includes(category)) {
      return buildError(
        "Category must be one of: learning, research, idle.",
        400
      );
    }
    updates.category = category;
  }

  if (Object.keys(updates).length === 0) {
    return buildError("No valid updates provided.", 400);
  }

  const updated = await prisma.$transaction(async (tx) => {
    const nextLog = await tx.activityLog.update({
      where: { id: logId },
      data: updates,
      include: {
        user: { select: { id: true, name: true, email: true, role: true } },
        task: { select: { id: true, title: true, ownerId: true } },
        workSession: true,
      },
    });

    if (nextLog.type === "WFH") {
      const startTime = nextLog.startTime;
      const endTime = nextLog.endTime;
      const nextTaskId = nextLog.taskId;

      if (startTime && endTime) {
        const durationSeconds = Math.max(
          0,
          Math.floor((endTime.getTime() - startTime.getTime()) / 1000)
        );
        const deltaSeconds = durationSeconds - Number(nextLog.durationSeconds ?? 0);

        await tx.activityLog.update({
          where: { id: logId },
          data: {
            durationSeconds,
            hoursSpent: durationSeconds / 3600,
            category: "WFH",
          },
        });

        if (nextLog.workSession) {
          const previousTaskId = nextLog.workSession.taskId;
          if (previousTaskId && previousTaskId !== nextTaskId) {
            await tx.task.update({
              where: { id: previousTaskId },
              data: { totalTimeSpent: { increment: -Number(nextLog.durationSeconds ?? 0) } },
            });
          }
          if (nextTaskId) {
            await tx.task.update({
              where: { id: nextTaskId },
              data: {
                totalTimeSpent: {
                  increment:
                    nextTaskId === previousTaskId
                      ? deltaSeconds
                      : durationSeconds,
                },
              },
            });
          }

          if (!nextTaskId) {
            await tx.taskWorkSession.delete({
              where: { id: nextLog.workSession.id },
            });
          } else {
            await tx.taskWorkSession.update({
              where: { id: nextLog.workSession.id },
              data: {
                taskId: nextTaskId,
                startedAt: startTime,
                endedAt: endTime,
                durationSeconds,
              },
            });
          }
        } else if (nextTaskId) {
          await tx.taskWorkSession.create({
            data: {
              taskId: nextTaskId,
              userId: nextLog.userId,
              startedAt: startTime,
              endedAt: endTime,
              durationSeconds,
              source: "WFH",
              activityLogId: nextLog.id,
            },
          });
          await tx.task.update({
            where: { id: nextTaskId },
            data: { totalTimeSpent: { increment: durationSeconds } },
          });
        }
      }
    }

    return tx.activityLog.findUnique({
      where: { id: logId },
      include: {
        user: { select: { id: true, name: true, email: true, role: true } },
        task: { select: { id: true, title: true, ownerId: true } },
        workSession: true,
      },
    });
  });

  return buildSuccess("Activity log updated.", { activityLog: updated });
}

export async function DELETE(request, { params }) {
  const context = await getAuthContext();
  const authError = ensureAuthenticated(context);
  if (authError) {
    return authError;
  }

  const allowedRoles = [...ADMIN_ROLES, "DEVELOPER"];
  const roleError = ensureRole(context.role, allowedRoles);
  if (roleError) {
    return roleError;
  }

  const { id: logId } = await params;
  if (!logId) {
    return buildError("Activity log id is required.", 400);
  }

  const log = await getActivityLog(logId);
  if (!log) {
    return buildError("Activity log not found.", 404);
  }

  if (!canAccessLog(context, log)) {
    return buildError("You do not have permission to delete this log.", 403);
  }

  try {
    await prisma.$transaction(async (tx) => {
      if (log.type === "WFH" && log.workSession) {
        const durationSeconds = Number(log.durationSeconds ?? 0);
        if (log.workSession.taskId && durationSeconds > 0) {
          await tx.task.update({
            where: { id: log.workSession.taskId },
            data: { totalTimeSpent: { increment: -durationSeconds } },
          });
        }
        await tx.taskWorkSession.delete({
          where: { id: log.workSession.id },
        });
      }

      await tx.activityLog.delete({ where: { id: logId } });
    });
    return buildSuccess("Activity log deleted.");
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === "P2025") {
        return buildError("Activity log not found.", 404);
      }
    }

    return buildError("Unable to delete activity log.", 500);
  }
}
