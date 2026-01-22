"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import ActionButton from "@/components/ui/ActionButton";
import { useToast } from "@/components/ui/ToastProvider";
import { users } from "@/lib/users";
import { getRoleById } from "@/lib/roles";

export default function SignInForm() {
  const router = useRouter();
  const { addToast } = useToast();
  const [formState, setFormState] = useState({
    email: "",
    password: "",
  });
  const [status, setStatus] = useState({ loading: false, error: null });

  const handleChange = (event) => {
    const { name, value } = event.target;
    setFormState((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setStatus({ loading: true, error: null });

    const response = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(formState),
    });

    if (!response.ok) {
      const data = await response.json();
      setStatus({ loading: false, error: data?.error ?? "Sign-in failed." });
      addToast({
        title: "Sign-in failed",
        message: data?.error ?? "Please check your credentials.",
        variant: "error",
      });
      return;
    }

    addToast({
      title: "Signed in",
      message: "Welcome back to PMS Cloud.",
      variant: "success",
    });
    router.push("/dashboard");
    router.refresh();
  };

  return (
    <form className="mt-6 grid gap-4" onSubmit={handleSubmit}>
      <label className="grid gap-2 text-sm text-white/70">
        Work email
        <input
          type="email"
          name="email"
          value={formState.email}
          onChange={handleChange}
          placeholder="name@company.com"
          className="rounded-xl border border-white/10 bg-slate-900/60 px-3 py-2 text-sm text-white outline-none focus:border-white/40"
        />
      </label>
      <label className="grid gap-2 text-sm text-white/70">
        Password
        <input
          type="password"
          name="password"
          value={formState.password}
          onChange={handleChange}
          placeholder="••••••••"
          className="rounded-xl border border-white/10 bg-slate-900/60 px-3 py-2 text-sm text-white outline-none focus:border-white/40"
        />
      </label>
      {status.error && (
        <p className="text-xs text-rose-300">{status.error}</p>
      )}
      <div className="flex flex-wrap gap-3">
        <ActionButton
          label={status.loading ? "Signing in..." : "Sign in"}
          variant="primary"
          type="submit"
          className="min-w-[140px]"
        />
        <ActionButton
          label="Reset password"
          variant="secondary"
          toast={{
            title: "Password reset",
            message: "Password reset flows are staged for integration.",
            variant: "warning",
          }}
          type="button"
        />
      </div>

      <div className="mt-6 rounded-2xl border border-white/10 bg-white/5 p-4">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-white/40">
          Demo accounts
        </p>
        <div className="mt-3 grid gap-3 text-xs text-white/70">
          {users.map((user) => {
            const role = getRoleById(user.role);
            return (
              <div key={user.email} className="rounded-xl border border-white/10 p-3">
                <p className="text-sm font-semibold text-white">
                  {role?.label ?? user.role}
                </p>
                <p>{user.email}</p>
                <p>Password: {user.password}</p>
              </div>
            );
          })}
        </div>
      </div>
    </form>
  );
}
