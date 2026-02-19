"use client";

import { useEffect, useMemo, useState } from "react";

function formatDuration(seconds) {
  const safeSeconds = Math.max(0, Number(seconds ?? 0));
  if (!safeSeconds) {
    return "0m";
  }
  const totalMinutes = Math.round(safeSeconds / 60);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours && minutes) {
    return `${hours}h ${minutes}m`;
  }
  if (hours) {
    return `${hours}h`;
  }
  return `${minutes}m`;
}

function StatsSkeleton() {
  return (
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
      {["a", "b", "c", "d"].map((id) => (
        <div
          key={id}
          className="h-28 animate-pulse rounded-2xl border border-[color:var(--color-border)] bg-[color:var(--color-card)]"
        />
      ))}
    </div>
  );
}

function StatsCard({ title, value, detail, accent }) {
  return (
    <div className="rounded-2xl border border-[color:var(--color-border)] bg-[color:var(--color-card)] p-4">
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[color:var(--color-text-subtle)]">
        {title}
      </p>
      <p className="mt-3 text-2xl font-semibold text-[color:var(--color-text)]">{value}</p>
      <p className={`mt-2 text-xs ${accent ?? "text-[color:var(--color-text-muted)]"}`}>{detail}</p>
    </div>
  );
}

export default function DashboardStatsCards({ period, userId }) {
  const [state, setState] = useState({ status: "idle", payload: null, error: null });

  useEffect(() => {
    const controller = new AbortController();
    const load = async () => {
      setState({ status: "loading", payload: null, error: null });
      try {
        const params = new URLSearchParams({ range: period });
        if (userId) {
          params.set("userId", userId);
        }
        const response = await fetch(`/api/analytics/dashboard-stats?${params.toString()}`, {
          signal: controller.signal,
        });
        const data = await response.json();
        if (!response.ok) {
          throw new Error(data?.error ?? "Failed to load dashboard stats.");
        }
        setState({ status: "success", payload: data, error: null });
      } catch (error) {
        if (error?.name === "AbortError") {
          return;
        }
        setState({
          status: "error",
          payload: null,
          error: error instanceof Error ? error.message : "Failed to load dashboard stats.",
        });
      }
    };
    load();
    return () => controller.abort();
  }, [period, userId]);

  const metrics = useMemo(() => {
    const payload = state.payload ?? {};
    const time = payload.time ?? {};
    const estimatedSeconds = Number(time.estimatedSeconds ?? 0);
    const spentSeconds = Number(time.spentSeconds ?? 0);
    const varianceSeconds = Number(time.varianceSeconds ?? spentSeconds - estimatedSeconds);
    const variancePrefix = varianceSeconds > 0 ? "+" : varianceSeconds < 0 ? "-" : "±";
    const varianceText = `${variancePrefix}${formatDuration(Math.abs(varianceSeconds))}`;

    return {
      completedTasks: Number(payload.completedTasks ?? 0),
      reworkCount: Number(payload.reworkCount ?? 0),
      blockedTasks: Number(payload.blockedTasks ?? 0),
      estimatedSeconds,
      spentSeconds,
      varianceSeconds,
      varianceText,
    };
  }, [state.payload]);

  if (state.status === "loading" || state.status === "idle") {
    return <StatsSkeleton />;
  }

  if (state.status === "error") {
    return (
      <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 p-4 text-sm text-rose-200">
        {state.error}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-sm font-semibold text-[color:var(--color-text)]">Task stats</p>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <StatsCard
          title="Completed Tasks"
          value={metrics.completedTasks}
          detail={`Completed in ${period}`}
        />
        <StatsCard
          title="Rework Count"
          value={metrics.reworkCount}
          detail={`Rejections in ${period}`}
        />
        <StatsCard
          title="Time vs Estimate"
          value={metrics.varianceText}
          detail={`Spent ${formatDuration(metrics.spentSeconds)} / Est ${formatDuration(metrics.estimatedSeconds)}`}
          accent={
            metrics.varianceSeconds > 0
              ? "text-amber-300"
              : metrics.varianceSeconds < 0
              ? "text-emerald-300"
              : "text-[color:var(--color-text-muted)]"
          }
        />
        <StatsCard
          title="Blocked Tasks"
          value={metrics.blockedTasks}
          detail="Currently blocked"
        />
      </div>
    </div>
  );
}
