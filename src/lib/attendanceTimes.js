function formatDateInput(value) {
  if (!value) {
    return null;
  }
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }
  return date.toISOString().slice(0, 10);
}

function parseTimeString(value) {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  const match = trimmed.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
  if (!match) {
    return null;
  }
  const hours = Number.parseInt(match[1], 10);
  const minutes = Number.parseInt(match[2], 10);
  const seconds = match[3] ? Number.parseInt(match[3], 10) : 0;
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

function extractTimeParts(value) {
  if (!value) {
    return null;
  }
  const parsedTime = parseTimeString(value);
  if (parsedTime) {
    return parsedTime;
  }
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }
  return {
    hours: date.getHours(),
    minutes: date.getMinutes(),
    seconds: date.getSeconds(),
    milliseconds: date.getMilliseconds(),
  };
}

export function combineDateAndTime(dateValue, timeValue) {
  const dateString = formatDateInput(dateValue);
  const timeParts = extractTimeParts(timeValue);
  if (!dateString || !timeParts) {
    return null;
  }
  const base = new Date(`${dateString}T00:00:00`);
  if (Number.isNaN(base.getTime())) {
    return null;
  }
  base.setHours(
    timeParts.hours,
    timeParts.minutes,
    timeParts.seconds,
    timeParts.milliseconds
  );
  return base;
}

export function normalizeAttendanceTimes({ shiftDate, inTime, outTime }) {
  const inAt = inTime ? combineDateAndTime(shiftDate, inTime) : null;
  let outAt = outTime ? combineDateAndTime(shiftDate, outTime) : null;
  if (inAt && outAt && outAt <= inAt) {
    outAt = new Date(outAt);
    outAt.setDate(outAt.getDate() + 1);
  }
  return { inAt, outAt };
}

export function normalizeWfhInterval({ shiftDate, startTime, endTime }) {
  const startAt = startTime ? combineDateAndTime(shiftDate, startTime) : null;
  let endAt = endTime ? combineDateAndTime(shiftDate, endTime) : null;
  if (startAt && endAt && endAt <= startAt) {
    endAt = new Date(endAt);
    endAt.setDate(endAt.getDate() + 1);
  }
  return { startAt, endAt };
}

export const DEFAULT_TIME_ZONE = "Asia/Karachi";

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
  const lookup = parts.reduce((acc, part) => {
    if (part.type !== "literal") {
      acc[part.type] = part.value;
    }
    return acc;
  }, {});
  if (!lookup.year || !lookup.month || !lookup.day) {
    return null;
  }
  return lookup;
}

export function getTimeZoneNow(timeZone = DEFAULT_TIME_ZONE) {
  const now = new Date();
  const parts = getTimeZoneParts(now, timeZone);
  if (!parts) {
    return now;
  }
  return new Date(
    `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}:${parts.second}`
  );
}
