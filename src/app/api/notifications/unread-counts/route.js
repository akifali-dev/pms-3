import { prisma } from "@/lib/prisma";
import {
  buildSuccess,
  ensureAuthenticated,
  getAuthContext,
} from "@/lib/api";

export async function GET() {
  const context = await getAuthContext();
  const authError = ensureAuthenticated(context);
  if (authError) {
    return authError;
  }

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

  return buildSuccess("Unread notification counts loaded.", {
    unreadCounts: {
      total: unreadTotal,
      taskMovement: unreadTaskMovement,
      creation: unreadCreation,
      log: unreadLog,
    },
  });
}
