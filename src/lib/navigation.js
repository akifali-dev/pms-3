export const roleOptions = [
  {
    id: "admin",
    label: "Admin",
    description: "Organization-wide oversight",
  },
  {
    id: "manager",
    label: "Project Manager",
    description: "Delivery and resource planning",
  },
  {
    id: "contributor",
    label: "Contributor",
    description: "Execution and updates",
  },
];

export const navigationItems = [
  { label: "Dashboard", href: "/dashboard" },
  { label: "Projects", href: "/projects" },
  { label: "Milestones", href: "/milestones" },
  { label: "Tasks", href: "/tasks" },
  { label: "Reports", href: "/reports" },
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
