import { prisma } from "@/lib/prisma";
import {
  buildSuccess,
  ensureAuthenticated,
  getAuthContext,
} from "@/lib/api";

export async function PATCH() {
  const context = await getAuthContext();
  const authError = ensureAuthenticated(context);
  if (authError) {
    return authError;
  }

  const result = await prisma.notificationRecipient.updateMany({
    where: { userId: context.user.id, readAt: null },
    data: { readAt: new Date() },
  });

  return buildSuccess("Notifications marked read.", {
    updated: result.count,
  });
}
