"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import ActionButton from "@/components/ui/ActionButton";
import Modal from "@/components/ui/Modal";
import PageHeader from "@/components/layout/PageHeader";
import { useToast } from "@/components/ui/ToastProvider";
import useOutsideClick from "@/hooks/useOutsideClick";
import { getAttendanceAutoOffTime } from "@/lib/attendanceAutoOff";

const badgeOptions = [
  { id: "all", label: "All" },
  { id: "recorded", label: "Recorded" },
];

const presetOptions = [
  { id: "today", label: "Today" },
  { id: "week", label: "This Week" },
  { id: "month", label: "This Month" },
];

const breakTypeOptions = [
  { id: "LUNCH", label: "Lunch" },
  { id: "DINNER", label: "Dinner" },
  { id: "NAMAZ", label: "Namaz" },
  { id: "REFRESHMENT", label: "Refreshment" },
  { id: "OTHER", label: "Other" },
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

function formatDurationFromSeconds(seconds) {
  if (!seconds || seconds <= 0) {
    return "-";
  }
  const totalMinutes = Math.round(seconds / 60);
  if (totalMinutes <= 0) {
    return "-";
  }
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

function formatDurationFromMinutes(minutes) {
  const totalMinutes = Number(minutes);
  if (!totalMinutes || totalMinutes <= 0) {
    return "-";
  }
  const hours = Math.floor(totalMinutes / 60);
  const remaining = totalMinutes % 60;
  if (hours && remaining) {
    return `${hours}h ${remaining}m`;
  }
  if (hours) {
    return `${hours}h`;
  }
  return `${remaining}m`;
}

function getRecordDurations(record) {
  if (!record) {
    return { office: "-", wfh: "-", total: "-" };
  }
  if (record.inTime && !record.outTime) {
    return { office: "Shift running", wfh: "-", total: "-" };
  }
  if (record.officeHHMM || record.wfhHHMM || record.dutyHHMM) {
    return {
      office: record.officeHHMM ?? "-",
      wfh: record.wfhHHMM ?? "-",
      total: record.dutyHHMM ?? "-",
    };
  }
  let officeSeconds = 0;
  if (record.inTime && record.outTime) {
    const start = new Date(record.inTime);
    const end = new Date(record.outTime);
    if (!Number.isNaN(start.getTime()) && !Number.isNaN(end.getTime()) && end > start) {
      officeSeconds = Math.round((end - start) / 1000);
    }
  }
  let wfhSeconds = 0;
  if (Array.isArray(record.wfhIntervals)) {
    record.wfhIntervals.forEach((interval) => {
      if (!interval?.startAt || !interval?.endAt) {
        return;
      }
      const start = new Date(interval.startAt);
      const end = new Date(interval.endAt);
      if (!Number.isNaN(start.getTime()) && !Number.isNaN(end.getTime()) && end > start) {
        wfhSeconds += Math.round((end - start) / 1000);
      }
    });
  }
  const totalSeconds = officeSeconds + wfhSeconds;
  return {
    office: formatDurationFromSeconds(officeSeconds),
    wfh: formatDurationFromSeconds(wfhSeconds),
    total: formatDurationFromSeconds(totalSeconds),
  };
}

function isTodayDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return false;
  }
  const today = new Date();
  return (
    date.getUTCFullYear() === today.getUTCFullYear() &&
    date.getUTCMonth() === today.getUTCMonth() &&
    date.getUTCDate() === today.getUTCDate()
  );
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

function isAttendanceRunning(attendance, now = new Date()) {
  if (!attendance?.inTime || attendance.outTime) {
    return false;
  }
  const start = new Date(attendance.inTime);
  if (Number.isNaN(start.getTime())) {
    return false;
  }
  const cutoff = getAttendanceAutoOffTime(start);
  if (!cutoff) {
    return false;
  }
  return now >= start && now <= cutoff;
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

function formatPresenceLabel(presence) {
  const status = presence?.status;
  if (status === "IN_OFFICE") {
    return "In office";
  }
  if (status === "WFH") {
    return "WFH";
  }
  return "Off duty";
}

function formatBreakType(value) {
  const option = breakTypeOptions.find((item) => item.id === value);
  return option?.label ?? "Other";
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

const BreakMenu = ({ onEdit, onDelete, disabled, tooltip }) => {
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
        aria-label="Break actions"
        title={disabled ? tooltip : "Break actions"}
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
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              setIsOpen(false);
              onDelete();
            }}
            className="flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-rose-300 hover:bg-rose-500/10"
          >
            Delete
          </button>
        </div>
      ) : null}
    </div>
  );
};

export default function AttendanceDashboard({
  initialAttendance,
  initialPresenceNow,
  users,
  currentUser,
  isLeader,
  initialRange,
}) {
  const { addToast } = useToast();
  const [attendance, setAttendance] = useState(initialAttendance ?? []);
  const [presenceNow, setPresenceNow] = useState(initialPresenceNow ?? null);
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
  const [wfhIntervals, setWfhIntervals] = useState([]);
  const [wfhForm, setWfhForm] = useState({ startTime: "", endTime: "" });
  const [wfhSubmitting, setWfhSubmitting] = useState(false);
  const [breakModal, setBreakModal] = useState({
    open: false,
    mode: "create",
    breakItem: null,
    attendanceId: null,
  });
  const [breakForm, setBreakForm] = useState({
    type: "LUNCH",
    startTime: "",
    durationMinutes: "",
    notes: "",
  });
  const [breakSubmitting, setBreakSubmitting] = useState(false);
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

  const activeBreakRecord = useMemo(() => {
    const targetUserId = selectedUser?.id ?? currentUser?.id;
    if (!targetUserId) {
      return null;
    }
    return (
      attendance.find(
        (record) =>
          (record.userId ?? record.user?.id) === targetUserId &&
          record.inTime &&
          !record.outTime
      ) ?? null
    );
  }, [attendance, currentUser?.id, selectedUser?.id]);

  const canManageBreaks = useMemo(() => {
    if (!activeBreakRecord) {
      return false;
    }
    if (isLeader) {
      return true;
    }
    return isAttendanceRunning(activeBreakRecord, new Date());
  }, [activeBreakRecord, isLeader]);

  const notifyAttendanceUpdated = (userId) => {
    if (typeof window === "undefined") {
      return;
    }
    window.dispatchEvent(
      new CustomEvent("attendance-updated", { detail: { userId } })
    );
  };

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
      setPresenceNow(data?.presenceNow ?? null);
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
    setWfhIntervals([]);
    setWfhForm({ startTime: "", endTime: "" });
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
    setWfhIntervals(record.wfhIntervals ?? []);
    setWfhForm({ startTime: "", endTime: "" });
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

  const canAddWfh =
    modalState.mode === "edit" &&
    activeRecord &&
    isTodayDate(activeRecord.date) &&
    activeRecord.inTime &&
    activeRecord.outTime;

  const wfhHelperText = useMemo(() => {
    if (!activeRecord || modalState.mode !== "edit") {
      return "Save attendance to add WFH intervals.";
    }
    if (!isTodayDate(activeRecord.date)) {
      return "WFH intervals can only be added for today.";
    }
    if (!activeRecord.outTime) {
      return "Add out time to enable WFH.";
    }
    return "Add intervals for today.";
  }, [activeRecord, modalState.mode]);

  const handleWfhChange = (event) => {
    const { name, value } = event.target;
    setWfhForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleAddWfhInterval = async () => {
    if (!activeRecord?.id) {
      return;
    }
    const startAt = combineDateTime(form.date, wfhForm.startTime);
    const endAt = combineDateTime(form.date, wfhForm.endTime);
    if (!startAt || !endAt) {
      addToast({
        title: "WFH time required",
        message: "Select both a start and end time for WFH.",
        variant: "warning",
      });
      return;
    }
    setWfhSubmitting(true);
    try {
      const response = await fetch(
        `/api/attendance/${activeRecord.id}/wfh-interval`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ startAt, endAt }),
        }
      );
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.error ?? "Unable to add WFH interval.");
      }
      addToast({
        title: "WFH interval added",
        message: data?.message ?? "WFH interval saved.",
        variant: "success",
      });
      setWfhForm({ startTime: "", endTime: "" });
      if (data?.attendance) {
        setActiveRecord(data.attendance);
        setWfhIntervals(data.attendance.wfhIntervals ?? []);
        if (data?.presenceNow) {
          setPresenceNow(data.presenceNow);
        }
        setAttendance((prev) =>
          prev.map((record) =>
            record.id === data.attendance.id ? data.attendance : record
          )
        );
        notifyAttendanceUpdated(data.attendance.userId ?? currentUser?.id);
      } else {
        fetchAttendance({ targetUserId: selectedUser?.id ?? "" });
      }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unable to add WFH interval.";
      addToast({
        title: "WFH failed",
        message,
        variant: "error",
      });
    } finally {
      setWfhSubmitting(false);
    }
  };

  const openBreakModalForm = ({ mode, breakItem = null, attendanceId = null } = {}) => {
    const startTimeValue = breakItem?.startAt
      ? formatTimeInput(breakItem.startAt)
      : formatTimeInput(new Date());
    setBreakForm({
      type: breakItem?.type ?? "LUNCH",
      startTime: startTimeValue,
      durationMinutes: breakItem?.durationMinutes?.toString() ?? "",
      notes: breakItem?.notes ?? "",
    });
    setBreakModal({ open: true, mode, breakItem, attendanceId });
  };

  const closeBreakModal = () => {
    setBreakModal({ open: false, mode: "create", breakItem: null, attendanceId: null });
  };

  const handleBreakFormChange = (event) => {
    const { name, value } = event.target;
    setBreakForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleBreakSubmit = async (event) => {
    event.preventDefault();
    const targetAttendanceId =
      breakModal.mode === "create"
        ? breakModal.attendanceId ?? activeBreakRecord?.id
        : breakModal.breakItem?.attendanceId;
    if (!targetAttendanceId) {
      return;
    }
    if (!breakForm.startTime || !breakForm.durationMinutes) {
      addToast({
        title: "Break info required",
        message: "Select a start time and duration.",
        variant: "warning",
      });
      return;
    }
    setBreakSubmitting(true);
    try {
      const payload = {
        type: breakForm.type,
        startTime: breakForm.startTime,
        durationMinutes: Number(breakForm.durationMinutes),
        notes: breakForm.notes,
      };
      const endpoint =
        breakModal.mode === "edit" && breakModal.breakItem
          ? `/api/attendance/breaks/${breakModal.breakItem.id}`
          : `/api/attendance/${targetAttendanceId}/breaks`;
      const response = await fetch(endpoint, {
        method: breakModal.mode === "edit" ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.message ?? "Unable to save break.");
      }
      addToast({
        title: breakModal.mode === "edit" ? "Break updated" : "Break added",
        message: data?.message ?? "Break saved.",
        variant: "success",
      });
      closeBreakModal();
      if (data?.attendance) {
        if (activeRecord?.id === data.attendance.id) {
          setActiveRecord(data.attendance);
        }
        setAttendance((prev) =>
          prev.map((record) =>
            record.id === data.attendance.id ? data.attendance : record
          )
        );
      } else {
        fetchAttendance({ targetUserId: selectedUser?.id ?? "" });
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to save break.";
      addToast({
        title: "Break failed",
        message,
        variant: "error",
      });
    } finally {
      setBreakSubmitting(false);
    }
  };

  const handleBreakDelete = async (breakItem) => {
    if (!breakItem?.id) {
      return;
    }
    const confirmed =
      typeof window !== "undefined"
        ? window.confirm("Delete this break?")
        : false;
    if (!confirmed) {
      return;
    }
    setBreakSubmitting(true);
    try {
      const response = await fetch(`/api/attendance/breaks/${breakItem.id}`, {
        method: "DELETE",
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.message ?? "Unable to delete break.");
      }
      addToast({
        title: "Break deleted",
        message: data?.message ?? "Break deleted.",
        variant: "success",
      });
      if (data?.attendance) {
        if (activeRecord?.id === data.attendance.id) {
          setActiveRecord(data.attendance);
        }
        setAttendance((prev) =>
          prev.map((record) =>
            record.id === data.attendance.id ? data.attendance : record
          )
        );
      } else {
        fetchAttendance({ targetUserId: selectedUser?.id ?? "" });
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to delete break.";
      addToast({
        title: "Break failed",
        message,
        variant: "error",
      });
    } finally {
      setBreakSubmitting(false);
    }
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
      if (data?.presenceNow) {
        setPresenceNow(data.presenceNow);
      }
      fetchAttendance({ targetUserId: selectedUser?.id ?? "" });
      notifyAttendanceUpdated(data?.attendance?.userId ?? currentUser?.id);
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
          <div className="flex items-center gap-2 rounded-full border border-[color:var(--color-border)] bg-[color:var(--color-muted-bg)] px-3 py-1 text-xs font-semibold text-[color:var(--color-text-muted)]">
            <span>Presence</span>
            <span className="text-[color:var(--color-text)]">
              {formatPresenceLabel(presenceNow)}
            </span>
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

      {activeBreakRecord &&
      (isLeader || isAttendanceRunning(activeBreakRecord, new Date())) ? (
        <div className="rounded-2xl border border-[color:var(--color-border)] bg-[color:var(--color-card)] p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-[color:var(--color-text)]">Breaks</p>
              <p className="text-xs text-[color:var(--color-text-muted)]">
                {activeBreakRecord.user?.name ?? "Current user"} ·{" "}
                {formatDisplayDate(activeBreakRecord.date)}
              </p>
            </div>
            <ActionButton
              label="Add Break"
              variant="secondary"
              onClick={() =>
                openBreakModalForm({
                  mode: "create",
                  attendanceId: activeBreakRecord.id,
                })
              }
              disabled={!canManageBreaks}
            />
          </div>
          {activeBreakRecord.breaks?.length ? (
            <ul className="mt-4 space-y-3 text-sm text-[color:var(--color-text)]">
              {activeBreakRecord.breaks.map((item) => (
                <li
                  key={item.id}
                  className="flex flex-wrap items-start justify-between gap-3 rounded-xl border border-[color:var(--color-border)] bg-[color:var(--color-muted-bg)] p-3"
                >
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-full border border-[color:var(--color-border)] bg-[color:var(--color-card)] px-2 py-0.5 text-[11px] font-semibold uppercase tracking-[0.15em] text-[color:var(--color-text-muted)]">
                        {formatBreakType(item.type)}
                      </span>
                      <span className="text-xs text-[color:var(--color-text-muted)]">
                        {formatDurationFromMinutes(item.durationMinutes)}
                      </span>
                      <span className="text-xs text-[color:var(--color-text-subtle)]">
                        {formatDisplayTime(item.startAt)} →{" "}
                        {formatDisplayTime(item.endAt)}
                      </span>
                    </div>
                    {item.notes ? (
                      <p className="text-xs text-[color:var(--color-text-muted)]">
                        {item.notes}
                      </p>
                    ) : null}
                  </div>
                  <BreakMenu
                    onEdit={() => openBreakModalForm({ mode: "edit", breakItem: item })}
                    onDelete={() => handleBreakDelete(item)}
                    disabled={!canManageBreaks}
                    tooltip="Breaks can only be edited while duty is running."
                  />
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-4 text-sm text-[color:var(--color-text-subtle)]">
              No breaks recorded yet.
            </p>
          )}
        </div>
      ) : null}

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
                <th className="px-4 py-3">Office duration</th>
                <th className="px-4 py-3">WFH duration</th>
                <th className="px-4 py-3">Total duty</th>
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
                  {(() => {
                    const durations = getRecordDurations(record);
                    return (
                      <>
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
                    {record.outTime ? (
                      <div className="space-y-1">
                        <p>{formatDisplayTime(record.outTime)}</p>
                        {record.autoOff ? (
                          <span
                            className="inline-flex rounded-full border border-amber-400/40 bg-amber-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-200"
                            title="Auto closed after 10 hours (missing out time)"
                          >
                            Auto Off
                          </span>
                        ) : null}
                      </div>
                    ) : record.inTime ? (
                      <div className="space-y-1 text-[color:var(--color-text-subtle)]">
                        <p>Out time not added yet</p>
                        <p className="text-[11px]">In recorded, waiting for out time</p>
                      </div>
                    ) : (
                      "-"
                    )}
                  </td>
                  <td className="px-4 py-4 text-[color:var(--color-text)]">
                    {durations.office}
                  </td>
                  <td className="px-4 py-4 text-[color:var(--color-text)]">
                    {durations.wfh}
                  </td>
                  <td className="px-4 py-4 text-[color:var(--color-text)]">
                    {durations.total}
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
                      </>
                    );
                  })()}
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
                  required
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
            <div className="rounded-2xl border border-[color:var(--color-border)] bg-[color:var(--color-muted-bg)] p-4">
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[color:var(--color-text-subtle)]">
                  Work From Home
                </p>
                <span className="text-[11px] text-[color:var(--color-text-subtle)]">
                  {wfhHelperText}
                </span>
              </div>
              {wfhIntervals.length ? (
                <ul className="mt-3 space-y-2 text-xs text-[color:var(--color-text-muted)]">
                  {wfhIntervals.map((interval) => (
                    <li
                      key={interval.id}
                      className="rounded-lg border border-[color:var(--color-border)] bg-[color:var(--color-card)] px-3 py-2"
                    >
                      {formatDisplayTime(interval.startAt)} →{" "}
                      {formatDisplayTime(interval.endAt)}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-3 text-xs text-[color:var(--color-text-subtle)]">
                  No WFH intervals recorded.
                </p>
              )}
              <div className="mt-4 grid gap-3 lg:grid-cols-3">
                <label className="grid gap-2 text-xs text-[color:var(--color-text-muted)]">
                  Start time
                  <input
                    type="time"
                    name="startTime"
                    value={wfhForm.startTime}
                    onChange={handleWfhChange}
                    disabled={!canAddWfh}
                    className="rounded-xl border border-[color:var(--color-border)] bg-[color:var(--color-input)] px-3 py-2 text-sm text-[color:var(--color-text)] outline-none focus:border-[color:var(--color-accent)] disabled:cursor-not-allowed disabled:opacity-60"
                  />
                </label>
                <label className="grid gap-2 text-xs text-[color:var(--color-text-muted)]">
                  End time
                  <input
                    type="time"
                    name="endTime"
                    value={wfhForm.endTime}
                    onChange={handleWfhChange}
                    disabled={!canAddWfh}
                    className="rounded-xl border border-[color:var(--color-border)] bg-[color:var(--color-input)] px-3 py-2 text-sm text-[color:var(--color-text)] outline-none focus:border-[color:var(--color-accent)] disabled:cursor-not-allowed disabled:opacity-60"
                  />
                </label>
                <div className="flex items-end">
                  <ActionButton
                    label={wfhSubmitting ? "Adding..." : "Add interval"}
                    variant="secondary"
                    type="button"
                    onClick={handleAddWfhInterval}
                    disabled={!canAddWfh || wfhSubmitting}
                    className="w-full"
                  />
                </div>
              </div>
            </div>
            {modalState.mode === "edit" && activeRecord ? (
              <div className="rounded-2xl border border-[color:var(--color-border)] bg-[color:var(--color-muted-bg)] p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[color:var(--color-text-subtle)]">
                    Breaks
                  </p>
                  {isLeader || isAttendanceRunning(activeRecord, new Date()) ? (
                    <ActionButton
                      label="Add break"
                      variant="secondary"
                      type="button"
                      onClick={() =>
                        openBreakModalForm({
                          mode: "create",
                          attendanceId: activeRecord.id,
                        })
                      }
                    />
                  ) : null}
                </div>
                {activeRecord.breaks?.length ? (
                  <ul className="mt-3 space-y-2 text-xs text-[color:var(--color-text-muted)]">
                    {activeRecord.breaks.map((item) => (
                      <li
                        key={item.id}
                        className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-[color:var(--color-border)] bg-[color:var(--color-card)] px-3 py-2"
                      >
                        <div className="space-y-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="rounded-full border border-[color:var(--color-border)] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.2em] text-[color:var(--color-text-muted)]">
                          {formatBreakType(item.type)}
                            </span>
                            <span>{formatDurationFromMinutes(item.durationMinutes)}</span>
                            <span>
                              {formatDisplayTime(item.startAt)} →{" "}
                              {formatDisplayTime(item.endAt)}
                            </span>
                          </div>
                          {item.notes ? <p>{item.notes}</p> : null}
                        </div>
                        {isLeader || isAttendanceRunning(activeRecord, new Date()) ? (
                          <BreakMenu
                            onEdit={() =>
                              openBreakModalForm({ mode: "edit", breakItem: item })
                            }
                            onDelete={() => handleBreakDelete(item)}
                            disabled={false}
                          />
                        ) : null}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-3 text-xs text-[color:var(--color-text-subtle)]">
                    No breaks recorded.
                  </p>
                )}
                {!isLeader && !isAttendanceRunning(activeRecord, new Date()) ? (
                  <p className="mt-2 text-xs text-[color:var(--color-text-subtle)]">
                    Breaks can be edited while duty is running.
                  </p>
                ) : null}
              </div>
            ) : null}
          </div>
          <div className="sticky bottom-0 mt-4 flex flex-wrap items-center justify-end gap-3 border-t border-[color:var(--color-border)] bg-[color:var(--color-card)] py-4">
            <ActionButton
              label={modalState.mode === "edit" ? "Save changes" : "Save attendance"}
              variant="primary"
              type="submit"
              className="min-w-[160px]"
            />
          </div>
        </form>
      </Modal>

      <Modal
        isOpen={breakModal.open}
        title={breakModal.mode === "edit" ? "Edit break" : "Add break"}
        description="Log a break taken during duty."
        onClose={closeBreakModal}
      >
        <form onSubmit={handleBreakSubmit} className="flex h-full flex-col">
          <div className="mt-4 flex-1 space-y-4 overflow-y-auto pr-1 hide-scrollbar">
            <label className="grid gap-2 text-xs text-[color:var(--color-text-muted)]">
              Break type
              <select
                name="type"
                value={breakForm.type}
                onChange={handleBreakFormChange}
                className="rounded-xl border border-[color:var(--color-border)] bg-[color:var(--color-input)] px-3 py-2 text-sm text-[color:var(--color-text)] outline-none focus:border-[color:var(--color-accent)]"
              >
                {breakTypeOptions.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <div className="grid gap-3 lg:grid-cols-2">
              <label className="grid gap-2 text-xs text-[color:var(--color-text-muted)]">
                Start time
                <input
                  type="time"
                  name="startTime"
                  value={breakForm.startTime}
                  onChange={handleBreakFormChange}
                  required
                  className="rounded-xl border border-[color:var(--color-border)] bg-[color:var(--color-input)] px-3 py-2 text-sm text-[color:var(--color-text)] outline-none focus:border-[color:var(--color-accent)]"
                />
              </label>
              <label className="grid gap-2 text-xs text-[color:var(--color-text-muted)]">
                Duration (minutes)
                <input
                  type="number"
                  name="durationMinutes"
                  value={breakForm.durationMinutes}
                  onChange={handleBreakFormChange}
                  min={1}
                  required
                  className="rounded-xl border border-[color:var(--color-border)] bg-[color:var(--color-input)] px-3 py-2 text-sm text-[color:var(--color-text)] outline-none focus:border-[color:var(--color-accent)]"
                />
              </label>
            </div>
            <label className="grid gap-2 text-xs text-[color:var(--color-text-muted)]">
              Notes (optional)
              <textarea
                name="notes"
                value={breakForm.notes}
                onChange={handleBreakFormChange}
                rows={3}
                className="rounded-xl border border-[color:var(--color-border)] bg-[color:var(--color-input)] px-3 py-2 text-sm text-[color:var(--color-text)] outline-none focus:border-[color:var(--color-accent)]"
              />
            </label>
          </div>
          <div className="sticky bottom-0 mt-4 flex flex-wrap items-center justify-end gap-3 border-t border-[color:var(--color-border)] bg-[color:var(--color-card)] pt-4">
            <ActionButton
              label={breakSubmitting ? "Saving..." : "Save break"}
              variant="primary"
              type="submit"
              className="min-w-[160px]"
              disabled={breakSubmitting}
            />
          </div>
        </form>
      </Modal>
    </div>
  );
}
