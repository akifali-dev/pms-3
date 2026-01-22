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
  const taskId = searchParams.get("taskId");

  const where = {};
  if (taskId) {
    where.taskId = taskId;
  }

  if (!isAdminRole(context.role)) {
    where.task = { ownerId: context.user.id };
  }

  const checklistItems = await prisma.checklistItem.findMany({
    where,
    orderBy: { label: "asc" },
    include: {
      task: { select: { id: true, title: true, ownerId: true } },
    },
  });

  return buildSuccess("Checklist items loaded.", { checklistItems });
}

export async function POST(request) {
  const context = await getAuthContext();
  const authError = ensureAuthenticated(context);
  if (authError) {
    return authError;
  }

  const allowedRoles = [...ADMIN_ROLES, "DEVELOPER"];
  const roleError = ensureRole(context.role, allowedRoles);
  if (roleError) {
    return roleError;
  }

  const body = await request.json();
  const label = body?.label?.trim();
  const taskId = body?.taskId;
  const isCompleted = Boolean(body?.isCompleted ?? false);

  if (!label || !taskId) {
    return buildError("Label and task are required.", 400);
  }

  const task = await prisma.task.findUnique({
    where: { id: taskId },
    select: { id: true, ownerId: true, title: true },
  });

  if (!task) {
    return buildError("Task not found.", 404);
  }

  if (!isAdminRole(context.role) && task.ownerId !== context.user.id) {
    return buildError("You do not have permission to add checklist items.", 403);
  }

  const checklistItem = await prisma.checklistItem.create({
    data: {
      label,
      taskId,
      isCompleted,
    },
    include: {
      task: { select: { id: true, title: true, ownerId: true } },
    },
  });

  return buildSuccess("Checklist item created.", { checklistItem }, 201);
}
