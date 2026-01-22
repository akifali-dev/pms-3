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
import { getStatusLabel, isValidTransition } from "@/lib/kanban";

async function getTask(taskId) {
  return prisma.task.findUnique({
    where: { id: taskId },
    include: {
      owner: { select: { id: true, name: true, email: true, role: true } },
      milestone: {
        select: { id: true, title: true, projectId: true },
      },
      checklistItems: true,
      statusHistory: true,
    },
  });
}

function canAccessTask(context, task) {
  if (!task) {
    return false;
  }

  if (isAdminRole(context.role)) {
    return true;
  }

  return task.ownerId === context.user.id;
}

export async function GET(request, { params }) {
  const context = await getAuthContext();
  const authError = ensureAuthenticated(context);
  if (authError) {
    return authError;
  }

  const taskId = params?.id;
  if (!taskId) {
    return buildError("Task id is required.", 400);
  }

  const task = await getTask(taskId);
  if (!task) {
    return buildError("Task not found.", 404);
  }

  if (!canAccessTask(context, task)) {
    return buildError("You do not have permission to view this task.", 403);
  }

  return buildSuccess("Task loaded.", { task });
}

export async function PATCH(request, { params }) {
  const context = await getAuthContext();
  const authError = ensureAuthenticated(context);
  if (authError) {
    return authError;
  }

  const taskId = params?.id;
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
  let statusChange = null;

  if (body?.title) {
    updates.title = body.title.trim();
  }

  if (body?.description) {
    updates.description = body.description.trim();
  }

  if (body?.status && body.status !== task.status) {
    const nextStatus = body.status;
    const allowedTransition = isValidTransition(task.status, nextStatus);

    if (!allowedTransition) {
      return buildError(
        `Invalid transition from ${getStatusLabel(
          task.status
        )} to ${getStatusLabel(nextStatus)}.`,
        400
      );
    }

    if (["DONE", "REJECTED"].includes(nextStatus) && context.role !== "PM") {
      return buildError("Only PMs can approve or reject tasks.", 403);
    }

    updates.status = nextStatus;
    statusChange = { from: task.status, to: nextStatus };

    if (nextStatus === "REJECTED") {
      updates.reworkCount = task.reworkCount + 1;
    }
  }

  if (body?.type) {
    updates.type = body.type;
  }

  if (typeof body?.estimatedHours === "number") {
    if (body.estimatedHours < 0) {
      return buildError("Estimated hours must be a valid number.", 400);
    }
    updates.estimatedHours = body.estimatedHours;
  }

  if (body?.milestoneId) {
    const milestone = await prisma.milestone.findUnique({
      where: { id: body.milestoneId },
      select: { id: true },
    });

    if (!milestone) {
      return buildError("Milestone not found.", 404);
    }

    updates.milestoneId = body.milestoneId;
  }

  if (body?.ownerId && isAdminRole(context.role)) {
    const owner = await prisma.user.findUnique({
      where: { id: body.ownerId },
      select: { id: true },
    });

    if (!owner) {
      return buildError("Task owner not found.", 404);
    }

    updates.ownerId = body.ownerId;
  }

  if (Object.keys(updates).length === 0) {
    return buildError("No valid updates provided.", 400);
  }

  const updated = await prisma.$transaction(async (tx) => {
    const updatedTask = await tx.task.update({
      where: { id: taskId },
      data: updates,
      include: {
        owner: { select: { id: true, name: true, email: true, role: true } },
        milestone: {
          select: { id: true, title: true, projectId: true },
        },
        checklistItems: true,
        statusHistory: true,
      },
    });

    if (statusChange) {
      await tx.taskStatusHistory.create({
        data: {
          taskId,
          fromStatus: statusChange.from,
          toStatus: statusChange.to,
          changedById: context.user.id,
        },
      });
    }

    return updatedTask;
  });

  return buildSuccess("Task updated.", { task: updated });
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

  const taskId = params?.id;
  if (!taskId) {
    return buildError("Task id is required.", 400);
  }

  const task = await getTask(taskId);
  if (!task) {
    return buildError("Task not found.", 404);
  }

  if (!canAccessTask(context, task)) {
    return buildError("You do not have permission to delete this task.", 403);
  }

  try {
    await prisma.$transaction([
      prisma.checklistItem.deleteMany({ where: { taskId } }),
      prisma.taskStatusHistory.deleteMany({ where: { taskId } }),
      prisma.task.delete({ where: { id: taskId } }),
    ]);

    return buildSuccess("Task deleted.");
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === "P2025") {
        return buildError("Task not found.", 404);
      }
    }

    return buildError("Unable to delete task.", 500);
  }
}
