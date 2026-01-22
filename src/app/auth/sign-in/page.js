import ActionButton from "@/components/ui/ActionButton";

export default function SignInPage() {
  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-white/40">
          Sign in
        </p>
        <h2 className="mt-2 text-2xl font-semibold text-white">
          Welcome back to PMS Cloud
        </h2>
        <p className="mt-2 text-sm text-white/60">
          This form is ready for authentication wiring.
        </p>
        <form className="mt-6 grid gap-4">
          <label className="grid gap-2 text-sm text-white/70">
            Work email
            <input
              type="email"
              placeholder="name@company.com"
              className="rounded-xl border border-white/10 bg-slate-900/60 px-3 py-2 text-sm text-white outline-none focus:border-white/40"
            />
          </label>
          <label className="grid gap-2 text-sm text-white/70">
            Password
            <input
              type="password"
              placeholder="••••••••"
              className="rounded-xl border border-white/10 bg-slate-900/60 px-3 py-2 text-sm text-white outline-none focus:border-white/40"
            />
          </label>
          <div className="flex flex-wrap gap-3">
            <ActionButton
              label="Sign in"
              variant="primary"
              toast={{
                title: "Sign-in placeholder",
                message: "Authentication will be enabled once identity is wired.",
                variant: "info",
              }}
              type="button"
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
        </form>
      </div>
    </div>
  );
}
