import { combineDateAndTime } from "@/lib/attendanceTimes";

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

export function getManualLogDateRangeUtc(baseDate = new Date()) {
  const start = new Date(baseDate);
  start.setUTCHours(0, 0, 0, 0);
  start.setUTCDate(start.getUTCDate() - 2);
  const end = new Date(baseDate);
  end.setUTCHours(23, 59, 59, 999);
  return { start, end };
}

export function isManualLogDateAllowed(date, baseDate = new Date()) {
  const parsed = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(parsed.getTime())) {
    return false;
  }
  const { start, end } = getManualLogDateRangeUtc(baseDate);
  return parsed >= start && parsed <= end;
}

export function buildManualLogTimes({ date, startTime, endTime }) {
  const startAt = combineDateAndTime(date, startTime);
  const endAt = combineDateAndTime(date, endTime);
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
