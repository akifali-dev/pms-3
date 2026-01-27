"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import ActionButton from "@/components/ui/ActionButton";
import { useToast } from "@/components/ui/ToastProvider";
import ProjectModal from "@/components/projects/ProjectModal";
import PageHeader from "@/components/layout/PageHeader";
import ViewToggle from "@/components/ui/ViewToggle";
import useOutsideClick from "@/hooks/useOutsideClick";

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
  const router = useRouter();
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

  const ProjectActionMenu = ({ project }) => {
    const [isOpen, setIsOpen] = useState(false);
    const menuRef = useRef(null);

    useOutsideClick(menuRef, () => setIsOpen(false), isOpen);

    const handleView = () => {
      setIsOpen(false);
      router.push(`/projects/${project.id}`);
    };

    const handleEdit = () => {
      setIsOpen(false);
      openEditModal(project);
    };

    return (
      <div className="relative" ref={menuRef}>
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            setIsOpen((prev) => !prev);
          }}
          className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-[color:var(--color-border)] text-[color:var(--color-text-muted)] transition hover:border-[color:var(--color-accent)] hover:text-[color:var(--color-text)]"
          aria-label="Project actions"
          title="Project actions"
          aria-expanded={isOpen}
          aria-haspopup="menu"
        >
          <span className="text-lg leading-none">⋮</span>
        </button>
        {isOpen ? (
          <div
            className="absolute right-0 z-10 mt-2 w-40 rounded-xl border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-2 text-xs text-[color:var(--color-text)] shadow-xl"
            onClick={(event) => event.stopPropagation()}
          >
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                handleView();
              }}
              className="flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-[color:var(--color-text)] hover:bg-[color:var(--color-muted-bg)]"
            >
              <svg
                viewBox="0 0 24 24"
                className="h-4 w-4"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
              >
                <path
                  d="M1.5 12s4.5-7 10.5-7 10.5 7 10.5 7-4.5 7-10.5 7-10.5-7-10.5-7Z"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <circle cx="12" cy="12" r="3" />
              </svg>
              <span>View</span>
            </button>
            {canManageProjects ? (
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  handleEdit();
                }}
                className="mt-1 flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-[color:var(--color-text)] hover:bg-[color:var(--color-muted-bg)]"
              >
                <svg
                  viewBox="0 0 24 24"
                  className="h-4 w-4"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                >
                  <path
                    d="M4 20h4l10-10-4-4L4 16v4Z"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  <path
                    d="M13 7l4 4"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
                <span>Edit</span>
              </button>
            ) : null}
          </div>
        ) : null}
      </div>
    );
  };

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
          <ViewToggle value={viewMode} onChange={setViewMode} />
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
                role="button"
                tabIndex={0}
                onClick={() => router.push(`/projects/${project.id}`)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    router.push(`/projects/${project.id}`);
                  }
                }}
                className="cursor-pointer rounded-2xl border border-[color:var(--color-border)] bg-[color:var(--color-card)] p-5 transition hover:border-[color:var(--color-accent)]"
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
                <div className="mt-4 flex items-center justify-end">
                  <ProjectActionMenu project={project} />
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
              <tbody>
                {projects.map((project) => (
                  <tr
                    key={project.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => router.push(`/projects/${project.id}`)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        router.push(`/projects/${project.id}`);
                      }
                    }}
                    className="border-t border-[color:var(--color-border)] text-sm transition hover:bg-[color:var(--color-muted-bg)]"
                  >
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
                      <ProjectActionMenu project={project} />
                    </td>
                  </tr>
                ))}
              </tbody>
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
