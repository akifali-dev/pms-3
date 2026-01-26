"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";

import ActionButton from "@/components/ui/ActionButton";
import { useToast } from "@/components/ui/ToastProvider";
import ProjectModal from "@/components/projects/ProjectModal";

const VIEW_PREFERENCE_KEY = "pms.projects.view";

const buildErrorMessage = (data) =>
  data?.error ?? data?.message ?? "Unable to load project data.";

const normalizeProject = (project) => ({
  id: project.id,
  name: project.name,
  description: project.description ?? "",
  status: project.status ?? "Active",
});

export default function ProjectListView({ canManageProjects }) {
  const { addToast } = useToast();
  const [projects, setProjects] = useState([]);
  const [status, setStatus] = useState({ loading: true, error: null });
  const [viewMode, setViewMode] = useState("grid");
  const [modalState, setModalState] = useState({
    open: false,
    mode: "create",
    project: null,
  });

  const loadProjects = useCallback(async () => {
    setStatus({ loading: true, error: null });
    try {
      const response = await fetch("/api/projects");
      const data = await response.json();
      if (!response.ok) {
        throw new Error(buildErrorMessage(data));
      }

      const normalized = (data?.projects ?? []).map((project) =>
        normalizeProject(project)
      );
      setProjects(normalized);
      setStatus({ loading: false, error: null });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unable to load project data.";
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

  const openCreateModal = () => {
    setModalState({ open: true, mode: "create", project: null });
  };

  const openEditModal = (project) => {
    setModalState({ open: true, mode: "edit", project });
  };

  const closeModal = () => {
    setModalState({ open: false, mode: "create", project: null });
  };

  const projectRows = useMemo(
    () =>
      projects.map((project) => (
        <tr key={project.id} className="border-t border-white/10 text-sm">
          <td className="px-4 py-3 text-white">
            <p className="font-semibold">{project.name}</p>
          </td>
          <td className="px-4 py-3 text-white/60">
            {project.description || "No description provided."}
          </td>
          <td className="px-4 py-3">
            <span className="rounded-full border border-white/10 px-2 py-1 text-xs text-white/60">
              {project.status}
            </span>
          </td>
          <td className="px-4 py-3 text-right">
            <details className="relative inline-block">
              <summary className="cursor-pointer rounded-full border border-white/10 px-3 py-1 text-xs text-white/70">
                Actions
              </summary>
              <div className="absolute right-0 z-10 mt-2 w-32 rounded-xl border border-white/10 bg-slate-950 p-2 text-xs text-white shadow-xl">
                <Link
                  href={`/projects/${project.id}`}
                  className="block rounded-md px-2 py-1 text-white/80 hover:bg-white/10"
                >
                  View
                </Link>
                {canManageProjects ? (
                  <button
                    type="button"
                    className="mt-1 w-full rounded-md px-2 py-1 text-left text-white/80 hover:bg-white/10"
                    onClick={() => openEditModal(project)}
                  >
                    Edit
                  </button>
                ) : null}
              </div>
            </details>
          </td>
        </tr>
      )),
    [projects, canManageProjects]
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 rounded-2xl border border-white/10 bg-white/5 p-6 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-white/40">
            Projects
          </p>
          <h2 className="mt-2 text-2xl font-semibold text-white">
            Portfolio overview
          </h2>
          <p className="mt-2 text-sm text-white/60">
            Track active initiatives across the organization.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex rounded-full border border-white/10 bg-white/5 p-1 text-xs text-white/60">
            <button
              type="button"
              onClick={() => setViewMode("grid")}
              className={`rounded-full px-3 py-1 ${
                viewMode === "grid" ? "bg-white/10 text-white" : ""
              }`}
            >
              Grid
            </button>
            <button
              type="button"
              onClick={() => setViewMode("list")}
              className={`rounded-full px-3 py-1 ${
                viewMode === "list" ? "bg-white/10 text-white" : ""
              }`}
            >
              List
            </button>
          </div>
          {canManageProjects ? (
            <ActionButton
              label="Create project"
              variant="success"
              onClick={openCreateModal}
            />
          ) : null}
        </div>
      </div>

      {status.loading && (
        <div className="rounded-2xl border border-white/10 bg-white/5 p-6 text-sm text-white/60">
          Loading projects...
        </div>
      )}
      {!status.loading && status.error && (
        <div className="space-y-3 rounded-2xl border border-rose-500/30 bg-rose-500/10 p-6 text-sm text-rose-100">
          <p>{status.error}</p>
          <ActionButton label="Retry" variant="secondary" onClick={loadProjects} />
        </div>
      )}
      {!status.loading && !status.error && !projects.length && (
        <div className="rounded-2xl border border-dashed border-white/20 bg-white/5 p-6 text-sm text-white/60">
          No projects yet. Create one to begin planning milestones.
        </div>
      )}

      {!status.loading && !status.error && projects.length ? (
        viewMode === "grid" ? (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {projects.map((project) => (
              <div
                key={project.id}
                className="rounded-2xl border border-white/10 bg-slate-900/60 p-5"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-sm font-semibold text-white">
                      {project.name}
                    </p>
                    <p className="mt-2 text-xs text-white/60">
                      {project.description || "No description provided."}
                    </p>
                  </div>
                  <span className="rounded-full border border-white/10 px-2 py-1 text-[11px] text-white/60">
                    {project.status}
                  </span>
                </div>
                <div className="mt-4 flex items-center justify-between gap-2">
                  <Link
                    href={`/projects/${project.id}`}
                    className="text-xs text-emerald-200 hover:text-emerald-100"
                  >
                    View project →
                  </Link>
                  <details className="relative inline-block text-xs text-white/70">
                    <summary className="cursor-pointer rounded-full border border-white/10 px-3 py-1">
                      Actions
                    </summary>
                    <div className="absolute right-0 z-10 mt-2 w-32 rounded-xl border border-white/10 bg-slate-950 p-2 text-xs text-white shadow-xl">
                      <Link
                        href={`/projects/${project.id}`}
                        className="block rounded-md px-2 py-1 text-white/80 hover:bg-white/10"
                      >
                        View
                      </Link>
                      {canManageProjects ? (
                        <button
                          type="button"
                          className="mt-1 w-full rounded-md px-2 py-1 text-left text-white/80 hover:bg-white/10"
                          onClick={() => openEditModal(project)}
                        >
                          Edit
                        </button>
                      ) : null}
                    </div>
                  </details>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="overflow-hidden rounded-2xl border border-white/10 bg-slate-900/60">
            <table className="w-full text-left text-sm">
              <thead className="bg-white/5 text-xs uppercase tracking-[0.2em] text-white/40">
                <tr>
                  <th className="px-4 py-3">Project</th>
                  <th className="px-4 py-3">Description</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>{projectRows}</tbody>
            </table>
          </div>
        )
      ) : null}

      <ProjectModal
        isOpen={modalState.open}
        mode={modalState.mode}
        initialValues={modalState.project}
        onClose={closeModal}
        onSuccess={loadProjects}
      />
    </div>
  );
}
