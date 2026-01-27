"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";

import ActionButton from "@/components/ui/ActionButton";
import Modal from "@/components/ui/Modal";
import { useToast } from "@/components/ui/ToastProvider";
import MilestoneCard from "@/components/milestones/MilestoneCard";

const formatDateInput = (value) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().split("T")[0];
};

const buildErrorMessage = (data) =>
  data?.error ?? data?.message ?? "Unable to load project data.";

export default function ProjectDetailView({ projectId, canManageMilestones }) {
  const { addToast } = useToast();
  const [project, setProject] = useState(null);
  const [milestones, setMilestones] = useState([]);
  const [status, setStatus] = useState({ loading: true, error: null });
  const [modalOpen, setModalOpen] = useState(false);
  const [savingMilestone, setSavingMilestone] = useState(false);
  const [milestoneForm, setMilestoneForm] = useState({
    title: "",
    startDate: "",
    endDate: "",
  });

  const loadProject = useCallback(async () => {
    setStatus({ loading: true, error: null });
    try {
      const [projectResponse, milestoneResponse] = await Promise.all([
        fetch(`/api/projects/${projectId}`),
        fetch(`/api/milestones?projectId=${projectId}`),
      ]);
      const projectData = await projectResponse.json();
      const milestoneData = await milestoneResponse.json();

      if (!projectResponse.ok) {
        throw new Error(buildErrorMessage(projectData));
      }
      if (!milestoneResponse.ok) {
        throw new Error(buildErrorMessage(milestoneData));
      }

      setProject(projectData.project);
      setMilestones(
        (milestoneData?.milestones ?? []).map((milestone) => ({
          id: milestone.id,
          title: milestone.title,
          startDate: formatDateInput(milestone.startDate),
          endDate: formatDateInput(milestone.endDate),
        }))
      );
      setStatus({ loading: false, error: null });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unable to load project data.";
      setStatus({ loading: false, error: message });
      addToast({
        title: "Project unavailable",
        message,
        variant: "error",
      });
    }
  }, [addToast, projectId]);

  useEffect(() => {
    loadProject();
  }, [loadProject]);

  const resetMilestoneForm = () => {
    setMilestoneForm({ title: "", startDate: "", endDate: "" });
  };

  const handleMilestoneSubmit = async (event) => {
    event.preventDefault();
    if (!milestoneForm.title.trim()) {
      addToast({
        title: "Milestone title needed",
        message: "Name the milestone to continue.",
        variant: "warning",
      });
      return;
    }

    setSavingMilestone(true);
    try {
      const response = await fetch("/api/milestones", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: milestoneForm.title,
          startDate: milestoneForm.startDate,
          endDate: milestoneForm.endDate,
          projectId,
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
      resetMilestoneForm();
      setModalOpen(false);
      loadProject();
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unable to save milestone.";
      addToast({
        title: "Milestone update failed",
        message,
        variant: "error",
      });
    } finally {
      setSavingMilestone(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 rounded-2xl border border-white/10 bg-white/5 p-6 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-white/40">
            Project workspace
          </p>
          <h2 className="mt-2 text-2xl font-semibold text-white">
            {project?.name ?? "Project overview"}
          </h2>
          <p className="mt-2 text-sm text-white/60">
            Manage milestones and planning checkpoints for this project.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href="/projects"
            className="rounded-full border border-white/10 px-4 py-2 text-xs text-white/70"
          >
            Back to projects
          </Link>
          {canManageMilestones ? (
            <ActionButton
              label="Create milestone"
              variant="primary"
              onClick={() => setModalOpen(true)}
            />
          ) : null}
        </div>
      </div>

      {status.loading && (
        <div className="rounded-2xl border border-white/10 bg-white/5 p-6 text-sm text-white/60">
          Loading project...
        </div>
      )}
      {!status.loading && status.error && (
        <div className="space-y-3 rounded-2xl border border-rose-500/30 bg-rose-500/10 p-6 text-sm text-rose-100">
          <p>{status.error}</p>
          <ActionButton label="Retry" variant="secondary" onClick={loadProject} />
        </div>
      )}

      {!status.loading && !status.error && project ? (
        <>
          <div className="rounded-2xl border border-white/10 bg-slate-900/60 p-5">
            <div className="space-y-2">
              <p className="text-sm font-semibold text-white">Overview</p>
              <p className="text-sm text-white/70">
                {project.description || "Add a short summary for this project."}
              </p>
            </div>
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-white">Milestones</p>
              <span className="text-xs text-white/60">
                {milestones.length} total
              </span>
            </div>
            {milestones.length ? (
              <div className="grid gap-4 lg:grid-cols-2">
                {milestones.map((milestone) => (
                  <MilestoneCard
                    key={milestone.id}
                    milestone={milestone}
                    href={`/projects/${projectId}/milestones/${milestone.id}`}
                  />
                ))}
              </div>
            ) : (
              <div className="rounded-2xl border border-dashed border-white/20 bg-white/5 p-6 text-center text-sm text-white/60">
                Add milestones to visualize timelines for this project.
              </div>
            )}
          </div>
        </>
      ) : null}

      <Modal
        isOpen={modalOpen}
        title="Create milestone"
        description="Set dates to anchor the milestone timeline."
        onClose={savingMilestone ? undefined : () => setModalOpen(false)}
      >
        <form onSubmit={handleMilestoneSubmit} className="space-y-4">
          <label className="text-xs text-white/60">
            Milestone title
            <input
              className="mt-1 w-full rounded-xl border border-white/10 bg-slate-950/60 px-3 py-2 text-sm text-white"
              value={milestoneForm.title}
              onChange={(event) =>
                setMilestoneForm((prev) => ({
                  ...prev,
                  title: event.target.value,
                }))
              }
            />
          </label>
          <div className="grid gap-3 md:grid-cols-2">
            <label className="text-xs text-white/60">
              Start date
              <input
                type="date"
                className="mt-1 w-full rounded-xl border border-white/10 bg-slate-950/60 px-3 py-2 text-sm text-white"
                value={milestoneForm.startDate}
                onChange={(event) =>
                  setMilestoneForm((prev) => ({
                    ...prev,
                    startDate: event.target.value,
                  }))
                }
              />
            </label>
            <label className="text-xs text-white/60">
              End date
              <input
                type="date"
                className="mt-1 w-full rounded-xl border border-white/10 bg-slate-950/60 px-3 py-2 text-sm text-white"
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
              onClick={() => setModalOpen(false)}
              className={savingMilestone ? "pointer-events-none opacity-60" : ""}
            />
            <ActionButton
              label={savingMilestone ? "Saving..." : "Create milestone"}
              variant="primary"
              type="submit"
              className={savingMilestone ? "pointer-events-none opacity-60" : ""}
            />
          </div>
        </form>
      </Modal>
    </div>
  );
}
