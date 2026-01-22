import ActionButton from "@/components/ui/ActionButton";
import PlaceholderUpload from "@/components/ui/PlaceholderUpload";

const milestones = [
  {
    title: "Planning kickoff",
    window: "Weeks 1-2",
    owner: "Program Ops",
  },
  {
    title: "Design validation",
    window: "Weeks 3-4",
    owner: "UX Team",
  },
  {
    title: "Launch readiness",
    window: "Week 6",
    owner: "Release Mgmt",
  },
];

export default function MilestonesPage() {
  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 rounded-2xl border border-white/10 bg-white/5 p-6 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-white/40">
            Milestones
          </p>
          <h2 className="mt-2 text-2xl font-semibold text-white">
            Coordinate cross-team delivery
          </h2>
          <p className="mt-2 text-sm text-white/60">
            Align teams around critical checkpoints and dependencies.
          </p>
        </div>
        <ActionButton
          label="Add milestone"
          variant="primary"
          toast={{
            title: "Milestone placeholder",
            message: "Milestone creation is ready for data wiring.",
            variant: "info",
          }}
        />
      </div>

      <div className="space-y-4">
        {milestones.map((milestone) => (
          <div
            key={milestone.title}
            className="flex flex-col gap-3 rounded-2xl border border-white/10 bg-slate-900/60 p-5 lg:flex-row lg:items-center lg:justify-between"
          >
            <div>
              <p className="text-sm font-semibold text-white">
                {milestone.title}
              </p>
              <p className="mt-1 text-xs text-white/60">{milestone.window}</p>
            </div>
            <div className="flex items-center gap-3">
              <span className="rounded-full border border-white/10 px-3 py-1 text-xs text-white/60">
                Owner: {milestone.owner}
              </span>
              <ActionButton
                label="Review"
                size="sm"
                variant="secondary"
                toast={{
                  title: "Milestone review",
                  message: "Reviews will open once milestone data is synced.",
                  variant: "warning",
                }}
              />
            </div>
          </div>
        ))}
      </div>

      <PlaceholderUpload
        label="Milestone artifacts"
        helperText="Attach supporting documentation for gate reviews."
      />
    </div>
  );
}
