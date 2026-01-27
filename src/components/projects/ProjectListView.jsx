"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";

import ActionButton from "@/components/ui/ActionButton";
import { useToast } from "@/components/ui/ToastProvider";
import ProjectModal from "@/components/projects/ProjectModal";
import PageHeader from "@/components/layout/PageHeader";

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
        <tr key={project.id} className="border-t border-[color:var(--color-border)] text-sm">
          <td className="px-4 py-3 text-[color:var(--color-text)]">
            <p className="font-semibold">{project.name}</p>
          </td>
          <td className="px-4 py-3 text-[color:var(--color-text-muted)]">
            {project.description || "No description provided."}
          </td>
          <td className="px-4 py-3">
            <span className="rounded-full border border-[color:var(--color-border)] px-2 py-1 text-xs text-[color:var(--color-text-muted)]">
              {project.status}
            </span>
          </td>
          <td className="px-4 py-3 text-right">
            <details className="relative inline-block">
              <summary className="cursor-pointer rounded-full border border-[color:var(--color-border)] px-3 py-1 text-xs text-[color:var(--color-text-muted)]">
                Actions
              </summary>
              <div className="absolute right-0 z-10 mt-2 w-32 rounded-xl border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-2 text-xs text-[color:var(--color-text)] shadow-xl">
                <Link
                  href={`/projects/${project.id}`}
                  className="block rounded-md px-2 py-1 text-[color:var(--color-text)] hover:bg-[color:var(--color-muted-bg)]"
                >
                  View
                </Link>
                {canManageProjects ? (
                  <button
                    type="button"
                    className="mt-1 w-full rounded-md px-2 py-1 text-left text-[color:var(--color-text)] hover:bg-[color:var(--color-muted-bg)]"
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
      <PageHeader
        eyebrow="Projects"
        title="Portfolio overview"
        subtitle="Track active initiatives across the organization."
        actions={
          canManageProjects ? (
            <ActionButton
              label="Create project"
              variant="success"
              onClick={openCreateModal}
            />
          ) : null
        }
        viewToggle={
          <div className="flex items-center rounded-full border border-[color:var(--color-border)] bg-[color:var(--color-muted-bg)] p-1 text-xs text-[color:var(--color-text-muted)]">
            <button
              type="button"
              onClick={() => setViewMode("grid")}
              className={`rounded-full px-3 py-1 transition ${
                viewMode === "grid"
                  ? "bg-[color:var(--color-accent-muted)] text-[color:var(--color-accent)]"
                  : ""
              }`}
            >
              Grid
            </button>
            <button
              type="button"
              onClick={() => setViewMode("list")}
              className={`rounded-full px-3 py-1 transition ${
                viewMode === "list"
                  ? "bg-[color:var(--color-accent-muted)] text-[color:var(--color-accent)]"
                  : ""
              }`}
            >
              List
            </button>
          </div>
        }
      />

      {status.loading && (
        <div className="rounded-2xl border border-[color:var(--color-border)] bg-[color:var(--color-card)] p-6 text-sm text-[color:var(--color-text-muted)]">
          Loading projects...
        </div>
      )}
      {!status.loading && status.error && (
        <div className="space-y-3 rounded-2xl border border-rose-500/30 bg-rose-500/10 p-6 text-sm text-rose-200">
          <p>{status.error}</p>
          <ActionButton label="Retry" variant="secondary" onClick={loadProjects} />
        </div>
      )}
      {!status.loading && !status.error && !projects.length && (
        <div className="rounded-2xl border border-dashed border-[color:var(--color-border)] bg-[color:var(--color-card)] p-6 text-sm text-[color:var(--color-text-muted)]">
          No projects yet. Create one to begin planning milestones.
        </div>
      )}

      {!status.loading && !status.error && projects.length ? (
        viewMode === "grid" ? (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {projects.map((project) => (
              <div
                key={project.id}
                className="rounded-2xl border border-[color:var(--color-border)] bg-[color:var(--color-card)] p-5"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-sm font-semibold text-[color:var(--color-text)]">
                      {project.name}
                    </p>
                    <p className="mt-2 text-xs text-[color:var(--color-text-muted)]">
                      {project.description || "No description provided."}
                    </p>
                  </div>
                  <span className="rounded-full border border-[color:var(--color-border)] px-2 py-1 text-[11px] text-[color:var(--color-text-muted)]">
                    {project.status}
                  </span>
                </div>
                <div className="mt-4 flex items-center justify-between gap-2">
                  <Link
                    href={`/projects/${project.id}`}
                    className="text-xs font-semibold text-emerald-500 hover:text-emerald-400"
                  >
                    View project →
                  </Link>
                  <details className="relative inline-block text-xs text-[color:var(--color-text-muted)]">
                    <summary className="cursor-pointer rounded-full border border-[color:var(--color-border)] px-3 py-1">
                      Actions
                    </summary>
                    <div className="absolute right-0 z-10 mt-2 w-32 rounded-xl border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-2 text-xs text-[color:var(--color-text)] shadow-xl">
                      <Link
                        href={`/projects/${project.id}`}
                        className="block rounded-md px-2 py-1 text-[color:var(--color-text)] hover:bg-[color:var(--color-muted-bg)]"
                      >
                        View
                      </Link>
                      {canManageProjects ? (
                        <button
                          type="button"
                          className="mt-1 w-full rounded-md px-2 py-1 text-left text-[color:var(--color-text)] hover:bg-[color:var(--color-muted-bg)]"
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
          <div className="overflow-hidden rounded-2xl border border-[color:var(--color-border)] bg-[color:var(--color-card)]">
            <table className="w-full text-left text-sm">
              <thead className="bg-[color:var(--color-surface-muted)] text-xs uppercase tracking-[0.2em] text-[color:var(--color-text-subtle)]">
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
