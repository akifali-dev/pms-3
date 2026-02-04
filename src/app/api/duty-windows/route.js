import { prisma } from "@/lib/prisma";
import {
  buildError,
  buildSuccess,
  ensureAuthenticated,
  getAuthContext,
  isAdminRole,
  isManagementRole,
} from "@/lib/api";
import { getDutyDate, getDutyWindows } from "@/lib/dutyHours";

export async function GET(request) {
  const context = await getAuthContext();
  const authError = ensureAuthenticated(context);
  if (authError) {
    return authError;
  }

  const { searchParams } = new URL(request.url);
  const userId = searchParams.get("userId") ?? context.user.id;
  const dateParam = searchParams.get("date");

  if (
    userId !== context.user.id &&
    !isManagementRole(context.role) &&
    !isAdminRole(context.role)
  ) {
    return buildError("You do not have permission to view duty windows.", 403);
  }

  const dutyDate = getDutyDate(new Date());
  const date = dateParam ? new Date(dateParam) : dutyDate ? new Date(dutyDate) : new Date();
  if (Number.isNaN(date.getTime())) {
    return buildError("Date must be valid.", 400);
  }

  const windows = await getDutyWindows(prisma, userId, date);

  return buildSuccess("Duty windows loaded.", {
    windows: windows.map((window) => ({
      start: window.start.toISOString(),
      end: window.end.toISOString(),
      source: window.source,
    })),
  });
}
