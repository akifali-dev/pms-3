import { allRoles, roles } from "@/lib/roles";

export const navigationItems = [
  { label: "Dashboard", href: "/dashboard", roles: allRoles },
  {
    label: "Projects",
    href: "/projects",
    roles: [roles.CEO, roles.PM, roles.CTO, roles.SENIOR_DEV, roles.DEV],
  },
  {
    label: "Milestones",
    href: "/milestones",
    roles: [roles.CEO, roles.PM, roles.CTO, roles.SENIOR_DEV, roles.DEV],
  },
  {
    label: "Activity",
    href: "/activity",
    roles: [roles.CEO, roles.PM, roles.CTO, roles.SENIOR_DEV, roles.DEV],
  },
  { label: "Attendance", href: "/attendance", roles: allRoles },
  {
    label: "Reports",
    href: "/reports",
    roles: [roles.CEO, roles.PM, roles.CTO],
  },
  {
    label: "Create user",
    href: "/users/create",
    roles: [roles.CEO, roles.PM, roles.CTO],
  },
];

export const quickActions = [
  {
    id: "new-project",
    label: "New project",
    description: "Kick off a new workspace",
    variant: "success",
  },
  {
    id: "log-update",
    label: "Log status update",
    description: "Capture progress in seconds",
    variant: "info",
  },
  {
    id: "flag-risk",
    label: "Flag a risk",
    description: "Escalate blockers quickly",
    variant: "warning",
  },
];
