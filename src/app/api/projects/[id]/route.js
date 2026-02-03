import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  buildError,
  buildSuccess,
  ensureAuthenticated,
  ensureRole,
  getAuthContext,
  isManagementRole,
  PROJECT_MANAGEMENT_ROLES,
} from "@/lib/api";
import { createNotification } from "@/lib/notifications";
import { ensureTaskUpdatedAt } from "@/lib/taskDataFixes";

async function getProjectWithAccess(projectId) {
  return prisma.project.findUnique({
    where: { id: projectId },
    include: {
      createdBy: {
        select: { id: true, name: true, email: true, role: true },
      },
      members: {
        select: {
          userId: true,
          user: { select: { id: true, name: true, email: true, role: true } },
        },
      },
    },
  });
}

function canAccessProject(context, project) {
  if (!project) {
    return false;
  }

  if (isManagementRole(context.role)) {
    return true;
  }

  return project.members?.some((member) => member.userId === context.user.id);
}

export async function GET(request, { params }) {
  const {id:projectId}= await params;
    const context = await getAuthContext();

  const authError = ensureAuthenticated(context);
  if (authError) {
    return authError;
  }


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

  return buildSuccess("Project loaded.", {
    project: {
      ...project,
      members: project.members.map((member) => member.user),
    },
  });
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
  const {id:projectId}= await params;
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
  const incomingMemberIds = Array.isArray(body?.memberIds)
    ? body.memberIds.filter(Boolean)
    : null;

  if (!name && description === undefined && incomingMemberIds === null) {
    return buildError("No valid updates provided.", 400);
  }

  const existingMemberIds = project.members?.map((member) => member.userId) ?? [];
  let memberIdsUpdate = null;
  let addedMemberIds = [];
  if (incomingMemberIds !== null) {
    const uniqueMemberIds = Array.from(
      new Set([project.createdById, ...incomingMemberIds])
    );
    const memberCount = await prisma.user.count({
      where: { id: { in: uniqueMemberIds } },
    });
    if (memberCount !== uniqueMemberIds.length) {
      return buildError("One or more project members were not found.", 404);
    }
    memberIdsUpdate = uniqueMemberIds;
    addedMemberIds = uniqueMemberIds.filter(
      (memberId) => !existingMemberIds.includes(memberId)
    );
  }

  const updated = await prisma.project.update({
    where: { id: projectId },
    data: {
      ...(name ? { name } : {}),
      ...(description !== undefined
        ? { description: description || null }
        : {}),
      ...(memberIdsUpdate
        ? {
            members: {
              deleteMany: {},
              create: memberIdsUpdate.map((userId) => ({ userId })),
            },
          }
        : {}),
    },
    include: {
      createdBy: {
        select: { id: true, name: true, email: true, role: true },
      },
      members: {
        select: {
          userId: true,
          user: { select: { id: true, name: true, email: true, role: true } },
        },
      },
    },
  });

  if (addedMemberIds.length) {
    await createNotification({
      type: "CREATION_ASSIGNMENT",
      actorId: context.user.id,
      message: `${context.user?.name || context.user?.email || "A teammate"} added you to project ${updated.name}.`,
      projectId: updated.id,
      recipientIds: addedMemberIds,
    });
  }

  return buildSuccess("Project updated.", {
    project: {
      ...updated,
      members: updated.members.map((member) => member.user),
    },
  });
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

  const {id:projectId}= await params;
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

    if (milestoneIds.length) {
      await ensureTaskUpdatedAt(prisma, { milestoneId: { in: milestoneIds } });
    }

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
      prisma.projectMember.deleteMany({ where: { projectId } }),
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
