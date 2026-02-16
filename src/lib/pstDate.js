export const PST_TIME_ZONE = "America/Los_Angeles";

function getDatePartsInTimeZone(value, timeZone) {
  const baseDate = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(baseDate.getTime())) {
    return null;
  }

  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });

  const parts = formatter.formatToParts(baseDate);
  const partLookup = parts.reduce((acc, part) => {
    if (part.type !== "literal") {
      acc[part.type] = part.value;
    }
    return acc;
  }, {});

  if (!partLookup.year || !partLookup.month || !partLookup.day) {
    return null;
  }

  return partLookup;
}

export function getTodayInPSTDateString(baseDate = new Date()) {
  const parts = getDatePartsInTimeZone(baseDate, PST_TIME_ZONE);
  if (!parts) {
    return "";
  }
  return `${parts.year}-${parts.month}-${parts.day}`;
}

export function formatDateInPSTDateString(value) {
  const parts = getDatePartsInTimeZone(value, PST_TIME_ZONE);
  if (!parts) {
    return "";
  }
  return `${parts.year}-${parts.month}-${parts.day}`;
}

export function shiftDateStringByDays(dateString, days) {
  const match = dateString?.match?.(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) {
    return "";
  }

  const shiftedDate = new Date(
    Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]))
  );
  shiftedDate.setUTCDate(shiftedDate.getUTCDate() + Number(days || 0));
  return shiftedDate.toISOString().slice(0, 10);
}
