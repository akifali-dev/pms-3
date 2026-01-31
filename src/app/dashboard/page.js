import ActionButton from "@/components/ui/ActionButton";
import PageHeader from "@/components/layout/PageHeader";
import PlaceholderUpload from "@/components/ui/PlaceholderUpload";
import AnalyticsDashboardPanel from "@/components/analytics/AnalyticsDashboardPanel";
import { getSession } from "@/lib/session";
import { getRoleById, roles } from "@/lib/roles";
import { prisma } from "@/lib/prisma";

const metricDefinitions = [
  {
    id: "tasks-completed",
    label: "Tasks completed",
    value: "128",
    trend: "+12% WoW",
    detail: "92% delivered on time",
  },
  {
    id: "rework-count",
    label: "Rework count",
    value: "9",
    trend: "-3 vs last week",
    detail: "Quality improvements holding",
  },
  {
    id: "time-vs-estimate",
    label: "Time vs estimate",
    value: "1.06x",
    trend: "Near target",
    detail: "Estimate accuracy stable",
  },
  {
    id: "checklist-compliance",
    label: "Checklist compliance",
    value: "96%",
    trend: "+2% WoW",
    detail: "QA gates consistently met",
  },
  {
    id: "blocked-tasks",
    label: "Blocked tasks",
    value: "4",
    trend: "-2 vs last week",
    detail: "Dependencies clearing",
  },
  {
    id: "milestone-health",
    label: "Milestone health",
    value: "Green",
    trend: "3 at risk",
    detail: "Next milestone in 12 days",
  },
];

const executiveHighlights = [
  {
    title: "Portfolio confidence",
    value: "High",
    detail: "3 critical programs in steady state",
  },
  {
    title: "Delivery cadence",
    value: "12 teams weekly",
    detail: "Cross-org updates on schedule",
  },
  {
    title: "Resource focus",
    value: "78% allocated",
    detail: "Hiring plan aligned to milestones",
  },
];

const deliveryFocus = [
  {
    title: "Active releases",
    value: "6",
    detail: "2 major launches this quarter",
  },
  {
    title: "Escalations",
    value: "2",
    detail: "Pending vendor review",
  },
  {
    title: "Cross-team blockers",
    value: "4",
    detail: "Infrastructure dependencies",
  },
];

const developerSnapshot = [
  {
    title: "My tasks completed",
    value: "14",
    detail: "5 ahead of plan",
  },
  {
    title: "My rework items",
    value: "1",
    detail: "Reviewed and cleared",
  },
  {
    title: "My time vs estimate",
    value: "0.98x",
    detail: "Staying within scope",
  },
  {
    title: "My checklist compliance",
    value: "100%",
    detail: "All QA gates complete",
  },
  {
    title: "My blocked tasks",
    value: "1",
    detail: "Waiting on API review",
  },
  {
    title: "My milestone impact",
    value: "On track",
    detail: "Release ready in 5 days",
  },
];

export default async function DashboardPage() {
  const session = await getSession();
  const role = getRoleById(session?.role);
  const roleId = role?.id ?? null;

  const hasDatabase = Boolean(process.env.DATABASE_URL);
  let currentUser = null;
  let users = [];

  if (hasDatabase && session?.email) {
    currentUser = await prisma.user.findUnique({
      where: { email: session.email },
      select: { id: true, name: true, email: true, role: true },
    });
    if (currentUser) {
      users = await prisma.user.findMany({
        where: { isActive: true },
        orderBy: { name: "asc" },
        select: { id: true, name: true, email: true, role: true },
      });
    }
  }

  const isExecutiveSummary = roleId === roles.CEO || !roleId;
  const isFullVisibility = roleId === roles.PM || roleId === roles.CTO;
  const isDeveloper = roleId === roles.DEV || roleId === roles.SENIOR_DEV;

  const headline = isFullVisibility
    ? {
        title: "Program delivery command center",
        description: "Full visibility across initiatives, dependencies, and QA.",
      }
    : isDeveloper
    ? {
        title: "My delivery dashboard",
        description: "Personal execution insights with milestone impact.",
      }
    : {
        title: "Executive overview",
        description: "Summary visibility across programs and resources.",
      };

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Dashboard"
        title={headline.title}
        subtitle={headline.description}
        actions={
          <ActionButton
            label={isDeveloper ? "Share update" : "Share snapshot"}
            variant="primary"
            toast={{
              title: "Snapshot ready",
              message:
                "Role-based dashboard snapshots are ready for email delivery.",
              variant: "info",
            }}
          />
        }
      />

      <div className="space-y-3">
        <p className="text-sm font-semibold text-[color:var(--color-text)]">
          Working time analytics
        </p>
        <AnalyticsDashboardPanel
          users={users}
          currentUser={currentUser}
          isManager={isFullVisibility || isExecutiveSummary}
        />
      </div>

      {isExecutiveSummary && (
        <div className="space-y-4">
          <div className="grid gap-4 lg:grid-cols-3">
            {executiveHighlights.map((item) => (
              <div
                key={item.title}
                className="rounded-2xl border border-[color:var(--color-border)] bg-[color:var(--color-card)] p-5"
              >
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[color:var(--color-text-subtle)]">
                  {item.title}
                </p>
                <p className="mt-3 text-xl font-semibold text-[color:var(--color-text)]">
                  {item.value}
                </p>
                <p className="mt-2 text-xs text-[color:var(--color-text-muted)]">{item.detail}</p>
              </div>
            ))}
          </div>

          <div className="rounded-2xl border border-[color:var(--color-border)] bg-[color:var(--color-card)] p-5">
            <p className="text-sm font-semibold text-[color:var(--color-text)]">Key metrics</p>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              {metricDefinitions.map((metric) => (
                <div
                  key={metric.id}
                  className="rounded-xl border border-[color:var(--color-border-subtle)] bg-[color:var(--color-muted-bg)] p-4"
                >
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[color:var(--color-text-subtle)]">
                      {metric.label}
                    </p>
                    <span className="text-xs text-emerald-300">
                      {metric.trend}
                    </span>
                  </div>
                  <p className="mt-3 text-lg font-semibold text-[color:var(--color-text)]">
                    {metric.value}
                  </p>
                  <p className="mt-2 text-xs text-[color:var(--color-text-muted)]">
                    {metric.detail}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {isFullVisibility && (
        <div className="space-y-4">
          <div className="rounded-2xl border border-[color:var(--color-border)] bg-[color:var(--color-card)] p-5">
            <p className="text-sm font-semibold text-[color:var(--color-text)]">
              Metrics performance
            </p>
            <div className="mt-4 grid gap-4 lg:grid-cols-3">
              {metricDefinitions.map((metric) => (
                <div
                  key={metric.id}
                  className="rounded-xl border border-[color:var(--color-border-subtle)] bg-[color:var(--color-muted-bg)] p-4"
                >
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[color:var(--color-text-subtle)]">
                      {metric.label}
                    </p>
                    <span className="text-xs text-emerald-300">
                      {metric.trend}
                    </span>
                  </div>
                  <p className="mt-3 text-lg font-semibold text-[color:var(--color-text)]">
                    {metric.value}
                  </p>
                  <p className="mt-2 text-xs text-[color:var(--color-text-muted)]">
                    {metric.detail}
                  </p>
                </div>
              ))}
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-3">
            {deliveryFocus.map((item) => (
              <div
                key={item.title}
                className="rounded-2xl border border-[color:var(--color-border)] bg-[color:var(--color-card)] p-5"
              >
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[color:var(--color-text-subtle)]">
                  {item.title}
                </p>
                <p className="mt-3 text-xl font-semibold text-[color:var(--color-text)]">
                  {item.value}
                </p>
                <p className="mt-2 text-xs text-[color:var(--color-text-muted)]">{item.detail}</p>
              </div>
            ))}
          </div>

          <div className="rounded-2xl border border-[color:var(--color-border)] bg-[color:var(--color-card)] p-5">
            <p className="text-sm font-semibold text-[color:var(--color-text)]">
              Milestone readiness
            </p>
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              {[
                {
                  title: "Q3 launch readiness",
                  detail: "85% complete, 4 risks logged",
                },
                {
                  title: "Dependency coverage",
                  detail: "7 of 9 partners confirmed",
                },
                {
                  title: "Checklist compliance",
                  detail: "QA gates passing across all streams",
                },
                {
                  title: "Blocked task recovery",
                  detail: "Two blockers escalated and tracked",
                },
              ].map((item) => (
                <div
                  key={item.title}
                  className="rounded-xl border border-[color:var(--color-border-subtle)] bg-[color:var(--color-muted-bg)] p-4"
                >
                  <p className="text-sm font-semibold text-[color:var(--color-text)]">
                    {item.title}
                  </p>
                  <p className="mt-2 text-xs text-[color:var(--color-text-muted)]">
                    {item.detail}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {isDeveloper && (
        <div className="rounded-2xl border border-[color:var(--color-border)] bg-[color:var(--color-card)] p-5">
          <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-sm font-semibold text-[color:var(--color-text)]">
                Individual performance
              </p>
              <p className="mt-1 text-xs text-[color:var(--color-text-muted)]">
                Your execution metrics across active tasks and milestones.
              </p>
            </div>
            <ActionButton
              label="Email my status"
              size="sm"
              variant="secondary"
              toast={{
                title: "Status queued",
                message: "Your dashboard summary is formatted for email.",
                variant: "info",
              }}
            />
          </div>
          <div className="mt-4 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {developerSnapshot.map((item) => (
              <div
                key={item.title}
                className="rounded-xl border border-[color:var(--color-border-subtle)] bg-[color:var(--color-muted-bg)] p-4"
              >
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[color:var(--color-text-subtle)]">
                  {item.title}
                </p>
                <p className="mt-3 text-lg font-semibold text-[color:var(--color-text)]">
                  {item.value}
                </p>
                <p className="mt-2 text-xs text-[color:var(--color-text-muted)]">{item.detail}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      <PlaceholderUpload
        label={isDeveloper ? "Personal highlights" : "Quarterly highlights"}
        helperText={
          isDeveloper
            ? "Upload demos and metrics to include in your status emails."
            : "Upload leadership-ready visuals and decks."
        }
      />
    </div>
  );
}
