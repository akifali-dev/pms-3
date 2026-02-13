import { prisma } from "@/lib/prisma";
import { getTimeZoneNow } from "@/lib/attendanceTimes";
import {
  buildSuccess,
  ensureAuthenticated,
  getAuthContext,
} from "@/lib/api";
import {
  normalizeAutoOffForUser,
  resolveAttendanceOutTime,
} from "@/lib/attendanceAutoOff";
import { getDutyDate } from "@/lib/dutyHours";

function toIso(value) {
  if (!value) {
    return null;
  }
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }
  return date.toISOString();
}

export async function GET() {
  const context = await getAuthContext();
  const authError = ensureAuthenticated(context);
  if (authError) {
    return authError;
  }

  const now = getTimeZoneNow();
  await normalizeAutoOffForUser(prisma, context.user.id, now);

  const dutyDate = getDutyDate(now);
  const dutyDateValue = dutyDate ? new Date(dutyDate) : null;

  const attendance = dutyDateValue
    ? await prisma.attendance.findFirst({
        where: {
          userId: context.user.id,
          date: dutyDateValue,
        },
        select: {
          inTime: true,
          outTime: true,
          autoOff: true,
        },
      })
    : null;

  if (!attendance?.inTime) {
    return buildSuccess("Attendance status loaded.", {
      onDuty: false,
      autoOff: false,
      dutyStartAt: null,
      dutyEndAt: null,
    });
  }

  const resolvedOutTime = resolveAttendanceOutTime(attendance, now);
  const resolvedOutMs = resolvedOutTime?.getTime();
  const nowMs = now.getTime();

  const autoOff = Boolean(attendance.autoOff);
  const hasOutTime = Boolean(attendance.outTime);
  const outElapsed =
    Number.isFinite(nowMs) && Number.isFinite(resolvedOutMs)
      ? nowMs > resolvedOutMs
      : false;

  const onDuty = !autoOff && !hasOutTime && !outElapsed;

  return buildSuccess("Attendance status loaded.", {
    onDuty,
    autoOff,
    dutyStartAt: toIso(attendance.inTime),
    dutyEndAt: onDuty ? null : toIso(resolvedOutTime),
  });
}
