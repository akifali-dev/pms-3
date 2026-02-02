"use client";

import { useMemo } from "react";
import {
  Bar,
  BarChart,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

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

function formatDayLabel(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }
  return date.toLocaleDateString([], { weekday: "short", day: "numeric" });
}

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) {
    return null;
  }
  const entry = payload[0]?.payload;
  return (
    <div className="rounded-lg border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-3 text-xs text-[color:var(--color-text)] shadow-lg">
      <p className="text-xs font-semibold text-[color:var(--color-text)]">
        {formatDayLabel(label)}
      </p>
      <div className="mt-2 space-y-1 text-[color:var(--color-text-muted)]">
        <p>Work: {formatDuration(entry.workSeconds)}</p>
        <p>Break: {formatDuration(entry.breakSeconds)}</p>
        <p>Idle: {formatDuration(entry.idleSeconds)}</p>
      </div>
    </div>
  );
}

export default function WorkstackChart({ perDay, minWidth }) {
  const data = useMemo(() => {
    return (perDay ?? []).map((entry) => ({
      date: entry.date,
      workSeconds: entry.totals?.workSeconds ?? 0,
      breakSeconds: entry.totals?.breakSeconds ?? 0,
      idleSeconds: entry.totals?.idleSeconds ?? 0,
    }));
  }, [perDay]);

  return (
    <div className="h-64 w-full overflow-x-auto">
      <div style={{ minWidth: minWidth ?? "100%", height: "100%" }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={data}
            barSize={24}
            margin={{ top: 10, right: 20, left: 0, bottom: 10 }}
          >
            <XAxis
              dataKey="date"
              tickFormatter={formatDayLabel}
              tick={{ fill: "var(--color-text-muted)", fontSize: 12 }}
            />
            <YAxis
              tickFormatter={(value) => formatDuration(value)}
              tick={{ fill: "var(--color-text-muted)", fontSize: 12 }}
            />
            <Tooltip content={<CustomTooltip />} />
            <Legend />
            <Bar
              dataKey="workSeconds"
              stackId="day"
              fill="var(--color-work)"
              name="Work"
              radius={0}
            />
            <Bar
              dataKey="breakSeconds"
              stackId="day"
              fill="var(--color-break)"
              name="Break"
              radius={0}
            />
            <Bar
              dataKey="idleSeconds"
              stackId="day"
              fill="var(--color-idle)"
              name="Idle"
              radius={0}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
