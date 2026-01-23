import ActionButton from "@/components/ui/ActionButton";
import PlaceholderUpload from "@/components/ui/PlaceholderUpload";
import TaskBoardContainer from "@/components/tasks/TaskBoardContainer";
import { getSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";

export default async function TasksPage() {
  const session = await getSession();
  const hasDatabase = Boolean(process.env.DATABASE_URL);
  const currentUser =
    hasDatabase && session?.email
      ? await prisma.user.findUnique({
          where: { email: session.email },
          select: { id: true },
        })
      : null;

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

      <TaskBoardContainer
        role={session?.role}
        currentUserId={currentUser?.id ?? null}
        hasDatabase={hasDatabase}
      />

      <PlaceholderUpload
        label="Task intake"
        helperText="Drag and drop intake spreadsheets or CSVs."
      />
    </div>
  );
}
