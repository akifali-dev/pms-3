import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  ADMIN_ROLES,
  ALL_ROLES,
  buildError,
  buildSuccess,
  ensureAuthenticated,
  ensureRole,
  getAuthContext,
  normalizeRole,
} from "@/lib/api";

function canAccessUser(context, userId) {
  if (context.user?.id === userId) {
    return true;
  }

  return ADMIN_ROLES.includes(context.role);
}

export async function GET(request, { params }) {
  const context = await getAuthContext();
  const authError = ensureAuthenticated(context);
  if (authError) {
    return authError;
  }

  const { id: userId } = await params;
  if (!userId) {
    return buildError("User id is required.", 400);
  }

  if (!canAccessUser(context, userId)) {
    return buildError("You do not have permission to view this user.", 403);
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      isActive: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  if (!user) {
    return buildError("User not found.", 404);
  }

  return buildSuccess("User loaded.", { user });
}

export async function PATCH(request, { params }) {
  const context = await getAuthContext();
  const authError = ensureAuthenticated(context);
  if (authError) {
    return authError;
  }

  const { id: userId } = await params;
  if (!userId) {
    return buildError("User id is required.", 400);
  }

  if (!canAccessUser(context, userId)) {
    return buildError("You do not have permission to update this user.", 403);
  }

  const body = await request.json();
  const name = body?.name?.trim();
  const password = body?.password;
  const updates = {};

  if (name) {
    updates.name = name;
  }

  if (password) {
    updates.password = password;
  }

  if (ADMIN_ROLES.includes(context.role)) {
    if (body?.email) {
      updates.email = body.email.trim().toLowerCase();
    }

    if (body?.role) {
      const nextRole = normalizeRole(body.role);
      if (!ALL_ROLES.includes(nextRole)) {
        return buildError("Role is invalid.", 400);
      }
      updates.role = nextRole;
    }

    if (typeof body?.isActive === "boolean") {
      updates.isActive = body.isActive;
    }
  }

  if (Object.keys(updates).length === 0) {
    return buildError("No valid updates provided.", 400);
  }

  try {
    const user = await prisma.user.update({
      where: { id: userId },
      data: updates,
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return buildSuccess("User updated.", { user });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === "P2002") {
        return buildError("A user with this email already exists.", 409);
      }
    }

    return buildError("Unable to update user.", 500);
  }
}

export async function DELETE(request, { params }) {
  const context = await getAuthContext();
  const authError = ensureAuthenticated(context);
  if (authError) {
    return authError;
  }

  const roleError = ensureRole(context.role, ADMIN_ROLES);
  if (roleError) {
    return roleError;
  }

  const { id: userId } = await params;
  if (!userId) {
    return buildError("User id is required.", 400);
  }

  try {
    await prisma.user.delete({ where: { id: userId } });
    return buildSuccess("User deleted.");
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === "P2025") {
        return buildError("User not found.", 404);
      }
    }

    return buildError("Unable to delete user.", 500);
  }
}
