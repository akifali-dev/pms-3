import { prisma } from "@/lib/prisma";
import {
  buildError,
  buildSuccess,
  ensureAuthenticated,
  getAuthContext,
} from "@/lib/api";
import { createNotification } from "@/lib/notifications";

const ALLOWED_STATUSES = ["APPROVED", "REJECTED"];

function isLeader(role) {
  return ["PM", "CTO"].includes(role);
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

export async function PATCH(request, { params }) {
  const context = await getAuthContext();
  const authError = ensureAuthenticated(context);
  if (authError) {
    return authError;
  }

  if (!isLeader(context.role)) {
    return buildError("Only PMs and CTOs can review time requests.", 403);
  }

  const requestId = params?.requestId;
  if (!requestId) {
    return buildError("Request id is required.", 400);
  }

  const body = await request.json();
  const nextStatus = body?.status;
  if (!ALLOWED_STATUSES.includes(nextStatus)) {
    return buildError("Status must be approved or rejected.", 400);
  }

  const existing = await prisma.taskTimeRequest.findUnique({
    where: { id: requestId },
    include: {
      task: {
        select: {
          id: true,
          title: true,
          estimatedHours: true,
          ownerId: true,
          milestone: { select: { id: true, projectId: true } },
        },
      },
      requestedBy: { select: { id: true, name: true, email: true } },
    },
  });

  if (!existing) {
    return buildError("Time request not found.", 404);
  }

  if (existing.status !== "PENDING") {
    return buildError("This request has already been reviewed.", 400);
  }

  const now = new Date();

  const updated = await prisma.$transaction(async (tx) => {
    if (nextStatus === "APPROVED") {
      const addedHours = existing.requestedSeconds / 3600;
      await tx.task.update({
        where: { id: existing.taskId },
        data: { estimatedHours: existing.task.estimatedHours + addedHours },
      });
    }

    return tx.taskTimeRequest.update({
      where: { id: requestId },
      data: {
        status: nextStatus,
        reviewedById: context.user.id,
        reviewedAt: now,
      },
      include: {
        requestedBy: { select: { id: true, name: true, email: true, role: true } },
        reviewedBy: { select: { id: true, name: true, email: true, role: true } },
      },
    });
  });

  const actorName = context.user?.name || context.user?.email || "A leader";
  const requesterName =
    existing.requestedBy?.name || existing.requestedBy?.email || "A teammate";
  const message = `${actorName} ${nextStatus.toLowerCase()} ${requesterName}'s request for +${formatDuration(
    existing.requestedSeconds
  )} on Task: ${existing.task.title}.`;

  await createNotification({
    type: "TIME_REQUEST",
    actorId: context.user.id,
    message,
    taskId: existing.taskId,
    projectId: existing.task?.milestone?.projectId ?? null,
    milestoneId: existing.task?.milestone?.id ?? null,
    recipientIds: [existing.requestedById, existing.task.ownerId],
  });

  return buildSuccess("Time request updated.", { request: updated });
}
