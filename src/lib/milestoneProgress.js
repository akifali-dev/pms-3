const DAY_MS = 1000 * 60 * 60 * 24;
const MILESTONE_TIMEZONE = "Asia/Karachi";
const DEFAULT_DAILY_WORK_HOURS = 7;

const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

const normalizeDate = (value) => {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    const fallback = new Date(`${value}T00:00:00`);
    if (Number.isNaN(fallback.getTime())) return null;
    return new Date(
      fallback.getFullYear(),
      fallback.getMonth(),
      fallback.getDate()
    );
  }

  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
};

const normalizeDateInTimeZone = (value, timeZone = MILESTONE_TIMEZONE) => {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }

  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const parts = formatter.formatToParts(date);
  const year = Number(parts.find((part) => part.type === "year")?.value);
  const month = Number(parts.find((part) => part.type === "month")?.value);
  const day = Number(parts.find((part) => part.type === "day")?.value);

  if (!year || !month || !day) {
    return null;
  }

  return new Date(Date.UTC(year, month - 1, day));
};

const formatDayLabel = (days) => `${days} day${days === 1 ? "" : "s"}`;

export const getTaskEstimatedMinutes = (task) => {
  const estimatedMinutes = Number(task?.estimatedMinutes);
  if (Number.isFinite(estimatedMinutes) && estimatedMinutes > 0) {
    return estimatedMinutes;
  }

  const estimatedHours = Number(task?.estimatedHours ?? 0);
  if (Number.isFinite(estimatedHours) && estimatedHours > 0) {
    return estimatedHours * 60;
  }

  return 0;
};

export const getMilestoneStatus = (
  startDate,
  endDate,
  now = new Date(),
  timeZone = MILESTONE_TIMEZONE
) => {
  const start = normalizeDateInTimeZone(startDate, timeZone);
  const end = normalizeDateInTimeZone(endDate, timeZone);
  const today = normalizeDateInTimeZone(now, timeZone);

  if (!start || !end || !today) {
    return {
      state: "unscheduled",
      statusText: "Add start and end dates",
      daysUntilStart: 0,
      daysRemaining: 0,
      overdueDays: 0,
    };
  }

  const daysUntilStart = Math.max(0, Math.floor((start - today) / DAY_MS));
  const daysRemaining = Math.max(0, Math.floor((end - today) / DAY_MS));
  const overdueDays = Math.max(0, Math.floor((today - end) / DAY_MS));

  if (today < start) {
    return {
      state: "upcoming",
      statusText: `Starts in ${formatDayLabel(daysUntilStart)}`,
      daysUntilStart,
      daysRemaining,
      overdueDays: 0,
    };
  }

  if (today > end) {
    return {
      state: "overdue",
      statusText: "Deadline over",
      daysUntilStart: 0,
      daysRemaining: 0,
      overdueDays,
    };
  }

  return {
    state: "active",
    statusText: `${formatDayLabel(daysRemaining)} remaining`,
    daysUntilStart: 0,
    daysRemaining,
    overdueDays: 0,
  };
};

export const getMilestoneCapacity = ({
  startDate,
  endDate,
  plannedMinutes = 0,
  dailyWorkHours = DEFAULT_DAILY_WORK_HOURS,
  timeZone = MILESTONE_TIMEZONE,
}) => {
  const start = normalizeDateInTimeZone(startDate, timeZone);
  const end = normalizeDateInTimeZone(endDate, timeZone);
  const totalDays =
    start && end ? Math.max(0, Math.floor((end - start) / DAY_MS) + 1) : 0;
  const capacityHours = totalDays * dailyWorkHours;
  const plannedHours = Math.max(0, plannedMinutes / 60);
  const remainingHours = capacityHours - plannedHours;
  const overbooked = remainingHours < 0;
  const fillPercent =
    capacityHours > 0 ? Math.min(100, (plannedHours / capacityHours) * 100) : 0;

  return {
    totalDays,
    capacityHours,
    plannedHours,
    remainingHours,
    overbooked,
    fillPercent,
  };
};

export const formatMilestoneDate = (value, timeZone = MILESTONE_TIMEZONE) => {
  const date = normalizeDateInTimeZone(value, timeZone);
  if (!date) return "";
  return date.toISOString().split("T")[0];
};

export const getMilestoneProgress = (startDate, endDate, now = new Date()) => {
  const start = normalizeDate(startDate);
  const end = normalizeDate(endDate);
  const today = normalizeDate(now) ?? new Date();

  if (!start || !end) {
    return {
      totalDuration: 0,
      elapsedDays: 0,
      remainingDays: 0,
      elapsedPercentage: 0,
      remainingPercentage: 100,
    };
  }

  const totalDuration = Math.max(0, Math.floor((end - start) / DAY_MS));
  const elapsedDays = Math.max(0, Math.floor((today - start) / DAY_MS));
  const remainingDays = Math.max(0, Math.floor((end - today) / DAY_MS));

  const elapsedPercentage = clamp(
    totalDuration > 0
      ? (elapsedDays / totalDuration) * 100
      : remainingDays === 0
        ? 100
        : 0,
    0,
    100
  );
  const remainingPercentage = clamp(100 - elapsedPercentage, 0, 100);

  return {
    totalDuration,
    elapsedDays,
    remainingDays,
    elapsedPercentage,
    remainingPercentage,
  };
};
