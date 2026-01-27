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
import { TASK_STATUSES } from "@/lib/kanban";
import { getChecklistForTaskType } from "@/lib/taskChecklists";

export async function GET(request) {
  const context = await getAuthContext();
  const authError = ensureAuthenticated(context);
  if (authError) {
    return authError;
  }

  const { searchParams } = new URL(request.url);
  const ownerId = searchParams.get("ownerId");
  const status = searchParams.get("status");
  const milestoneId = searchParams.get("milestoneId");

  const where = {};

  if (!milestoneId) {
    return buildError("Milestone id is required.", 400);
  }

  if (status) {
    where.status = status;
  }

  where.milestoneId = milestoneId;

  if (isAdminRole(context.role)) {
    if (ownerId) {
      where.ownerId = ownerId;
    }
  } else {
    where.ownerId = context.user.id;
  }

  const tasks = await prisma.task.findMany({
    where,
    orderBy: { createdAt: "desc" },
    include: {
      owner: { select: { id: true, name: true, email: true, role: true } },
      milestone: {
        select: {
          id: true,
          title: true,
          projectId: true,
          project: { select: { id: true, name: true } },
        },
      },
      checklistItems: true,
      statusHistory: true,
      activityLogs: true,
    },
  });

  return buildSuccess("Tasks loaded.", { tasks });
}

export async function POST(request) {
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

  const body = await request.json();
  const title = body?.title?.trim();
  const description = body?.description?.trim();
  const status = body?.status;
  const type = body?.type;
  const milestoneId = body?.milestoneId;
  const estimatedHours = Number(body?.estimatedHours ?? 0);
  const ownerId = body?.ownerId;

  if (!title || !description || !status || !type || !milestoneId) {
    return buildError(
      "Title, description, status, type, and milestone are required.",
      400
    );
  }

  if (!TASK_STATUSES.some((taskStatus) => taskStatus.id === status)) {
    return buildError("Task status is invalid.", 400);
  }

  if (["DONE", "REJECTED"].includes(status)) {
    if (!["PM", "CTO"].includes(context.role)) {
      return buildError("Only PMs and CTOs can approve or reject tasks.", 403);
    }
  }

  if (!Number.isFinite(estimatedHours) || estimatedHours < 0) {
    return buildError("Estimated hours must be a valid number.", 400);
  }

  const milestone = await prisma.milestone.findUnique({
    where: { id: milestoneId },
    select: { id: true },
  });

  if (!milestone) {
    return buildError("Milestone not found.", 404);
  }

  let resolvedOwnerId = ownerId;

  if (isAdminRole(context.role)) {
    if (ownerId) {
      const owner = await prisma.user.findUnique({
        where: { id: ownerId },
        select: { id: true },
      });

      if (!owner) {
        return buildError("Task owner not found.", 404);
      }
    } else {
      resolvedOwnerId = context.user.id;
    }
  } else {
    if (ownerId && ownerId !== context.user.id) {
      return buildError("You can only assign tasks to yourself.", 403);
    }

    resolvedOwnerId = context.user.id;
  }

  const task = await prisma.$transaction(async (tx) => {
    const createdTask = await tx.task.create({
      data: {
        title,
        description,
        status,
        type,
        milestoneId,
        ownerId: resolvedOwnerId,
        estimatedHours,
        reworkCount: 0,
      },
      include: {
        owner: { select: { id: true, name: true, email: true, role: true } },
        milestone: {
          select: { id: true, title: true, projectId: true },
        },
        checklistItems: true,
        statusHistory: true,
        activityLogs: true,
      },
    });

    const checklistLabels = getChecklistForTaskType(type);
    if (checklistLabels.length > 0) {
      await tx.checklistItem.createMany({
        data: checklistLabels.map((label) => ({
          taskId: createdTask.id,
          label,
        })),
      });
    }

    await tx.taskStatusHistory.create({
      data: {
        taskId: createdTask.id,
        fromStatus: null,
        toStatus: status,
        changedById: context.user.id,
      },
    });

    await tx.activityLog.create({
      data: {
        userId: createdTask.ownerId,
        taskId: createdTask.id,
        category: "TASK",
        hoursSpent: 0,
        description: `Task created: ${createdTask.title} (${status}).`,
      },
    });

    return tx.task.findUnique({
      where: { id: createdTask.id },
      include: {
        owner: { select: { id: true, name: true, email: true, role: true } },
        milestone: {
          select: { id: true, title: true, projectId: true },
        },
        checklistItems: true,
        statusHistory: true,
        activityLogs: true,
      },
    });
  });

  return buildSuccess("Task created.", { task }, 201);
}
