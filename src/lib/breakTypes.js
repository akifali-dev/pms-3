export const BREAK_TYPES = ["NAMAZ", "LUNCH", "DINNER", "REFRESHMENT", "OTHER"];

const BREAK_TYPE_SET = new Set(BREAK_TYPES);

export const BREAK_TYPE_LABELS = {
  NAMAZ: "Namaz",
  LUNCH: "Lunch",
  DINNER: "Dinner",
  REFRESHMENT: "Refreshment",
  OTHER: "Other",
};

function normalizeLegacyBreakType(value) {
  const upper = value?.toString?.().trim().toUpperCase();
  if (!upper) {
    return null;
  }
  if (upper === "MEAL") {
    return "DINNER";
  }
  return BREAK_TYPE_SET.has(upper) ? upper : null;
}

export function normalizeBreakTypes(value, fallback = null) {
  const source = Array.isArray(value) ? value : value ? [value] : [];
  const normalized = source
    .map((entry) => normalizeLegacyBreakType(entry))
    .filter(Boolean);

  if (normalized.length > 0) {
    return [...new Set(normalized)];
  }

  const fallbackType = normalizeLegacyBreakType(fallback);
  return fallbackType ? [fallbackType] : [];
}

export function formatBreakTypes(value, fallback = null) {
  const types = normalizeBreakTypes(value, fallback);
  if (!types.length) {
    return BREAK_TYPE_LABELS.OTHER;
  }
  return types.map((type) => BREAK_TYPE_LABELS[type] ?? BREAK_TYPE_LABELS.OTHER).join(" & ");
}

export function breakTypesIncludeOther(value, fallback = null) {
  return normalizeBreakTypes(value, fallback).includes("OTHER");
}
