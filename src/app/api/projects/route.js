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

  const where = {
    members: { some: { userId: context.user.id } },
  };
  if (isAdminRole(context.role) && createdById) {
    where.createdById = createdById;
  }

  const projects = await prisma.project.findMany({
    where,
    orderBy: { createdAt: "desc" },
    include: {
      createdBy: {
        select: { id: true, name: true, email: true, role: true },
      },
      members: {
        select: {
          user: { select: { id: true, name: true, email: true, role: true } },
        },
      },
    },
  });

  return buildSuccess("Projects loaded.", {
    projects: projects.map((project) => ({
      ...project,
      members: project.members.map((member) => member.user),
    })),
  });
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
  const incomingMemberIds = Array.isArray(body?.memberIds)
    ? body.memberIds.filter(Boolean)
    : [];
  const uniqueMemberIds = Array.from(
    new Set([context.user.id, ...incomingMemberIds])
  );

  if (uniqueMemberIds.length) {
    const memberCount = await prisma.user.count({
      where: { id: { in: uniqueMemberIds } },
    });
    if (memberCount !== uniqueMemberIds.length) {
      return buildError("One or more project members were not found.", 404);
    }
  }

  if (!name) {
    return buildError("Project name is required.", 400);
  }

  const project = await prisma.project.create({
    data: {
      name,
      description: description || null,
      createdById: context.user.id,
      members: {
        create: uniqueMemberIds.map((userId) => ({ userId })),
      },
    },
    include: {
      createdBy: {
        select: { id: true, name: true, email: true, role: true },
      },
      members: {
        select: {
          user: { select: { id: true, name: true, email: true, role: true } },
        },
      },
    },
  });

  return buildSuccess(
    "Project created.",
    {
      project: {
        ...project,
        members: project.members.map((member) => member.user),
      },
    },
    201
  );
}
