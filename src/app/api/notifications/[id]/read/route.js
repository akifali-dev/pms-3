import { prisma } from "@/lib/prisma";
import {
  buildError,
  buildSuccess,
  ensureAuthenticated,
  getAuthContext,
} from "@/lib/api";

export async function PATCH(request, { params }) {
  const { id: notificationId } = await params;

  const context = await getAuthContext();
  const authError = ensureAuthenticated(context);
  if (authError) {
    return authError;
  }

  if (!notificationId) {
    return buildError("Notification id is required.", 400);
  }

  const recipient = await prisma.notificationRecipient.findUnique({
    where: {
      notificationId_userId: {
        notificationId,
        userId: context.user.id,
      },
    },
  });

  if (!recipient) {
    return buildError("Notification not found.", 404);
  }

  if (recipient.readAt) {
    return buildSuccess("Notification already read.", { readAt: recipient.readAt });
  }

  const updated = await prisma.notificationRecipient.update({
    where: {
      notificationId_userId: {
        notificationId,
        userId: context.user.id,
      },
    },
    data: { readAt: new Date() },
  });

  return buildSuccess("Notification marked read.", { readAt: updated.readAt });
}
