import { getAuthContext, ensureAuthenticated, ensureRole, ALL_ROLES, buildError } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { APP_DATE_TIME_ZONE } from "@/lib/dateKeys";
import { getTodayInPSTDateString } from "@/lib/pstDate";
import { shiftDateKey } from "@/lib/dateKeys";
import { zonedTimeToUtc } from "@/lib/attendanceTimes";

const RANGE_OPTIONS = new Set(["daily", "weekly", "monthly"]);
const LEADERSHIP_ROLES = new Set(["CEO", "PM", "CTO"]);

function getRangeWindow(range) {
  const todayKey = getTodayInPSTDateString();
  const endDateKey = todayKey;
  const startDateKey =
    range === "monthly"
      ? shiftDateKey(todayKey, -29)
      : range === "weekly"
      ? shiftDateKey(todayKey, -6)
      : todayKey;

  const startAt = zonedTimeToUtc({
    date: startDateKey,
    time: "00:00:00",
    timeZone: APP_DATE_TIME_ZONE,
  });
  const endExclusive = zonedTimeToUtc({
    date: shiftDateKey(endDateKey, 1),
    time: "00:00:00",
    timeZone: APP_DATE_TIME_ZONE,
  });

  return {
    startAt,
    endExclusive,
    startDateKey,
    endDateKey,
  };
}

export async function GET(request) {
  const context = await getAuthContext();
  const authError = ensureAuthenticated(context);
  if (authError) {
    return authError;
  }

  const roleError = ensureRole(context.role, ALL_ROLES);
  if (roleError) {
    return roleError;
  }

  const { searchParams } = new URL(request.url);
  const requestedRange = searchParams.get("range")?.toLowerCase() ?? "daily";
  if (!RANGE_OPTIONS.has(requestedRange)) {
    return buildError("Invalid range. Use daily, weekly, or monthly.", 400);
  }

  const requestedUserId = searchParams.get("userId")?.trim() || null;
  const isLeadership = LEADERSHIP_ROLES.has(context.role);

  if (!isLeadership && requestedUserId && requestedUserId !== context.user.id) {
    return buildError("You can only view your own dashboard stats.", 403);
  }

  const scopedUserId = isLeadership ? requestedUserId : context.user.id;
  const ownerFilter = scopedUserId ? { ownerId: scopedUserId } : {};

  const window = getRangeWindow(requestedRange);

  const [doneTransitions, rejectedTransitions, periodTasks, blockedTasks] =
    await Promise.all([
      prisma.taskStatusHistory.findMany({
        where: {
          toStatus: "DONE",
          changedAt: { gte: window.startAt, lt: window.endExclusive },
          ...(scopedUserId ? { task: { ownerId: scopedUserId } } : {}),
        },
        select: { taskId: true },
      }),
      prisma.taskStatusHistory.count({
        where: {
          toStatus: "REJECTED",
          changedAt: { gte: window.startAt, lt: window.endExclusive },
          ...(scopedUserId ? { task: { ownerId: scopedUserId } } : {}),
        },
      }),
      prisma.task.findMany({
        where: {
          ...ownerFilter,
          updatedAt: { gte: window.startAt, lt: window.endExclusive },
        },
        select: {
          id: true,
          estimatedHours: true,
          totalTimeSpent: true,
        },
      }),
      prisma.task.count({
        where: {
          ...ownerFilter,
          status: "BLOCKED",
        },
      }),
    ]);

  const completedTasks = new Set(doneTransitions.map((entry) => entry.taskId)).size;
  const estimatedSeconds = periodTasks.reduce((sum, task) => {
    const estimated = Number(task.estimatedHours ?? 0);
    return sum + (Number.isFinite(estimated) && estimated > 0 ? Math.round(estimated * 3600) : 0);
  }, 0);
  const spentSeconds = periodTasks.reduce((sum, task) => {
    const spent = Number(task.totalTimeSpent ?? 0);
    return sum + (Number.isFinite(spent) && spent > 0 ? spent : 0);
  }, 0);

  return Response.json({
    ok: true,
    range: requestedRange,
    userId: scopedUserId,
    completedTasks,
    blockedTasks,
    reworkCount: rejectedTransitions,
    time: {
      estimatedSeconds,
      spentSeconds,
      varianceSeconds: spentSeconds - estimatedSeconds,
    },
    periodWindow: {
      startDate: window.startDateKey,
      endDate: window.endDateKey,
      timeZone: APP_DATE_TIME_ZONE,
    },
  });
}
