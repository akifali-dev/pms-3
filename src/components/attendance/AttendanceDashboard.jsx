"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import ActionButton from "@/components/ui/ActionButton";
import Modal from "@/components/ui/Modal";
import PageHeader from "@/components/layout/PageHeader";
import { useToast } from "@/components/ui/ToastProvider";
import useOutsideClick from "@/hooks/useOutsideClick";

const badgeOptions = [
  { id: "all", label: "All" },
  { id: "recorded", label: "Recorded" },
];

const presetOptions = [
  { id: "today", label: "Today" },
  { id: "week", label: "This Week" },
  { id: "month", label: "This Month" },
];

function formatDateForInput(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }
  return date.toLocaleDateString("en-CA");
}

function formatDisplayDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "-";
  }
  return date.toLocaleDateString();
}

function formatDisplayTime(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "-";
  }
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function formatTimeInput(value) {
  if (!value) {
    return "";
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }
  return date.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
}

function formatDuration(inTime, outTime) {
  if (!inTime || !outTime) {
    return "-";
  }
  const start = new Date(inTime);
  const end = new Date(outTime);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return "-";
  }
  const diffMs = end - start;
  if (diffMs < 0) {
    return "-";
  }
  const totalMinutes = Math.round(diffMs / 60000);
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

function isEditableAttendanceDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return false;
  }
  const today = new Date();
  const startOfToday = new Date(
    Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate())
  );
  const earliest = new Date(startOfToday);
  earliest.setUTCDate(startOfToday.getUTCDate() - 2);
  const target = new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate())
  );
  return target >= earliest && target <= startOfToday;
}

function getPresetRange(preset) {
  const now = new Date();
  const start = new Date(now);
  const end = new Date(now);

  if (preset === "week") {
    const day = now.getDay();
    const diff = (day + 6) % 7;
    start.setDate(now.getDate() - diff);
    end.setDate(start.getDate() + 6);
  } else if (preset === "month") {
    start.setDate(1);
    end.setMonth(start.getMonth() + 1, 0);
  }

  return {
    from: formatDateForInput(start),
    to: formatDateForInput(end),
  };
}

function combineDateTime(dateValue, timeValue) {
  if (!dateValue || !timeValue) {
    return null;
  }
  const combined = new Date(`${dateValue}T${timeValue}`);
  if (Number.isNaN(combined.getTime())) {
    return null;
  }
  return combined.toISOString();
}

const AttendanceMenu = ({ onEdit, disabled, tooltip }) => {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef(null);

  useOutsideClick(menuRef, () => setIsOpen(false), isOpen);

  return (
    <div className="relative" ref={menuRef}>
      <button
        type="button"
        onClick={(event) => {
          event.stopPropagation();
          if (disabled) {
            return;
          }
          setIsOpen((prev) => !prev);
        }}
        className={`inline-flex h-8 w-8 items-center justify-center rounded-full border border-[color:var(--color-border)] text-[color:var(--color-text-muted)] transition ${
          disabled
            ? "cursor-not-allowed opacity-60"
            : "hover:border-[color:var(--color-accent)] hover:text-[color:var(--color-text)]"
        }`}
        aria-label="Attendance actions"
        title={disabled ? tooltip : "Attendance actions"}
        aria-expanded={isOpen}
        aria-haspopup="menu"
        disabled={disabled}
      >
        <span className="text-lg leading-none">⋮</span>
      </button>
      {isOpen ? (
        <div
          className="absolute right-0 z-10 mt-2 w-40 rounded-xl border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-2 text-xs text-[color:var(--color-text)] shadow-xl"
          onClick={(event) => event.stopPropagation()}
        >
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              setIsOpen(false);
              onEdit();
            }}
            className="flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-[color:var(--color-text)] hover:bg-[color:var(--color-muted-bg)]"
          >
            Edit
          </button>
        </div>
      ) : null}
    </div>
  );
};

export default function AttendanceDashboard({
  initialAttendance,
  users,
  currentUser,
  isLeader,
  initialRange,
}) {
  const { addToast } = useToast();
  const [attendance, setAttendance] = useState(initialAttendance ?? []);
  const [status, setStatus] = useState({ loading: false, error: null });
  const [activeBadge, setActiveBadge] = useState("all");
  const [activePreset, setActivePreset] = useState(initialRange?.preset ?? "week");
  const [range, setRange] = useState(() => {
    if (initialRange?.from && initialRange?.to) {
      return { from: initialRange.from, to: initialRange.to };
    }
    return getPresetRange("week");
  });
  const [selectedUser, setSelectedUser] = useState(null);
  const [userQuery, setUserQuery] = useState("");
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const userMenuRef = useRef(null);

  const [modalState, setModalState] = useState({ open: false, mode: "create" });
  const [activeRecord, setActiveRecord] = useState(null);
  const [form, setForm] = useState({
    date: formatDateForInput(new Date()),
    inTime: "",
    outTime: "",
    note: "",
    userId: currentUser?.id ?? "",
  });
  const [formUserQuery, setFormUserQuery] = useState("");
  const [isFormUserMenuOpen, setIsFormUserMenuOpen] = useState(false);
  const formUserMenuRef = useRef(null);

  useOutsideClick(userMenuRef, () => setIsUserMenuOpen(false), isUserMenuOpen);
  useOutsideClick(
    formUserMenuRef,
    () => setIsFormUserMenuOpen(false),
    isFormUserMenuOpen
  );

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

  const filteredFormUsers = useMemo(() => {
    const query = formUserQuery.toLowerCase();
    if (!query) {
      return users;
    }
    return users.filter(
      (user) =>
        user.name.toLowerCase().includes(query) ||
        user.email.toLowerCase().includes(query)
    );
  }, [formUserQuery, users]);

  const badgeCounts = useMemo(() => {
    const counts = { all: attendance.length, recorded: 0 };
    attendance.forEach((record) => {
      if (record.inTime || record.outTime) {
        counts.recorded += 1;
      }
    });
    return counts;
  }, [attendance]);

  const filteredAttendance = useMemo(() => {
    if (activeBadge === "recorded") {
      return attendance.filter((record) => record.inTime || record.outTime);
    }
    return attendance;
  }, [activeBadge, attendance]);

  const fetchAttendance = async ({ targetUserId } = {}) => {
    setStatus({ loading: true, error: null });
    try {
      const params = new URLSearchParams();
      if (range.from) {
        params.set("from", range.from);
      }
      if (range.to) {
        params.set("to", range.to);
      }
      if (targetUserId) {
        params.set("userId", targetUserId);
      }
      const response = await fetch(`/api/attendance?${params.toString()}`);
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.message ?? "Unable to load attendance.");
      }
      setAttendance(data?.attendance ?? []);
      setStatus({ loading: false, error: null });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unable to load attendance.";
      setStatus({ loading: false, error: message });
      addToast({
        title: "Attendance unavailable",
        message,
        variant: "error",
      });
    }
  };

  useEffect(() => {
    fetchAttendance({ targetUserId: selectedUser?.id ?? "" });
  }, [range.from, range.to, selectedUser?.id]);

  const handlePresetClick = (preset) => {
    const nextRange = getPresetRange(preset);
    setRange(nextRange);
    setActivePreset(preset);
  };

  const handleRangeChange = (field, value) => {
    setRange((prev) => ({ ...prev, [field]: value }));
    setActivePreset(null);
  };

  const openCreateModal = () => {
    const defaultUser = selectedUser ?? currentUser;
    setForm({
      date: range.from || formatDateForInput(new Date()),
      inTime: "",
      outTime: "",
      note: "",
      userId: defaultUser?.id ?? currentUser?.id ?? "",
    });
    setFormUserQuery(defaultUser?.name ?? "");
    setActiveRecord(null);
    setModalState({ open: true, mode: "create" });
  };

  const openEditModal = (record) => {
    setActiveRecord(record);
    setForm({
      date: formatDateForInput(record.date),
      inTime: formatTimeInput(record.inTime),
      outTime: formatTimeInput(record.outTime),
      note: record.note ?? "",
      userId: record.userId ?? record.user?.id ?? "",
    });
    setFormUserQuery(record.user?.name ?? "");
    setModalState({ open: true, mode: "edit" });
  };

  const closeModal = () => {
    setModalState({ open: false, mode: "create" });
  };

  const handleFormChange = (event) => {
    const { name, value } = event.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setStatus((prev) => ({ ...prev, loading: true }));

    const payload = {
      date: form.date,
      inTime: combineDateTime(form.date, form.inTime),
      outTime: combineDateTime(form.date, form.outTime),
      note: form.note,
    };

    if (isLeader && form.userId) {
      payload.userId = form.userId;
    }

    try {
      const response = await fetch(
        modalState.mode === "edit" && activeRecord
          ? `/api/attendance/${activeRecord.id}`
          : "/api/attendance",
        {
          method: modalState.mode === "edit" ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      );
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.message ?? "Unable to save attendance.");
      }
      addToast({
        title: "Attendance saved",
        message: data?.message ?? "Attendance saved.",
        variant: "success",
      });
      closeModal();
      fetchAttendance({ targetUserId: selectedUser?.id ?? "" });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unable to save attendance.";
      addToast({
        title: "Attendance failed",
        message,
        variant: "error",
      });
    } finally {
      setStatus((prev) => ({ ...prev, loading: false }));
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="People Ops"
        title="Attendance"
        subtitle="Track check-ins and check-outs across the team."
        actions={<ActionButton label="Add Attendance" onClick={openCreateModal} />}
      />

      <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-[color:var(--color-border)] bg-[color:var(--color-card)] p-4">
        <div className="flex flex-wrap items-center gap-2">
          {badgeOptions.map((badge) => (
            <button
              key={badge.id}
              type="button"
              onClick={() => setActiveBadge(badge.id)}
              className={`flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold transition ${
                activeBadge === badge.id
                  ? "border-[color:var(--color-accent)] bg-[color:var(--color-accent-muted)] text-[color:var(--color-accent)]"
                  : "border-[color:var(--color-border)] text-[color:var(--color-text-muted)] hover:border-[color:var(--color-accent)]"
              }`}
            >
              <span>{badge.label}</span>
              <span className="rounded-full bg-[color:var(--color-muted-bg)] px-2 py-0.5 text-[10px] font-semibold text-[color:var(--color-text-muted)]">
                {badgeCounts[badge.id] ?? 0}
              </span>
            </button>
          ))}
          <div className="flex flex-wrap items-center gap-2">
            {presetOptions.map((preset) => (
              <button
                key={preset.id}
                type="button"
                onClick={() => handlePresetClick(preset.id)}
                className={`rounded-full border px-3 py-1 text-xs font-semibold transition ${
                  activePreset === preset.id
                    ? "border-[color:var(--color-accent)] bg-[color:var(--color-accent-muted)] text-[color:var(--color-accent)]"
                    : "border-[color:var(--color-border)] text-[color:var(--color-text-muted)] hover:border-[color:var(--color-accent)]"
                }`}
              >
                {preset.label}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <label className="flex items-center gap-2 text-xs text-[color:var(--color-text-subtle)]">
              From
              <input
                type="date"
                value={range.from}
                onChange={(event) => handleRangeChange("from", event.target.value)}
                className="rounded-full border border-[color:var(--color-border)] bg-[color:var(--color-input)] px-3 py-1 text-xs font-semibold text-[color:var(--color-text)]"
              />
            </label>
            <label className="flex items-center gap-2 text-xs text-[color:var(--color-text-subtle)]">
              To
              <input
                type="date"
                value={range.to}
                onChange={(event) => handleRangeChange("to", event.target.value)}
                className="rounded-full border border-[color:var(--color-border)] bg-[color:var(--color-input)] px-3 py-1 text-xs font-semibold text-[color:var(--color-text)]"
              />
            </label>
          </div>
        </div>

        {isLeader ? (
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

      {status.loading ? (
        <div className="space-y-3 rounded-2xl border border-[color:var(--color-border)] bg-[color:var(--color-card)] p-6">
          {[...Array(5)].map((_, index) => (
            <div
              key={`skeleton-${index}`}
              className="h-10 w-full animate-pulse rounded-xl bg-[color:var(--color-muted-bg)]"
            />
          ))}
        </div>
      ) : status.error ? (
        <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 p-6 text-sm text-rose-200">
          {status.error}
        </div>
      ) : filteredAttendance.length ? (
        <div className="overflow-x-auto rounded-2xl border border-[color:var(--color-border)] bg-[color:var(--color-card)]">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-[color:var(--color-border)] text-xs uppercase tracking-[0.2em] text-[color:var(--color-text-subtle)]">
              <tr>
                {isLeader ? <th className="px-4 py-3">User</th> : null}
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">In time</th>
                <th className="px-4 py-3">Out time</th>
                <th className="px-4 py-3">Duration</th>
                <th className="px-4 py-3">Note</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredAttendance.map((record) => (
                <tr
                  key={record.id}
                  className="border-b border-[color:var(--color-border)] last:border-b-0"
                >
                  {isLeader ? (
                    <td className="px-4 py-4">
                      <div className="text-sm font-semibold text-[color:var(--color-text)]">
                        {record.user?.name ?? "Unknown"}
                      </div>
                      <div className="text-xs text-[color:var(--color-text-subtle)]">
                        {record.user?.role ?? ""}
                      </div>
                    </td>
                  ) : null}
                  <td className="px-4 py-4 text-[color:var(--color-text)]">
                    {formatDisplayDate(record.date)}
                  </td>
                  <td className="px-4 py-4 text-[color:var(--color-text)]">
                    {record.inTime ? formatDisplayTime(record.inTime) : "-"}
                  </td>
                  <td className="px-4 py-4 text-[color:var(--color-text)]">
                    {record.outTime ? formatDisplayTime(record.outTime) : "-"}
                  </td>
                  <td className="px-4 py-4 text-[color:var(--color-text)]">
                    {formatDuration(record.inTime, record.outTime)}
                  </td>
                  <td className="px-4 py-4 text-[color:var(--color-text-muted)]">
                    {record.note || "-"}
                  </td>
                  <td className="px-4 py-4 text-right">
                    <AttendanceMenu
                      onEdit={() => openEditModal(record)}
                      disabled={!isLeader && !isEditableAttendanceDate(record.date)}
                      tooltip="You can only edit attendance for today and the last 2 days."
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="rounded-2xl border border-[color:var(--color-border)] bg-[color:var(--color-card)] p-6 text-sm text-[color:var(--color-text-muted)]">
          No attendance found.
        </div>
      )}

      <Modal
        isOpen={modalState.open}
        title={modalState.mode === "edit" ? "Edit attendance" : "Add attendance"}
        description="Record check-in and check-out times for any date."
        onClose={closeModal}
      >
        <form onSubmit={handleSubmit} className="flex h-full flex-col">
          <div className="mt-4 flex-1 space-y-4 overflow-y-auto pr-1 hide-scrollbar">
            {isLeader ? (
              <div className="relative" ref={formUserMenuRef}>
                <label className="grid gap-2 text-xs text-[color:var(--color-text-muted)]">
                  User
                  <input
                    value={formUserQuery}
                    onChange={(event) => {
                      setFormUserQuery(event.target.value);
                      setIsFormUserMenuOpen(true);
                      if (!event.target.value) {
                        setForm((prev) => ({ ...prev, userId: "" }));
                      }
                    }}
                    onFocus={() => setIsFormUserMenuOpen(true)}
                    placeholder="Select user"
                    className="w-full rounded-xl border border-[color:var(--color-border)] bg-[color:var(--color-input)] px-3 py-2 text-sm text-[color:var(--color-text)] outline-none focus:border-[color:var(--color-accent)]"
                  />
                </label>
                {form.userId ? (
                  <button
                    type="button"
                    onClick={() => {
                      setForm((prev) => ({ ...prev, userId: "" }));
                      setFormUserQuery("");
                      setIsFormUserMenuOpen(false);
                    }}
                    className="absolute right-3 top-9 text-[color:var(--color-text-muted)]"
                    aria-label="Clear user selection"
                  >
                    ×
                  </button>
                ) : null}
                {isFormUserMenuOpen ? (
                  <div className="absolute right-0 z-10 mt-2 max-h-56 w-full overflow-y-auto rounded-xl border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-2 text-xs shadow-xl">
                    {filteredFormUsers.length ? (
                      filteredFormUsers.map((user) => (
                        <button
                          key={user.id}
                          type="button"
                          onClick={() => {
                            setForm((prev) => ({ ...prev, userId: user.id }));
                            setFormUserQuery(user.name);
                            setIsFormUserMenuOpen(false);
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
            <div className="grid gap-3 lg:grid-cols-3">
              <label className="grid gap-2 text-xs text-[color:var(--color-text-muted)]">
                Date
                <input
                  type="date"
                  name="date"
                  value={form.date}
                  onChange={handleFormChange}
                  required
                  className="rounded-xl border border-[color:var(--color-border)] bg-[color:var(--color-input)] px-3 py-2 text-sm text-[color:var(--color-text)] outline-none focus:border-[color:var(--color-accent)]"
                />
              </label>
              <label className="grid gap-2 text-xs text-[color:var(--color-text-muted)]">
                In time
                <input
                  type="time"
                  name="inTime"
                  value={form.inTime}
                  onChange={handleFormChange}
                  className="rounded-xl border border-[color:var(--color-border)] bg-[color:var(--color-input)] px-3 py-2 text-sm text-[color:var(--color-text)] outline-none focus:border-[color:var(--color-accent)]"
                />
              </label>
              <label className="grid gap-2 text-xs text-[color:var(--color-text-muted)]">
                Out time
                <input
                  type="time"
                  name="outTime"
                  value={form.outTime}
                  onChange={handleFormChange}
                  className="rounded-xl border border-[color:var(--color-border)] bg-[color:var(--color-input)] px-3 py-2 text-sm text-[color:var(--color-text)] outline-none focus:border-[color:var(--color-accent)]"
                />
              </label>
            </div>
            <label className="grid gap-2 text-xs text-[color:var(--color-text-muted)]">
              Note
              <textarea
                name="note"
                value={form.note}
                onChange={handleFormChange}
                rows={3}
                placeholder="Optional notes"
                className="rounded-xl border border-[color:var(--color-border)] bg-[color:var(--color-input)] px-3 py-2 text-sm text-[color:var(--color-text)] outline-none focus:border-[color:var(--color-accent)]"
              />
            </label>
          </div>
          <div className="sticky bottom-0 mt-4 flex flex-wrap items-center justify-end gap-3 border-t border-[color:var(--color-border)] bg-[color:var(--color-card)] pt-4">
            <ActionButton
              label={modalState.mode === "edit" ? "Save changes" : "Save attendance"}
              variant="primary"
              type="submit"
              className="min-w-[160px]"
            />
          </div>
        </form>
      </Modal>
    </div>
  );
}
