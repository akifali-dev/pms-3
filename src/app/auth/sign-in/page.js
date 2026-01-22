import SignInForm from "@/components/auth/SignInForm";

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
          Use your company account to access role-specific dashboards.
        </p>
        <SignInForm />
      </div>
    </div>
  );
}
