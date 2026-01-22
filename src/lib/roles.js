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
  "/reports": [roles.CEO, roles.PM, roles.CTO],
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

export function getRoleById(roleId) {
  return roleOptions.find((role) => role.id === roleId) ?? null;
}

export function roleHasRouteAccess(roleId, pathname) {
  if (!roleId) {
    return false;
  }

  const matchingRoute = Object.keys(routeAccess).find((route) =>
    pathname.startsWith(route)
  );

  if (!matchingRoute) {
    return true;
  }

  return routeAccess[matchingRoute].includes(roleId);
}

export function getDefaultRouteForRole(roleId) {
  const allowedRoutes = Object.entries(routeAccess)
    .filter(([, roles]) => roles.includes(roleId))
    .map(([route]) => route);

  return allowedRoutes[0] ?? "/dashboard";
}

export function canMoveTask(roleId) {
  return taskPermissions[roleId]?.canMoveTask ?? false;
}

export function canMarkTaskDone(roleId) {
  return taskPermissions[roleId]?.canMarkDone ?? false;
}
