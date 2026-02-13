import { prisma } from "@/lib/prisma";
import {
  ADMIN_ROLES,
  buildError,
  buildSuccess,
  ensureAuthenticated,
  ensureRole,
  getAuthContext,
  isManagementRole,
} from "@/lib/api";
import { createNotification, getProjectMemberIds } from "@/lib/notifications";

export async function GET(request) {
  const context = await getAuthContext();
  const authError = ensureAuthenticated(context);
  if (authError) {
    return authError;
  }

  const { searchParams } = new URL(request.url);
  const projectId = searchParams.get("projectId");

  const where = {};
  if (projectId) {
    where.projectId = projectId;
  }

  if (!isManagementRole(context.role)) {
    where.project = { members: { some: { userId: context.user.id } } };
  }

  const milestones = await prisma.milestone.findMany({
    where,
    orderBy: { startDate: "asc" },
    include: {
      project: {
        select: { id: true, name: true, createdById: true },
      },
      tasks: {
        select: {
          id: true,
          estimatedHours: true,
        },
      },
    },
  });

  return buildSuccess("Milestones loaded.", { milestones });
}

export async function POST(request) {
  const context = await getAuthContext();
  const authError = ensureAuthenticated(context);
  if (authError) {
    return authError;
  }

  const roleError = ensureRole(context.role, ADMIN_ROLES);
  if (roleError) {
    return roleError;
  }

  const body = await request.json();
  const title = body?.title?.trim();
  const startDate = body?.startDate ? new Date(body.startDate) : null;
  const endDate = body?.endDate ? new Date(body.endDate) : null;
  const projectId = body?.projectId;

  if (!title || !startDate || !endDate || !projectId) {
    return buildError(
      "Title, start date, end date, and project are required.",
      400
    );
  }

  if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
    return buildError("Start and end dates must be valid.", 400);
  }

  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { id: true, members: { select: { userId: true } } },
  });

  if (!project) {
    return buildError("Project not found.", 404);
  }

  if (!isManagementRole(context.role)) {
    if (!project.members?.some((member) => member.userId === context.user.id)) {
      return buildError("You do not have permission to add milestones.", 403);
    }
  }

  const milestone = await prisma.milestone.create({
    data: {
      title,
      startDate,
      endDate,
      projectId,
    },
    include: {
      project: {
        select: { id: true, name: true },
      },
    },
  });

  const memberIds = await getProjectMemberIds(projectId);
  await createNotification({
    type: "CREATION_ASSIGNMENT",
    actorId: context.user.id,
    message: `${context.user?.name || context.user?.email || "A teammate"} created milestone ${milestone.title}.`,
    milestoneId: milestone.id,
    projectId,
    recipientIds: memberIds,
  });

  return buildSuccess("Milestone created.", { milestone }, 201);
}
