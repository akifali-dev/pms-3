export const MANUAL_LOG_TIME_ZONE = "Asia/Karachi";

const DATE_KEY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

export function parseDateKey(value) {
  if (typeof value !== "string") {
    return null;
  }
  const match = value.trim().match(DATE_KEY_PATTERN);
  if (!match) {
    return null;
  }
  const year = Number.parseInt(match[1], 10);
  const month = Number.parseInt(match[2], 10);
  const day = Number.parseInt(match[3], 10);
  if (
    Number.isNaN(year) ||
    Number.isNaN(month) ||
    Number.isNaN(day) ||
    month < 1 ||
    month > 12 ||
    day < 1 ||
    day > 31
  ) {
    return null;
  }
  return { year, month, day };
}

function getTimeZoneParts(date, timeZone) {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
  const parts = formatter.formatToParts(date);
  return parts.reduce((acc, part) => {
    if (part.type !== "literal") {
      acc[part.type] = part.value;
    }
    return acc;
  }, {});
}

function getTimeZoneOffset(date, timeZone) {
  const parts = getTimeZoneParts(date, timeZone);
  if (!parts?.year || !parts?.month || !parts?.day) {
    return 0;
  }
  const asUtc = Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    Number(parts.hour ?? 0),
    Number(parts.minute ?? 0),
    Number(parts.second ?? 0)
  );
  return asUtc - date.getTime();
}

function normalizeMeridiem(meridiem) {
  if (!meridiem) {
    return null;
  }
  const value = meridiem.trim().toUpperCase();
  if (value === "AM" || value === "A.M.") {
    return "AM";
  }
  if (value === "PM" || value === "P.M.") {
    return "PM";
  }
  return null;
}

export function parseTimeInput(value) {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  const meridiemMatch = trimmed.match(/^(\d{1,2}):(\d{2})(?:\s*([aApP]\.?[mM]\.?)|\s*([aApP][mM]))$/i);
  if (meridiemMatch) {
    const baseHours = Number.parseInt(meridiemMatch[1], 10);
    const minutes = Number.parseInt(meridiemMatch[2], 10);
    const meridiem = normalizeMeridiem(meridiemMatch[3] ?? meridiemMatch[4]);
    if (
      Number.isNaN(baseHours) ||
      Number.isNaN(minutes) ||
      !meridiem ||
      baseHours < 1 ||
      baseHours > 12 ||
      minutes < 0 ||
      minutes > 59
    ) {
      return null;
    }
    const hours = (baseHours % 12) + (meridiem === "PM" ? 12 : 0);
    return { hours, minutes, seconds: 0, milliseconds: 0 };
  }

  const twentyFourHourMatch = trimmed.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
  if (!twentyFourHourMatch) {
    return null;
  }
  const hours = Number.parseInt(twentyFourHourMatch[1], 10);
  const minutes = Number.parseInt(twentyFourHourMatch[2], 10);
  const seconds = twentyFourHourMatch[3]
    ? Number.parseInt(twentyFourHourMatch[3], 10)
    : 0;
  if (
    Number.isNaN(hours) ||
    Number.isNaN(minutes) ||
    Number.isNaN(seconds) ||
    hours < 0 ||
    hours > 23 ||
    minutes < 0 ||
    minutes > 59 ||
    seconds < 0 ||
    seconds > 59
  ) {
    return null;
  }
  return { hours, minutes, seconds, milliseconds: 0 };
}

export function normalizeTimeString(value) {
  const parts = parseTimeInput(value);
  if (!parts) {
    return null;
  }
  return `${String(parts.hours).padStart(2, "0")}:${String(parts.minutes).padStart(2, "0")}`;
}

export function toDateKeyInTZ(value, tz = MANUAL_LOG_TIME_ZONE) {
  if (!value) {
    return null;
  }
  if (typeof value === "string") {
    const parsed = parseDateKey(value);
    if (parsed) {
      return `${String(parsed.year).padStart(4, "0")}-${String(parsed.month).padStart(2, "0")}-${String(parsed.day).padStart(2, "0")}`;
    }
  }
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }
  const parts = getTimeZoneParts(date, tz);
  if (!parts?.year || !parts?.month || !parts?.day) {
    return null;
  }
  return `${parts.year}-${parts.month}-${parts.day}`;
}

export function makeZonedDateTime({ dateKey, timeStr, tz = MANUAL_LOG_TIME_ZONE }) {
  const dateParts = parseDateKey(dateKey);
  const timeParts = parseTimeInput(timeStr);
  if (!dateParts || !timeParts) {
    return null;
  }
  const utcGuess = new Date(
    Date.UTC(
      dateParts.year,
      dateParts.month - 1,
      dateParts.day,
      timeParts.hours,
      timeParts.minutes,
      timeParts.seconds,
      timeParts.milliseconds
    )
  );
  const offset = getTimeZoneOffset(utcGuess, tz);
  return new Date(utcGuess.getTime() - offset);
}

export function formatTimeInTZ(value, tz = MANUAL_LOG_TIME_ZONE) {
  if (!value) {
    return null;
  }
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }
  const parts = getTimeZoneParts(date, tz);
  if (!parts?.hour || !parts?.minute) {
    return null;
  }
  return `${parts.hour}:${parts.minute}`;
}
