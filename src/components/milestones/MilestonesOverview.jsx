"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import MilestoneCard from "@/components/milestones/MilestoneCard";
import ActionButton from "@/components/ui/ActionButton";
import { useToast } from "@/components/ui/ToastProvider";
import { getMilestoneProgress } from "@/lib/milestoneProgress";

const buildErrorMessage = (data) =>
  data?.error ?? data?.message ?? "Unable to load milestones.";

export default function MilestonesOverview() {
  const { addToast } = useToast();
  const [milestones, setMilestones] = useState([]);
  const [status, setStatus] = useState({ loading: true, error: null });
  const [projectFilter, setProjectFilter] = useState("ALL");
  const [statusFilter, setStatusFilter] = useState("ALL");

  const loadMilestones = useCallback(async () => {
    setStatus({ loading: true, error: null });
    try {
      const response = await fetch("/api/milestones");
      const data = await response.json();

      if (!response.ok) {
        throw new Error(buildErrorMessage(data));
      }

      setMilestones(data?.milestones ?? []);
      setStatus({ loading: false, error: null });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unable to load milestones.";
      setStatus({ loading: false, error: message });
      addToast({
        title: "Milestones unavailable",
        message,
        variant: "error",
      });
    }
  }, [addToast]);

  useEffect(() => {
    loadMilestones();
  }, [loadMilestones]);

  const projectOptions = useMemo(() => {
    const map = new Map();
    milestones.forEach((milestone) => {
      if (milestone.project) {
        map.set(milestone.project.id, milestone.project.name);
      }
    });
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
  }, [milestones]);

  const filteredMilestones = useMemo(() => {
    return milestones.filter((milestone) => {
      if (projectFilter !== "ALL" && milestone.project?.id !== projectFilter) {
        return false;
      }

      if (statusFilter !== "ALL") {
        const { remainingDays } = getMilestoneProgress(
          milestone.startDate,
          milestone.endDate
        );
        const isExpired = remainingDays === 0;
        if (statusFilter === "ACTIVE" && isExpired) {
          return false;
        }
        if (statusFilter === "EXPIRED" && !isExpired) {
          return false;
        }
      }

      return true;
    });
  }, [milestones, projectFilter, statusFilter]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 rounded-2xl border border-white/10 bg-white/5 p-6 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-white/40">
            Milestones
          </p>
          <h2 className="mt-2 text-2xl font-semibold text-white">
            Global milestone tracking
          </h2>
          <p className="mt-2 text-sm text-white/60">
            Monitor active checkpoints across every project in the workspace.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex flex-col gap-1 text-xs text-white/60">
            Project
            <select
              className="rounded-xl border border-white/10 bg-slate-950/60 px-3 py-2 text-sm text-white"
              value={projectFilter}
              onChange={(event) => setProjectFilter(event.target.value)}
            >
              <option value="ALL">All projects</option>
              {projectOptions.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.name}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1 text-xs text-white/60">
            Status
            <select
              className="rounded-xl border border-white/10 bg-slate-950/60 px-3 py-2 text-sm text-white"
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
            >
              <option value="ALL">All statuses</option>
              <option value="ACTIVE">Active</option>
              <option value="EXPIRED">Expired</option>
            </select>
          </div>
        </div>
      </div>

      {status.loading && (
        <div className="rounded-2xl border border-white/10 bg-white/5 p-6 text-sm text-white/60">
          Loading milestones...
        </div>
      )}

      {!status.loading && status.error && (
        <div className="space-y-3 rounded-2xl border border-rose-500/30 bg-rose-500/10 p-6 text-sm text-rose-100">
          <p>{status.error}</p>
          <ActionButton label="Retry" variant="secondary" onClick={loadMilestones} />
        </div>
      )}

      {!status.loading && !status.error && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-white">Milestone feed</p>
            <span className="text-xs text-white/60">
              {filteredMilestones.length} total
            </span>
          </div>
          {filteredMilestones.length ? (
            <div className="grid gap-4 lg:grid-cols-2">
              {filteredMilestones.map((milestone) => (
                <MilestoneCard
                  key={milestone.id}
                  milestone={milestone}
                  href={`/milestones/${milestone.id}`}
                />
              ))}
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-white/20 bg-white/5 p-6 text-center text-sm text-white/60">
              No milestones yet.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
