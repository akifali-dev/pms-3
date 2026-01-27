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
import { getChecklistForTaskType } from "@/lib/taskChecklists";

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
    const {id : taskId} = await params;

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
    return buildError("You do not have permission to view this task.", 403);
  }

  return buildSuccess("Task loaded.", { task });
}

export async function PATCH(request, { params }) {
  const {id : taskId} = await params;

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

  const body = await request.json();
  const updates = {};

  if (body?.title) {
    updates.title = body.title.trim();
  }

  if (body?.description) {
    updates.description = body.description.trim();
  }

  if (body?.status && body.status !== task.status) {
    return buildError("Use the status endpoint to move tasks.", 400);
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
    await tx.task.update({
      where: { id: taskId },
      data: updates,
    });

    if (updates.type && task.checklistItems.length === 0) {
      const checklistLabels = getChecklistForTaskType(updates.type);
      if (checklistLabels.length > 0) {
        await tx.checklistItem.createMany({
          data: checklistLabels.map((label) => ({
            taskId,
            label,
          })),
        });
      }
    }

    return tx.task.findUnique({
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
  });

  return buildSuccess("Task updated.", { task: updated });
}


export async function DELETE(request, { params }) {
    const {id : taskId} = await params;
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
