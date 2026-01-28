import { prisma } from "@/lib/prisma";

const LEADERSHIP_ROLES = ["CEO", "PM", "CTO"];

export function isLeadershipRole(role) {
  return LEADERSHIP_ROLES.includes(role);
}

export async function getLeadershipUserIds(prismaClient = prisma) {
  const leaders = await prismaClient.user.findMany({
    where: { role: { in: LEADERSHIP_ROLES } },
    select: { id: true },
  });
  return leaders.map((leader) => leader.id);
}

export async function getProjectMemberIds(projectId, prismaClient = prisma) {
  if (!projectId) {
    return [];
  }

  const project = await prismaClient.project.findUnique({
    where: { id: projectId },
    select: { members: { select: { userId: true } } },
  });

  return project?.members?.map((member) => member.userId) ?? [];
}

export async function getTaskMemberIds(taskId, prismaClient = prisma) {
  if (!taskId) {
    return [];
  }

  const task = await prismaClient.task.findUnique({
    where: { id: taskId },
    select: {
      ownerId: true,
      milestone: {
        select: {
          project: { select: { members: { select: { userId: true } } } },
        },
      },
    },
  });

  const memberIds =
    task?.milestone?.project?.members?.map((member) => member.userId) ?? [];
  return Array.from(new Set([task?.ownerId, ...memberIds].filter(Boolean)));
}

export async function createNotification({
  prismaClient = prisma,
  type,
  actorId,
  message,
  taskId = null,
  projectId = null,
  milestoneId = null,
  recipientIds = [],
}) {
  const uniqueRecipients = Array.from(new Set(recipientIds.filter(Boolean)));
  if (!uniqueRecipients.length) {
    return null;
  }

  return prismaClient.notification.create({
    data: {
      type,
      actorId,
      message,
      taskId,
      projectId,
      milestoneId,
      recipients: {
        create: uniqueRecipients.map((userId) => ({ userId })),
      },
    },
  });
}
