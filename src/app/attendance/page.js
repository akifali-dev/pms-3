import AttendanceDashboard from "@/components/attendance/AttendanceDashboard";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { normalizeRole, PROJECT_MANAGEMENT_ROLES } from "@/lib/api";

function getWeekRange() {
  const now = new Date();
  const start = new Date(now);
  const end = new Date(now);
  const day = now.getDay();
  const diff = (day + 6) % 7;
  start.setDate(now.getDate() - diff);
  end.setDate(start.getDate() + 6);
  start.setHours(0, 0, 0, 0);
  end.setHours(23, 59, 59, 999);
  return { start, end };
}

export default async function AttendancePage() {
  const session = await getSession();
  const hasDatabase = Boolean(process.env.DATABASE_URL);
  const role = normalizeRole(session?.role);
  const isLeader = PROJECT_MANAGEMENT_ROLES.includes(role);

  let currentUser = null;
  let users = [];
  let attendance = [];

  const { start, end } = getWeekRange();

  if (hasDatabase && session?.email) {
    currentUser = await prisma.user.findUnique({
      where: { email: session.email },
      select: { id: true, name: true, email: true, role: true },
    });

    if (currentUser) {
      const userFilter = isLeader ? {} : { id: currentUser.id };
      users = await prisma.user.findMany({
        where: userFilter,
        orderBy: { name: "asc" },
        select: { id: true, name: true, email: true, role: true },
      });

      attendance = await prisma.attendance.findMany({
        where: {
          ...(isLeader ? {} : { userId: currentUser.id }),
          date: {
            gte: start,
            lte: end,
          },
        },
        orderBy: { date: "desc" },
        include: {
          user: { select: { id: true, name: true, email: true, role: true } },
        },
      });
    }
  }

  return (
    <AttendanceDashboard
      initialAttendance={attendance}
      users={users}
      currentUser={currentUser}
      isLeader={isLeader}
      initialRange={{
        preset: "week",
        from: start.toISOString().slice(0, 10),
        to: end.toISOString().slice(0, 10),
      }}
    />
  );
}
