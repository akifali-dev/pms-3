import {
  DEFAULT_TIME_ZONE,
  parseDateInput,
  zonedTimeToUtc,
} from "@/lib/attendanceTimes";
import { getDutyDate } from "@/lib/dutyHours";

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

function formatDateParts(parts) {
  if (!parts) {
    return null;
  }
  const year = String(parts.year).padStart(4, "0");
  const month = String(parts.month).padStart(2, "0");
  const day = String(parts.day).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function normalizeManualDate(value, timeZone = DEFAULT_TIME_ZONE) {
  const parts = parseDateInput(value, timeZone);
  if (!parts) {
    return null;
  }
  return formatDateParts(parts);
}

function addDaysToDateString(dateString, days) {
  const match = dateString.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) {
    return null;
  }
  const base = new Date(
    Date.UTC(
      Number(match[1]),
      Number(match[2]) - 1,
      Number(match[3])
    )
  );
  base.setUTCDate(base.getUTCDate() + days);
  return base.toISOString().slice(0, 10);
}

export function getManualLogDateBounds(
  baseDate = new Date(),
  timeZone = DEFAULT_TIME_ZONE
) {
  const dutyDate = getDutyDate(baseDate, timeZone);
  const max = normalizeManualDate(dutyDate ?? baseDate, timeZone);
  if (!max) {
    return { min: null, max: null };
  }
  const min = addDaysToDateString(max, -2);
  return { min, max };
}

export function isManualLogDateAllowed(
  date,
  baseDate = new Date(),
  timeZone = DEFAULT_TIME_ZONE
) {
  const normalized = normalizeManualDate(date, timeZone);
  if (!normalized) {
    return false;
  }
  const { min, max } = getManualLogDateBounds(baseDate, timeZone);
  if (!min || !max) {
    return false;
  }
  return normalized >= min && normalized <= max;
}

export function isManualLogInFuture(
  { date, startTime, endTime },
  baseDate = new Date(),
  timeZone = DEFAULT_TIME_ZONE
) {
  const normalized = normalizeManualDate(date, timeZone);
  if (!normalized) {
    return false;
  }
  const dutyDate = getDutyDate(baseDate, timeZone);
  const today = normalizeManualDate(dutyDate ?? baseDate, timeZone);
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

export function buildManualLogDate(dateValue, timeZone = DEFAULT_TIME_ZONE) {
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
  const startAt = zonedTimeToUtc({
    date: normalized,
    time: startTime,
    timeZone: DEFAULT_TIME_ZONE,
  });
  const endAt = zonedTimeToUtc({
    date: normalized,
    time: endTime,
    timeZone: DEFAULT_TIME_ZONE,
  });
  if (!startAt || !endAt) {
    return { error: "Start and end time are required." };
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
