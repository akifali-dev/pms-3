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

export async function GET(request) {
  const context = await getAuthContext();
  const authError = ensureAuthenticated(context);
  if (authError) {
    return authError;
  }

  const { searchParams } = new URL(request.url);
  const createdById = searchParams.get("createdById");
  const createdForId = searchParams.get("createdForId");

  const where = {};

  if (isAdminRole(context.role)) {
    if (createdById) {
      where.createdById = createdById;
    }
    if (createdForId) {
      where.createdForId = createdForId;
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

  const allowedRoles = [...ADMIN_ROLES, "DEVELOPER"];
  const roleError = ensureRole(context.role, allowedRoles);
  if (roleError) {
    return roleError;
  }

  const body = await request.json();
  const message = body?.message?.trim();
  const createdForId = body?.createdForId;

  if (!message || !createdForId) {
    return buildError("Message and recipient are required.", 400);
  }

  const recipient = await prisma.user.findUnique({
    where: { id: createdForId },
    select: { id: true },
  });

  if (!recipient) {
    return buildError("Recipient not found.", 404);
  }

  const comment = await prisma.comment.create({
    data: {
      message,
      createdById: context.user.id,
      createdForId,
    },
    include: {
      createdBy: { select: { id: true, name: true, email: true, role: true } },
      createdFor: { select: { id: true, name: true, email: true, role: true } },
    },
  });

  return buildSuccess("Comment created.", { comment }, 201);
}
