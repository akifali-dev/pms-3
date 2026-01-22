export const TASK_STATUSES = [
  { id: "BACKLOG", label: "Backlog" },
  { id: "READY", label: "Ready" },
  { id: "IN_PROGRESS", label: "In Progress" },
  { id: "DEV_TEST", label: "Dev Test" },
  { id: "TESTING", label: "Testing" },
  { id: "DONE", label: "Done" },
  { id: "REJECTED", label: "Rejected" },
];

export const TASK_TRANSITIONS = {
  BACKLOG: ["READY"],
  READY: ["IN_PROGRESS"],
  IN_PROGRESS: ["DEV_TEST"],
  DEV_TEST: ["TESTING"],
  TESTING: ["DONE", "REJECTED"],
  REJECTED: ["IN_PROGRESS"],
  DONE: [],
};

export function getStatusLabel(status) {
  return TASK_STATUSES.find((item) => item.id === status)?.label ?? status;
}

export function getNextStatuses(status) {
  return TASK_TRANSITIONS[status] ?? [];
}

export function isValidTransition(fromStatus, toStatus) {
  return getNextStatuses(fromStatus).includes(toStatus);
}
