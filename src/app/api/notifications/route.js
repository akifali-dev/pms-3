import { prisma } from "@/lib/prisma";
import {
  buildError,
  buildSuccess,
  ensureAuthenticated,
  getAuthContext,
} from "@/lib/api";

const TAB_TO_TYPES = {
  taskMovement: ["TASK_MOVEMENT"],
  creation: ["CREATION_ASSIGNMENT", "TASK_ASSIGNED"],
  log: ["USER_LOG_COMMENT"],
};

export async function GET(request) {
  const context = await getAuthContext();
  const authError = ensureAuthenticated(context);
  if (authError) {
    return authError;
  }

  const { searchParams } = new URL(request.url);
  const tab = searchParams.get("tab");
  const limitParam = searchParams.get("limit");
  const limit = Number(limitParam ?? 50);

  if (Number.isNaN(limit) || limit <= 0) {
    return buildError("Limit must be a positive number.", 400);
  }

  const typeFilter = TAB_TO_TYPES[tab] ?? null;

  const notifications = await prisma.notification.findMany({
    where: {
      ...(typeFilter ? { type: { in: typeFilter } } : {}),
      recipients: { some: { userId: context.user.id } },
    },
    orderBy: { createdAt: "desc" },
    take: Math.min(limit, 200),
    include: {
      actor: { select: { id: true, name: true, email: true, role: true } },
      recipients: {
        where: { userId: context.user.id },
        select: { readAt: true },
      },
    },
  });

  const unreadTotal = await prisma.notificationRecipient.count({
    where: { userId: context.user.id, readAt: null },
  });
  const unreadTaskMovement = await prisma.notificationRecipient.count({
    where: {
      userId: context.user.id,
      readAt: null,
      notification: { type: "TASK_MOVEMENT" },
    },
  });
  const unreadCreation = await prisma.notificationRecipient.count({
    where: {
      userId: context.user.id,
      readAt: null,
      notification: { type: { in: ["CREATION_ASSIGNMENT", "TASK_ASSIGNED"] } },
    },
  });
  const unreadLog = await prisma.notificationRecipient.count({
    where: {
      userId: context.user.id,
      readAt: null,
      notification: { type: "USER_LOG_COMMENT" },
    },
  });

  return buildSuccess("Notifications loaded.", {
    notifications: notifications.map((notification) => ({
      id: notification.id,
      type: notification.type,
      message: notification.message,
      createdAt: notification.createdAt,
      readAt: notification.recipients[0]?.readAt ?? null,
      taskId: notification.taskId,
      projectId: notification.projectId,
      milestoneId: notification.milestoneId,
      actor: notification.actor,
    })),
    unreadCounts: {
      total: unreadTotal,
      taskMovement: unreadTaskMovement,
      creation: unreadCreation,
      log: unreadLog,
    },
  });
}
