"use client";

import { useEffect, useMemo, useState } from "react";

const TIME_ZONE = "Asia/Karachi";

const SEGMENT_COLORS = {
  NO_DUTY: "var(--color-off-duty)",
  IDLE: "var(--color-idle)",
  WORK_TASK: "var(--color-work)",
  WORK_MANUAL: "var(--color-work-manual)",
  BREAK: "var(--color-break)",
};

const SEGMENT_LABELS = {
  NO_DUTY: "No duty",
  IDLE: "Idle",
  WORK_TASK: "Task work",
  WORK_MANUAL: "Manual work",
  BREAK: "Break",
};

function formatTime(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }
  return new Intl.DateTimeFormat("en-US", {
    timeZone: TIME_ZONE,
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

function formatDuration(startAt, endAt) {
  const start = new Date(startAt);
  const end = new Date(endAt);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return "";
  }
  const seconds = Math.max(0, Math.floor((end - start) / 1000));
  if (!seconds) {
    return "0m";
  }
  const minutes = Math.round(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  if (hours && remainder) {
    return `${hours}h ${remainder}m`;
  }
  if (hours) {
    return `${hours}h`;
  }
  return `${remainder}m`;
}

function formatBreakReason(reason) {
  if (!reason) {
    return "Other";
  }
  const value = reason.toString().toLowerCase();
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function buildBreakLabel(segment) {
  const reason = formatBreakReason(segment.breakReason);
  if (segment.breakType === "TASK_PAUSE") {
    return `Break (Task Pause) \u2013 ${reason}`;
  }
  return segment.breakReason ? `Break (${reason})` : "Break";
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

function buildTooltip(segment) {
  const typeLabel =
    segment.type === "BREAK"
      ? buildBreakLabel(segment)
      : SEGMENT_LABELS[segment.type] ?? segment.type;
  const timeRange = `${formatTime(segment.startAt)} - ${formatTime(segment.endAt)}`;
  const duration = formatDuration(segment.startAt, segment.endAt);
  const wfhFlag = segment.isWFH ? " • WFH" : "";
  return `${typeLabel} | ${timeRange} | ${duration}${wfhFlag}`;
}

export default function DailyTimelineChart({
  date,
  userId,
  showNames,
  title = "Daily timeline",
}) {
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
        if (date) {
          params.set("date", date);
        }
        if (userId) {
          params.set("userId", userId);
        }
        const response = await fetch(
          `/api/analytics/daily-timeline?${params.toString()}`,
          { signal: controller.signal }
        );
        const data = await response.json();
        if (!response.ok) {
          throw new Error(data?.error ?? "Unable to load timeline.");
        }
        setState({ status: "success", error: null, payload: data });
      } catch (error) {
        if (error?.name === "AbortError") {
          return;
        }
        setState({
          status: "error",
          error: error instanceof Error ? error.message : "Unable to load timeline.",
          payload: null,
        });
      }
    };
    load();
    return () => controller.abort();
  }, [date, userId]);

  const payload = state.payload ?? {};
  const rows = payload?.rows ?? [];
  const window = payload?.window ?? null;

  const range = useMemo(() => {
    if (!window?.startAt || !window?.endAt) {
      return null;
    }
    const start = new Date(window.startAt);
    const end = new Date(window.endAt);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end <= start) {
      return null;
    }
    return { start, end };
  }, [window]);

  const ticks = useMemo(() => {
    if (!range || !Array.isArray(window?.ticks)) {
      return [];
    }
    return window.ticks.map((tick) => {
      const time = new Date(tick);
      return {
        value: tick,
        label: formatTime(tick),
        ...getWidthPercent(range, time, time),
      };
    });
  }, [range, window]);

  const rowMarkers = useMemo(() => {
    if (!range) {
      return [];
    }
    return rows.map((row) => ({
      ...row,
      segments: (row.segments ?? []).map((segment) => ({
        ...segment,
        ...getWidthPercent(
          range,
          new Date(segment.startAt),
          new Date(segment.endAt)
        ),
      })),
    }));
  }, [range, rows]);

  if (state.status === "loading") {
    return (
      <div className="rounded-2xl border border-[color:var(--color-border)] bg-[color:var(--color-card)] p-5 text-sm text-[color:var(--color-text-muted)]">
        Loading timeline...
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

  if (!rows.length || !range) {
    return (
      <div className="rounded-2xl border border-[color:var(--color-border)] bg-[color:var(--color-card)] p-5 text-sm text-[color:var(--color-text-subtle)]">
        No timeline data available.
      </div>
    );
  }

  const showUserNames = showNames ?? rows.length > 1;
  const minWidth = Math.max(640, ticks.length * 120);

  return (
    <div className="rounded-2xl border border-[color:var(--color-border)] bg-[color:var(--color-card)] p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-sm font-semibold text-[color:var(--color-text)]">{title}</p>
          <p className="text-xs text-[color:var(--color-text-muted)]">
            {formatTime(range.start)} - {formatTime(range.end)} (Asia/Karachi)
          </p>
        </div>
      </div>

      <div className="mt-4 overflow-x-auto">
        <div className="min-w-full" style={{ minWidth }}>
          <div
            className={`grid items-center gap-3 pb-2 text-[11px] text-[color:var(--color-text-muted)] ${
              showUserNames ? "grid-cols-[160px,1fr]" : "grid-cols-1"
            }`}
          >
            {showUserNames ? <div className="sticky left-0 bg-[color:var(--color-card)]" /> : null}
            <div className="relative h-6 border-b border-[color:var(--color-border-subtle)]">
              {ticks.map((tick) => (
                <div
                  key={tick.value}
                  className="absolute top-0 h-full"
                  style={{ left: `${tick.left}%` }}
                >
                  <div className="h-full border-l border-dashed border-[color:var(--color-border-subtle)]" />
                  <span className="absolute -bottom-5 -translate-x-1/2">
                    {tick.label}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-3">
            {rowMarkers.map((row) => (
              <div
                key={row.user?.id ?? row.user?.name ?? "row"}
                className={`grid items-center gap-3 ${
                  showUserNames ? "grid-cols-[160px,1fr]" : "grid-cols-1"
                }`}
              >
                {showUserNames ? (
                  <div className="sticky left-0 z-10 truncate bg-[color:var(--color-card)] pr-2 text-sm font-semibold text-[color:var(--color-text)]">
                    {row.user?.name ?? "Unknown"}
                  </div>
                ) : null}
                <div className="relative h-8 rounded-none border border-[color:var(--color-border-subtle)] bg-[color:var(--color-surface-muted)]">
                  {row.segments.map((segment) => (
                    <div
                      key={`${segment.type}-${segment.startAt}-${segment.endAt}`}
                      className="absolute top-0 h-full rounded-none"
                      style={{
                        left: `${segment.left}%`,
                        width: `${segment.width}%`,
                        backgroundColor:
                          SEGMENT_COLORS[segment.type] ?? SEGMENT_COLORS.NO_DUTY,
                        backgroundImage: segment.isWFH
                          ? "repeating-linear-gradient(45deg, rgba(255,255,255,0.35) 0 4px, rgba(255,255,255,0) 4px 8px)"
                          : "none",
                      }}
                      title={buildTooltip(segment)}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3 text-xs text-[color:var(--color-text-muted)]">
        <span className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-none" style={{ background: SEGMENT_COLORS.WORK_TASK }} />
          Task work
        </span>
        <span className="flex items-center gap-2">
          <span
            className="h-2 w-2 rounded-none"
            style={{ background: SEGMENT_COLORS.WORK_MANUAL }}
          />
          Manual work
        </span>
        <span className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-none" style={{ background: SEGMENT_COLORS.BREAK }} />
          Break
        </span>
        <span className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-none" style={{ background: SEGMENT_COLORS.IDLE }} />
          Idle
        </span>
        <span className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-none" style={{ background: SEGMENT_COLORS.NO_DUTY }} />
          No duty
        </span>
        <span className="flex items-center gap-2">
          <span
            className="h-2 w-3 rounded-none"
            style={{
              backgroundColor: SEGMENT_COLORS.WORK_TASK,
              backgroundImage:
                "repeating-linear-gradient(45deg, rgba(255,255,255,0.35) 0 4px, rgba(255,255,255,0) 4px 8px)",
            }}
          />
          WFH overlay
        </span>
      </div>
    </div>
  );
}
