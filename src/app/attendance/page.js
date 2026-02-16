import AttendanceDashboard from "@/components/attendance/AttendanceDashboard";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { normalizeRole, PROJECT_MANAGEMENT_ROLES } from "@/lib/api";
import {
  computeAttendanceDurationsForRecord,
  getUserPresenceNow,
} from "@/lib/dutyHours";
import { getTimeZoneNow } from "@/lib/attendanceTimes";
import { normalizeAutoOffForAttendances } from "@/lib/attendanceAutoOff";
import { getTodayInPSTDateString } from "@/lib/pstDate";

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
  let presenceNow = null;

  const { start, end } = getWeekRange();
  const todayPST = getTodayInPSTDateString();

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
          wfhIntervals: { orderBy: { startAt: "asc" } },
          breaks: { orderBy: { startAt: "asc" } },
        },
      });
      await normalizeAutoOffForAttendances(prisma, attendance, getTimeZoneNow());

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
          wfhIntervals: { orderBy: { startAt: "asc" } },
          breaks: { orderBy: { startAt: "asc" } },
        },
      });

      attendance = attendance.map((record) => {
        const computed = computeAttendanceDurationsForRecord(record);
        return {
          ...record,
          computedOfficeSeconds: computed.officeSeconds,
          computedWfhSeconds: computed.wfhSeconds,
          computedDutySeconds: computed.dutySeconds,
          officeHHMM: computed.officeHHMM,
          wfhHHMM: computed.wfhHHMM,
          dutyHHMM: computed.dutyHHMM,
        };
      });

      presenceNow = await getUserPresenceNow(
        prisma,
        currentUser.id,
        getTimeZoneNow()
      );
    }
  }

  return (
    <AttendanceDashboard
      initialAttendance={attendance}
      initialPresenceNow={presenceNow}
      users={users}
      currentUser={currentUser}
      isLeader={isLeader}
      initialRange={{
        preset: "today",
        from: todayPST,
        to: todayPST,
      }}
    />
  );
}
