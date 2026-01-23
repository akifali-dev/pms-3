export const roles = {
  CEO: "ceo",
  PM: "pm",
  CTO: "cto",
  SENIOR_DEV: "senior-developer",
  DEV: "developer",
};

export const roleOptions = [
  {
    id: roles.CEO,
    label: "CEO",
    description: "Executive dashboard visibility",
  },
  {
    id: roles.PM,
    label: "PM",
    description: "Delivery leadership and planning",
  },
  {
    id: roles.CTO,
    label: "CTO",
    description: "Technical portfolio oversight",
  },
  {
    id: roles.SENIOR_DEV,
    label: "Senior Developer",
    description: "Lead implementation and review",
  },
  {
    id: roles.DEV,
    label: "Developer",
    description: "Execute and update tasks",
  },
];

export const routeAccess = {
  "/dashboard": [
    roles.CEO,
    roles.PM,
    roles.CTO,
    roles.SENIOR_DEV,
    roles.DEV,
  ],
  "/projects": [roles.PM, roles.CTO, roles.SENIOR_DEV],
  "/milestones": [roles.PM, roles.CTO, roles.SENIOR_DEV],
  "/tasks": [roles.CEO, roles.PM, roles.CTO, roles.SENIOR_DEV, roles.DEV],
  "/activity": [
    roles.CEO,
    roles.PM,
    roles.CTO,
    roles.SENIOR_DEV,
    roles.DEV,
  ],
  "/reports": [roles.CEO, roles.PM, roles.CTO],
  "/users": [roles.CEO, roles.PM, roles.CTO],
};

export const taskPermissions = {
  [roles.CEO]: {
    canMoveTask: false,
    canMarkDone: true,
  },
  [roles.PM]: {
    canMoveTask: true,
    canMarkDone: true,
  },
  [roles.CTO]: {
    canMoveTask: true,
    canMarkDone: true,
  },
  [roles.SENIOR_DEV]: {
    canMoveTask: true,
    canMarkDone: true,
  },
  [roles.DEV]: {
    canMoveTask: true,
    canMarkDone: false,
  },
};

export const allRoles = roleOptions.map((role) => role.id);

export function normalizeRoleId(roleId) {
  if (!roleId) {
    return null;
  }

  const normalized = roleId
    .toString()
    .trim()
    .replace(/\s+/g, "_")
    .replace(/-/g, "_")
    .toUpperCase();

  const mapping = {
    CEO: roles.CEO,
    PM: roles.PM,
    CTO: roles.CTO,
    SENIOR_DEV: roles.SENIOR_DEV,
    SENIOR_DEVELOPER: roles.SENIOR_DEV,
    DEVELOPER: roles.DEV,
    DEV: roles.DEV,
  };

  return mapping[normalized] ?? null;
}

export function getRoleById(roleId) {
  const normalized = normalizeRoleId(roleId) ?? roleId;
  return roleOptions.find((role) => role.id === normalized) ?? null;
}

export function roleHasRouteAccess(roleId, pathname) {
  const normalized = normalizeRoleId(roleId);
  if (!normalized) {
    return false;
  }

  const matchingRoute = Object.keys(routeAccess).find((route) =>
    pathname.startsWith(route)
  );

  if (!matchingRoute) {
    return true;
  }

  return routeAccess[matchingRoute].includes(normalized);
}

export function getDefaultRouteForRole(roleId) {
  const normalized = normalizeRoleId(roleId);
  const allowedRoutes = Object.entries(routeAccess)
    .filter(([, roles]) => roles.includes(normalized))
    .map(([route]) => route);

  return allowedRoutes[0] ?? "/dashboard";
}

export function canMoveTask(roleId) {
  const normalized = normalizeRoleId(roleId);
  return taskPermissions[normalized]?.canMoveTask ?? false;
}

export function canMarkTaskDone(roleId) {
  const normalized = normalizeRoleId(roleId);
  return taskPermissions[normalized]?.canMarkDone ?? false;
}
