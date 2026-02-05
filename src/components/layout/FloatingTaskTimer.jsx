"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ui/ToastProvider";
import useOutsideClick from "@/hooks/useOutsideClick";

const STORAGE_KEY_X = "timer_pos_x";
const STORAGE_KEY_Y = "timer_pos_y";
const BREAK_REASONS = ["NAMAZ", "LUNCH", "DINNER", "REFRESHMENT", "OTHER"];

const COLOR_MAP = {
  neutral: {
    ring: "#94a3b8",
    border: "#64748b",
  },
  green: {
    ring: "#22c55e",
    border: "#16a34a",
  },
  yellow: {
    ring: "#f59e0b",
    border: "#d97706",
  },
  red: {
    ring: "#ef4444",
    border: "#dc2626",
  },
};

function clamp(n, min, max) {
  return Math.min(Math.max(n, min), max);
}

function formatHHMMSS(totalSeconds = 0) {
  const value = Math.max(0, Math.floor(Number(totalSeconds) || 0));
  const hours = Math.floor(value / 3600)
    .toString()
    .padStart(2, "0");
  const minutes = Math.floor((value % 3600) / 60)
    .toString()
    .padStart(2, "0");
  const seconds = Math.floor(value % 60)
    .toString()
    .padStart(2, "0");
  return `${hours}:${minutes}:${seconds}`;
}

function formatShort(totalSeconds = 0) {
  const seconds = Math.max(0, Math.floor(Number(totalSeconds) || 0));
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (hours > 0 && minutes > 0) {
    return `${hours}h ${minutes}m`;
  }
  if (hours > 0) {
    return `${hours}h`;
  }
  return `${minutes}m`;
}

function getTimerColor(estimatedSeconds, spentSeconds) {
  const estimated = Number(estimatedSeconds ?? 0);
  if (!Number.isFinite(estimated) || estimated <= 0) {
    return "neutral";
  }

  const spent = Math.max(0, Number(spentSeconds ?? 0));
  if (spent > estimated) {
    return "red";
  }

  const progress = spent / estimated;
  const remainingPercentage = Math.max(0, 100 - progress * 100);

  if (remainingPercentage > 70) {
    return "green";
  }
  if (remainingPercentage >= 30) {
    return "yellow";
  }
  return "red";
}

export default function FloatingTaskTimer({ session }) {
  const router = useRouter();
  const { addToast } = useToast();
  const [activeSession, setActiveSession] = useState(null);
  const [tick, setTick] = useState(() => Date.now());
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [reasonMenuOpen, setReasonMenuOpen] = useState(false);
  const menuRef = useRef(null);
  useOutsideClick(menuRef, () => setReasonMenuOpen(false), reasonMenuOpen);

  const containerRef = useRef(null);
  const dragPointerIdRef = useRef(null);
  const dragStartOffsetRef = useRef({ x: 0, y: 0 });
  const [position, setPosition] = useState(() => {
    if (typeof window === "undefined") {
      return { x: 24, y: 96 };
    }
    const storedX = Number(window.localStorage.getItem(STORAGE_KEY_X));
    const storedY = Number(window.localStorage.getItem(STORAGE_KEY_Y));
    if (Number.isFinite(storedX) && Number.isFinite(storedY)) {
      return { x: storedX, y: storedY };
    }
    return { x: 24, y: 96 };
  });

  const syncFromServer = useCallback(async () => {
    if (!session) {
      setLoading(false);
      setActiveSession(null);
      return;
    }

    const response = await fetch("/api/tasks/active-session", {
      cache: "no-store",
    });
    const data = await response.json();
    if (!response.ok) {
      setLoading(false);
      setActiveSession(null);
      return;
    }

    setActiveSession(data.active ? data : null);
    setLoading(false);
  }, [session]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      syncFromServer();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [syncFromServer]);

  useEffect(() => {
    const interval = window.setInterval(() => {
      setTick(Date.now());
    }, 1000);
    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    const interval = window.setInterval(() => {
      syncFromServer();
    }, 30000);
    return () => window.clearInterval(interval);
  }, [syncFromServer]);

  useEffect(() => {
    const onFocus = () => syncFromServer();
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [syncFromServer]);

  const clampPosition = useCallback((nextX, nextY) => {
    const el = containerRef.current;
    const width = el?.offsetWidth ?? 320;
    const height = el?.offsetHeight ?? 160;
    const maxX = Math.max(8, window.innerWidth - width - 8);
    const maxY = Math.max(8, window.innerHeight - height - 8);
    return {
      x: clamp(nextX, 8, maxX),
      y: clamp(nextY, 8, maxY),
    };
  }, []);

  useEffect(() => {
    const onResize = () => {
      setPosition((prev) => clampPosition(prev.x, prev.y));
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [clampPosition]);

  useEffect(() => {
    const safe = clampPosition(position.x, position.y);
    window.localStorage.setItem(STORAGE_KEY_X, String(safe.x));
    window.localStorage.setItem(STORAGE_KEY_Y, String(safe.y));
  }, [clampPosition, position.x, position.y]);

  const spentSeconds = useMemo(() => {
    if (!activeSession?.active) {
      return 0;
    }

    const accumulated = Math.max(0, Number(activeSession.accumulatedSeconds ?? 0));
    if (activeSession.isPaused || !activeSession.runningStartedAt) {
      return accumulated;
    }

    const serverNowMs = new Date(activeSession.serverNow).getTime();
    const startedMs = new Date(activeSession.runningStartedAt).getTime();
    if (!Number.isFinite(serverNowMs) || !Number.isFinite(startedMs)) {
      return accumulated;
    }

    const baseline = Math.max(0, accumulated + Math.floor((serverNowMs - startedMs) / 1000));
    const sinceRenderTick = Math.max(0, Math.floor((tick - serverNowMs) / 1000));
    return baseline + sinceRenderTick;
  }, [activeSession, tick]);

  const estimatedSeconds = Math.max(0, Number(activeSession?.task?.estimatedSeconds ?? 0));
  const progress = estimatedSeconds > 0 ? Math.min(1, spentSeconds / estimatedSeconds) : 0;
  const colorState = getTimerColor(estimatedSeconds, spentSeconds);
  const palette = COLOR_MAP[colorState];

  const canControl =
    Boolean(activeSession?.active) &&
    session &&
    !["PM", "CTO"].includes(String(session.role ?? "").toUpperCase());

  const moveToTask = useCallback(async () => {
    if (!activeSession?.task?.id) {
      return;
    }
    let projectId = activeSession.task.projectId ?? null;
    let milestoneId = activeSession.task.milestoneId ?? null;

    if (!projectId || !milestoneId) {
      const response = await fetch(`/api/tasks/${activeSession.task.id}/context`, {
        cache: "no-store",
      });
      const data = await response.json();
      if (response.ok) {
        projectId = data.projectId;
        milestoneId = data.milestoneId;
      }
    }

    if (!projectId || !milestoneId) {
      addToast({
        title: "Unable to open task",
        message: "Task context could not be resolved.",
        variant: "error",
      });
      return;
    }

    router.push(
      `/projects/${projectId}/milestones/${milestoneId}?taskId=${activeSession.task.id}&tab=overview`
    );
  }, [activeSession, addToast, router]);

  const handlePause = async (reason) => {
    if (!activeSession?.task?.id || !canControl) {
      return;
    }
    setSubmitting(true);
    const response = await fetch(`/api/tasks/${activeSession.task.id}/breaks/start`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason }),
    });
    const data = await response.json();
    if (!response.ok) {
      addToast({
        title: "Pause failed",
        message: data?.error ?? "Unable to pause timer.",
        variant: "error",
      });
      setSubmitting(false);
      return;
    }
    setReasonMenuOpen(false);
    setSubmitting(false);
    syncFromServer();
  };

  const handleResume = async () => {
    if (!activeSession?.task?.id || !canControl) {
      return;
    }
    setSubmitting(true);
    const response = await fetch(`/api/tasks/${activeSession.task.id}/breaks/end`, {
      method: "POST",
    });
    const data = await response.json();
    if (!response.ok) {
      addToast({
        title: "Resume failed",
        message: data?.error ?? "Unable to resume timer.",
        variant: "error",
      });
      setSubmitting(false);
      return;
    }
    setSubmitting(false);
    syncFromServer();
  };

  const onPointerDownDrag = (event) => {
    if (event.button !== 0) {
      return;
    }
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) {
      return;
    }
    dragPointerIdRef.current = event.pointerId;
    dragStartOffsetRef.current = {
      x: event.clientX - rect.left,
      y: event.clientY - rect.top,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const onPointerMoveDrag = (event) => {
    if (dragPointerIdRef.current !== event.pointerId) {
      return;
    }
    const nextX = event.clientX - dragStartOffsetRef.current.x;
    const nextY = event.clientY - dragStartOffsetRef.current.y;
    setPosition(clampPosition(nextX, nextY));
  };

  const onPointerUpDrag = (event) => {
    if (dragPointerIdRef.current !== event.pointerId) {
      return;
    }
    dragPointerIdRef.current = null;
    event.currentTarget.releasePointerCapture(event.pointerId);
  };

  if (loading || !activeSession?.active) {
    return null;
  }

  const radius = 16;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - progress);

  return (
    <section
      ref={containerRef}
      className="fixed z-[70] w-[320px] max-w-[calc(100vw-16px)] rounded-2xl border bg-[color:var(--color-surface)] p-3 shadow-2xl"
      style={{
        left: `${position.x}px`,
        top: `${position.y}px`,
        borderColor: "var(--color-border)",
      }}
    >
      <div
        className="mb-2 flex cursor-grab items-center justify-between border-b pb-2 active:cursor-grabbing"
        style={{ borderColor: "var(--color-border)" }}
        onPointerDown={onPointerDownDrag}
        onPointerMove={onPointerMoveDrag}
        onPointerUp={onPointerUpDrag}
      >
        <p className="truncate pr-2 text-sm font-semibold text-[color:var(--color-text)]">
          {activeSession.task.title}
        </p>
        <span
          className="inline-block h-2.5 w-2.5 rounded-full"
          style={{ backgroundColor: palette.border }}
        />
      </div>

      <div
        className="mb-2 h-1.5 w-full rounded-full"
        style={{ backgroundColor: `${palette.ring}22` }}
      >
        <div
          className="h-full rounded-full transition-all"
          style={{
            width: `${Math.max(0, Math.min(100, progress * 100))}%`,
            backgroundColor: palette.ring,
          }}
        />
      </div>

      <div className="mb-2 flex items-center justify-between gap-3">
        <div>
          <p className="text-2xl font-bold tabular-nums text-[color:var(--color-text)]">
            {formatHHMMSS(spentSeconds)}
          </p>
          <p className="text-xs text-[color:var(--color-text-subtle)]">
            Est: {estimatedSeconds > 0 ? formatShort(estimatedSeconds) : "N/A"} · Spent: {formatShort(spentSeconds)}
          </p>
        </div>
        <svg viewBox="0 0 40 40" className="h-10 w-10 -rotate-90" aria-hidden="true">
          <circle
            cx="20"
            cy="20"
            r={radius}
            fill="none"
            stroke="currentColor"
            strokeWidth="3"
            className="text-[color:var(--color-border)]"
          />
          <circle
            cx="20"
            cy="20"
            r={radius}
            fill="none"
            strokeWidth="3"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            style={{ stroke: palette.ring }}
          />
        </svg>
      </div>

      <div className="flex flex-wrap gap-2">
        {activeSession.isPaused ? (
          <button
            type="button"
            className="rounded-lg border px-2.5 py-1 text-xs font-semibold"
            style={{ borderColor: "var(--color-border)" }}
            onClick={handleResume}
            disabled={submitting || !canControl}
            title={!canControl ? "Only assigned developer can resume." : undefined}
          >
            Resume
          </button>
        ) : (
          <div className="relative" ref={menuRef}>
            <button
              type="button"
              className="rounded-lg border px-2.5 py-1 text-xs font-semibold"
              style={{ borderColor: "var(--color-border)" }}
              onClick={() => setReasonMenuOpen((prev) => !prev)}
              disabled={submitting || !canControl}
              title={!canControl ? "Only assigned developer can pause." : undefined}
            >
              Pause
            </button>
            {reasonMenuOpen ? (
              <div className="absolute left-0 top-9 z-10 w-44 rounded-xl border bg-[color:var(--color-surface)] p-1 shadow-xl" style={{ borderColor: "var(--color-border)" }}>
                {BREAK_REASONS.map((reason) => (
                  <button
                    key={reason}
                    type="button"
                    className="w-full rounded-lg px-2 py-1.5 text-left text-xs hover:bg-[color:var(--color-muted-bg)]"
                    onClick={() => handlePause(reason)}
                  >
                    {reason}
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        )}

        <button
          type="button"
          className="rounded-lg border px-2.5 py-1 text-xs font-semibold"
          style={{ borderColor: "var(--color-border)" }}
          onClick={moveToTask}
        >
          Open Task
        </button>
      </div>
    </section>
  );
}
