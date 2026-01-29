import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  buildError,
  buildSuccess,
  ensureAuthenticated,
  getAuthContext,
  isAdminRole,
} from "@/lib/api";

async function getComment(commentId) {
  return prisma.comment.findUnique({
    where: { id: commentId },
    include: {
      createdBy: { select: { id: true, name: true, email: true, role: true } },
    },
  });
}

async function canAccessEntity(context, entityType, entityId) {
  if (isAdminRole(context.role)) {
    return true;
  }

  if (entityType === "TASK") {
    const task = await prisma.task.findUnique({
      where: { id: entityId },
      select: {
        id: true,
        milestone: {
          select: {
            project: { select: { members: { select: { userId: true } } } },
          },
        },
      },
    });

    return Boolean(
      task?.milestone?.project?.members?.some(
        (member) => member.userId === context.user.id
      )
    );
  }

  const log = await prisma.activityLog.findUnique({
    where: { id: entityId },
    select: { userId: true },
  });

  return log?.userId === context.user.id;
}

async function canAccessComment(context, comment) {
  if (!comment) {
    return false;
  }

  return canAccessEntity(context, comment.entityType, comment.entityId);
}

export async function GET(request, { params }) {
  const context = await getAuthContext();
  const authError = ensureAuthenticated(context);
  if (authError) {
    return authError;
  }

  const { id: commentId } = await params;
  if (!commentId) {
    return buildError("Comment id is required.", 400);
  }

  const comment = await getComment(commentId);
  if (!comment) {
    return buildError("Comment not found.", 404);
  }

  if (!(await canAccessComment(context, comment))) {
    return buildError("You do not have permission to view this comment.", 403);
  }

  return buildSuccess("Comment loaded.", { comment });
}

export async function PATCH(request, { params }) {
  const context = await getAuthContext();
  const authError = ensureAuthenticated(context);
  if (authError) {
    return authError;
  }

  const { id: commentId } = await params;
  if (!commentId) {
    return buildError("Comment id is required.", 400);
  }

  const comment = await getComment(commentId);
  if (!comment) {
    return buildError("Comment not found.", 404);
  }

  if (!isAdminRole(context.role) && comment.createdById !== context.user.id) {
    return buildError("You do not have permission to update this comment.", 403);
  }

  const body = await request.json();
  const message = body?.message?.trim();

  if (!message) {
    return buildError("Message is required.", 400);
  }

  const updated = await prisma.comment.update({
    where: { id: commentId },
    data: { message },
    include: {
      createdBy: { select: { id: true, name: true, email: true, role: true } },
    },
  });

  return buildSuccess("Comment updated.", { comment: updated });
}

export async function DELETE(request, { params }) {
  const context = await getAuthContext();
  const authError = ensureAuthenticated(context);
  if (authError) {
    return authError;
  }

  const { id: commentId } = await params;
  if (!commentId) {
    return buildError("Comment id is required.", 400);
  }

  const comment = await getComment(commentId);
  if (!comment) {
    return buildError("Comment not found.", 404);
  }

  if (!isAdminRole(context.role) && comment.createdById !== context.user.id) {
    return buildError("You do not have permission to delete this comment.", 403);
  }

  try {
    await prisma.comment.delete({ where: { id: commentId } });
    return buildSuccess("Comment deleted.");
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === "P2025") {
        return buildError("Comment not found.", 404);
      }
    }

    return buildError("Unable to delete comment.", 500);
  }
}
