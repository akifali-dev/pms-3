import { Prisma } from "@prisma/client";
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

async function getProjectWithAccess(projectId) {
  return prisma.project.findUnique({
    where: { id: projectId },
    include: {
      createdBy: {
        select: { id: true, name: true, email: true, role: true },
      },
    },
  });
}

function canAccessProject(context, project) {
  if (!project) {
    return false;
  }

  if (isAdminRole(context.role)) {
    return true;
  }

  return project.createdById === context.user.id;
}

export async function GET(request, { params }) {
  const context = await getAuthContext();
  const authError = ensureAuthenticated(context);
  if (authError) {
    return authError;
  }

  const projectId = params?.id;
  if (!projectId) {
    return buildError("Project id is required.", 400);
  }

  const project = await getProjectWithAccess(projectId);
  if (!project) {
    return buildError("Project not found.", 404);
  }

  if (!canAccessProject(context, project)) {
    return buildError("You do not have permission to view this project.", 403);
  }

  return buildSuccess("Project loaded.", { project });
}

async function handleProjectUpdate(request, { params }) {
  const context = await getAuthContext();
  const authError = ensureAuthenticated(context);
  if (authError) {
    return authError;
  }

  const roleError = ensureRole(context.role, PROJECT_MANAGEMENT_ROLES);
  if (roleError) {
    return roleError;
  }

  const projectId = params?.id;
  if (!projectId) {
    return buildError("Project id is required.", 400);
  }

  const project = await getProjectWithAccess(projectId);
  if (!project) {
    return buildError("Project not found.", 404);
  }

  if (!canAccessProject(context, project)) {
    return buildError("You do not have permission to update this project.", 403);
  }

  const body = await request.json();
  const name = body?.name?.trim();
  const description = body?.description?.trim();

  if (!name && description === undefined) {
    return buildError("No valid updates provided.", 400);
  }

  const updated = await prisma.project.update({
    where: { id: projectId },
    data: {
      ...(name ? { name } : {}),
      ...(description !== undefined
        ? { description: description || null }
        : {}),
    },
    include: {
      createdBy: {
        select: { id: true, name: true, email: true, role: true },
      },
    },
  });

  return buildSuccess("Project updated.", { project: updated });
}

export async function PUT(request, context) {
  return handleProjectUpdate(request, context);
}

export async function PATCH(request, context) {
  return handleProjectUpdate(request, context);
}

export async function DELETE(request, { params }) {
  const context = await getAuthContext();
  const authError = ensureAuthenticated(context);
  if (authError) {
    return authError;
  }

  const projectId = params?.id;
  if (!projectId) {
    return buildError("Project id is required.", 400);
  }

  const project = await getProjectWithAccess(projectId);
  if (!project) {
    return buildError("Project not found.", 404);
  }

  if (!canAccessProject(context, project)) {
    return buildError("You do not have permission to delete this project.", 403);
  }

  try {
    const milestones = await prisma.milestone.findMany({
      where: { projectId },
      select: { id: true },
    });

    const milestoneIds = milestones.map((milestone) => milestone.id);

    const tasks = milestoneIds.length
      ? await prisma.task.findMany({
          where: { milestoneId: { in: milestoneIds } },
          select: { id: true },
        })
      : [];

    const taskIds = tasks.map((task) => task.id);

    await prisma.$transaction([
      prisma.checklistItem.deleteMany({
        where: taskIds.length ? { taskId: { in: taskIds } } : {},
      }),
      prisma.task.deleteMany({
        where: milestoneIds.length ? { milestoneId: { in: milestoneIds } } : {},
      }),
      prisma.milestone.deleteMany({ where: { projectId } }),
      prisma.project.delete({ where: { id: projectId } }),
    ]);

    return buildSuccess("Project deleted.");
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === "P2025") {
        return buildError("Project not found.", 404);
      }
    }

    return buildError("Unable to delete project.", 500);
  }
}
