"use client";

import { useState } from "react";
import ActionButton from "@/components/ui/ActionButton";
import { useToast } from "@/components/ui/ToastProvider";
import { roleOptions, roles } from "@/lib/roles";

const buildErrorMessage = (data) =>
  data?.error ?? data?.message ?? "Unable to create user.";

export default function CreateUserForm() {
  const { addToast } = useToast();
  const [formState, setFormState] = useState({
    name: "",
    email: "",
    role: roles.DEV,
    password: "",
  });
  const [status, setStatus] = useState({ loading: false });

  const handleChange = (event) => {
    const { name, value } = event.target;
    setFormState((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setStatus({ loading: true });

    try {
      const response = await fetch("/api/users/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formState),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(buildErrorMessage(data));
      }

      addToast({
        title: "User created successfully",
        message: "The new user can now sign in.",
        variant: "success",
      });
      setFormState({
        name: "",
        email: "",
        role: roles.DEV,
        password: "",
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unable to create user.";
      addToast({
        title: "User creation failed",
        message,
        variant: "error",
      });
    } finally {
      setStatus({ loading: false });
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-4 rounded-2xl border border-white/10 bg-slate-900/60 p-6"
    >
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-white/40">
          Create user
        </p>
        <p className="mt-2 text-sm text-white/60">
          Assign a role and set a secure password for the new account.
        </p>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <label className="text-xs text-white/60">
          Name
          <input
            name="name"
            value={formState.name}
            onChange={handleChange}
            className="mt-1 w-full rounded-xl border border-white/10 bg-slate-950/60 px-3 py-2 text-sm text-white"
            required
          />
        </label>
        <label className="text-xs text-white/60">
          Email
          <input
            type="email"
            name="email"
            value={formState.email}
            onChange={handleChange}
            className="mt-1 w-full rounded-xl border border-white/10 bg-slate-950/60 px-3 py-2 text-sm text-white"
            required
          />
        </label>
        <label className="text-xs text-white/60">
          Role
          <select
            name="role"
            value={formState.role}
            onChange={handleChange}
            className="mt-1 w-full rounded-xl border border-white/10 bg-slate-950/60 px-3 py-2 text-sm text-white"
            required
          >
            {roleOptions.map((role) => (
              <option key={role.id} value={role.id}>
                {role.label}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs text-white/60">
          Password
          <input
            type="password"
            name="password"
            value={formState.password}
            onChange={handleChange}
            className="mt-1 w-full rounded-xl border border-white/10 bg-slate-950/60 px-3 py-2 text-sm text-white"
            required
          />
        </label>
      </div>

      <div className="flex flex-wrap gap-2">
        <ActionButton
          label={status.loading ? "Creating..." : "Create user"}
          variant="primary"
          type="submit"
          className={status.loading ? "pointer-events-none opacity-60" : ""}
        />
      </div>
    </form>
  );
}
