import ActionButton from "@/components/ui/ActionButton";
import PlaceholderUpload from "@/components/ui/PlaceholderUpload";

export default function DashboardPage() {
  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 rounded-2xl border border-white/10 bg-white/5 p-6 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-white/40">
            Dashboard
          </p>
          <h2 className="mt-2 text-2xl font-semibold text-white">
            Executive overview
          </h2>
          <p className="mt-2 text-sm text-white/60">
            Consolidated visibility across programs and resources.
          </p>
        </div>
        <ActionButton
          label="Share snapshot"
          variant="primary"
          toast={{
            title: "Snapshot ready",
            message: "Shareable dashboard links will be enabled soon.",
            variant: "info",
          }}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {[
          {
            title: "Delivery cadence",
            detail: "12 teams reporting weekly",
          },
          {
            title: "Resource capacity",
            detail: "78% allocation tracked",
          },
          {
            title: "Budget health",
            detail: "Spend visibility coming online",
          },
        ].map((item) => (
          <div
            key={item.title}
            className="rounded-2xl border border-white/10 bg-slate-900/60 p-5"
          >
            <p className="text-sm font-semibold text-white">{item.title}</p>
            <p className="mt-2 text-xs text-white/60">{item.detail}</p>
          </div>
        ))}
      </div>

      <PlaceholderUpload
        label="Quarterly highlights"
        helperText="Upload leadership-ready visuals and decks."
      />
    </div>
  );
}
