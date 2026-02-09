"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import useOutsideClick from "@/hooks/useOutsideClick";
import DailyTimelineChart from "@/components/analytics/DailyTimelineChart";
import { DEFAULT_TIME_ZONE, formatDateInTimeZone } from "@/lib/attendanceTimes";
import { getDutyDate } from "@/lib/dutyHours";

const periodOptions = [
  { id: "daily", label: "Daily" },
  { id: "weekly", label: "Weekly" },
  { id: "monthly", label: "Monthly" },
];

const AnalyticsResults = dynamic(
  () => import("@/components/analytics/AnalyticsResults"),
  {
    ssr: false,
    loading: () => (
      <div className="rounded-2xl border border-[color:var(--color-border)] bg-[color:var(--color-card)] p-5 text-sm text-[color:var(--color-text-muted)]">
        Loading analytics...
      </div>
    ),
  }
);

function formatDateOnly(value) {
  return formatDateInTimeZone(value, DEFAULT_TIME_ZONE) ?? "";
}

export default function AnalyticsDashboardPanel({ users, currentUser, isManager }) {
  const [period, setPeriod] = useState("daily");
  const [selectedDate, setSelectedDate] = useState("");
  const [selectedUser, setSelectedUser] = useState(null);
  const [userQuery, setUserQuery] = useState("");
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const userMenuRef = useRef(null);

  useOutsideClick(userMenuRef, () => setIsUserMenuOpen(false), isUserMenuOpen);

  useEffect(() => {
    const today = formatDateOnly(new Date());
    setSelectedDate(getDutyDate(new Date()) ?? today);
  }, []);

  const filteredUsers = useMemo(() => {
    const query = userQuery.toLowerCase();
    if (!query) {
      return users;
    }
    return users.filter(
      (user) =>
        user.name.toLowerCase().includes(query) ||
        user.email.toLowerCase().includes(query)
    );
  }, [userQuery, users]);

  const activeUserId = selectedUser?.id ?? (isManager ? null : currentUser?.id);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[color:var(--color-border)] bg-[color:var(--color-card)] p-4">
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={period}
            onChange={(event) => setPeriod(event.target.value)}
            className="rounded-full border border-[color:var(--color-border)] bg-[color:var(--color-input)] px-3 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-[color:var(--color-text-muted)]"
          >
            {periodOptions.map((option) => (
              <option key={option.id} value={option.id}>
                {option.label}
              </option>
            ))}
          </select>
          <input
            type="date"
            value={selectedDate}
            onChange={(event) => setSelectedDate(event.target.value)}
            className="rounded-full border border-[color:var(--color-border)] bg-[color:var(--color-input)] px-3 py-2 text-xs font-semibold text-[color:var(--color-text-muted)]"
          />
        </div>

        {isManager ? (
          <div className="relative w-full max-w-xs" ref={userMenuRef}>
            <input
              value={userQuery}
              onChange={(event) => {
                setUserQuery(event.target.value);
                setIsUserMenuOpen(true);
                if (!event.target.value) {
                  setSelectedUser(null);
                }
              }}
              onFocus={() => setIsUserMenuOpen(true)}
              placeholder="Search user"
              className="w-full rounded-full border border-[color:var(--color-border)] bg-[color:var(--color-input)] px-4 py-2 text-sm text-[color:var(--color-text)] outline-none focus:border-[color:var(--color-accent)]"
            />
            {selectedUser ? (
              <button
                type="button"
                onClick={() => {
                  setSelectedUser(null);
                  setUserQuery("");
                  setIsUserMenuOpen(false);
                }}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[color:var(--color-text-muted)]"
                aria-label="Clear user filter"
              >
                ×
              </button>
            ) : null}
            {isUserMenuOpen ? (
              <div className="absolute right-0 z-10 mt-2 max-h-56 w-full overflow-y-auto rounded-xl border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-2 text-xs shadow-xl">
                {filteredUsers.length ? (
                  filteredUsers.map((user) => (
                    <button
                      key={user.id}
                      type="button"
                      onClick={() => {
                        setSelectedUser(user);
                        setUserQuery(user.name);
                        setIsUserMenuOpen(false);
                      }}
                      className="flex w-full flex-col gap-1 rounded-lg px-3 py-2 text-left text-[color:var(--color-text)] hover:bg-[color:var(--color-muted-bg)]"
                    >
                      <span className="text-sm font-semibold">{user.name}</span>
                      <span className="text-[11px] text-[color:var(--color-text-subtle)]">
                        {user.role}
                      </span>
                    </button>
                  ))
                ) : (
                  <p className="px-3 py-2 text-[color:var(--color-text-subtle)]">
                    No users found.
                  </p>
                )}
              </div>
            ) : null}
          </div>
        ) : null}
      </div>

      {period === "daily" ? (
        <DailyTimelineChart
          date={selectedDate}
          userId={activeUserId}
          showNames={isManager}
          title="Daily working timeline"
        />
      ) : null}

      <AnalyticsResults period={period} date={selectedDate} userId={activeUserId} />
    </div>
  );
}
