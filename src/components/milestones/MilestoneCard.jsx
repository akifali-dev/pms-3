import Link from "next/link";

import {
  formatMilestoneDate,
  getMilestoneProgress,
} from "@/lib/milestoneProgress";

const getRemainingLabel = (remainingDays) => {
  if (remainingDays === 0) {
    return "Deadline reached";
  }
  return `${remainingDays} day${remainingDays === 1 ? "" : "s"} remaining`;
};

const getProgressColor = (remainingPercentage) => {
  if (remainingPercentage > 70) {
    return "bg-emerald-400";
  }
  if (remainingPercentage >= 30) {
    return "bg-amber-400";
  }
  return "bg-rose-500";
};

export default function MilestoneCard({ milestone, href, className = "" }) {
  const { elapsedPercentage, remainingDays, remainingPercentage } =
    getMilestoneProgress(milestone.startDate, milestone.endDate);
  const dateLabel =
    milestone.startDate && milestone.endDate
      ? `${formatMilestoneDate(milestone.startDate)} → ${formatMilestoneDate(
          milestone.endDate
        )}`
      : "Add start and end dates";

  const content = (
    <div
      className={`relative rounded-2xl border border-[color:var(--color-border)] bg-[color:var(--color-card)] p-5 transition hover:border-[color:var(--color-accent)] ${className}`}
    >
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[color:var(--color-text-subtle)]">
        {getRemainingLabel(remainingDays)}
      </p>
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
      <Link href={href} className="block">
        {content}
      </Link>
    );
  }

  return content;
}
