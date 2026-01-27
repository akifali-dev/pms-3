import ActivityDashboard from "@/components/activity/ActivityDashboard";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { isAdminRole, normalizeRole } from "@/lib/api";

export default async function ActivityPage() {
  const session = await getSession();
  const hasDatabase = Boolean(process.env.DATABASE_URL);
  const role = normalizeRole(session?.role);
  const isAdmin = isAdminRole(role);

  let currentUser = null;
  let users = [];
  let activityLogs = [];
  let comments = [];

  if (hasDatabase && session?.email) {
    currentUser = await prisma.user.findUnique({
      where: { email: session.email },
      select: { id: true, name: true, email: true, role: true },
    });

    if (currentUser) {
      const userFilter = isAdmin ? {} : { id: currentUser.id };
      users = await prisma.user.findMany({
        where: userFilter,
        orderBy: { name: "asc" },
        select: { id: true, name: true, email: true, role: true },
      });

      activityLogs = await prisma.activityLog.findMany({
        where: isAdmin ? {} : { userId: currentUser.id },
        orderBy: { date: "desc" },
        include: {
          user: { select: { id: true, name: true, email: true, role: true } },
          task: { select: { id: true, title: true, ownerId: true } },
        },
      });

      comments = await prisma.comment.findMany({
        where: isAdmin
          ? {}
          : {
              OR: [
                { createdById: currentUser.id },
                { createdForId: currentUser.id },
              ],
            },
        orderBy: { createdAt: "desc" },
        include: {
          createdBy: {
            select: { id: true, name: true, email: true, role: true },
          },
          createdFor: {
            select: { id: true, name: true, email: true, role: true },
          },
          task: { select: { id: true, title: true, ownerId: true } },
        },
      });

    }
  }

  return (
    <ActivityDashboard
      initialLogs={activityLogs}
      initialComments={comments}
      users={users}
      currentUser={currentUser}
      role={role}
    />
  );
}
