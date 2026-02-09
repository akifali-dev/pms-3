import { prisma } from "@/lib/prisma";
import { buildError, buildSuccess, ensureAuthenticated, getAuthContext } from "@/lib/api";
import { buildDailyTimeline } from "@/lib/analytics/dailyTimeline";
import { getDutyDate } from "@/lib/dutyHours";

const MANAGEMENT_ROLES = new Set(["CEO", "PM", "CTO"]);

function parseDateParam(value) {
  if (!value) {
    return null;
  }
  return value;
}

export async function GET(request) {
  const context = await getAuthContext();
  const authError = ensureAuthenticated(context);
  if (authError) {
    return authError;
  }

  const url = new URL(request.url);
  const dateParam = parseDateParam(url.searchParams.get("date"));
  const targetUserId = url.searchParams.get("userId");
  const viewerRole = context.role;
  const isManager = MANAGEMENT_ROLES.has(viewerRole);

  if (targetUserId && !isManager && targetUserId !== context.user.id) {
    return buildError("You do not have permission to view this user.", 403);
  }

  const timeline = await buildDailyTimeline({
    prismaClient: prisma,
    date: dateParam ?? getDutyDate(new Date()),
    viewerUserId: context.user.id,
    viewerRole,
    targetUserId: isManager ? targetUserId : null,
  });

  return buildSuccess("Daily timeline loaded.", timeline);
}
