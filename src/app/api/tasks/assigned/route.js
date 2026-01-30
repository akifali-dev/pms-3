import { prisma } from "@/lib/prisma";
import { buildSuccess, ensureAuthenticated, getAuthContext } from "@/lib/api";

export async function GET() {
  const context = await getAuthContext();
  const authError = ensureAuthenticated(context);
  if (authError) {
    return authError;
  }

  const tasks = await prisma.task.findMany({
    where: {
      ownerId: context.user.id,
      status: { notIn: ["DONE", "REJECTED"] },
    },
    orderBy: { updatedAt: "desc" },
    select: {
      id: true,
      title: true,
      milestone: { select: { id: true, title: true } },
    },
  });

  return buildSuccess("Assigned tasks loaded.", { tasks });
}
