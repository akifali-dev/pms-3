import ActionButton from "@/components/ui/ActionButton";
import ActionLink from "@/components/ui/ActionLink";
import PlaceholderUpload from "@/components/ui/PlaceholderUpload";

export default function Home() {
  return (
    <div className="space-y-8">
      <section className="rounded-3xl border border-white/10 bg-white/5 p-8">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-white/40">
              Command center
            </p>
            <h2 className="mt-2 text-3xl font-semibold text-white">
              Build, track, and report across every initiative.
            </h2>
            <p className="mt-3 max-w-2xl text-sm text-white/60">
              This production-ready foundation centralizes project visibility,
              milestone tracking, and stakeholder reporting without implementing
              business logic yet.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <ActionButton
              label="Create workspace"
              variant="success"
              toast={{
                title: "Workspace queued",
                message: "Workspace creation will be available once auth is wired.",
                variant: "success",
              }}
            />
            <ActionButton
              label="Invite stakeholders"
              variant="secondary"
              toast={{
                title: "Invites ready",
                message: "Stakeholder invites are staged for launch.",
                variant: "info",
              }}
            />
          </div>
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-3">
        {[
          {
            title: "Portfolio snapshot",
            description: "Track project health, budget, and velocity in one view.",
            metric: "12 active programs",
          },
          {
            title: "Milestone readiness",
            description: "Ensure cross-team milestones stay aligned.",
            metric: "8 upcoming gates",
          },
          {
            title: "Risk monitoring",
            description: "Surface blockers early and keep delivery on track.",
            metric: "3 open risks",
          },
        ].map((card) => (
          <div
            key={card.title}
            className="rounded-2xl border border-white/10 bg-slate-900/60 p-6"
          >
            <p className="text-sm font-semibold text-white">{card.title}</p>
            <p className="mt-2 text-xs text-white/60">{card.description}</p>
            <p className="mt-5 text-lg font-semibold text-white">
              {card.metric}
            </p>
          </div>
        ))}
      </section>

      <section className="grid gap-6 lg:grid-cols-[2fr,1fr]">
        <div className="space-y-4 rounded-2xl border border-white/10 bg-white/5 p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-sm font-semibold text-white">Quick access</p>
              <p className="text-xs text-white/60">
                Jump directly into dedicated workspaces.
              </p>
            </div>
            <ActionLink
              href="/projects"
              label="View projects →"
              toast={{
                title: "Navigation",
                message: "Opening projects hub.",
                variant: "info",
              }}
              className="text-xs font-semibold text-sky-200 hover:text-sky-100"
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            {["Product launch", "Customer migration", "Security overhaul", "Q4 roadmap"].map(
              (project) => (
                <div
                  key={project}
                  className="rounded-xl border border-white/10 bg-slate-900/60 p-4"
                >
                  <p className="text-sm font-semibold text-white">{project}</p>
                  <p className="mt-2 text-xs text-white/60">
                    Status tracking ready for activation.
                  </p>
                  <ActionButton
                    label="Open"
                    variant="secondary"
                    size="sm"
                    className="mt-3"
                    toast={{
                      title: "Project preview",
                      message: "Project details will appear once data is connected.",
                      variant: "info",
                    }}
                  />
                </div>
              )
            )}
          </div>
        </div>
        <div className="space-y-4 rounded-2xl border border-white/10 bg-white/5 p-6">
          <div>
            <p className="text-sm font-semibold text-white">Asset uploads</p>
            <p className="text-xs text-white/60">
              Add brand guidelines, plans, or specs.
            </p>
          </div>
          <PlaceholderUpload
            label="Project cover"
            helperText="Upload hero imagery for portfolios."
          />
          <PlaceholderUpload
            label="Risk matrix"
            helperText="Attach PDFs or slide decks."
          />
        </div>
      </section>
    </div>
  );
}
