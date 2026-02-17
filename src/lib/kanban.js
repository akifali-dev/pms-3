export const TASK_STATUSES = [
  { id: "BACKLOG", label: "BACKLOG" },
  { id: "READY", label: "READY" },
  { id: "IN_PROGRESS", label: "IN_PROGRESS" },
  { id: "ON_HOLD", label: "ON_HOLD" },
  { id: "DEV_TEST", label: "DEV_TEST" },
  { id: "TESTING", label: "TESTING" },
  { id: "DONE", label: "DONE" },
  { id: "REJECTED", label: "REJECTED" },
  { id: "BLOCKED", label: "BLOCKED" },
];

export const TASK_TRANSITIONS = {
  BACKLOG: ["READY", "BLOCKED"],
  READY: ["IN_PROGRESS", "ON_HOLD", "BLOCKED"],
  IN_PROGRESS: ["DEV_TEST", "ON_HOLD", "BLOCKED"],
  ON_HOLD: ["READY", "IN_PROGRESS", "BLOCKED"],
  DEV_TEST: ["TESTING", "ON_HOLD", "BLOCKED"],
  TESTING: ["DONE", "REJECTED", "ON_HOLD", "BLOCKED"],
  REJECTED: ["READY", "ON_HOLD", "BLOCKED"],
  BLOCKED: ["READY", "IN_PROGRESS", "ON_HOLD"],
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

export function canTransition({ from, to, role, isOwner }) {
  if (!from || !to) {
    return { ok: false, message: "Status transition is required." };
  }

  if (from === to) {
    return { ok: true };
  }

  if (!isValidTransition(from, to)) {
    return {
      ok: false,
      message: `Invalid transition from ${getStatusLabel(from)} to ${getStatusLabel(to)}.`,
    };
  }

  if (["DONE", "REJECTED"].includes(to) && !["PM", "CTO"].includes(role)) {
    return {
      ok: false,
      message: "Only PMs and CTOs can move tasks to Done or Rejected.",
    };
  }

  if (!["PM", "CTO"].includes(role) && !isOwner) {
    return {
      ok: false,
      message: "You can only move tasks assigned to you.",
    };
  }

  return { ok: true };
}
