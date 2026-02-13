import Link from "next/link";

import {
  formatMilestoneDate,
  getMilestoneCapacity,
  getMilestoneProgress,
  getMilestoneStatus,
  getTaskEstimatedMinutes,
} from "@/lib/milestoneProgress";

const formatHours = (value) => `${Math.max(0, value).toFixed(1)}h`;

const getProgressColor = (remainingPercentage) => {
  if (remainingPercentage > 70) {
    return "bg-emerald-400";
  }
  if (remainingPercentage >= 30) {
    return "bg-amber-400";
  }
  return "bg-rose-500";
};

export default function MilestoneCard({
  milestone,
  href,
  className = "",
  onClick,
}) {
  const { elapsedPercentage, remainingPercentage } =
    getMilestoneProgress(milestone.startDate, milestone.endDate);
  const { statusText } = getMilestoneStatus(milestone.startDate, milestone.endDate);
  const plannedMinutes = (milestone.tasks ?? []).reduce(
    (sum, task) => sum + getTaskEstimatedMinutes(task),
    0
  );
  const capacity = getMilestoneCapacity({
    startDate: milestone.startDate,
    endDate: milestone.endDate,
    plannedMinutes,
  });
  const dateLabel =
    milestone.startDate && milestone.endDate
      ? `${formatMilestoneDate(milestone.startDate)} → ${formatMilestoneDate(
          milestone.endDate
        )}`
      : "Add start and end dates";

  const content = (
    <div
      className={`relative rounded-2xl border bg-[color:var(--color-card)] p-5 transition hover:border-[color:var(--color-accent)] ${capacity.overbooked ? "border-rose-500/60" : "border-[color:var(--color-border)]"} ${className}`}
    >
      <div className="flex items-start justify-between gap-3">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[color:var(--color-text-subtle)]">
          {statusText}
        </p>
        <div className="rounded-lg border border-[color:var(--color-border)] bg-[color:var(--color-surface-muted)] px-2 py-1 text-right text-[11px] text-[color:var(--color-text-muted)]">
          <p>Capacity: {formatHours(capacity.capacityHours)}</p>
          <p>Planned: {formatHours(capacity.plannedHours)}</p>
          <p className={capacity.overbooked ? "text-rose-400" : "text-[color:var(--color-text-muted)]"}>
            {capacity.overbooked
              ? `Over by: +${Math.abs(capacity.remainingHours).toFixed(1)}h`
              : `Left: ${formatHours(capacity.remainingHours)}`}
          </p>
        </div>
      </div>
      <p className="mt-2 text-sm font-semibold text-[color:var(--color-text)]">
        {milestone.title}
      </p>
      <div className="mt-4 space-y-2">
        <div className="h-2 w-full overflow-hidden rounded-full bg-[color:var(--color-muted-bg)]">
          <div
            className={`h-full ${getProgressColor(remainingPercentage)}`}
            style={{ width: `${elapsedPercentage}%` }}
          />
        </div>
      </div>
      <div className="mt-3 space-y-1">
        <p className="text-[11px] text-[color:var(--color-text-muted)]">Capacity planning</p>
        <div className="h-2 w-full overflow-hidden rounded-full bg-[color:var(--color-muted-bg)]">
          <div
            className={`h-full ${capacity.overbooked ? "bg-rose-500" : "bg-[color:var(--color-accent)]"}`}
            style={{ width: `${capacity.fillPercent}%` }}
          />
        </div>
      </div>
      <p className="mt-3 text-xs text-[color:var(--color-text-muted)]">
        {dateLabel}
      </p>
      {milestone.project?.name ? (
        <p className="mt-2 text-xs text-[color:var(--color-text-subtle)]">
          Project:{" "}
          <span className="text-[color:var(--color-text-muted)]">
            {milestone.project.name}
          </span>
        </p>
      ) : null}
    </div>
  );

  if (href) {
    return (
      <Link href={href} className="block" onClick={onClick}>
        {content}
      </Link>
    );
  }

  if (onClick) {
    return (
      <button type="button" className="block w-full text-left" onClick={onClick}>
        {content}
      </button>
    );
  }

  return content;
}
