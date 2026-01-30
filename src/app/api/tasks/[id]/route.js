import { prisma } from "@/lib/prisma";
import {
  buildError,
  buildSuccess,
  ensureAuthenticated,
  getAuthContext,
  isManagementRole,
} from "@/lib/api";
import { resolveTotalTimeSpent } from "@/lib/timeLogs";
import { endSessionsPastCutoff } from "@/lib/taskWorkSessions";
import { TASK_TYPE_CHECKLISTS } from "@/lib/taskChecklists";
import { createNotification } from "@/lib/notifications";

async function getTask(taskId) {
  return prisma.task.findUnique({
    where: { id: taskId },
    include: {
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
      activityLogs: true,
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

  return task.ownerId === context.user.id;
}

export async function GET(request, { params }) {
  const { id: taskId } = await params;

  const context = await getAuthContext();
  const authError = ensureAuthenticated(context);
  if (authError) {
    return authError;
  }

  if (!taskId) {
    return buildError("Task id is required.", 400);
  }

  await endSessionsPastCutoff(prisma, context.user.id, new Date());

  const task = await getTask(taskId);
  if (!task) {
    return buildError("Task not found.", 404);
  }

  if (!canAccessTask(context, task)) {
    return buildError("You do not have permission to view this task.", 403);
  }

  return buildSuccess("Task loaded.", {
    task: {
      ...task,
      totalTimeSpent: resolveTotalTimeSpent(task),
      activeBreak: task.breaks?.find((brk) => !brk.endedAt) ?? null,
      activeWorkSession:
        task.workSessions?.find((session) => !session.endedAt) ?? null,
    },
  });
}

export async function PATCH(request, { params }) {
  const { id: taskId } = await params;

  const context = await getAuthContext();
  const authError = ensureAuthenticated(context);
  if (authError) {
    return authError;
  }

  if (!isManagementRole(context.role)) {
    return buildError("Only PM/CTO can edit tasks.", 403);
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

  const body = await request.json();
  const updates = {};

  if (body?.title !== undefined) {
    const trimmedTitle = body.title.trim();
    if (!trimmedTitle) {
      return buildError("Task title is required.", 400);
    }
    updates.title = trimmedTitle;
  }

  if (body?.description !== undefined) {
    const trimmedDescription = body.description.trim();
    if (!trimmedDescription) {
      return buildError("Task description is required.", 400);
    }
    updates.description = trimmedDescription;
  }

  if (body?.type !== undefined) {
    if (!Object.keys(TASK_TYPE_CHECKLISTS).includes(body.type)) {
      return buildError("Task type is invalid.", 400);
    }
    updates.type = body.type;
  }

  if (body?.estimatedHours !== undefined) {
    const estimatedHours = Number(body.estimatedHours ?? 0);
    if (!Number.isFinite(estimatedHours) || estimatedHours < 0) {
      return buildError("Estimated hours must be a valid number.", 400);
    }
    updates.estimatedHours = estimatedHours;
  }

  if (body?.ownerId !== undefined) {
    updates.ownerId = body.ownerId;
  }

  if (body?.status) {
    return buildError("Task status changes must use the status endpoint.", 400);
  }

  const checklistItems = Array.isArray(body?.checklistItems)
    ? body.checklistItems
    : null;
  const ownerChanged =
    body?.ownerId !== undefined && body.ownerId !== task.ownerId;

  const updatedTask = await prisma.$transaction(async (tx) => {
    const updated = await tx.task.update({
      where: { id: taskId },
      data: updates,
    });

    if (checklistItems) {
      const normalizedItems = checklistItems
        .map((item) => ({
          id: item.id,
          label: item.label?.trim() ?? "",
          isCompleted: Boolean(item.isCompleted),
        }))
        .filter((item) => item.label);

      const existingIds = new Set(task.checklistItems.map((item) => item.id));
      const incomingIds = new Set(
        normalizedItems.filter((item) => item.id).map((item) => item.id)
      );

      const deleteIds = Array.from(existingIds).filter(
        (id) => !incomingIds.has(id)
      );

      if (deleteIds.length > 0) {
        await tx.checklistItem.deleteMany({
          where: { id: { in: deleteIds } },
        });
      }

      await Promise.all(
        normalizedItems.map((item) => {
          if (item.id && existingIds.has(item.id)) {
            return tx.checklistItem.update({
              where: { id: item.id },
              data: { label: item.label, isCompleted: item.isCompleted },
            });
          }
          return tx.checklistItem.create({
            data: {
              taskId,
              label: item.label,
              isCompleted: item.isCompleted,
            },
          });
        })
      );
    }

    const nextTask = await tx.task.findUnique({
      where: { id: taskId },
      include: {
        owner: { select: { id: true, name: true, email: true, role: true } },
        milestone: {
          select: { id: true, title: true, projectId: true },
        },
        checklistItems: true,
        statusHistory: true,
        activityLogs: true,
        timeLogs: true,
        workSessions: { orderBy: { startedAt: "desc" } },
        breaks: { orderBy: { startedAt: "desc" } },
      },
    });

    if (ownerChanged && nextTask?.ownerId && nextTask.ownerId !== context.user.id) {
      await createNotification({
        prismaClient: tx,
        type: "TASK_ASSIGNED",
        actorId: context.user.id,
        message: `${context.user?.name || context.user?.email || "A leader"} assigned you task ${nextTask.title}.`,
        taskId: nextTask.id,
        projectId: nextTask.milestone?.projectId ?? null,
        milestoneId: nextTask.milestone?.id ?? null,
        recipientIds: [nextTask.ownerId],
      });
    }

    return nextTask;
  });

  return buildSuccess("Task updated.", {
    task: {
      ...updatedTask,
      totalTimeSpent: resolveTotalTimeSpent(updatedTask),
      activeBreak: updatedTask.breaks?.find((brk) => !brk.endedAt) ?? null,
      activeWorkSession:
        updatedTask.workSessions?.find((session) => !session.endedAt) ?? null,
    },
  });
}
