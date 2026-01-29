import { prisma } from "@/lib/prisma";
import {
  PROJECT_MANAGEMENT_ROLES,
  buildError,
  buildSuccess,
  ensureAuthenticated,
  getAuthContext,
} from "@/lib/api";
import { createNotification, getLeadershipUserIds } from "@/lib/notifications";

function isLeader(role) {
  return PROJECT_MANAGEMENT_ROLES.includes(role);
}

async function getTask(taskId) {
  return prisma.task.findUnique({
    where: { id: taskId },
    select: {
      id: true,
      title: true,
      ownerId: true,
      milestone: {
        select: {
          id: true,
          projectId: true,
          project: { select: { members: { select: { userId: true } } } },
        },
      },
    },
  });
}

function canViewRequests(context, task) {
  if (!task) {
    return false;
  }
  const isMember = task.milestone?.project?.members?.some(
    (member) => member.userId === context.user.id
  );
  if (!isMember) {
    return false;
  }
  if (isLeader(context.role)) {
    return true;
  }
  return task.ownerId === context.user.id;
}

function canCreateRequest(context, task) {
  if (!task) {
    return false;
  }
  return task.ownerId === context.user.id;
}

function formatDuration(seconds) {
  const totalSeconds = Math.max(0, Math.floor(seconds));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  if (hours > 0 && minutes > 0) {
    return `${hours}h ${minutes}m`;
  }
  if (hours > 0) {
    return `${hours}h`;
  }
  return `${minutes}m`;
}

export async function GET(request, { params }) {
  const context = await getAuthContext();
  const authError = ensureAuthenticated(context);
  if (authError) {
    return authError;
  }

  const taskId = params?.id;
  if (!taskId) {
    return buildError("Task id is required.", 400);
  }

  const task = await getTask(taskId);
  if (!task) {
    return buildError("Task not found.", 404);
  }

  if (!canViewRequests(context, task)) {
    return buildError("You do not have permission to view time requests.", 403);
  }

  const where = { taskId };
  if (!isLeader(context.role)) {
    where.requestedById = context.user.id;
  }

  const requests = await prisma.taskTimeRequest.findMany({
    where,
    orderBy: { createdAt: "desc" },
    include: {
      requestedBy: { select: { id: true, name: true, email: true, role: true } },
      reviewedBy: { select: { id: true, name: true, email: true, role: true } },
    },
  });

  return buildSuccess("Time requests loaded.", { requests });
}

export async function POST(request, { params }) {
  const { id:taskId} = await params;
  const context = await getAuthContext();
  const authError = ensureAuthenticated(context);
  if (authError) {
    return authError;
  }

  if (!taskId) {
    return buildError("Task id is required.", 400);
  }

  const task = await getTask(taskId);
  if (!task) {
    return buildError("Task not found.", 404);
  }

  if (!canCreateRequest(context, task)) {
    return buildError("You can only request time on your assigned tasks.", 403);
  }

  const body = await request.json();
  const requestedSeconds = Number(body?.requestedSeconds ?? 0);
  const reason = body?.reason?.trim();

  if (!Number.isFinite(requestedSeconds) || requestedSeconds <= 0) {
    return buildError("Requested time must be greater than zero.", 400);
  }

  if (!reason) {
    return buildError("Reason is required.", 400);
  }

  const createdRequest = await prisma.taskTimeRequest.create({
    data: {
      taskId,
      requestedById: context.user.id,
      requestedSeconds,
      reason,
    },
    include: {
      requestedBy: { select: { id: true, name: true, email: true, role: true } },
      reviewedBy: { select: { id: true, name: true, email: true, role: true } },
    },
  });

  const leaderIds = await getLeadershipUserIds();
  const actorName = context.user?.name || context.user?.email || "A teammate";
  await createNotification({
    type: "TIME_REQUEST",
    actorId: context.user.id,
    message: `${actorName} requested +${formatDuration(requestedSeconds)} on Task: ${task.title}.`,
    taskId,
    projectId: task.milestone?.projectId ?? null,
    milestoneId: task.milestone?.id ?? null,
    recipientIds: leaderIds,
  });

  return buildSuccess("Time request created.", { request: createdRequest }, 201);
}
