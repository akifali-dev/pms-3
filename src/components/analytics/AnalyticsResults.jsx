"use client";

import { useEffect, useMemo, useState } from "react";
import TimelineCard from "@/components/analytics/TimelineCard";
import WorkstackChart from "@/components/analytics/WorkstackChart";

function formatDuration(seconds) {
  if (!seconds || seconds <= 0) {
    return "0m";
  }
  const totalMinutes = Math.round(seconds / 60);
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

function formatPercent(value) {
  if (!value || Number.isNaN(value)) {
    return "0%";
  }
  return `${Math.round(value * 100)}%`;
}

function buildDateParam(value) {
  if (!value) {
    return new Date().toISOString().slice(0, 10);
  }
  return value;
}

function UserTotals({ totals }) {
  return (
    <div className="grid gap-3 md:grid-cols-4">
      <div className="rounded-xl border border-[color:var(--color-border-subtle)] bg-[color:var(--color-muted-bg)] p-3">
        <p className="text-[11px] uppercase tracking-[0.2em] text-[color:var(--color-text-subtle)]">
          Work
        </p>
        <p className="mt-2 text-lg font-semibold text-[color:var(--color-text)]">
          {formatDuration(totals.workSeconds)}
        </p>
      </div>
      <div className="rounded-xl border border-[color:var(--color-border-subtle)] bg-[color:var(--color-muted-bg)] p-3">
        <p className="text-[11px] uppercase tracking-[0.2em] text-[color:var(--color-text-subtle)]">
          Break
        </p>
        <p className="mt-2 text-lg font-semibold text-[color:var(--color-text)]">
          {formatDuration(totals.breakSeconds)}
        </p>
      </div>
      <div className="rounded-xl border border-[color:var(--color-border-subtle)] bg-[color:var(--color-muted-bg)] p-3">
        <p className="text-[11px] uppercase tracking-[0.2em] text-[color:var(--color-text-subtle)]">
          Idle
        </p>
        <p className="mt-2 text-lg font-semibold text-[color:var(--color-text)]">
          {formatDuration(totals.idleSeconds)}
        </p>
      </div>
      <div className="rounded-xl border border-[color:var(--color-border-subtle)] bg-[color:var(--color-muted-bg)] p-3">
        <p className="text-[11px] uppercase tracking-[0.2em] text-[color:var(--color-text-subtle)]">
          Utilization
        </p>
        <p className="mt-2 text-lg font-semibold text-[color:var(--color-text)]">
          {formatPercent(totals.utilization)}
        </p>
      </div>
    </div>
  );
}

export default function AnalyticsResults({ period, date, userId }) {
  const [state, setState] = useState({
    status: "idle",
    error: null,
    payload: null,
  });

  useEffect(() => {
    const controller = new AbortController();
    const load = async () => {
      setState({ status: "loading", error: null, payload: null });
      try {
        const params = new URLSearchParams();
        params.set("period", period);
        params.set("date", buildDateParam(date));
        if (userId) {
          params.set("userId", userId);
        }
        const response = await fetch(`/api/analytics/timeline?${params.toString()}`, {
          signal: controller.signal,
        });
        const data = await response.json();
        if (!response.ok) {
          throw new Error(data?.error ?? "Unable to load analytics.");
        }
        setState({ status: "success", error: null, payload: data });
      } catch (error) {
        if (error?.name === "AbortError") {
          return;
        }
        setState({
          status: "error",
          error: error instanceof Error ? error.message : "Unable to load analytics.",
          payload: null,
        });
      }
    };
    load();
    return () => controller.abort();
  }, [period, date, userId]);

  const results = useMemo(() => state.payload?.users ?? [], [state.payload]);

  if (state.status === "loading") {
    return (
      <div className="rounded-2xl border border-[color:var(--color-border)] bg-[color:var(--color-card)] p-5 text-sm text-[color:var(--color-text-muted)]">
        Loading analytics...
      </div>
    );
  }

  if (state.status === "error") {
    return (
      <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 p-5 text-sm text-rose-200">
        {state.error}
      </div>
    );
  }

  if (!results.length) {
    return (
      <div className="rounded-2xl border border-[color:var(--color-border)] bg-[color:var(--color-card)] p-5 text-sm text-[color:var(--color-text-subtle)]">
        No analytics to display.
      </div>
    );
  }

  if (period === "daily") {
    return (
      <div className="space-y-4">
        {results.map((entry) => (
          <TimelineCard key={entry.user.id} user={entry.user} timeline={entry.timeline} />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {results.map((entry) => (
        <div
          key={entry.user.id}
          className="rounded-2xl border border-[color:var(--color-border)] bg-[color:var(--color-card)] p-5"
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-[color:var(--color-text)]">
                {entry.user.name}
              </p>
              <p className="text-xs text-[color:var(--color-text-subtle)]">
                {entry.user.role}
              </p>
            </div>
            <p className="text-xs text-[color:var(--color-text-muted)] uppercase tracking-[0.2em]">
              {period}
            </p>
          </div>
          <div className="mt-4">
            <UserTotals totals={entry.totals} />
          </div>
          <div className="mt-4">
            <WorkstackChart
              dailySummaries={entry.dailySummaries}
              minWidth={
                period === "monthly"
                  ? Math.max(720, (entry.dailySummaries?.length ?? 0) * 28)
                  : 640
              }
            />
          </div>
        </div>
      ))}
    </div>
  );
}
