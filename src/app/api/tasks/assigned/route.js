import { prisma } from "@/lib/prisma";
import { buildSuccess, ensureAuthenticated, getAuthContext } from "@/lib/api";
import { ensureTaskUpdatedAt } from "@/lib/taskDataFixes";

export async function GET() {
  const context = await getAuthContext();
  const authError = ensureAuthenticated(context);
  if (authError) {
    return authError;
  }

  const where = {
    ownerId: context.user.id,
    status: { notIn: ["DONE", "REJECTED"] },
  };

  await ensureTaskUpdatedAt(prisma, where);

  const tasks = await prisma.task.findMany({
    where,
    orderBy: { updatedAt: "desc" },
    select: {
      id: true,
      title: true,
      milestone: { select: { id: true, title: true } },
    },
  });

  return buildSuccess("Assigned tasks loaded.", { tasks });
}
