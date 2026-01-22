import { Prisma } from "@prisma/client";
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

async function getChecklistItem(itemId) {
  return prisma.checklistItem.findUnique({
    where: { id: itemId },
    include: {
      task: { select: { id: true, ownerId: true, title: true } },
    },
  });
}

function canAccessChecklistItem(context, item) {
  if (!item) {
    return false;
  }

  if (isAdminRole(context.role)) {
    return true;
  }

  return item.task.ownerId === context.user.id;
}

export async function GET(request, { params }) {
  const context = await getAuthContext();
  const authError = ensureAuthenticated(context);
  if (authError) {
    return authError;
  }

  const itemId = params?.id;
  if (!itemId) {
    return buildError("Checklist item id is required.", 400);
  }

  const item = await getChecklistItem(itemId);
  if (!item) {
    return buildError("Checklist item not found.", 404);
  }

  if (!canAccessChecklistItem(context, item)) {
    return buildError(
      "You do not have permission to view this checklist item.",
      403
    );
  }

  return buildSuccess("Checklist item loaded.", { checklistItem: item });
}

export async function PATCH(request, { params }) {
  const context = await getAuthContext();
  const authError = ensureAuthenticated(context);
  if (authError) {
    return authError;
  }

  const itemId = params?.id;
  if (!itemId) {
    return buildError("Checklist item id is required.", 400);
  }

  const item = await getChecklistItem(itemId);
  if (!item) {
    return buildError("Checklist item not found.", 404);
  }

  if (!canAccessChecklistItem(context, item)) {
    return buildError(
      "You do not have permission to update this checklist item.",
      403
    );
  }

  const body = await request.json();
  const updates = {};

  if (body?.label) {
    updates.label = body.label.trim();
  }

  if (typeof body?.isCompleted === "boolean") {
    updates.isCompleted = body.isCompleted;
  }

  if (Object.keys(updates).length === 0) {
    return buildError("No valid updates provided.", 400);
  }

  const updated = await prisma.checklistItem.update({
    where: { id: itemId },
    data: updates,
    include: {
      task: { select: { id: true, title: true, ownerId: true } },
    },
  });

  return buildSuccess("Checklist item updated.", {
    checklistItem: updated,
  });
}

export async function DELETE(request, { params }) {
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

  const itemId = params?.id;
  if (!itemId) {
    return buildError("Checklist item id is required.", 400);
  }

  const item = await getChecklistItem(itemId);
  if (!item) {
    return buildError("Checklist item not found.", 404);
  }

  if (!canAccessChecklistItem(context, item)) {
    return buildError(
      "You do not have permission to delete this checklist item.",
      403
    );
  }

  try {
    await prisma.checklistItem.delete({ where: { id: itemId } });
    return buildSuccess("Checklist item deleted.");
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === "P2025") {
        return buildError("Checklist item not found.", 404);
      }
    }

    return buildError("Unable to delete checklist item.", 500);
  }
}
