"use client";

import { useMemo } from "react";

const SEGMENT_COLORS = {
  WORK: "var(--color-work)",
  IDLE: "var(--color-idle)",
  BREAK: "var(--color-break)",
};

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

function getTimeLabel(date) {
  const value = new Date(date);
  if (Number.isNaN(value.getTime())) {
    return "";
  }
  return value.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function buildRange(dutyWindows) {
  if (!Array.isArray(dutyWindows) || dutyWindows.length === 0) {
    return null;
  }
  const normalized = dutyWindows
    .map((window) => ({
      start: new Date(window.start),
      end: new Date(window.end),
    }))
    .filter((window) => !Number.isNaN(window.start.getTime()));
  if (!normalized.length) {
    return null;
  }
  const start = normalized.reduce(
    (min, window) => (window.start < min ? window.start : min),
    normalized[0].start
  );
  const end = normalized.reduce(
    (max, window) => (window.end > max ? window.end : max),
    normalized[0].end
  );
  return { start, end };
}

function getWidthPercent(range, start, end) {
  const total = range.end.getTime() - range.start.getTime();
  if (total <= 0) {
    return { left: 0, width: 0 };
  }
  const left = ((start.getTime() - range.start.getTime()) / total) * 100;
  const width = ((end.getTime() - start.getTime()) / total) * 100;
  return { left: Math.max(0, left), width: Math.max(0, width) };
}

export default function TimelineCard({ user, timeline }) {
  const range = useMemo(() => buildRange(timeline?.dutyWindows ?? []), [timeline]);
  const segments = timeline?.segments ?? [];
  const summary = timeline?.summary ?? {};
  const wfhWindows = timeline?.wfhWindows ?? [];

  const markers = useMemo(() => {
    if (!range) {
      return [];
    }
    return segments.map((segment) => ({
      ...segment,
      ...getWidthPercent(range, new Date(segment.startAt), new Date(segment.endAt)),
    }));
  }, [range, segments]);

  const wfhMarkers = useMemo(() => {
    if (!range) {
      return [];
    }
    return wfhWindows.map((window) => ({
      ...window,
      ...getWidthPercent(range, new Date(window.start), new Date(window.end)),
    }));
  }, [range, wfhWindows]);

  const pauseBreakdown = summary?.pauseBreakdown ?? {};

  return (
    <div className="rounded-2xl border border-[color:var(--color-border)] bg-[color:var(--color-card)] p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-[color:var(--color-text)]">
            {user?.name ?? "Unknown user"}
          </p>
          <p className="text-xs text-[color:var(--color-text-subtle)]">
            {user?.role ?? "No role"}
          </p>
        </div>
        {range ? (
          <div className="text-xs text-[color:var(--color-text-muted)]">
            {getTimeLabel(range.start)} - {getTimeLabel(range.end)}
          </div>
        ) : null}
      </div>

      <div className="mt-4 grid gap-3 lg:grid-cols-4">
        <div className="rounded-xl border border-[color:var(--color-border-subtle)] bg-[color:var(--color-muted-bg)] p-3">
          <p className="text-[11px] uppercase tracking-[0.2em] text-[color:var(--color-text-subtle)]">
            Duty
          </p>
          <p className="mt-2 text-lg font-semibold text-[color:var(--color-text)]">
            {formatDuration(summary.totalDutySeconds)}
          </p>
          <p className="text-xs text-[color:var(--color-text-muted)]">
            Utilization {formatPercent(summary.utilization)}
          </p>
        </div>
        <div className="rounded-xl border border-[color:var(--color-border-subtle)] bg-[color:var(--color-muted-bg)] p-3">
          <p className="text-[11px] uppercase tracking-[0.2em] text-[color:var(--color-text-subtle)]">
            Work
          </p>
          <p className="mt-2 text-lg font-semibold text-[color:var(--color-text)]">
            {formatDuration(summary.workSeconds)}
          </p>
          <p className="text-xs text-[color:var(--color-text-muted)]">
            First work delay {formatDuration(summary.firstWorkStartDelaySeconds)}
          </p>
        </div>
        <div className="rounded-xl border border-[color:var(--color-border-subtle)] bg-[color:var(--color-muted-bg)] p-3">
          <p className="text-[11px] uppercase tracking-[0.2em] text-[color:var(--color-text-subtle)]">
            Breaks
          </p>
          <p className="mt-2 text-lg font-semibold text-[color:var(--color-text)]">
            {formatDuration(summary.breakSeconds)}
          </p>
          <p className="text-xs text-[color:var(--color-text-muted)]">
            {summary.numberOfPauses ?? 0} pauses
          </p>
        </div>
        <div className="rounded-xl border border-[color:var(--color-border-subtle)] bg-[color:var(--color-muted-bg)] p-3">
          <p className="text-[11px] uppercase tracking-[0.2em] text-[color:var(--color-text-subtle)]">
            Idle
          </p>
          <p className="mt-2 text-lg font-semibold text-[color:var(--color-text)]">
            {formatDuration(summary.idleSeconds)}
          </p>
          <p className="text-xs text-[color:var(--color-text-muted)]">
            Lost time {formatDuration(summary.lostTimeSeconds)}
          </p>
        </div>
      </div>

      <div className="mt-5">
        {range ? (
          <div className="relative h-10 w-full rounded-full border border-[color:var(--color-border-subtle)] bg-[color:var(--color-surface-muted)]">
            {wfhMarkers.map((marker, index) => (
              <div
                key={`wfh-${index}`}
                className="absolute top-0 h-full rounded-full opacity-20"
                style={{
                  left: `${marker.left}%`,
                  width: `${marker.width}%`,
                  background: "var(--color-wfh)",
                }}
              />
            ))}
            {markers.map((segment) => (
              <div
                key={`${segment.type}-${segment.startAt}-${segment.endAt}`}
                className="absolute top-0 h-full rounded-full"
                style={{
                  left: `${segment.left}%`,
                  width: `${segment.width}%`,
                  background: SEGMENT_COLORS[segment.type] ?? "var(--color-off-duty)",
                  boxShadow: segment.isWFH
                    ? "inset 0 0 0 1px rgba(14,165,233,0.45)"
                    : "none",
                }}
                title={`${segment.type} ${getTimeLabel(segment.startAt)} - ${getTimeLabel(
                  segment.endAt
                )}${segment.reason ? ` (${segment.reason})` : ""}${
                  segment.isWFH ? " • WFH" : ""
                }`}
              />
            ))}
          </div>
        ) : (
          <div className="rounded-xl border border-dashed border-[color:var(--color-border)] bg-[color:var(--color-muted-bg)] p-4 text-sm text-[color:var(--color-text-subtle)]">
            {timeline?.message ?? "No attendance recorded."}
          </div>
        )}
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3 text-xs text-[color:var(--color-text-muted)]">
        <span className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full" style={{ background: SEGMENT_COLORS.WORK }} />
          Work
        </span>
        <span className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full" style={{ background: SEGMENT_COLORS.BREAK }} />
          Break
        </span>
        <span className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full" style={{ background: SEGMENT_COLORS.IDLE }} />
          Idle
        </span>
        <span className="flex items-center gap-2">
          <span
            className="h-2 w-2 rounded-full"
            style={{ background: "var(--color-wfh)" }}
          />
          WFH window
        </span>
      </div>

      {Object.keys(pauseBreakdown).length ? (
        <div className="mt-4 flex flex-wrap gap-2 text-xs text-[color:var(--color-text-muted)]">
          {Object.entries(pauseBreakdown).map(([reason, data]) => (
            <span
              key={reason}
              className="rounded-full border border-[color:var(--color-border)] px-3 py-1"
            >
              {reason.toLowerCase()} · {data.count} · {formatDuration(data.seconds)}
            </span>
          ))}
        </div>
      ) : null}
    </div>
  );
}
