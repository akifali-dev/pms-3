import ActionButton from "@/components/ui/ActionButton";
import ActionLink from "@/components/ui/ActionLink";

export default function AuthLandingPage() {
  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-white/40">
          Authentication
        </p>
        <h2 className="mt-2 text-2xl font-semibold text-white">
          Secure access staging
        </h2>
        <p className="mt-2 text-sm text-white/60">
          Authentication flows are scaffolded and ready for integration.
        </p>
        <div className="mt-4 flex flex-wrap gap-3">
          <ActionLink
            href="/auth/sign-in"
            label="Go to sign in"
            toast={{
              title: "Sign-in",
              message: "Opening the sign-in experience.",
              variant: "info",
            }}
            className="inline-flex items-center rounded-xl border border-white/20 px-4 py-2 text-sm font-semibold text-white/80 transition hover:border-white/40"
          />
          <ActionButton
            label="Request access"
            variant="secondary"
            toast={{
              title: "Access request",
              message: "Access workflows will route through admin approval soon.",
              variant: "info",
            }}
          />
        </div>
      </div>
    </div>
  );
}
