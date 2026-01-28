import { prisma } from "@/lib/prisma";
import {
  buildError,
  buildSuccess,
  ensureAuthenticated,
  getAuthContext,
  isAdminRole,
} from "@/lib/api";

const normalizeEntityType = (value) => value?.toString().trim().toUpperCase();

export async function PATCH(request) {
  const context = await getAuthContext();
  const authError = ensureAuthenticated(context);
  if (authError) {
    return authError;
  }

  const body = await request.json();
  const entityType = normalizeEntityType(body?.entityType);
  const entityId = body?.entityId;

  if (!entityType || !["TASK", "MANUAL_LOG"].includes(entityType)) {
    return buildError("Entity type must be TASK or MANUAL_LOG.", 400);
  }

  if (!entityId) {
    return buildError("Entity id is required.", 400);
  }

  if (!isAdminRole(context.role)) {
    if (entityType === "TASK") {
      const task = await prisma.task.findUnique({
        where: { id: entityId },
        select: {
          id: true,
          milestone: {
            select: {
              project: {
                select: { members: { select: { userId: true } } },
              },
            },
          },
        },
      });
      const isMember = task?.milestone?.project?.members?.some(
        (member) => member.userId === context.user.id
      );
      if (!isMember) {
        return buildError("You do not have permission to update this thread.", 403);
      }
    } else {
      const log = await prisma.activityLog.findUnique({
        where: { id: entityId },
        select: { userId: true },
      });
      if (!log || log.userId !== context.user.id) {
        return buildError("You do not have permission to update this thread.", 403);
      }
    }
  }

  const readState = await prisma.commentReadState.upsert({
    where: {
      userId_entityType_entityId: {
        userId: context.user.id,
        entityType,
        entityId,
      },
    },
    update: { lastReadAt: new Date() },
    create: {
      userId: context.user.id,
      entityType,
      entityId,
      lastReadAt: new Date(),
    },
  });

  return buildSuccess("Comment thread marked as read.", {
    readState: { lastReadAt: readState.lastReadAt },
  });
}
