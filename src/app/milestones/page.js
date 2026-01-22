import Link from "next/link";

import ActionButton from "@/components/ui/ActionButton";

export default function MilestonesPage() {
  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-white/40">
          Milestones
        </p>
        <h2 className="mt-2 text-2xl font-semibold text-white">
          Milestones now live inside projects
        </h2>
        <p className="mt-2 text-sm text-white/60">
          Build timelines, track health, and manage milestone CRUD directly from
          the project workspace.
        </p>
        <div className="mt-4">
          <Link href="/projects">
            <ActionButton
              label="Go to projects"
              variant="primary"
              toast={{
                title: "Project workspace",
                message: "Manage milestones within each project.",
                variant: "info",
              }}
            />
          </Link>
        </div>
      </div>
    </div>
  );
}
