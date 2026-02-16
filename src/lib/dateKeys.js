import { parseDateInput } from "@/lib/attendanceTimes";

export const APP_DATE_TIME_ZONE = "America/Los_Angeles";

const DATE_KEY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

function formatDateParts({ year, month, day }) {
  return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export function parseDateKey(dateKey) {
  if (typeof dateKey !== "string") {
    return null;
  }
  const match = dateKey.trim().match(DATE_KEY_PATTERN);
  if (!match) {
    return null;
  }
  return {
    year: Number(match[1]),
    month: Number(match[2]),
    day: Number(match[3]),
  };
}

export function toDateKey(value, timeZone = APP_DATE_TIME_ZONE) {
  if (!value) {
    return null;
  }
  const parts = parseDateInput(value, timeZone);
  if (!parts) {
    return null;
  }
  return formatDateParts(parts);
}

export function getTodayKey(timeZone = APP_DATE_TIME_ZONE, baseDate = new Date()) {
  return toDateKey(baseDate, timeZone);
}

export function compareDateKeys(aKey, bKey) {
  if (!aKey || !bKey) {
    return null;
  }
  if (aKey === bKey) {
    return 0;
  }
  return aKey > bKey ? 1 : -1;
}

export function shiftDateKey(dateKey, days) {
  const parts = parseDateKey(dateKey);
  if (!parts) {
    return null;
  }
  const shifted = new Date(Date.UTC(parts.year, parts.month - 1, parts.day));
  shifted.setUTCDate(shifted.getUTCDate() + Number(days || 0));
  return shifted.toISOString().slice(0, 10);
}

export function isDateKeyInRange(dateKey, minKey, maxKey) {
  if (!dateKey || !minKey || !maxKey) {
    return false;
  }
  return compareDateKeys(dateKey, minKey) >= 0 && compareDateKeys(dateKey, maxKey) <= 0;
}

export function dateKeyToUtcDate(dateKey) {
  const parts = parseDateKey(dateKey);
  if (!parts) {
    return null;
  }
  return new Date(Date.UTC(parts.year, parts.month - 1, parts.day));
}
