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

async function getMilestone(milestoneId) {
  return prisma.milestone.findUnique({
    where: { id: milestoneId },
    include: {
      project: {
        select: { id: true, name: true, createdById: true },
      },
    },
  });
}

function canAccessMilestone(context, milestone) {
  if (!milestone) {
    return false;
  }

  if (isAdminRole(context.role)) {
    return true;
  }

  return milestone.project.createdById === context.user.id;
}

export async function GET(request, { params }) {
  const context = await getAuthContext();
  const {id:milestoneId}= await params
  const authError = ensureAuthenticated(context);
  if (authError) {
    return authError;
  }


  if (!milestoneId) {
    return buildError("Milestone id is required.", 400);
  }

  const milestone = await getMilestone(milestoneId);
  if (!milestone) {
    return buildError("Milestone not found.", 404);
  }

  if (!canAccessMilestone(context, milestone)) {
    return buildError("You do not have permission to view this milestone.", 403);
  }

  return buildSuccess("Milestone loaded.", { milestone });
}

export async function PATCH(request, { params }) {
  const context = await getAuthContext();
    const {id:milestoneId}= await params;
  const authError = ensureAuthenticated(context);
  if (authError) {
    return authError;
  }

 
  if (!milestoneId) {
    return buildError("Milestone id is required.", 400);
  }

  const milestone = await getMilestone(milestoneId);
  if (!milestone) {
    return buildError("Milestone not found.", 404);
  }

  if (!canAccessMilestone(context, milestone)) {
    return buildError("You do not have permission to update this milestone.", 403);
  }

  const body = await request.json();
  const title = body?.title?.trim();
  const startDate = body?.startDate ? new Date(body.startDate) : null;
  const endDate = body?.endDate ? new Date(body.endDate) : null;

  if (!title && !startDate && !endDate) {
    return buildError("No valid updates provided.", 400);
  }

  if (startDate && Number.isNaN(startDate.getTime())) {
    return buildError("Start date must be valid.", 400);
  }

  if (endDate && Number.isNaN(endDate.getTime())) {
    return buildError("End date must be valid.", 400);
  }

  const updated = await prisma.milestone.update({
    where: { id: milestoneId },
    data: {
      ...(title ? { title } : {}),
      ...(startDate ? { startDate } : {}),
      ...(endDate ? { endDate } : {}),
    },
    include: {
      project: {
        select: { id: true, name: true },
      },
    },
  });

  return buildSuccess("Milestone updated.", { milestone: updated });
}

export async function DELETE(request, { params }) {
  const context = await getAuthContext();
    const {id:milestoneId}= await params
  const authError = ensureAuthenticated(context);
  if (authError) {
    return authError;
  }

  const roleError = ensureRole(context.role, ADMIN_ROLES);
  if (roleError) {
    return roleError;
  }

  if (!milestoneId) {
    return buildError("Milestone id is required.", 400);
  }

  const milestone = await getMilestone(milestoneId);
  if (!milestone) {
    return buildError("Milestone not found.", 404);
  }

  if (!canAccessMilestone(context, milestone)) {
    return buildError("You do not have permission to delete this milestone.", 403);
  }

  try {
    const tasks = await prisma.task.findMany({
      where: { milestoneId },
      select: { id: true },
    });

    const taskIds = tasks.map((task) => task.id);

    await prisma.$transaction([
      prisma.checklistItem.deleteMany({
        where: taskIds.length ? { taskId: { in: taskIds } } : {},
      }),
      prisma.task.deleteMany({ where: { milestoneId } }),
      prisma.milestone.delete({ where: { id: milestoneId } }),
    ]);

    return buildSuccess("Milestone deleted.");
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === "P2025") {
        return buildError("Milestone not found.", 404);
      }
    }

    return buildError("Unable to delete milestone.", 500);
  }
}
