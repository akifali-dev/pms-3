export const TASK_STATUSES = [
  { id: "BACKLOG", label: "BACKLOG" },
  { id: "READY", label: "READY" },
  { id: "IN_PROGRESS", label: "IN_PROGRESS" },
  { id: "DEV_TEST", label: "DEV_TEST" },
  { id: "TESTING", label: "TESTING" },
  { id: "DONE", label: "DONE" },
  { id: "REJECTED", label: "REJECTED" },
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
