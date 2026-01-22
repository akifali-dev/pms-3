import { allRoles, roles } from "@/lib/roles";

export const navigationItems = [
  { label: "Dashboard", href: "/dashboard", roles: allRoles },
  {
    label: "Projects",
    href: "/projects",
    roles: [roles.PM, roles.CTO, roles.SENIOR_DEV],
  },
  {
    label: "Milestones",
    href: "/milestones",
    roles: [roles.PM, roles.CTO, roles.SENIOR_DEV],
  },
  {
    label: "Tasks",
    href: "/tasks",
    roles: [roles.CEO, roles.PM, roles.CTO, roles.SENIOR_DEV, roles.DEV],
  },
  {
    label: "Activity",
    href: "/activity",
    roles: [roles.CEO, roles.PM, roles.CTO, roles.SENIOR_DEV, roles.DEV],
  },
  {
    label: "Reports",
    href: "/reports",
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
