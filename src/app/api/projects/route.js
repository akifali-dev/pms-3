import { prisma } from "@/lib/prisma";
import {
  buildError,
  buildSuccess,
  ensureAuthenticated,
  ensureRole,
  getAuthContext,
  isAdminRole,
  PROJECT_MANAGEMENT_ROLES,
} from "@/lib/api";

export async function GET(request) {
  const context = await getAuthContext();
  const authError = ensureAuthenticated(context);
  if (authError) {
    return authError;
  }

  const { searchParams } = new URL(request.url);
  const createdById = searchParams.get("createdById");

  const where = {};
  if (isAdminRole(context.role)) {
    if (createdById) {
      where.createdById = createdById;
    }
  } else {
    where.createdById = context.user.id;
  }

  const projects = await prisma.project.findMany({
    where,
    orderBy: { createdAt: "desc" },
    include: {
      createdBy: {
        select: { id: true, name: true, email: true, role: true },
      },
    },
  });

  return buildSuccess("Projects loaded.", { projects });
}

export async function POST(request) {
  const context = await getAuthContext();
  const authError = ensureAuthenticated(context);
  if (authError) {
    return authError;
  }

  const roleError = ensureRole(context.role, PROJECT_MANAGEMENT_ROLES);
  if (roleError) {
    return roleError;
  }

  const body = await request.json();
  const name = body?.name?.trim();
  const description = body?.description?.trim();

  if (!name) {
    return buildError("Project name is required.", 400);
  }

  const project = await prisma.project.create({
    data: {
      name,
      description: description || null,
      createdById: context.user.id,
    },
    include: {
      createdBy: {
        select: { id: true, name: true, email: true, role: true },
      },
    },
  });

  return buildSuccess("Project created.", { project }, 201);
}
