"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import MilestoneCard from "@/components/milestones/MilestoneCard";
import ActionButton from "@/components/ui/ActionButton";
import { useToast } from "@/components/ui/ToastProvider";
import { getMilestoneStatus } from "@/lib/milestoneProgress";
import PageHeader from "@/components/layout/PageHeader";
import Modal from "@/components/ui/Modal";
import ViewToggle from "@/components/ui/ViewToggle";
import { getTodayInPSTDateString } from "@/lib/pstDate";

const VIEW_PREFERENCE_KEY = "pms.milestones.view";

const buildErrorMessage = (data) =>
  data?.error ?? data?.message ?? "Unable to load milestones.";

export default function MilestonesOverview() {
  const { addToast } = useToast();
  const [milestones, setMilestones] = useState([]);
  const [projects, setProjects] = useState([]);
  const [status, setStatus] = useState({ loading: true, error: null });
  const [projectFilter, setProjectFilter] = useState("ALL");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [viewMode, setViewMode] = useState("grid");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [milestoneForm, setMilestoneForm] = useState({
    title: "",
    startDate: "",
    endDate: "",
    projectId: "",
  });

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

  useEffect(() => {
    const stored =
      typeof window !== "undefined"
        ? window.localStorage.getItem(VIEW_PREFERENCE_KEY)
        : null;
    if (stored === "grid" || stored === "list") {
      setViewMode(stored);
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(VIEW_PREFERENCE_KEY, viewMode);
  }, [viewMode]);

  const loadProjects = useCallback(async () => {
    try {
      const response = await fetch("/api/projects");
      const data = await response.json();
      if (!response.ok) {
        throw new Error(buildErrorMessage(data));
      }
      setProjects(data?.projects ?? []);
      setMilestoneForm((prev) => ({
        ...prev,
        projectId: data?.projects?.[0]?.id ?? "",
      }));
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unable to load projects.";
      addToast({
        title: "Projects unavailable",
        message,
        variant: "error",
      });
    }
  }, [addToast]);

  useEffect(() => {
    if (!isModalOpen) return;
    loadProjects();
  }, [isModalOpen, loadProjects]);

  const handleCreateMilestone = async (event) => {
    event.preventDefault();
    if (!milestoneForm.title.trim() || !milestoneForm.projectId) {
      addToast({
        title: "Milestone details needed",
        message: "Add a title and project to continue.",
        variant: "warning",
      });
      return;
    }

    setIsSaving(true);
    try {
      const response = await fetch("/api/milestones", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: milestoneForm.title,
          startDate: milestoneForm.startDate,
          endDate: milestoneForm.endDate,
          projectId: milestoneForm.projectId,
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(buildErrorMessage(data));
      }

      addToast({
        title: "Milestone created",
        message: "Timeline checkpoint added.",
        variant: "success",
      });
      const today = getTodayInPSTDateString();
      setMilestoneForm({
        title: "",
        startDate: today,
        endDate: today,
        projectId: projects[0]?.id ?? "",
      });
      setIsModalOpen(false);
      loadMilestones();
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unable to create milestone.";
      addToast({
        title: "Milestone creation failed",
        message,
        variant: "error",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleMilestoneNavigate = (milestone) => {
    if (!milestone?.project?.id || !milestone?.id) {
      addToast({
        title: "Milestone link unavailable",
        message: "This milestone is missing project details.",
        variant: "warning",
      });
    }
  };

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
        const { state } = getMilestoneStatus(
          milestone.startDate,
          milestone.endDate
        );
        const isExpired = state === "overdue";
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
      <PageHeader
        eyebrow="Milestones"
        title="Global milestone tracking"
        subtitle="Monitor active checkpoints across every project in the workspace."
        actions={
          <ActionButton
            label="Create milestone"
            variant="success"
            onClick={() => {
              const today = getTodayInPSTDateString();
              setMilestoneForm((prev) => ({
                ...prev,
                startDate: today,
                endDate: today,
              }));
              setIsModalOpen(true);
            }}
          />
        }
        viewToggle={
          <ViewToggle value={viewMode} onChange={setViewMode} />
        }
      />

      <div className="flex flex-wrap items-end gap-4 rounded-2xl border border-[color:var(--color-border)] bg-[color:var(--color-card)] p-4">
        <div className="flex flex-col gap-1 text-xs text-[color:var(--color-text-muted)]">
          Project
          <select
            className="rounded-xl border border-[color:var(--color-border)] bg-[color:var(--color-input)] px-3 py-2 text-sm text-[color:var(--color-text)]"
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
        <div className="flex flex-col gap-1 text-xs text-[color:var(--color-text-muted)]">
          Status
          <select
            className="rounded-xl border border-[color:var(--color-border)] bg-[color:var(--color-input)] px-3 py-2 text-sm text-[color:var(--color-text)]"
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value)}
          >
            <option value="ALL">All statuses</option>
            <option value="ACTIVE">Active</option>
            <option value="EXPIRED">Expired</option>
          </select>
        </div>
      </div>

      {status.loading && (
        <div className="rounded-2xl border border-[color:var(--color-border)] bg-[color:var(--color-card)] p-6 text-sm text-[color:var(--color-text-muted)]">
          Loading milestones...
        </div>
      )}

      {!status.loading && status.error && (
        <div className="space-y-3 rounded-2xl border border-rose-500/30 bg-rose-500/10 p-6 text-sm text-rose-200">
          <p>{status.error}</p>
          <ActionButton label="Retry" variant="secondary" onClick={loadMilestones} />
        </div>
      )}

      {!status.loading && !status.error && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-[color:var(--color-text)]">
              Milestone feed
            </p>
            <span className="text-xs text-[color:var(--color-text-muted)]">
              {filteredMilestones.length} total
            </span>
          </div>
          {filteredMilestones.length ? (
            <div
              className={
                viewMode === "grid"
                  ? "grid gap-4 lg:grid-cols-2"
                  : "flex flex-col gap-3"
              }
            >
              {filteredMilestones.map((milestone) => (
                <MilestoneCard
                  key={milestone.id}
                  milestone={milestone}
                  href={
                    milestone.project?.id
                      ? `/projects/${milestone.project.id}/milestones/${milestone.id}`
                      : undefined
                  }
                  onClick={
                    milestone.project?.id
                      ? undefined
                      : () => handleMilestoneNavigate(milestone)
                  }
                />
              ))}
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-[color:var(--color-border)] bg-[color:var(--color-card)] p-6 text-center text-sm text-[color:var(--color-text-muted)]">
              No milestones yet.
            </div>
          )}
        </div>
      )}

      <Modal
        isOpen={isModalOpen}
        title="Create milestone"
        description="Set dates to anchor the milestone timeline."
        onClose={isSaving ? undefined : () => setIsModalOpen(false)}
      >
        <form onSubmit={handleCreateMilestone} className="space-y-4">
          <label className="text-xs text-[color:var(--color-text-muted)]">
            Milestone title
            <input
              className="mt-1 w-full rounded-xl border border-[color:var(--color-border)] bg-[color:var(--color-input)] px-3 py-2 text-sm text-[color:var(--color-text)]"
              value={milestoneForm.title}
              onChange={(event) =>
                setMilestoneForm((prev) => ({
                  ...prev,
                  title: event.target.value,
                }))
              }
            />
          </label>
          <label className="text-xs text-[color:var(--color-text-muted)]">
            Project
            <select
              className="mt-1 w-full rounded-xl border border-[color:var(--color-border)] bg-[color:var(--color-input)] px-3 py-2 text-sm text-[color:var(--color-text)]"
              value={milestoneForm.projectId}
              onChange={(event) =>
                setMilestoneForm((prev) => ({
                  ...prev,
                  projectId: event.target.value,
                }))
              }
            >
              {projects.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.name}
                </option>
              ))}
            </select>
          </label>
          <div className="grid gap-3 md:grid-cols-2">
            <label className="text-xs text-[color:var(--color-text-muted)]">
              Start date
              <input
                type="date"
                className="mt-1 w-full rounded-xl border border-[color:var(--color-border)] bg-[color:var(--color-input)] px-3 py-2 text-sm text-[color:var(--color-text)]"
                value={milestoneForm.startDate}
                onChange={(event) =>
                  setMilestoneForm((prev) => ({
                    ...prev,
                    startDate: event.target.value,
                  }))
                }
              />
            </label>
            <label className="text-xs text-[color:var(--color-text-muted)]">
              End date
              <input
                type="date"
                className="mt-1 w-full rounded-xl border border-[color:var(--color-border)] bg-[color:var(--color-input)] px-3 py-2 text-sm text-[color:var(--color-text)]"
                value={milestoneForm.endDate}
                onChange={(event) =>
                  setMilestoneForm((prev) => ({
                    ...prev,
                    endDate: event.target.value,
                  }))
                }
              />
            </label>
          </div>
          <div className="flex flex-wrap justify-end gap-2">
            <ActionButton
              label="Cancel"
              variant="secondary"
              onClick={() => setIsModalOpen(false)}
              className={isSaving ? "pointer-events-none opacity-60" : ""}
            />
            <ActionButton
              label={isSaving ? "Saving..." : "Create milestone"}
              variant="primary"
              type="submit"
              className={isSaving ? "pointer-events-none opacity-60" : ""}
            />
          </div>
        </form>
      </Modal>
    </div>
  );
}
