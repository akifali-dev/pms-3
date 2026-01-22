import ActionButton from "@/components/ui/ActionButton";
import PlaceholderUpload from "@/components/ui/PlaceholderUpload";

const tasks = [
  {
    title: "Draft kickoff brief",
    team: "Program Ops",
    status: "Queued",
  },
  {
    title: "Finalize dependency map",
    team: "Delivery",
    status: "Awaiting input",
  },
  {
    title: "Confirm vendor timelines",
    team: "Procurement",
    status: "Planned",
  },
];

export default function TasksPage() {
  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 rounded-2xl border border-white/10 bg-white/5 p-6 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-white/40">
            Tasks
          </p>
          <h2 className="mt-2 text-2xl font-semibold text-white">
            Operational task queues
          </h2>
          <p className="mt-2 text-sm text-white/60">
            Assign, prioritize, and execute across teams.
          </p>
        </div>
        <ActionButton
          label="Assign task"
          variant="primary"
          toast={{
            title: "Task assignment",
            message: "Assignments will activate once user roles are linked.",
            variant: "info",
          }}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {tasks.map((task) => (
          <div
            key={task.title}
            className="rounded-2xl border border-white/10 bg-slate-900/60 p-5"
          >
            <p className="text-sm font-semibold text-white">{task.title}</p>
            <p className="mt-1 text-xs text-white/60">{task.team}</p>
            <div className="mt-4 flex items-center justify-between">
              <span className="rounded-full border border-white/10 px-3 py-1 text-xs text-white/60">
                {task.status}
              </span>
              <ActionButton
                label="Update"
                size="sm"
                variant="secondary"
                toast={{
                  title: "Task update",
                  message: "Status updates will sync when tasks are wired.",
                  variant: "warning",
                }}
              />
            </div>
          </div>
        ))}
      </div>

      <PlaceholderUpload
        label="Task intake"
        helperText="Drag and drop intake spreadsheets or CSVs."
      />
    </div>
  );
}
