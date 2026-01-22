import ActionButton from "@/components/ui/ActionButton";
import PlaceholderUpload from "@/components/ui/PlaceholderUpload";

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
];

export default function ReportsPage() {
  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 rounded-2xl border border-white/10 bg-white/5 p-6 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-white/40">
            Reports
          </p>
          <h2 className="mt-2 text-2xl font-semibold text-white">
            Stakeholder-ready reporting
          </h2>
          <p className="mt-2 text-sm text-white/60">
            Daily and weekly reports are auto-generated and email-ready.
          </p>
        </div>
        <ActionButton
          label="Generate report"
          variant="success"
          toast={{
            title: "Report queued",
            message: "Report outputs are formatted for email delivery.",
            variant: "success",
          }}
        />
      </div>

      <div className="space-y-4">
        {reports.map((report) => (
          <div
            key={report.title}
            className="flex flex-col gap-4 rounded-2xl border border-white/10 bg-slate-900/60 p-5 lg:flex-row lg:items-center lg:justify-between"
          >
            <div>
              <p className="text-sm font-semibold text-white">
                {report.title}
              </p>
              <p className="mt-1 text-xs text-white/60">
                {report.cadence}
              </p>
              <p className="mt-2 text-xs text-white/60">
                Audience: {report.audience}
              </p>
              <p className="mt-1 text-xs text-emerald-300">
                {report.delivery}
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {report.sections.map((section) => (
                  <span
                    key={section}
                    className="rounded-full border border-white/10 bg-slate-950/40 px-2 py-1 text-[11px] text-white/70"
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
        <div className="rounded-2xl border border-white/10 bg-slate-900/60 p-5 lg:col-span-2">
          <p className="text-sm font-semibold text-white">Email preview</p>
          <div className="mt-4 space-y-3 text-xs text-white/70">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-white/40">
                Subject
              </p>
              <p className="mt-1 text-sm font-semibold text-white">
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
        <div className="rounded-2xl border border-white/10 bg-slate-900/60 p-5">
          <p className="text-sm font-semibold text-white">
            Metrics included
          </p>
          <ul className="mt-3 space-y-2 text-xs text-white/70">
            {metricsChecklist.map((metric) => (
              <li
                key={metric}
                className="flex items-center justify-between rounded-xl border border-white/5 bg-slate-950/40 px-3 py-2"
              >
                <span>{metric}</span>
                <span className="text-emerald-300">Ready</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <PlaceholderUpload
        label="Executive slides"
        helperText="Upload slide decks to augment reports."
      />
    </div>
  );
}
