import { prisma } from "@/lib/prisma";
import {
  buildError,
  buildSuccess,
  ensureAuthenticated,
  getAuthContext,
  isAdminRole,
  isManagementRole,
  WORK_ITEM_CREATION_ROLES,
} from "@/lib/api";
import { TASK_STATUSES } from "@/lib/kanban";
import { getChecklistForTaskType } from "@/lib/taskChecklists";
import { computeTaskSpentTime } from "@/lib/taskTimeCalculator";
import { createNotification, getProjectMemberIds } from "@/lib/notifications";
import { ensureTaskUpdatedAt } from "@/lib/taskDataFixes";

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

  const milestone = await prisma.milestone.findUnique({
    where: { id: milestoneId },
    select: {
      id: true,
      project: { select: { members: { select: { userId: true } } } },
    },
  });

  if (!milestone) {
    return buildError("Milestone not found.", 404);
  }

  if (!isManagementRole(context.role)) {
    if (
      !milestone.project.members?.some(
        (member) => member.userId === context.user.id
      )
    ) {
      return buildError("You do not have permission to view these tasks.", 403);
    }
  }

  if (status) {
    where.status = status;
  }

  where.milestoneId = milestoneId;

  if (ownerId) {
    where.ownerId = ownerId;
  }

  await ensureTaskUpdatedAt(prisma, where);

  const tasks = await prisma.task.findMany({
    where,
    orderBy: { createdAt: "desc" },
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
          project: { select: { id: true, name: true } },
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

  const hydratedTasks = await Promise.all(
    tasks.map(async (task) => {
      const computed = await computeTaskSpentTime(
        prisma,
        task.id,
        task.ownerId
      );
      return {
        ...task,
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
          task.breaks?.find(
            (brk) => !brk.endedAt && brk.userId === task.ownerId
          ) ?? null,
      };
    })
  );

  return buildSuccess("Tasks loaded.", { tasks: hydratedTasks });
}

export async function POST(request) {
  const context = await getAuthContext();
  const authError = ensureAuthenticated(context);
  if (authError) {
    return authError;
  }

  if (!WORK_ITEM_CREATION_ROLES.includes(context.role)) {
    return buildError("You are not allowed to create tasks.", 403);
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
    select: {
      id: true,
      project: { select: { members: { select: { userId: true } } } },
    },
  });

  if (!milestone) {
    return buildError("Milestone not found.", 404);
  }

  if (!isManagementRole(context.role)) {
    if (
      !milestone.project.members?.some(
        (member) => member.userId === context.user.id
      )
    ) {
      return buildError("You do not have permission to add tasks.", 403);
    }
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

  const createdTask = await prisma.$transaction(async (tx) => {
    const now = new Date();
    const task = await tx.task.create({
      data: {
        title,
        description,
        status,
        type,
        milestoneId,
        ownerId: resolvedOwnerId,
        estimatedHours,
        reworkCount: 0,
        lastStartedAt: null,
      },
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

    const checklistLabels = getChecklistForTaskType(type);
    if (checklistLabels.length > 0) {
      await tx.checklistItem.createMany({
        data: checklistLabels.map((label) => ({
          taskId: task.id,
          label,
        })),
      });
    }

    await tx.taskStatusHistory.create({
      data: {
        taskId: task.id,
        fromStatus: null,
        toStatus: status,
        changedById: context.user.id,
      },
    });

    if (status === "IN_PROGRESS") {
      await tx.taskTimeLog.create({
        data: {
          taskId: task.id,
          status,
          startedAt: now,
        },
      });
    }

    await tx.activityLog.create({
      data: {
        userId: task.ownerId,
        taskId: task.id,
        description: `Task created: ${task.title} (${status}).`,
      },
    });

    return task;
  });

  const memberIds = await getProjectMemberIds(createdTask.milestone?.projectId);
  await createNotification({
    type: "CREATION_ASSIGNMENT",
    actorId: context.user.id,
    message: `${context.user?.name || context.user?.email || "A teammate"} created task ${createdTask.title}.`,
    taskId: createdTask.id,
    projectId: createdTask.milestone?.projectId ?? null,
    milestoneId: createdTask.milestone?.id ?? null,
    recipientIds: memberIds.length ? memberIds : [createdTask.ownerId],
  });

  if (
    ["PM", "CTO"].includes(context.role) &&
    createdTask.ownerId &&
    createdTask.ownerId !== context.user.id
  ) {
    await createNotification({
      type: "TASK_ASSIGNED",
      actorId: context.user.id,
      message: `${context.user?.name || context.user?.email || "A leader"} assigned you task ${createdTask.title}.`,
      taskId: createdTask.id,
      projectId: createdTask.milestone?.projectId ?? null,
      milestoneId: createdTask.milestone?.id ?? null,
      recipientIds: [createdTask.ownerId],
    });
  }

  const task = await prisma.task.findUnique({
    where: { id: createdTask.id },
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

  if (!task) {
    return buildError("Task not found after creation.", 500);
  }

  const computed = await computeTaskSpentTime(prisma, task.id, task.ownerId);

  return buildSuccess(
    "Task created.",
    {
      task: {
        ...task,
        spentTimeSeconds: computed.effectiveSpentSeconds,
        breakSeconds: computed.breakSeconds,
        dutyOverlapSeconds: computed.dutyOverlapSeconds,
        rawWorkSeconds: computed.rawWorkSeconds,
        lastComputedAt: computed.lastComputedAt,
        presenceStatusNow: computed.presenceStatusNow,
        isOnDutyNow: computed.isOnDutyNow,
        isWFHNow: computed.isWFHNow,
        isOffDutyNow: computed.isOffDutyNow,
        activeBreak: task.breaks?.find((brk) => !brk.endedAt) ?? null,
      },
    },
    201
  );
}
