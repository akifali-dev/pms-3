import { prisma } from "@/lib/prisma";
import {
  buildError,
  buildSuccess,
  ensureAuthenticated,
  ensureRole,
  getAuthContext,
  isAdminRole,
} from "@/lib/api";
import { createNotification, getTaskMemberIds } from "@/lib/notifications";

export async function GET(request) {
  const context = await getAuthContext();
  const authError = ensureAuthenticated(context);
  if (authError) {
    return authError;
  }

  const { searchParams } = new URL(request.url);
  const createdById = searchParams.get("createdById");
  const createdForId = searchParams.get("createdForId");
  const taskId = searchParams.get("taskId");

  const where = {};

  if (isAdminRole(context.role)) {
    if (createdById) {
      where.createdById = createdById;
    }
    if (createdForId) {
      where.createdForId = createdForId;
    }
    if (taskId) {
      where.taskId = taskId;
    }
  } else {
    where.OR = [
      { createdById: context.user.id },
      { createdForId: context.user.id },
    ];
  }

  const comments = await prisma.comment.findMany({
    where,
    orderBy: { createdAt: "desc" },
    include: {
      createdBy: { select: { id: true, name: true, email: true, role: true } },
      createdFor: { select: { id: true, name: true, email: true, role: true } },
      task: { select: { id: true, title: true, ownerId: true } },
    },
  });

  return buildSuccess("Comments loaded.", { comments });
}

export async function POST(request) {
  const context = await getAuthContext();
  const authError = ensureAuthenticated(context);
  if (authError) {
    return authError;
  }

  const roleError = ensureRole(context.role, ["PM", "CTO"]);
  if (roleError) {
    return roleError;
  }

  const body = await request.json();
  const message = body?.message?.trim();
  const createdForId = body?.createdForId;
  const taskId = body?.taskId;

  if (!message) {
    return buildError("Message is required.", 400);
  }

  let resolvedRecipientId = createdForId;
  let resolvedTaskId = taskId;

  if (taskId) {
    const task = await prisma.task.findUnique({
      where: { id: taskId },
      select: { id: true, ownerId: true },
    });

    if (!task) {
      return buildError("Task not found.", 404);
    }

    resolvedTaskId = task.id;
    resolvedRecipientId = task.ownerId;
  } else if (createdForId) {
    const recipient = await prisma.user.findUnique({
      where: { id: createdForId },
      select: { id: true },
    });

    if (!recipient) {
      return buildError("Recipient not found.", 404);
    }
  }

  if (!resolvedRecipientId) {
    return buildError("Recipient is required.", 400);
  }

  const comment = await prisma.comment.create({
    data: {
      message,
      createdById: context.user.id,
      createdForId: resolvedRecipientId,
      taskId: resolvedTaskId ?? null,
    },
    include: {
      createdBy: { select: { id: true, name: true, email: true, role: true } },
      createdFor: { select: { id: true, name: true, email: true, role: true } },
      task: { select: { id: true, title: true, ownerId: true } },
    },
  });

  const actorName = context.user?.name || context.user?.email || "A teammate";
  const taskMemberIds = resolvedTaskId
    ? await getTaskMemberIds(resolvedTaskId)
    : [];
  const recipientIds = Array.from(
    new Set([resolvedRecipientId, ...taskMemberIds].filter(Boolean))
  );

  await createNotification({
    type: "USER_LOG_COMMENT",
    actorId: context.user.id,
    message: comment.task
      ? `${actorName} commented on ${comment.task.title}.`
      : `${actorName} left a comment.`,
    taskId: comment.task?.id ?? null,
    recipientIds,
  });

  return buildSuccess("Comment created.", { comment }, 201);
}
