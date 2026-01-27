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
  const projectId = searchParams.get("projectId");

  const where = {};
  if (projectId) {
    where.projectId = projectId;
  }

  where.project = { memberIds: { has: context.user.id } };

  const milestones = await prisma.milestone.findMany({
    where,
    orderBy: { startDate: "asc" },
    include: {
      project: {
        select: { id: true, name: true, createdById: true },
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
    select: { id: true, memberIds: true },
  });

  if (!project) {
    return buildError("Project not found.", 404);
  }

  if (!project.memberIds?.includes(context.user.id)) {
    return buildError("You do not have permission to add milestones.", 403);
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

  return buildSuccess("Milestone created.", { milestone }, 201);
}
