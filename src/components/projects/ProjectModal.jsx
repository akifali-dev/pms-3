"use client";

import { useEffect, useState } from "react";

import ActionButton from "@/components/ui/ActionButton";
import Modal from "@/components/ui/Modal";
import { useToast } from "@/components/ui/ToastProvider";

const buildErrorMessage = (data) =>
  data?.error ?? data?.message ?? "Unable to save project.";

export default function ProjectModal({
  isOpen,
  mode,
  initialValues,
  onClose,
  onSuccess,
}) {
  const { addToast } = useToast();
  const [formValues, setFormValues] = useState({
    name: "",
    description: "",
    memberIds: [],
  });
  const [isSaving, setIsSaving] = useState(false);
  const [users, setUsers] = useState([]);

  useEffect(() => {
    if (!isOpen) return;
    setFormValues({
      name: initialValues?.name ?? "",
      description: initialValues?.description ?? "",
      memberIds: (initialValues?.members ?? []).map((member) => member.id),
    });
  }, [isOpen, initialValues]);

  useEffect(() => {
    if (!isOpen) return;
    const loadUsers = async () => {
      try {
        const response = await fetch("/api/users?isActive=true");
        const data = await response.json();
        if (response.ok) {
          setUsers(data?.users ?? []);
        }
      } catch (error) {
        setUsers([]);
      }
    };
    loadUsers();
  }, [isOpen]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!formValues.name.trim()) {
      addToast({
        title: "Project name needed",
        message: "Add a project name to continue.",
        variant: "warning",
      });
      return;
    }

    setIsSaving(true);
    try {
      const response = await fetch(
        mode === "edit" ? `/api/projects/${initialValues?.id}` : "/api/projects",
        {
          method: mode === "edit" ? "PUT" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: formValues.name,
            description: formValues.description,
            memberIds: formValues.memberIds,
          }),
        }
      );
      const data = await response.json();

      if (!response.ok) {
        throw new Error(buildErrorMessage(data));
      }

      addToast({
        title: mode === "edit" ? "Project updated" : "Project created",
        message:
          mode === "edit"
            ? "Project details are synced."
            : "New project added to the portfolio.",
        variant: "success",
      });
      onSuccess?.(data.project);
      onClose?.();
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unable to save project.";
      addToast({
        title: "Project update failed",
        message,
        variant: "error",
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      title={mode === "edit" ? "Edit project" : "Create project"}
      description="Capture initiative goals and project summaries."
      onClose={isSaving ? undefined : onClose}
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <label className="text-xs text-[color:var(--color-text-muted)]">
          Project name
          <input
            className="mt-1 w-full rounded-xl border border-[color:var(--color-border)] bg-[color:var(--color-input)] px-3 py-2 text-sm text-[color:var(--color-text)]"
            value={formValues.name}
            onChange={(event) =>
              setFormValues((prev) => ({
                ...prev,
                name: event.target.value,
              }))
            }
          />
        </label>
        <label className="text-xs text-[color:var(--color-text-muted)]">
          Description
          <textarea
            rows={4}
            className="mt-1 w-full rounded-xl border border-[color:var(--color-border)] bg-[color:var(--color-input)] px-3 py-2 text-sm text-[color:var(--color-text)]"
            value={formValues.description}
            onChange={(event) =>
              setFormValues((prev) => ({
                ...prev,
                description: event.target.value,
              }))
            }
          />
        </label>
        <div className="space-y-2 text-xs text-[color:var(--color-text-muted)]">
          <p>Members</p>
          <div className="grid max-h-40 gap-2 overflow-y-auto rounded-xl border border-[color:var(--color-border)] bg-[color:var(--color-input)] p-3 text-xs text-[color:var(--color-text)]">
            {users.length ? (
              users.map((user) => {
                const isSelected = formValues.memberIds.includes(user.id);
                return (
                  <label
                    key={user.id}
                    className="flex items-center gap-2"
                  >
                    <input
                      type="checkbox"
                      className="h-4 w-4 rounded border-[color:var(--color-border)] bg-transparent text-[color:var(--color-accent)]"
                      checked={isSelected}
                      onChange={(event) => {
                        setFormValues((prev) => {
                          const next = new Set(prev.memberIds);
                          if (event.target.checked) {
                            next.add(user.id);
                          } else {
                            next.delete(user.id);
                          }
                          return { ...prev, memberIds: Array.from(next) };
                        });
                      }}
                    />
                    <span>{user.name}</span>
                  </label>
                );
              })
            ) : (
              <p className="text-xs text-[color:var(--color-text-subtle)]">
                No active users available.
              </p>
            )}
          </div>
        </div>
        <div className="flex flex-wrap justify-end gap-2">
          <ActionButton
            label="Cancel"
            variant="secondary"
            onClick={onClose}
            className={isSaving ? "pointer-events-none opacity-60" : ""}
          />
          <ActionButton
            label={isSaving ? "Saving..." : "Save project"}
            variant="primary"
            type="submit"
            className={isSaving ? "pointer-events-none opacity-60" : ""}
          />
        </div>
      </form>
    </Modal>
  );
}
