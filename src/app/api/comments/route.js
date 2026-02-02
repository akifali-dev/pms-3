import { prisma } from "@/lib/prisma";
import {
  buildError,
  buildSuccess,
  ensureAuthenticated,
  getAuthContext,
  isAdminRole,
} from "@/lib/api";
import { createNotification, getTaskMemberIds } from "@/lib/notifications";
import { ensureTaskUpdatedAt } from "@/lib/taskDataFixes";

const normalizeEntityType = (value) => value?.toString().trim().toUpperCase();

const isValidEntityType = (entityType) =>
  ["TASK", "MANUAL_LOG"].includes(entityType);

async function getAccessibleTaskIds(context, ids) {
  await ensureTaskUpdatedAt(
    prisma,
    ids?.length ? { id: { in: ids } } : {}
  );

  const tasks = await prisma.task.findMany({
    where: {
      ...(ids?.length ? { id: { in: ids } } : {}),
      milestone: {
        project: {
          members: { some: { userId: context.user.id } },
        },
      },
    },
    select: { id: true },
  });
  return tasks.map((task) => task.id);
}

async function getAccessibleManualLogIds(context, ids) {
  const logs = await prisma.activityLog.findMany({
    where: {
      ...(ids?.length ? { id: { in: ids } } : {}),
      userId: context.user.id,
    },
    select: { id: true },
  });
  return logs.map((log) => log.id);
}

export async function GET(request) {
  const context = await getAuthContext();
  const authError = ensureAuthenticated(context);
  if (authError) {
    return authError;
  }

  const { searchParams } = new URL(request.url);
  const entityType = normalizeEntityType(searchParams.get("entityType"));
  const entityId = searchParams.get("entityId");
  const entityIdsParam = searchParams.get("entityIds");

  if (!entityType || !isValidEntityType(entityType)) {
    return buildError("Entity type must be TASK or MANUAL_LOG.", 400);
  }

  const entityIds = entityId
    ? [entityId]
    : entityIdsParam
        ?.split(",")
        .map((id) => id.trim())
        .filter(Boolean) ?? [];

  let accessibleIds = entityIds;

  if (!isAdminRole(context.role)) {
    if (entityType === "TASK") {
      accessibleIds = await getAccessibleTaskIds(
        context,
        entityIds.length ? entityIds : null
      );
    } else {
      accessibleIds = await getAccessibleManualLogIds(
        context,
        entityIds.length ? entityIds : null
      );
    }
  }

  if (!isAdminRole(context.role) && accessibleIds.length === 0) {
    return buildSuccess("Comments loaded.", { comments: [] });
  }

  const comments = await prisma.comment.findMany({
    where: {
      entityType,
      ...(accessibleIds.length
        ? { entityId: { in: accessibleIds } }
        : {}),
    },
    orderBy: { createdAt: "asc" },
    include: {
      createdBy: { select: { id: true, name: true, email: true, role: true } },
    },
  });

  let readState = null;
  if (entityId) {
    readState = await prisma.commentReadState.findUnique({
      where: {
        userId_entityType_entityId: {
          userId: context.user.id,
          entityType,
          entityId,
        },
      },
    });
  }

  return buildSuccess("Comments loaded.", {
    comments,
    readState: readState ? { lastReadAt: readState.lastReadAt } : null,
  });
}

export async function POST(request) {
  const context = await getAuthContext();
  const authError = ensureAuthenticated(context);
  if (authError) {
    return authError;
  }

  const body = await request.json();
  const message = body?.message?.trim();
  const entityType = normalizeEntityType(body?.entityType);
  const entityId = body?.entityId;
  const mentions = Array.isArray(body?.mentions) ? body.mentions : [];

  if (!message) {
    return buildError("Message is required.", 400);
  }

  if (!entityType || !isValidEntityType(entityType)) {
    return buildError("Entity type must be TASK or MANUAL_LOG.", 400);
  }

  if (!entityId) {
    return buildError("Entity id is required.", 400);
  }

  let notificationRecipientIds = [];
  let notificationMessage = "left a comment.";

  if (entityType === "TASK") {
    const task = await prisma.task.findUnique({
      where: { id: entityId },
      select: {
        id: true,
        title: true,
        ownerId: true,
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
    if (!isMember && !isAdminRole(context.role)) {
      return buildError("You do not have permission to comment on this task.", 403);
    }

    notificationRecipientIds = await getTaskMemberIds(task.id);
    notificationMessage = `commented on ${task.title}.`;
  } else {
    const log = await prisma.activityLog.findUnique({
      where: { id: entityId },
      select: { id: true, userId: true },
    });

    if (!log) {
      return buildError("Manual log not found.", 404);
    }

    if (log.userId !== context.user.id && !isAdminRole(context.role)) {
      return buildError("You do not have permission to comment on this log.", 403);
    }

    notificationRecipientIds = log.userId ? [log.userId] : [];
    notificationMessage = "commented on a manual log.";
  }

  const comment = await prisma.comment.create({
    data: {
      message,
      createdById: context.user.id,
      entityType,
      entityId,
      mentions,
    },
    include: {
      createdBy: { select: { id: true, name: true, email: true, role: true } },
    },
  });

  const actorName = context.user?.name || context.user?.email || "A teammate";
  const recipientIds = Array.from(
    new Set(notificationRecipientIds.filter(Boolean))
  );

  if (recipientIds.length) {
    await createNotification({
      type: "USER_LOG_COMMENT",
      actorId: context.user.id,
      message: `${actorName} ${notificationMessage}`,
      taskId: entityType === "TASK" ? entityId : null,
      recipientIds,
    });
  }

  return buildSuccess("Comment created.", { comment }, 201);
}
