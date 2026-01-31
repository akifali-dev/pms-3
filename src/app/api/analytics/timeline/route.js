import { prisma } from "@/lib/prisma";
import {
  buildError,
  buildSuccess,
  ensureAuthenticated,
  getAuthContext,
} from "@/lib/api";
import {
  buildDateList,
  getPeriodEnd,
  getPeriodStart,
  getUserDailyTimeline,
} from "@/lib/analytics/timeline";

const MANAGEMENT_ROLES = ["CEO", "PM", "CTO"];

function parseDateParam(value) {
  if (!value) {
    return new Date();
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return new Date();
  }
  return parsed;
}

function normalizePeriod(value) {
  if (value === "weekly" || value === "monthly") {
    return value;
  }
  return "daily";
}

export async function GET(request) {
  const context = await getAuthContext();
  const authError = ensureAuthenticated(context);
  if (authError) {
    return authError;
  }

  const url = new URL(request.url);
  const period = normalizePeriod(url.searchParams.get("period"));
  const dateParam = url.searchParams.get("date");
  const targetUserId = url.searchParams.get("userId");
  const baseDate = parseDateParam(dateParam);

  const isManager = MANAGEMENT_ROLES.includes(context.role);

  if (targetUserId && !isManager && targetUserId !== context.user.id) {
    return buildError("You do not have permission to view this user.", 403);
  }

  let users = [];
  if (targetUserId) {
    const user = await prisma.user.findUnique({
      where: { id: targetUserId },
      select: { id: true, name: true, email: true, role: true },
    });
    if (!user) {
      return buildError("User not found.", 404);
    }
    users = [user];
  } else if (isManager) {
    users = await prisma.user.findMany({
      where: { isActive: true },
      select: { id: true, name: true, email: true, role: true },
      orderBy: { name: "asc" },
    });
  } else {
    users = [
      {
        id: context.user.id,
        name: context.user.name,
        email: context.user.email,
        role: context.user.role,
      },
    ];
  }

  if (period === "daily") {
    const results = await Promise.all(
      users.map(async (user) => {
        const timeline = await getUserDailyTimeline(prisma, user.id, baseDate);
        return { user, timeline };
      })
    );
    return buildSuccess("Timeline loaded.", {
      period,
      date: baseDate.toISOString(),
      users: results,
    });
  }

  const rangeStart = getPeriodStart(baseDate, period);
  const rangeEnd = getPeriodEnd(rangeStart, period);
  const dates = buildDateList(rangeStart, rangeEnd);

  const results = await Promise.all(
    users.map(async (user) => {
      const dailySummaries = await Promise.all(
        dates.map(async (day) => {
          const timeline = await getUserDailyTimeline(prisma, user.id, day);
          return {
            date: day.toISOString(),
            summary: timeline.summary,
          };
        })
      );

      const totals = dailySummaries.reduce(
        (acc, entry) => {
          acc.totalDutySeconds += entry.summary.totalDutySeconds;
          acc.workSeconds += entry.summary.workSeconds;
          acc.breakSeconds += entry.summary.breakSeconds;
          acc.idleSeconds += entry.summary.idleSeconds;
          return acc;
        },
        {
          totalDutySeconds: 0,
          workSeconds: 0,
          breakSeconds: 0,
          idleSeconds: 0,
        }
      );

      const utilization =
        totals.totalDutySeconds > 0
          ? Number((totals.workSeconds / totals.totalDutySeconds).toFixed(3))
          : 0;

      return {
        user,
        dailySummaries,
        totals: {
          ...totals,
          utilization,
        },
      };
    })
  );

  return buildSuccess("Timeline loaded.", {
    period,
    date: baseDate.toISOString(),
    range: { start: rangeStart.toISOString(), end: rangeEnd.toISOString() },
    users: results,
  });
}
