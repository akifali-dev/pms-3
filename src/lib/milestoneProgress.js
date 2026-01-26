const DAY_MS = 1000 * 60 * 60 * 24;

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

export const formatMilestoneDate = (value) => {
  const date = normalizeDate(value);
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
