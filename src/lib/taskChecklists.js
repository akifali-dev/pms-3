export const TASK_TYPE_CHECKLISTS = {
  UI: [
    "Confirm responsive layout on key breakpoints",
    "Validate design tokens and spacing",
    "Review accessibility states (focus, hover)",
    "Verify copy and labels are final",
  ],
  AUTH: [
    "Confirm authentication flow works end-to-end",
    "Validate session handling and logout",
    "Check error messaging and lockout states",
    "Verify role-based access rules",
  ],
  API: [
    "Validate request/response contracts",
    "Add or update API tests",
    "Confirm error handling and status codes",
    "Review performance impact and logs",
  ],
  REFACTOR: [
    "Document impacted modules",
    "Confirm no functional regressions",
    "Run targeted regression tests",
    "Remove unused code paths",
  ],
  CHART: [
    "Validate chart data mappings",
    "Review axes, legends, and labels",
    "Check edge cases (empty or null data)",
    "Verify color palette and contrast",
  ],
};

export function getChecklistForTaskType(taskType) {
  if (!taskType) {
    return [];
  }

  return TASK_TYPE_CHECKLISTS[taskType] ?? [];
}

