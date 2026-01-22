import ActionButton from "@/components/ui/ActionButton";
import PlaceholderUpload from "@/components/ui/PlaceholderUpload";

const reports = [
  {
    title: "Weekly executive summary",
    cadence: "Every Monday",
  },
  {
    title: "Risk & dependency report",
    cadence: "Bi-weekly",
  },
  {
    title: "Portfolio health check",
    cadence: "Monthly",
  },
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
            Schedule summaries and automate executive updates.
          </p>
        </div>
        <ActionButton
          label="Generate report"
          variant="success"
          toast={{
            title: "Report queued",
            message: "Automated reporting will launch with data integration.",
            variant: "success",
          }}
        />
      </div>

      <div className="space-y-4">
        {reports.map((report) => (
          <div
            key={report.title}
            className="flex flex-col gap-3 rounded-2xl border border-white/10 bg-slate-900/60 p-5 lg:flex-row lg:items-center lg:justify-between"
          >
            <div>
              <p className="text-sm font-semibold text-white">
                {report.title}
              </p>
              <p className="mt-1 text-xs text-white/60">
                {report.cadence}
              </p>
            </div>
            <ActionButton
              label="Preview"
              size="sm"
              variant="secondary"
              toast={{
                title: "Preview mode",
                message: "Preview templates are staged for activation.",
                variant: "info",
              }}
            />
          </div>
        ))}
      </div>

      <PlaceholderUpload
        label="Executive slides"
        helperText="Upload slide decks to augment reports."
      />
    </div>
  );
}
