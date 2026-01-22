"use client";

import { useMemo, useState } from "react";

import ActionButton from "@/components/ui/ActionButton";
import { useToast } from "@/components/ui/ToastProvider";

const dayMs = 1000 * 60 * 60 * 24;

const initialProjects = [
  {
    id: "project-1",
    name: "Client onboarding refresh",
    owner: "Alex Monroe",
    status: "Discovery ready",
    description: "Rebuild the intake journey to reduce onboarding time.",
    milestones: [
      {
        id: "milestone-1",
        title: "Kickoff alignment",
        owner: "Program Ops",
        startDate: "2024-11-01",
        endDate: "2024-11-08",
      },
      {
        id: "milestone-2",
        title: "Prototype walkthrough",
        owner: "UX Team",
        startDate: "2024-11-12",
        endDate: "2024-11-20",
      },
    ],
  },
  {
    id: "project-2",
    name: "Automation rollout",
    owner: "Taylor Jordan",
    status: "Planning in progress",
    description: "Automate recurring QA cycles and reporting.",
    milestones: [
      {
        id: "milestone-3",
        title: "Workflow mapping",
        owner: "Delivery Ops",
        startDate: "2024-11-03",
        endDate: "2024-11-15",
      },
    ],
  },
  {
    id: "project-3",
    name: "Security compliance",
    owner: "Morgan Lee",
    status: "Requirements queued",
    description: "Prepare SOC 2 evidence collection and internal controls.",
    milestones: [
      {
        id: "milestone-4",
        title: "Gap analysis",
        owner: "Security",
        startDate: "2024-10-28",
        endDate: "2024-11-05",
      },
    ],
  },
];

const createId = () =>
  typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : `id-${Date.now()}-${Math.random().toString(16).slice(2)}`;

const normalizeDate = (value) => {
  if (!value) return null;
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return null;
  return date;
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

export default function ProjectMilestoneManager() {
  const { addToast } = useToast();
  const [projects, setProjects] = useState(initialProjects);
  const [selectedProjectId, setSelectedProjectId] = useState(
    initialProjects[0]?.id ?? null
  );
  const [projectForm, setProjectForm] = useState({
    name: "",
    owner: "",
    status: "",
    description: "",
  });
  const [editingProjectId, setEditingProjectId] = useState(null);
  const [milestoneForm, setMilestoneForm] = useState({
    title: "",
    owner: "",
    startDate: "",
    endDate: "",
  });
  const [editingMilestoneId, setEditingMilestoneId] = useState(null);

  const selectedProject = useMemo(
    () => projects.find((project) => project.id === selectedProjectId) ?? null,
    [projects, selectedProjectId]
  );

  const resetProjectForm = () => {
    setProjectForm({ name: "", owner: "", status: "", description: "" });
    setEditingProjectId(null);
  };

  const resetMilestoneForm = () => {
    setMilestoneForm({ title: "", owner: "", startDate: "", endDate: "" });
    setEditingMilestoneId(null);
  };

  const handleProjectSubmit = (event) => {
    event.preventDefault();
    if (!projectForm.name.trim()) {
      addToast({
        title: "Project name needed",
        message: "Add a project name to continue.",
        variant: "warning",
      });
      return;
    }

    if (editingProjectId) {
      setProjects((prev) =>
        prev.map((project) =>
          project.id === editingProjectId
            ? { ...project, ...projectForm }
            : project
        )
      );
      addToast({
        title: "Project updated",
        message: "Project details are synced.",
        variant: "success",
      });
    } else {
      const id = createId();
      const nextProject = {
        id,
        ...projectForm,
        milestones: [],
      };
      setProjects((prev) => [nextProject, ...prev]);
      setSelectedProjectId(id);
      addToast({
        title: "Project created",
        message: "New project added to the portfolio.",
        variant: "success",
      });
    }

    resetProjectForm();
  };

  const handleProjectEdit = (project) => {
    setEditingProjectId(project.id);
    setSelectedProjectId(project.id);
    setProjectForm({
      name: project.name,
      owner: project.owner,
      status: project.status,
      description: project.description,
    });
  };

  const handleProjectDelete = (projectId) => {
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
  };

  const handleMilestoneSubmit = (event) => {
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

    const updater = (milestones) =>
      milestones.map((milestone) =>
        milestone.id === editingMilestoneId
          ? { ...milestone, ...milestoneForm }
          : milestone
      );

    if (editingMilestoneId) {
      setProjects((prev) =>
        prev.map((project) =>
          project.id === selectedProject.id
            ? { ...project, milestones: updater(project.milestones) }
            : project
        )
      );
      addToast({
        title: "Milestone updated",
        message: "Milestone details refreshed.",
        variant: "success",
      });
    } else {
      const nextMilestone = { id: createId(), ...milestoneForm };
      setProjects((prev) =>
        prev.map((project) =>
          project.id === selectedProject.id
            ? {
                ...project,
                milestones: [nextMilestone, ...project.milestones],
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
  };

  const handleMilestoneEdit = (milestone) => {
    setEditingMilestoneId(milestone.id);
    setMilestoneForm({
      title: milestone.title,
      owner: milestone.owner,
      startDate: milestone.startDate,
      endDate: milestone.endDate,
    });
  };

  const handleMilestoneDelete = (milestoneId) => {
    if (!selectedProject) return;
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
            setSelectedProjectId(selectedProjectId ?? initialProjects[0]?.id);
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
              {projects.map((project) => (
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
                        {project.status}
                      </p>
                    </div>
                    <span className="rounded-full border border-white/10 px-2 py-1 text-[11px] text-white/60">
                      {project.owner}
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
                Capture owner, status, and initiative goals.
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
                Owner
                <input
                  className="mt-1 w-full rounded-xl border border-white/10 bg-slate-950/60 px-3 py-2 text-sm text-white"
                  value={projectForm.owner}
                  onChange={(event) =>
                    setProjectForm((prev) => ({
                      ...prev,
                      owner: event.target.value,
                    }))
                  }
                />
              </label>
              <label className="text-xs text-white/60">
                Status
                <input
                  className="mt-1 w-full rounded-xl border border-white/10 bg-slate-950/60 px-3 py-2 text-sm text-white"
                  value={projectForm.status}
                  onChange={(event) =>
                    setProjectForm((prev) => ({
                      ...prev,
                      status: event.target.value,
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
                label={editingProjectId ? "Save changes" : "Create project"}
                variant="primary"
                type="submit"
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
                      {selectedProject.status}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full border border-white/10 px-3 py-1 text-xs text-white/60">
                      Owner: {selectedProject.owner || "Unassigned"}
                    </span>
                    <ActionButton
                      label="Edit"
                      size="sm"
                      variant="secondary"
                      onClick={() => handleProjectEdit(selectedProject)}
                    />
                    <ActionButton
                      label="Delete"
                      size="sm"
                      variant="danger"
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
                Owner
                <input
                  className="mt-1 w-full rounded-xl border border-white/10 bg-slate-950/60 px-3 py-2 text-sm text-white"
                  value={milestoneForm.owner}
                  onChange={(event) =>
                    setMilestoneForm((prev) => ({
                      ...prev,
                      owner: event.target.value,
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
                label={editingMilestoneId ? "Save milestone" : "Add milestone"}
                variant="primary"
                type="submit"
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
                      <span className="rounded-full border border-white/10 px-3 py-1 text-xs text-white/60">
                        Owner: {milestone.owner || "Unassigned"}
                      </span>
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
                      <p className="mt-1 text-sm text-white">
                        Planning only
                      </p>
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
                      label="Delete"
                      size="sm"
                      variant="danger"
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
