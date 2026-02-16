import { zonedTimeToUtc } from "@/lib/attendanceTimes";
import {
  getTodayKey,
  isDateKeyInRange,
  shiftDateKey,
  toDateKey,
} from "@/lib/dateKeys";
import { PST_TIME_ZONE } from "@/lib/pstDate";

export const MANUAL_LOG_CATEGORIES = ["LEARNING", "RESEARCH", "OTHER"];

export function normalizeManualCategories(value) {
  if (!Array.isArray(value)) {
    return null;
  }
  const normalized = value
    .map((entry) => entry?.toString?.().trim().toUpperCase())
    .filter(Boolean);
  const unique = Array.from(new Set(normalized));
  if (unique.length === 0) {
    return null;
  }
  const allValid = unique.every((category) =>
    MANUAL_LOG_CATEGORIES.includes(category)
  );
  if (!allValid) {
    return null;
  }
  return unique;
}

function normalizeManualDate(value, timeZone = PST_TIME_ZONE) {
  return toDateKey(value, timeZone);
}

export function getManualLogDateBounds(
  baseDate = new Date(),
  timeZone = PST_TIME_ZONE
) {
  const max = getTodayKey(timeZone, baseDate);
  if (!max) {
    return { min: null, max: null };
  }
  const min = shiftDateKey(max, -2);
  return { min, max };
}

export function isManualLogDateAllowed(
  date,
  baseDate = new Date(),
  timeZone = PST_TIME_ZONE
) {
  const normalized = normalizeManualDate(date, timeZone);
  if (!normalized) {
    return false;
  }
  const { min, max } = getManualLogDateBounds(baseDate, timeZone);
  return isDateKeyInRange(normalized, min, max);
}

export function isManualLogInFuture(
  { date, startTime, endTime },
  baseDate = new Date(),
  timeZone = PST_TIME_ZONE
) {
  const normalized = normalizeManualDate(date, timeZone);
  if (!normalized) {
    return false;
  }
  const today = getTodayKey(timeZone, baseDate);
  if (!today) {
    return false;
  }
  if (normalized > today) {
    return true;
  }
  if (normalized < today) {
    return false;
  }
  const now = baseDate instanceof Date ? baseDate : new Date(baseDate);
  const startAt = startTime
    ? zonedTimeToUtc({ date: normalized, time: startTime, timeZone })
    : null;
  const endAt = endTime
    ? zonedTimeToUtc({ date: normalized, time: endTime, timeZone })
    : null;
  if (startAt && startAt > now) {
    return true;
  }
  if (endAt && endAt > now) {
    return true;
  }
  return false;
}

export function buildManualLogDate(dateValue, timeZone = PST_TIME_ZONE) {
  const normalized = normalizeManualDate(dateValue, timeZone);
  if (!normalized) {
    return null;
  }
  return zonedTimeToUtc({
    date: normalized,
    time: "00:00",
    timeZone,
  });
}

export function buildManualLogTimes({ date, startTime, endTime }) {
  const normalized = normalizeManualDate(date);
  if (!normalized) {
    return { error: "Date must be valid." };
  }
  if (!startTime) {
    return { error: "Start time is required." };
  }
  const startAt = zonedTimeToUtc({
    date: normalized,
    time: startTime,
    timeZone: PST_TIME_ZONE,
  });
  if (!startAt) {
    return { error: "Start time is required." };
  }
  if (!endTime) {
    return { startAt, endAt: null, durationSeconds: 0 };
  }
  const endAt = zonedTimeToUtc({
    date: normalized,
    time: endTime,
    timeZone: PST_TIME_ZONE,
  });
  if (!endAt) {
    return { error: "End time must be valid." };
  }
  if (endAt <= startAt) {
    return { error: "End time must be after start time." };
  }
  const durationSeconds = Math.max(
    0,
    Math.floor((endAt.getTime() - startAt.getTime()) / 1000)
  );
  return { startAt, endAt, durationSeconds };
}
