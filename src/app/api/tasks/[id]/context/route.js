import { prisma } from "@/lib/prisma";
import {
  buildError,
  buildSuccess,
  ensureAuthenticated,
  getAuthContext,
  isManagementRole,
} from "@/lib/api";

export async function GET(_request, { params }) {
  const { id: taskId } = await params;

  const context = await getAuthContext();
  const authError = ensureAuthenticated(context);
  if (authError) {
    return authError;
  }

  if (!taskId) {
    return buildError("Task id is required.", 400);
  }

  const task = await prisma.task.findUnique({
    where: { id: taskId },
    select: {
      id: true,
      ownerId: true,
      milestoneId: true,
      milestone: {
        select: {
          id: true,
          projectId: true,
          project: {
            select: {
              members: {
                select: {
                  userId: true,
                },
              },
            },
          },
        },
      },
    },
  });

  if (!task) {
    return buildError("Task not found.", 404);
  }

  const canAccess =
    isManagementRole(context.role) ||
    task.ownerId === context.user.id ||
    task.milestone?.project?.members?.some(
      (member) => member.userId === context.user.id
    );

  if (!canAccess) {
    return buildError("You do not have permission to view this task.", 403);
  }

  return buildSuccess("Task context loaded.", {
    taskId: task.id,
    projectId: task.milestone?.projectId ?? null,
    milestoneId: task.milestone?.id ?? task.milestoneId ?? null,
  });
}
