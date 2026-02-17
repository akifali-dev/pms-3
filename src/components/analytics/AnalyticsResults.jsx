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

const EMPTY_TOTALS = {
  dutySeconds: 0,
  workSeconds: 0,
  breakSeconds: 0,
  idleSeconds: 0,
  wfhSeconds: 0,
  noDutySeconds: 0,
  utilization: 0,
};

function normalizeTotals(totals) {
  const dutySeconds = totals?.dutySeconds ?? 0;
  const workSeconds = totals?.workSeconds ?? 0;
  const breakSeconds = totals?.breakSeconds ?? 0;
  const idleSeconds =
    totals?.idleSeconds ?? Math.max(0, dutySeconds - workSeconds - breakSeconds);
  const wfhSeconds = totals?.wfhSeconds ?? 0;
  const noDutySeconds = totals?.noDutySeconds ?? 0;
  const utilization =
    dutySeconds > 0 ? totals?.utilization ?? workSeconds / dutySeconds : 0;
  return {
    dutySeconds,
    workSeconds,
    breakSeconds,
    idleSeconds,
    wfhSeconds,
    noDutySeconds,
    utilization,
  };
}

function AnalyticsSkeleton() {
  return (
    <div className="space-y-3 rounded-2xl border border-[color:var(--color-border)] bg-[color:var(--color-card)] p-5">
      <div className="h-4 w-1/3 animate-pulse rounded bg-[color:var(--color-muted-bg)]" />
      <div className="h-3 w-1/2 animate-pulse rounded bg-[color:var(--color-muted-bg)]" />
      <div className="h-24 w-full animate-pulse rounded-xl bg-[color:var(--color-muted-bg)]" />
    </div>
  );
}

function UserTotals({ totals }) {
  const safeTotals = normalizeTotals(totals ?? EMPTY_TOTALS);
  return (
    <div className="grid gap-3 md:grid-cols-4">
      <div className="rounded-xl border border-[color:var(--color-border-subtle)] bg-[color:var(--color-muted-bg)] p-3">
        <p className="text-[11px] uppercase tracking-[0.2em] text-[color:var(--color-text-subtle)]">
          Work
        </p>
        <p className="mt-2 text-lg font-semibold text-[color:var(--color-text)]">
          {formatDuration(safeTotals.workSeconds)}
        </p>
      </div>
      <div className="rounded-xl border border-[color:var(--color-border-subtle)] bg-[color:var(--color-muted-bg)] p-3">
        <p className="text-[11px] uppercase tracking-[0.2em] text-[color:var(--color-text-subtle)]">
          Break
        </p>
        <p className="mt-2 text-lg font-semibold text-[color:var(--color-text)]">
          {formatDuration(safeTotals.breakSeconds)}
        </p>
      </div>
      <div className="rounded-xl border border-[color:var(--color-border-subtle)] bg-[color:var(--color-muted-bg)] p-3">
        <p className="text-[11px] uppercase tracking-[0.2em] text-[color:var(--color-text-subtle)]">
          Idle
        </p>
        <p className="mt-2 text-lg font-semibold text-[color:var(--color-text)]">
          {formatDuration(safeTotals.idleSeconds)}
        </p>
      </div>
      <div className="rounded-xl border border-[color:var(--color-border-subtle)] bg-[color:var(--color-muted-bg)] p-3">
        <p className="text-[11px] uppercase tracking-[0.2em] text-[color:var(--color-text-subtle)]">
          Utilization
        </p>
        <p className="mt-2 text-lg font-semibold text-[color:var(--color-text)]">
          {formatPercent(safeTotals.utilization)}
        </p>
      </div>
    </div>
  );
}

function UsersSummaryTable({ users }) {
  if (!users?.length) {
    return (
      <div className="rounded-xl border border-dashed border-[color:var(--color-border)] bg-[color:var(--color-muted-bg)] p-4 text-xs text-[color:var(--color-text-subtle)]">
        No users to summarize.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-left text-xs text-[color:var(--color-text-muted)]">
        <thead className="text-[11px] uppercase tracking-[0.2em] text-[color:var(--color-text-subtle)]">
          <tr>
            <th className="px-3 py-2">User</th>
            <th className="px-3 py-2">Work</th>
            <th className="px-3 py-2">Break</th>
            <th className="px-3 py-2">Idle</th>
            <th className="px-3 py-2">Utilization</th>
          </tr>
        </thead>
        <tbody>
          {users.map((entry) => {
            const totals = normalizeTotals(entry?.totals ?? EMPTY_TOTALS);
            return (
              <tr key={entry.user.id} className="border-t border-[color:var(--color-border)]">
                <td className="px-3 py-2 text-sm font-semibold text-[color:var(--color-text)]">
                  {entry.user.name}
                </td>
                <td className="px-3 py-2">{formatDuration(totals.workSeconds)}</td>
                <td className="px-3 py-2">{formatDuration(totals.breakSeconds)}</td>
                <td className="px-3 py-2">{formatDuration(totals.idleSeconds)}</td>
                <td className="px-3 py-2">{formatPercent(totals.utilization)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
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
        const response = await fetch(`/api/analytics?${params.toString()}`, {
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

  const payload = state.payload ?? {};
  const results = useMemo(() => payload?.users ?? [], [payload]);
  const teamTotals = normalizeTotals(payload?.teamTotals ?? EMPTY_TOTALS);
  const teamPerDay = payload?.perDayTotals ?? payload?.teamPerDay ?? [];
  const mode = payload?.mode ?? "single";

  if (state.status === "loading") {
    return (
      <AnalyticsSkeleton />
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
    if (mode === "all") {
      return (
        <div className="space-y-4">
          <div className="rounded-2xl border border-[color:var(--color-border)] bg-[color:var(--color-card)] p-5">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-[color:var(--color-text)]">
                Team totals
              </p>
              <span className="text-xs uppercase tracking-[0.2em] text-[color:var(--color-text-muted)]">
                Daily
              </span>
            </div>
            <div className="mt-4">
              <UserTotals totals={teamTotals} />
            </div>
          </div>
          <div className="rounded-2xl border border-[color:var(--color-border)] bg-[color:var(--color-card)] p-5">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-[color:var(--color-text)]">
                User totals
              </p>
              <span className="text-xs uppercase tracking-[0.2em] text-[color:var(--color-text-muted)]">
                Daily
              </span>
            </div>
            <p className="mt-1 text-xs text-[color:var(--color-text-muted)]">
                Work, break, idle, and utilization.
            </p>
            <div className="mt-4">
              <UsersSummaryTable users={results} />
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className="space-y-4">
        {results.map((entry) => (
          <TimelineCard
            key={entry.user.id}
            user={entry.user}
            timeline={{
              segments: entry.segments ?? [],
              dutyWindows: entry.dutyWindows ?? [],
              wfhWindows: entry.wfhWindows ?? [],
              details: entry.details ?? {},
              totals: normalizeTotals(entry.totals ?? EMPTY_TOTALS),
              message: entry.message ?? null,
              dayWindowStart: entry.dayWindowStart ?? payload?.dayWindowStart ?? null,
              dayWindowEnd: entry.dayWindowEnd ?? payload?.dayWindowEnd ?? null,
            }}
          />
        ))}
      </div>
    );
  }

  if (mode === "all") {
    return (
      <div className="space-y-4">
        <div className="rounded-2xl border border-[color:var(--color-border)] bg-[color:var(--color-card)] p-5">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-[color:var(--color-text)]">
              Team totals
            </p>
            <span className="text-xs uppercase tracking-[0.2em] text-[color:var(--color-text-muted)]">
              {period}
            </span>
          </div>
          <div className="mt-4">
            <UserTotals totals={teamTotals} />
          </div>
        </div>
        <div className="rounded-2xl border border-[color:var(--color-border)] bg-[color:var(--color-card)] p-5">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-[color:var(--color-text)]">
              Team daily totals
            </p>
            <span className="text-xs uppercase tracking-[0.2em] text-[color:var(--color-text-muted)]">
              {period}
            </span>
          </div>
          <div className="mt-4">
            <WorkstackChart
              perDay={teamPerDay}
              minWidth={
                period === "monthly"
                  ? Math.max(720, (teamPerDay?.length ?? 0) * 28)
                  : 640
              }
            />
          </div>
        </div>
        <div className="rounded-2xl border border-[color:var(--color-border)] bg-[color:var(--color-card)] p-5">
          <p className="text-sm font-semibold text-[color:var(--color-text)]">
            User totals
          </p>
          <p className="mt-1 text-xs text-[color:var(--color-text-muted)]">
            Total work, break, idle, and utilization for the team.
          </p>
          <div className="mt-4">
            <UsersSummaryTable users={results} />
          </div>
        </div>
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
            {(() => {
              const perDayTotals = entry.perDayTotals ?? entry.perDay ?? [];
              return (
            <WorkstackChart
              perDay={perDayTotals}
              minWidth={
                period === "monthly"
                  ? Math.max(720, perDayTotals.length * 28)
                  : 640
              }
            />
              );
            })()}
          </div>
        </div>
      ))}
    </div>
  );
}
