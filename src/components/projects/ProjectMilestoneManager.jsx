"use client";

import { useCallback, useMemo, useState, useEffect } from "react";

import ActionButton from "@/components/ui/ActionButton";
import { useToast } from "@/components/ui/ToastProvider";

const dayMs = 1000 * 60 * 60 * 24;

const normalizeDate = (value) => {
  if (!value) return null;
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return null;
  return date;
};

const formatDateInput = (value) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().split("T")[0];
};

const getDurationDays = (startDate, endDate) => {
  if (!startDate || !endDate) return null;
  const start = normalizeDate(startDate);
  const end = normalizeDate(endDate);
  if (!start || !end || end < start) return null;
  return Math.floor((end - start) / dayMs) + 1;
};

const getRemainingDays = (endDate) => {
  const end = normalizeDate(endDate);
  if (!end) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  if (end < today) return 0;
  return Math.ceil((end - today) / dayMs);
};

const getProgress = (startDate, endDate) => {
  const start = normalizeDate(startDate);
  const end = normalizeDate(endDate);
  if (!start || !end || end <= start) return 0;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const ratio = (today - start) / (end - start);
  return Math.min(1, Math.max(0, ratio));
};

const getHealth = (startDate, endDate) => {
  const end = normalizeDate(endDate);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  if (!end) {
    return { label: "Needs dates", style: "border-white/10 text-white/50" };
  }
  if (today > end) {
    return { label: "Overdue", style: "border-rose-500/30 text-rose-200" };
  }
  const remaining = getRemainingDays(endDate);
  const progress = getProgress(startDate, endDate);
  if ((remaining !== null && remaining <= 5) || progress >= 0.8) {
    return { label: "At-risk", style: "border-amber-500/30 text-amber-200" };
  }
  return { label: "On-track", style: "border-emerald-500/30 text-emerald-200" };
};

const normalizeProject = (project, milestones = []) => ({
  id: project.id,
  name: project.name,
  description: project.description ?? "",
  createdBy: project.createdBy ?? null,
  milestones,
});

const normalizeMilestone = (milestone) => ({
  id: milestone.id,
  title: milestone.title,
  startDate: formatDateInput(milestone.startDate),
  endDate: formatDateInput(milestone.endDate),
  projectId: milestone.projectId,
});

const buildErrorMessage = (data) =>
  data?.error ?? data?.message ?? "Unable to load project data.";

export default function ProjectMilestoneManager() {
  const { addToast } = useToast();
  const [projects, setProjects] = useState([]);
  const [selectedProjectId, setSelectedProjectId] = useState(null);
  const [projectForm, setProjectForm] = useState({
    name: "",
    description: "",
  });
  const [editingProjectId, setEditingProjectId] = useState(null);
  const [milestoneForm, setMilestoneForm] = useState({
    title: "",
    startDate: "",
    endDate: "",
  });
  const [editingMilestoneId, setEditingMilestoneId] = useState(null);
  const [status, setStatus] = useState({ loading: true, error: null });
  const [savingProject, setSavingProject] = useState(false);
  const [savingMilestone, setSavingMilestone] = useState(false);
  const [deletingProjectId, setDeletingProjectId] = useState(null);
  const [deletingMilestoneId, setDeletingMilestoneId] = useState(null);

  const loadProjects = useCallback(async () => {
    setStatus({ loading: true, error: null });
    try {
      const [projectsResponse, milestonesResponse] = await Promise.all([
        fetch("/api/projects"),
        fetch("/api/milestones"),
      ]);

      const projectsData = await projectsResponse.json();
      const milestonesData = await milestonesResponse.json();

      if (!projectsResponse.ok) {
        throw new Error(buildErrorMessage(projectsData));
      }
      if (!milestonesResponse.ok) {
        throw new Error(buildErrorMessage(milestonesData));
      }

      const milestonesByProject = new Map();
      (milestonesData?.milestones ?? []).forEach((milestone) => {
        const normalized = normalizeMilestone(milestone);
        if (!milestonesByProject.has(normalized.projectId)) {
          milestonesByProject.set(normalized.projectId, []);
        }
        milestonesByProject.get(normalized.projectId).push(normalized);
      });

      const normalizedProjects = (projectsData?.projects ?? []).map((project) =>
        normalizeProject(project, milestonesByProject.get(project.id) ?? [])
      );

      setProjects(normalizedProjects);
      setSelectedProjectId((prev) => {
        if (prev && normalizedProjects.some((project) => project.id === prev)) {
          return prev;
        }
        return normalizedProjects[0]?.id ?? null;
      });
      setStatus({ loading: false, error: null });
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Unable to load project data.";
      setStatus({ loading: false, error: message });
      addToast({
        title: "Projects unavailable",
        message,
        variant: "error",
      });
    }
  }, [addToast]);

  useEffect(() => {
    loadProjects();
  }, [loadProjects]);

  const selectedProject = useMemo(
    () => projects.find((project) => project.id === selectedProjectId) ?? null,
    [projects, selectedProjectId]
  );

  const resetProjectForm = () => {
    setProjectForm({ name: "", description: "" });
    setEditingProjectId(null);
  };

  const resetMilestoneForm = () => {
    setMilestoneForm({ title: "", startDate: "", endDate: "" });
    setEditingMilestoneId(null);
  };

  const handleProjectSubmit = async (event) => {
    event.preventDefault();
    if (!projectForm.name.trim()) {
      addToast({
        title: "Project name needed",
        message: "Add a project name to continue.",
        variant: "warning",
      });
      return;
    }

    setSavingProject(true);
    const payload = {
      name: projectForm.name,
      description: projectForm.description,
    };

    try {
      const response = await fetch(
        editingProjectId ? `/api/projects/${editingProjectId}` : "/api/projects",
        {
          method: editingProjectId ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(buildErrorMessage(data));
      }

      if (editingProjectId) {
        setProjects((prev) =>
          prev.map((project) => {
            if (project.id !== editingProjectId) {
              return project;
            }
            return {
              ...normalizeProject(data.project, project.milestones ?? []),
            };
          })
        );
        addToast({
          title: "Project updated",
          message: "Project details are synced.",
          variant: "success",
        });
      } else {
        const nextProject = normalizeProject(data.project, []);
        setProjects((prev) => [nextProject, ...prev]);
        setSelectedProjectId(nextProject.id);
        addToast({
          title: "Project created",
          message: "New project added to the portfolio.",
          variant: "success",
        });
      }

      resetProjectForm();
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unable to save project.";
      addToast({
        title: "Project update failed",
        message,
        variant: "error",
      });
    } finally {
      setSavingProject(false);
    }
  };

  const handleProjectEdit = (project) => {
    setEditingProjectId(project.id);
    setSelectedProjectId(project.id);
    setProjectForm({
      name: project.name,
      description: project.description ?? "",
    });
  };

  const handleProjectDelete = async (projectId) => {
    setDeletingProjectId(projectId);
    try {
      const response = await fetch(`/api/projects/${projectId}`, {
        method: "DELETE",
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(buildErrorMessage(data));
      }

      setProjects((prev) => prev.filter((project) => project.id !== projectId));
      if (selectedProjectId === projectId) {
        const next = projects.find((project) => project.id !== projectId);
        setSelectedProjectId(next?.id ?? null);
      }
      addToast({
        title: "Project removed",
        message: "Project archived from the workspace.",
        variant: "info",
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unable to delete project.";
      addToast({
        title: "Project removal failed",
        message,
        variant: "error",
      });
    } finally {
      setDeletingProjectId(null);
    }
  };

  const handleMilestoneSubmit = async (event) => {
    event.preventDefault();
    if (!selectedProject) {
      addToast({
        title: "Select a project",
        message: "Choose a project before adding milestones.",
        variant: "warning",
      });
      return;
    }

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
      const payload = {
        title: milestoneForm.title,
        startDate: milestoneForm.startDate,
        endDate: milestoneForm.endDate,
        projectId: selectedProject.id,
      };

      const response = await fetch(
        editingMilestoneId
          ? `/api/milestones/${editingMilestoneId}`
          : "/api/milestones",
        {
          method: editingMilestoneId ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(buildErrorMessage(data));
      }

      const normalizedMilestone = normalizeMilestone(data.milestone);

      if (editingMilestoneId) {
        setProjects((prev) =>
          prev.map((project) => {
            if (project.id !== selectedProject.id) {
              return project;
            }
            return {
              ...project,
              milestones: project.milestones.map((milestone) =>
                milestone.id === editingMilestoneId
                  ? normalizedMilestone
                  : milestone
              ),
            };
          })
        );
        addToast({
          title: "Milestone updated",
          message: "Milestone details refreshed.",
          variant: "success",
        });
      } else {
        setProjects((prev) =>
          prev.map((project) =>
            project.id === selectedProject.id
              ? {
                  ...project,
                  milestones: [normalizedMilestone, ...project.milestones],
                }
              : project
          )
        );
        addToast({
          title: "Milestone created",
          message: "Timeline checkpoint added.",
          variant: "success",
        });
      }

      resetMilestoneForm();
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

  const handleMilestoneEdit = (milestone) => {
    setEditingMilestoneId(milestone.id);
    setMilestoneForm({
      title: milestone.title,
      startDate: milestone.startDate,
      endDate: milestone.endDate,
    });
  };

  const handleMilestoneDelete = async (milestoneId) => {
    if (!selectedProject) return;
    setDeletingMilestoneId(milestoneId);
    try {
      const response = await fetch(`/api/milestones/${milestoneId}`, {
        method: "DELETE",
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(buildErrorMessage(data));
      }

      setProjects((prev) =>
        prev.map((project) =>
          project.id === selectedProject.id
            ? {
                ...project,
                milestones: project.milestones.filter(
                  (milestone) => milestone.id !== milestoneId
                ),
              }
            : project
        )
      );
      addToast({
        title: "Milestone removed",
        message: "Milestone removed from the timeline.",
        variant: "info",
      });
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Unable to delete milestone.";
      addToast({
        title: "Milestone removal failed",
        message,
        variant: "error",
      });
    } finally {
      setDeletingMilestoneId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 rounded-2xl border border-white/10 bg-white/5 p-6 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-white/40">
            Projects & milestones
          </p>
          <h2 className="mt-2 text-2xl font-semibold text-white">
            Plan projects with milestone timelines
          </h2>
          <p className="mt-2 text-sm text-white/60">
            Milestones are planning-only checkpoints and do not impact reporting
            yet.
          </p>
        </div>
        <ActionButton
          label="New project"
          variant="success"
          onClick={() => {
            resetProjectForm();
            setSelectedProjectId(selectedProjectId ?? null);
          }}
          toast={{
            title: "Project draft",
            message: "Use the form to capture new project details.",
            variant: "info",
          }}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
        <div className="space-y-4">
          <div className="rounded-2xl border border-white/10 bg-slate-900/60 p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-white/40">
              Project roster
            </p>
            <div className="mt-4 space-y-3">
              {status.loading && (
                <div className="rounded-xl border border-white/10 bg-white/5 p-4 text-xs text-white/60">
                  Loading projects...
                </div>
              )}
              {!status.loading && status.error && (
                <div className="space-y-2 rounded-xl border border-rose-500/30 bg-rose-500/10 p-4 text-xs text-rose-100">
                  <p>{status.error}</p>
                  <ActionButton
                    label="Retry"
                    variant="secondary"
                    onClick={loadProjects}
                  />
                </div>
              )}
              {!status.loading && !status.error && !projects.length && (
                <div className="rounded-xl border border-dashed border-white/20 bg-white/5 p-4 text-xs text-white/60">
                  No projects yet. Create one to begin planning milestones.
                </div>
              )}
              {!status.loading &&
                !status.error &&
                projects.map((project) => (
                  <button
                    key={project.id}
                    type="button"
                    onClick={() => setSelectedProjectId(project.id)}
                    className={`w-full rounded-2xl border p-4 text-left transition hover:border-white/30 hover:bg-white/5 ${
                      selectedProjectId === project.id
                        ? "border-emerald-500/50 bg-emerald-500/10"
                        : "border-white/10 bg-white/5"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="text-sm font-semibold text-white">
                          {project.name}
                        </p>
                        <p className="mt-1 text-xs text-white/60">
                          Created by {project.createdBy?.name ?? "Unknown"}
                        </p>
                      </div>
                      <span className="rounded-full border border-white/10 px-2 py-1 text-[11px] text-white/60">
                        {project.createdBy?.role ?? "Owner"}
                      </span>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2 text-[11px] text-white/60">
                      <span className="rounded-full border border-white/10 px-2 py-1">
                        {project.milestones.length} milestones
                      </span>
                      <span className="rounded-full border border-white/10 px-2 py-1">
                        Planning only
                      </span>
                    </div>
                  </button>
                ))}
            </div>
          </div>

          <form
            onSubmit={handleProjectSubmit}
            className="space-y-3 rounded-2xl border border-white/10 bg-slate-900/60 p-4"
          >
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-white/40">
                {editingProjectId ? "Edit project" : "Create project"}
              </p>
              <p className="mt-2 text-sm text-white/60">
                Capture initiative goals and project summaries.
              </p>
            </div>
            <div className="space-y-3">
              <label className="text-xs text-white/60">
                Project name
                <input
                  className="mt-1 w-full rounded-xl border border-white/10 bg-slate-950/60 px-3 py-2 text-sm text-white"
                  value={projectForm.name}
                  onChange={(event) =>
                    setProjectForm((prev) => ({
                      ...prev,
                      name: event.target.value,
                    }))
                  }
                />
              </label>
              <label className="text-xs text-white/60">
                Summary
                <textarea
                  rows={3}
                  className="mt-1 w-full rounded-xl border border-white/10 bg-slate-950/60 px-3 py-2 text-sm text-white"
                  value={projectForm.description}
                  onChange={(event) =>
                    setProjectForm((prev) => ({
                      ...prev,
                      description: event.target.value,
                    }))
                  }
                />
              </label>
            </div>
            <div className="flex flex-wrap gap-2">
              <ActionButton
                label={
                  savingProject
                    ? "Saving..."
                    : editingProjectId
                      ? "Save changes"
                      : "Create project"
                }
                variant="primary"
                type="submit"
                className={savingProject ? "pointer-events-none opacity-60" : ""}
              />
              {(editingProjectId || projectForm.name) && (
                <ActionButton
                  label="Clear"
                  variant="secondary"
                  onClick={resetProjectForm}
                />
              )}
            </div>
          </form>
        </div>

        <div className="space-y-6">
          <div className="rounded-2xl border border-white/10 bg-slate-900/60 p-5">
            {selectedProject ? (
              <div className="space-y-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-white">
                      {selectedProject.name}
                    </p>
                    <p className="mt-1 text-xs text-white/60">
                      Created by {selectedProject.createdBy?.name ?? "Unknown"}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full border border-white/10 px-3 py-1 text-xs text-white/60">
                      Owner: {selectedProject.createdBy?.name ?? "Unassigned"}
                    </span>
                    <ActionButton
                      label="Edit"
                      size="sm"
                      variant="secondary"
                      onClick={() => handleProjectEdit(selectedProject)}
                    />
                    <ActionButton
                      label={
                        deletingProjectId === selectedProject.id
                          ? "Deleting..."
                          : "Delete"
                      }
                      size="sm"
                      variant="danger"
                      className={
                        deletingProjectId === selectedProject.id
                          ? "pointer-events-none opacity-60"
                          : ""
                      }
                      onClick={() => handleProjectDelete(selectedProject.id)}
                    />
                  </div>
                </div>
                <p className="text-sm text-white/70">
                  {selectedProject.description ||
                    "Add a short summary for this project."}
                </p>
              </div>
            ) : (
              <p className="text-sm text-white/60">
                Select a project to manage milestones.
              </p>
            )}
          </div>

          <form
            onSubmit={handleMilestoneSubmit}
            className="space-y-4 rounded-2xl border border-white/10 bg-slate-900/60 p-5"
          >
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-white/40">
                {editingMilestoneId ? "Edit milestone" : "Create milestone"}
              </p>
              <p className="mt-2 text-sm text-white/60">
                Set dates to auto-calculate duration and time remaining.
              </p>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <label className="text-xs text-white/60 md:col-span-2">
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
              <div className="rounded-xl border border-white/10 bg-white/5 p-3 text-xs text-white/60">
                <p className="font-semibold text-white">Timeline preview</p>
                <p className="mt-1">
                  Duration:{" "}
                  <span className="text-white">
                    {getDurationDays(
                      milestoneForm.startDate,
                      milestoneForm.endDate
                    ) ?? "--"}
                  </span>{" "}
                  days
                </p>
                <p className="mt-1">
                  Time remaining:{" "}
                  <span className="text-white">
                    {getRemainingDays(milestoneForm.endDate) ?? "--"}
                  </span>{" "}
                  days
                </p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <ActionButton
                label={
                  savingMilestone
                    ? "Saving..."
                    : editingMilestoneId
                      ? "Save milestone"
                      : "Add milestone"
                }
                variant="primary"
                type="submit"
                className={savingMilestone ? "pointer-events-none opacity-60" : ""}
              />
              {(editingMilestoneId || milestoneForm.title) && (
                <ActionButton
                  label="Clear"
                  variant="secondary"
                  onClick={resetMilestoneForm}
                />
              )}
            </div>
          </form>

          <div className="space-y-3">
            {selectedProject?.milestones.map((milestone) => {
              const duration = getDurationDays(
                milestone.startDate,
                milestone.endDate
              );
              const remaining = getRemainingDays(milestone.endDate);
              const progress = getProgress(
                milestone.startDate,
                milestone.endDate
              );
              const health = getHealth(
                milestone.startDate,
                milestone.endDate
              );

              return (
                <div
                  key={milestone.id}
                  className="rounded-2xl border border-white/10 bg-slate-900/60 p-5"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-white">
                        {milestone.title}
                      </p>
                      <p className="mt-1 text-xs text-white/60">
                        {milestone.startDate && milestone.endDate
                          ? `${milestone.startDate} → ${milestone.endDate}`
                          : "Add start and end dates"}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={`rounded-full border px-3 py-1 text-xs ${health.style}`}
                      >
                        {health.label}
                      </span>
                    </div>
                  </div>

                  <div className="mt-4">
                    <div className="flex items-center justify-between text-xs text-white/60">
                      <span>Timeline progress</span>
                      <span>{Math.round(progress * 100)}%</span>
                    </div>
                    <div className="mt-2 h-2 rounded-full bg-white/10">
                      <div
                        className="h-2 rounded-full bg-emerald-400"
                        style={{ width: `${Math.round(progress * 100)}%` }}
                      />
                    </div>
                  </div>

                  <div className="mt-4 grid gap-3 text-xs text-white/60 sm:grid-cols-3">
                    <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                      <p className="text-[11px] uppercase tracking-[0.2em] text-white/40">
                        Duration
                      </p>
                      <p className="mt-1 text-sm text-white">
                        {duration ?? "--"} days
                      </p>
                    </div>
                    <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                      <p className="text-[11px] uppercase tracking-[0.2em] text-white/40">
                        Time remaining
                      </p>
                      <p className="mt-1 text-sm text-white">
                        {remaining ?? "--"} days
                      </p>
                    </div>
                    <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                      <p className="text-[11px] uppercase tracking-[0.2em] text-white/40">
                        Planning impact
                      </p>
                      <p className="mt-1 text-sm text-white">Planning only</p>
                    </div>
                  </div>

                  <div className="mt-4 flex flex-wrap gap-2">
                    <ActionButton
                      label="Edit"
                      size="sm"
                      variant="secondary"
                      onClick={() => handleMilestoneEdit(milestone)}
                    />
                    <ActionButton
                      label={
                        deletingMilestoneId === milestone.id
                          ? "Deleting..."
                          : "Delete"
                      }
                      size="sm"
                      variant="danger"
                      className={
                        deletingMilestoneId === milestone.id
                          ? "pointer-events-none opacity-60"
                          : ""
                      }
                      onClick={() => handleMilestoneDelete(milestone.id)}
                    />
                  </div>
                </div>
              );
            })}

            {!selectedProject?.milestones.length && (
              <div className="rounded-2xl border border-dashed border-white/20 bg-white/5 p-6 text-center text-sm text-white/60">
                Add milestones to visualize timelines for this project.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
