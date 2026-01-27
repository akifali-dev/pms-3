import ActionButton from "@/components/ui/ActionButton";
import PageHeader from "@/components/layout/PageHeader";
import PlaceholderUpload from "@/components/ui/PlaceholderUpload";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { isAdminRole, normalizeRole } from "@/lib/api";

const reports = [
  {
    title: "Daily delivery pulse",
    cadence: "Every weekday at 7:00 AM",
    audience: "PM, CTO, Engineering leads",
    delivery: "Auto-generated, email-ready",
    sections: [
      "Tasks completed",
      "Blocked tasks",
      "Time vs estimate",
      "Checklist compliance",
    ],
  },
  {
    title: "Weekly executive summary",
    cadence: "Every Monday at 8:00 AM",
    audience: "CEO, PM, CTO",
    delivery: "Auto-generated, email-ready",
    sections: [
      "Milestone health",
      "Tasks completed",
      "Rework count",
      "Blocked tasks",
    ],
  },
  {
    title: "Weekly delivery health",
    cadence: "Every Friday at 4:00 PM",
    audience: "PM, CTO, Senior developers",
    delivery: "Auto-generated, email-ready",
    sections: [
      "Checklist compliance",
      "Time vs estimate",
      "Rework count",
      "Milestone health",
    ],
  },
];

const emailPreview = {
  subject: "Weekly Executive Summary | PMS Cloud",
  greeting: "Hello leadership team,",
  summary:
    "This week closed with strong delivery momentum across core initiatives.",
  highlights: [
    "12 projects reported progress with 92% on-time completion.",
    "Rework held to 9 items while checklist compliance reached 96%.",
    "3 milestones flagged for follow-up, with no critical blockers.",
  ],
  footer: "Reply to this email to request deeper analysis or adjustments.",
};

const metricsChecklist = [
  "Tasks completed",
  "Rework count",
  "Time vs estimate",
  "Checklist compliance",
  "Blocked tasks",
  "Milestone health",
  "Activity logs",
  "Manager comments",
];

export default async function ReportsPage() {
  const session = await getSession();
  const hasDatabase = Boolean(process.env.DATABASE_URL);
  const role = normalizeRole(session?.role);
  const isAdmin = isAdminRole(role);

  let activitySummary = null;

  if (hasDatabase && isAdmin) {
    const rangeStart = new Date();
    rangeStart.setDate(rangeStart.getDate() - 7);

    const [activityCount, commentCount, hoursTotal] = await Promise.all([
      prisma.activityLog.count({ where: { date: { gte: rangeStart } } }),
      prisma.comment.count({ where: { createdAt: { gte: rangeStart } } }),
      prisma.activityLog.aggregate({
        where: { date: { gte: rangeStart } },
        _sum: { hoursSpent: true },
      }),
    ]);

    activitySummary = {
      activityCount,
      commentCount,
      hoursTotal: Number(hoursTotal?._sum?.hoursSpent ?? 0),
    };
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Reports"
        title="Stakeholder-ready reporting"
        subtitle="Daily and weekly reports are auto-generated and email-ready."
        actions={
          <ActionButton
            label="Generate report"
            variant="success"
            toast={{
              title: "Report queued",
              message: "Report outputs are formatted for email delivery.",
              variant: "success",
            }}
          />
        }
      />

      <div className="space-y-4">
        {reports.map((report) => (
          <div
            key={report.title}
            className="flex flex-col gap-4 rounded-2xl border border-[color:var(--color-border)] bg-[color:var(--color-card)] p-5 lg:flex-row lg:items-center lg:justify-between"
          >
            <div>
              <p className="text-sm font-semibold text-[color:var(--color-text)]">
                {report.title}
              </p>
              <p className="mt-1 text-xs text-[color:var(--color-text-muted)]">
                {report.cadence}
              </p>
              <p className="mt-2 text-xs text-[color:var(--color-text-muted)]">
                Audience: {report.audience}
              </p>
              <p className="mt-1 text-xs text-emerald-300">
                {report.delivery}
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {report.sections.map((section) => (
                  <span
                    key={section}
                    className="rounded-full border border-[color:var(--color-border)] bg-[color:var(--color-muted-bg)] px-2 py-1 text-[11px] text-[color:var(--color-text-muted)]"
                  >
                    {section}
                  </span>
                ))}
              </div>
            </div>
            <ActionButton
              label="Preview"
              size="sm"
              variant="secondary"
              toast={{
                title: "Preview mode",
                message: "Email-ready report templates are available.",
                variant: "info",
              }}
            />
          </div>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="rounded-2xl border border-[color:var(--color-border)] bg-[color:var(--color-card)] p-5 lg:col-span-2">
          <p className="text-sm font-semibold text-[color:var(--color-text)]">Email preview</p>
          <div className="mt-4 space-y-3 text-xs text-[color:var(--color-text-muted)]">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[color:var(--color-text-subtle)]">
                Subject
              </p>
              <p className="mt-1 text-sm font-semibold text-[color:var(--color-text)]">
                {emailPreview.subject}
              </p>
            </div>
            <p>{emailPreview.greeting}</p>
            <p>{emailPreview.summary}</p>
            <ul className="list-disc space-y-1 pl-4">
              {emailPreview.highlights.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
            <p>{emailPreview.footer}</p>
          </div>
        </div>
        <div className="rounded-2xl border border-[color:var(--color-border)] bg-[color:var(--color-card)] p-5">
          <p className="text-sm font-semibold text-[color:var(--color-text)]">
            Metrics included
          </p>
          <ul className="mt-3 space-y-2 text-xs text-[color:var(--color-text-muted)]">
            {metricsChecklist.map((metric) => (
              <li
                key={metric}
                className="flex items-center justify-between rounded-xl border border-[color:var(--color-border-subtle)] bg-[color:var(--color-muted-bg)] px-3 py-2"
              >
                <span>{metric}</span>
                <span className="text-emerald-300">Ready</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {activitySummary && (
        <div className="rounded-2xl border border-[color:var(--color-border)] bg-[color:var(--color-card)] p-5">
          <p className="text-sm font-semibold text-[color:var(--color-text)]">
            Accountability coverage (last 7 days)
          </p>
          <div className="mt-4 grid gap-3 text-xs text-[color:var(--color-text-muted)] md:grid-cols-3">
            <div className="rounded-xl border border-[color:var(--color-border)] bg-[color:var(--color-muted-bg)] p-3">
              <p className="text-[color:var(--color-text-subtle)]">Activity logs</p>
              <p className="mt-2 text-lg font-semibold text-[color:var(--color-text)]">
                {activitySummary.activityCount}
              </p>
            </div>
            <div className="rounded-xl border border-[color:var(--color-border)] bg-[color:var(--color-muted-bg)] p-3">
              <p className="text-[color:var(--color-text-subtle)]">Manager comments</p>
              <p className="mt-2 text-lg font-semibold text-[color:var(--color-text)]">
                {activitySummary.commentCount}
              </p>
            </div>
            <div className="rounded-xl border border-[color:var(--color-border)] bg-[color:var(--color-muted-bg)] p-3">
              <p className="text-[color:var(--color-text-subtle)]">Hours logged</p>
              <p className="mt-2 text-lg font-semibold text-[color:var(--color-text)]">
                {activitySummary.hoursTotal}
              </p>
            </div>
          </div>
        </div>
      )}

      <PlaceholderUpload
        label="Executive slides"
        helperText="Upload slide decks to augment reports."
      />
    </div>
  );
}
