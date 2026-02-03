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
  buildDailyUserTimeline,
  getUserDailyTimeline,
} from "@/lib/analytics/timeline";
import { getShiftWindow } from "@/lib/dutyHours";

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

function finalizeTotals(rawTotals) {
  const dutySeconds = rawTotals?.dutySeconds ?? 0;
  const workSeconds = rawTotals?.workSeconds ?? 0;
  const breakSeconds = rawTotals?.breakSeconds ?? 0;
  const wfhSeconds = rawTotals?.wfhSeconds ?? 0;
  const noDutySeconds = rawTotals?.noDutySeconds ?? 0;
  const idleSeconds = Math.max(0, dutySeconds - workSeconds - breakSeconds);
  const utilization =
    dutySeconds > 0 ? Number((workSeconds / dutySeconds).toFixed(3)) : 0;
  return {
    dutySeconds,
    workSeconds,
    breakSeconds,
    idleSeconds,
    wfhSeconds,
    noDutySeconds,
    utilization,
  };
}

function accumulateTotals(acc, totals) {
  return {
    dutySeconds: acc.dutySeconds + (totals?.dutySeconds ?? 0),
    workSeconds: acc.workSeconds + (totals?.workSeconds ?? 0),
    breakSeconds: acc.breakSeconds + (totals?.breakSeconds ?? 0),
    wfhSeconds: acc.wfhSeconds + (totals?.wfhSeconds ?? 0),
    noDutySeconds: acc.noDutySeconds + (totals?.noDutySeconds ?? 0),
  };
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

  const mode = !targetUserId && isManager ? "all" : "single";
  const now = new Date();

  if (period === "daily") {
    const dayWindow = getShiftWindow(baseDate);
    const results = await Promise.all(
      users.map(async (user) => {
        const timeline = await buildDailyUserTimeline(prisma, user.id, baseDate, now);
        const totals = finalizeTotals(timeline.totals);
        const entry = { user, totals };
        if (mode === "single") {
          entry.segments = timeline.segments ?? [];
          entry.dutyWindows = timeline.dutyWindows ?? [];
          entry.wfhWindows = timeline.wfhWindows ?? [];
          entry.details = timeline.details ?? {};
          entry.message = timeline.message ?? null;
          entry.dayWindowStart = timeline.dayWindow?.start?.toISOString?.() ?? null;
          entry.dayWindowEnd = timeline.dayWindow?.end?.toISOString?.() ?? null;
        }
        return entry;
      })
    );

    const teamTotals = finalizeTotals(
      results.reduce(
        (acc, entry) => accumulateTotals(acc, entry.totals),
        {
          dutySeconds: 0,
          workSeconds: 0,
          breakSeconds: 0,
          wfhSeconds: 0,
          noDutySeconds: 0,
        }
      )
    );

    return buildSuccess("Analytics loaded.", {
      period,
      dayWindowStart: dayWindow?.start?.toISOString?.() ?? null,
      dayWindowEnd: dayWindow?.end?.toISOString?.() ?? null,
      range: dayWindow
        ? { start: dayWindow.start.toISOString(), end: dayWindow.end.toISOString() }
        : null,
      mode,
      users: results,
      teamTotals,
      teamPerDay: [],
      perDayTotals: [],
    });
  }

  const rangeStart = getPeriodStart(baseDate, period);
  const rangeEnd = getPeriodEnd(rangeStart, period);
  const dates = buildDateList(rangeStart, rangeEnd);

  const results = await Promise.all(
    users.map(async (user) => {
      const perDay = await Promise.all(
        dates.map(async (day) => {
          const timeline = await getUserDailyTimeline(prisma, user.id, day, now);
          return {
            date: day.toISOString(),
            totals: finalizeTotals(timeline.totals),
          };
        })
      );

      const totals = finalizeTotals(
        perDay.reduce(
          (acc, entry) => accumulateTotals(acc, entry.totals),
          { dutySeconds: 0, workSeconds: 0, breakSeconds: 0, wfhSeconds: 0 }
        )
      );

      return {
        user,
        totals,
        perDay,
        perDayTotals: perDay,
      };
    })
  );

  const teamPerDay = dates.map((day, index) => {
    const totals = finalizeTotals(
      results.reduce(
        (acc, entry) => accumulateTotals(acc, entry.perDay[index]?.totals),
        {
          dutySeconds: 0,
          workSeconds: 0,
          breakSeconds: 0,
          wfhSeconds: 0,
          noDutySeconds: 0,
        }
      )
    );
    return { date: day.toISOString(), totals };
  });

  const teamTotals = finalizeTotals(
    results.reduce(
      (acc, entry) => accumulateTotals(acc, entry.totals),
      {
        dutySeconds: 0,
        workSeconds: 0,
        breakSeconds: 0,
        wfhSeconds: 0,
        noDutySeconds: 0,
      }
    )
  );

  return buildSuccess("Analytics loaded.", {
    period,
    range: { start: rangeStart.toISOString(), end: rangeEnd.toISOString() },
    mode,
    users: results,
    teamTotals,
    teamPerDay,
    perDayTotals: teamPerDay,
  });
}
