import ActionButton from "@/components/ui/ActionButton";
import PlaceholderUpload from "@/components/ui/PlaceholderUpload";

const projects = [
  {
    name: "Client onboarding refresh",
    status: "Discovery ready",
    lead: "Alex Monroe",
  },
  {
    name: "Automation rollout",
    status: "Planning in progress",
    lead: "Taylor Jordan",
  },
  {
    name: "Security compliance",
    status: "Requirements queued",
    lead: "Morgan Lee",
  },
];

export default function ProjectsPage() {
  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 rounded-2xl border border-white/10 bg-white/5 p-6 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-white/40">
            Projects
          </p>
          <h2 className="mt-2 text-2xl font-semibold text-white">
            Active project portfolio
          </h2>
          <p className="mt-2 text-sm text-white/60">
            Maintain a single source of truth for every initiative.
          </p>
        </div>
        <ActionButton
          label="New project"
          variant="success"
          toast={{
            title: "Project draft",
            message: "Project creation is staged for the next milestone.",
            variant: "success",
          }}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {projects.map((project) => (
          <div
            key={project.name}
            className="rounded-2xl border border-white/10 bg-slate-900/60 p-5"
          >
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm font-semibold text-white">{project.name}</p>
                <p className="mt-1 text-xs text-white/60">{project.status}</p>
              </div>
              <span className="rounded-full border border-white/10 px-2 py-1 text-[11px] text-white/60">
                {project.lead}
              </span>
            </div>
            <ActionButton
              label="View workspace"
              variant="secondary"
              size="sm"
              className="mt-4"
              toast={{
                title: "Workspace preview",
                message: "Detailed project views will be enabled soon.",
                variant: "info",
              }}
            />
          </div>
        ))}
      </div>

      <PlaceholderUpload
        label="Project cover art"
        helperText="Upload imagery to brand each project."
      />
    </div>
  );
}
