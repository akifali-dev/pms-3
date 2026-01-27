import SignInForm from "@/components/auth/SignInForm";

export default function SignInPage() {
  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-[color:var(--color-border)] bg-[color:var(--color-card)] p-6">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[color:var(--color-text-subtle)]">
          Sign in
        </p>
        <h2 className="mt-2 text-2xl font-semibold text-[color:var(--color-text)]">
          Welcome back to PMS Cloud
        </h2>
        <p className="mt-2 text-sm text-[color:var(--color-text-muted)]">
          Use your company account to access role-specific dashboards.
        </p>
        <SignInForm />
      </div>
    </div>
  );
}
