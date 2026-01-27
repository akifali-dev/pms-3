import ActionButton from "@/components/ui/ActionButton";
import ActionLink from "@/components/ui/ActionLink";
import PlaceholderUpload from "@/components/ui/PlaceholderUpload";

export default function Home() {
  return (
    <div className="space-y-8">
      <section className="rounded-3xl border border-[color:var(--color-border)] bg-[color:var(--color-card)] p-8">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[color:var(--color-text-subtle)]">
              Command center
            </p>
            <h2 className="mt-2 text-3xl font-semibold text-[color:var(--color-text)]">
              Build, track, and report across every initiative.
            </h2>
            <p className="mt-3 max-w-2xl text-sm text-[color:var(--color-text-muted)]">
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
            className="rounded-2xl border border-[color:var(--color-border)] bg-[color:var(--color-card)] p-6"
          >
            <p className="text-sm font-semibold text-[color:var(--color-text)]">{card.title}</p>
            <p className="mt-2 text-xs text-[color:var(--color-text-muted)]">{card.description}</p>
            <p className="mt-5 text-lg font-semibold text-[color:var(--color-text)]">
              {card.metric}
            </p>
          </div>
        ))}
      </section>

      <section className="grid gap-6 lg:grid-cols-[2fr,1fr]">
        <div className="space-y-4 rounded-2xl border border-[color:var(--color-border)] bg-[color:var(--color-card)] p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-sm font-semibold text-[color:var(--color-text)]">Quick access</p>
              <p className="text-xs text-[color:var(--color-text-muted)]">
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
                  className="rounded-xl border border-[color:var(--color-border)] bg-[color:var(--color-card)] p-4"
                >
                  <p className="text-sm font-semibold text-[color:var(--color-text)]">{project}</p>
                  <p className="mt-2 text-xs text-[color:var(--color-text-muted)]">
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
        <div className="space-y-4 rounded-2xl border border-[color:var(--color-border)] bg-[color:var(--color-card)] p-6">
          <div>
            <p className="text-sm font-semibold text-[color:var(--color-text)]">Asset uploads</p>
            <p className="text-xs text-[color:var(--color-text-muted)]">
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
