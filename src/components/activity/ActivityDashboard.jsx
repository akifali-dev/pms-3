"use client";

import { useMemo, useState } from "react";
import ActionButton from "@/components/ui/ActionButton";
import { useToast } from "@/components/ui/ToastProvider";

const ranges = [
  { id: "daily", label: "Daily", days: 1 },
  { id: "weekly", label: "Weekly", days: 7 },
  { id: "monthly", label: "Monthly", days: 30 },
];

const manualCategories = [
  { id: "LEARNING", label: "Learning" },
  { id: "RESEARCH", label: "Research" },
  { id: "IDLE", label: "Idle time" },
];

const commentTargets = [{ id: "user", label: "User" }];

function formatDateTime(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "-";
  }
  return date.toLocaleString();
}

function formatDateOnly(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }
  return date.toISOString().slice(0, 10);
}

function getRangeStart(rangeId) {
  const range = ranges.find((item) => item.id === rangeId) ?? ranges[0];
  const now = new Date();
  const start = new Date(now);
  start.setDate(now.getDate() - range.days + 1);
  start.setHours(0, 0, 0, 0);
  return start;
}

function buildUserMap(users) {
  const map = new Map();
  users.forEach((user) => {
    map.set(user.id, { user, entries: [] });
  });
  return map;
}

export default function ActivityDashboard({
  initialLogs,
  initialComments,
  users,
  currentUser,
  role,
}) {
  const { addToast } = useToast();
  const [range, setRange] = useState("daily");
  const [logs, setLogs] = useState(initialLogs);
  const [comments, setComments] = useState(initialComments);
  const [logForm, setLogForm] = useState({
    category: "LEARNING",
    date: formatDateOnly(new Date()),
    hoursSpent: 1,
    description: "",
  });
  const [commentForm, setCommentForm] = useState({
    target: "user",
    createdForId: "",
    message: "",
  });
  const [status, setStatus] = useState({
    logSubmitting: false,
    commentSubmitting: false,
  });

  const canComment = ["PM", "CTO"].includes(role);

  const filteredLogs = useMemo(() => {
    const start = getRangeStart(range);
    return logs.filter((log) => new Date(log.date) >= start);
  }, [logs, range]);

  const filteredComments = useMemo(() => {
    const start = getRangeStart(range);
    return comments.filter((comment) => new Date(comment.createdAt) >= start);
  }, [comments, range]);

  const timeline = useMemo(() => {
    const userMap = buildUserMap(users);

    filteredLogs.forEach((log) => {
      const bucket = userMap.get(log.user.id);
      if (!bucket) {
        return;
      }
      bucket.entries.push({
        id: `log-${log.id}`,
        type: "log",
        timestamp: log.date,
        description: log.description,
        category: log.category,
        hoursSpent: log.hoursSpent,
        task: log.task,
      });
    });

    filteredComments.forEach((comment) => {
      const bucket = userMap.get(comment.createdFor.id);
      if (!bucket) {
        return;
      }
      bucket.entries.push({
        id: `comment-${comment.id}`,
        type: "comment",
        timestamp: comment.createdAt,
        description: comment.message,
        author: comment.createdBy,
        task: comment.task,
      });
    });

    return Array.from(userMap.values()).map((entry) => ({
      ...entry,
      entries: entry.entries.sort(
        (a, b) => new Date(b.timestamp) - new Date(a.timestamp)
      ),
    }));
  }, [filteredComments, filteredLogs, users]);

  const summary = useMemo(() => {
    const totalHours = filteredLogs.reduce(
      (acc, log) => acc + (Number(log.hoursSpent) || 0),
      0
    );
    const taskLogs = filteredLogs.filter((log) => log.category === "TASK");
    return {
      totalEntries: filteredLogs.length + filteredComments.length,
      totalHours,
      manualLogs: filteredLogs.length - taskLogs.length,
      taskLogs: taskLogs.length,
      comments: filteredComments.length,
    };
  }, [filteredComments.length, filteredLogs]);

  const handleLogChange = (event) => {
    const { name, value } = event.target;
    setLogForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleCommentChange = (event) => {
    const { name, value } = event.target;
    setCommentForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmitLog = async (event) => {
    event.preventDefault();
    setStatus((prev) => ({ ...prev, logSubmitting: true }));

    const response = await fetch("/api/activity-logs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        category: logForm.category,
        date: logForm.date,
        hoursSpent: Number(logForm.hoursSpent),
        description: logForm.description,
      }),
    });

    const payload = await response.json();

    if (!response.ok) {
      addToast({
        title: "Log failed",
        message: payload?.error ?? "Unable to save activity log.",
        variant: "error",
      });
      setStatus((prev) => ({ ...prev, logSubmitting: false }));
      return;
    }

    setLogs((prev) => [payload.activityLog, ...prev]);
    setLogForm((prev) => ({ ...prev, description: "" }));
    addToast({
      title: "Activity logged",
      message: "Manual activity saved to your timeline.",
      variant: "success",
    });
    setStatus((prev) => ({ ...prev, logSubmitting: false }));
  };

  const handleSubmitComment = async (event) => {
    event.preventDefault();

    if (!commentForm.createdForId) {
      addToast({
        title: "Select a user",
        message: "Choose a user before sharing feedback.",
        variant: "warning",
      });
      return;
    }

    setStatus((prev) => ({ ...prev, commentSubmitting: true }));

    const payload = {
      message: commentForm.message,
      createdForId: commentForm.createdForId,
    };

    const response = await fetch("/api/comments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const responseBody = await response.json();

    if (!response.ok) {
      addToast({
        title: "Comment failed",
        message: responseBody?.error ?? "Unable to save comment.",
        variant: "error",
      });
      setStatus((prev) => ({ ...prev, commentSubmitting: false }));
      return;
    }

    setComments((prev) => [responseBody.comment, ...prev]);
    setCommentForm((prev) => ({ ...prev, message: "" }));
    addToast({
      title: "Comment added",
      message: "Feedback shared with the owner.",
      variant: "success",
    });
    setStatus((prev) => ({ ...prev, commentSubmitting: false }));
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 rounded-2xl border border-white/10 bg-white/5 p-6 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-white/40">
            Accountability
          </p>
          <h2 className="mt-2 text-2xl font-semibold text-white">
            Activity & comment timeline
          </h2>
          <p className="mt-2 text-sm text-white/60">
            Track daily logs, task auto-activity, and leadership feedback.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {ranges.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setRange(item.id)}
              className={`rounded-full border px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] transition ${
                range === item.id
                  ? "border-emerald-400/70 bg-emerald-400/10 text-emerald-200"
                  : "border-white/10 bg-white/5 text-white/60 hover:border-white/30"
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="rounded-2xl border border-white/10 bg-slate-900/60 p-5">
          <p className="text-sm font-semibold text-white">Range summary</p>
          <div className="mt-4 space-y-2 text-xs text-white/70">
            <div className="flex items-center justify-between">
              <span>Total entries</span>
              <span className="text-white">{summary.totalEntries}</span>
            </div>
            <div className="flex items-center justify-between">
              <span>Manual logs</span>
              <span className="text-white">{summary.manualLogs}</span>
            </div>
            <div className="flex items-center justify-between">
              <span>Task auto-logs</span>
              <span className="text-white">{summary.taskLogs}</span>
            </div>
            <div className="flex items-center justify-between">
              <span>Comments shared</span>
              <span className="text-white">{summary.comments}</span>
            </div>
            <div className="flex items-center justify-between">
              <span>Hours logged</span>
              <span className="text-white">{summary.totalHours}</span>
            </div>
          </div>
        </div>

        <form
          className="rounded-2xl border border-white/10 bg-slate-900/60 p-5 lg:col-span-2"
          onSubmit={handleSubmitLog}
        >
          <p className="text-sm font-semibold text-white">Log manual activity</p>
          <div className="mt-4 grid gap-3 lg:grid-cols-3">
            <label className="grid gap-2 text-xs text-white/70">
              Category
              <select
                name="category"
                value={logForm.category}
                onChange={handleLogChange}
                className="rounded-xl border border-white/10 bg-slate-950/60 px-3 py-2 text-sm text-white outline-none focus:border-white/40"
              >
                {manualCategories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="grid gap-2 text-xs text-white/70">
              Date
              <input
                type="date"
                name="date"
                value={logForm.date}
                onChange={handleLogChange}
                className="rounded-xl border border-white/10 bg-slate-950/60 px-3 py-2 text-sm text-white outline-none focus:border-white/40"
              />
            </label>
            <label className="grid gap-2 text-xs text-white/70">
              Hours
              <input
                type="number"
                name="hoursSpent"
                min="0"
                step="0.25"
                value={logForm.hoursSpent}
                onChange={handleLogChange}
                className="rounded-xl border border-white/10 bg-slate-950/60 px-3 py-2 text-sm text-white outline-none focus:border-white/40"
              />
            </label>
          </div>
          <label className="mt-3 grid gap-2 text-xs text-white/70">
            Description
            <textarea
              name="description"
              value={logForm.description}
              onChange={handleLogChange}
              rows={3}
              placeholder="Summarize what you worked on."
              className="rounded-xl border border-white/10 bg-slate-950/60 px-3 py-2 text-sm text-white outline-none focus:border-white/40"
            />
          </label>
          <div className="mt-4 flex flex-wrap gap-3">
            <ActionButton
              label={status.logSubmitting ? "Saving..." : "Save log"}
              variant="primary"
              type="submit"
              className="min-w-[140px]"
            />
          </div>
        </form>
      </div>

      {canComment && (
        <form
          className="rounded-2xl border border-white/10 bg-slate-900/60 p-5"
          onSubmit={handleSubmitComment}
        >
          <p className="text-sm font-semibold text-white">Leadership comment</p>
          <p className="mt-1 text-xs text-white/60">
            Share guidance on a task or individual.
          </p>
          <div className="mt-4 grid gap-3 lg:grid-cols-3">
            <label className="grid gap-2 text-xs text-white/70">
              Target
              <select
                name="target"
                value={commentForm.target}
                onChange={handleCommentChange}
                className="rounded-xl border border-white/10 bg-slate-950/60 px-3 py-2 text-sm text-white outline-none focus:border-white/40"
              >
                {commentTargets.map((target) => (
                  <option key={target.id} value={target.id}>
                    {target.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="grid gap-2 text-xs text-white/70 lg:col-span-2">
              User
              <select
                name="createdForId"
                value={commentForm.createdForId}
                onChange={handleCommentChange}
                className="rounded-xl border border-white/10 bg-slate-950/60 px-3 py-2 text-sm text-white outline-none focus:border-white/40"
              >
                <option value="">Select user</option>
                {users.map((user) => (
                  <option key={user.id} value={user.id}>
                    {user.name} · {user.role}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <label className="mt-3 grid gap-2 text-xs text-white/70">
            Comment
            <textarea
              name="message"
              value={commentForm.message}
              onChange={handleCommentChange}
              rows={3}
              placeholder="Share guidance, risks, or expectations."
              className="rounded-xl border border-white/10 bg-slate-950/60 px-3 py-2 text-sm text-white outline-none focus:border-white/40"
            />
          </label>
          <div className="mt-4 flex flex-wrap gap-3">
            <ActionButton
              label={status.commentSubmitting ? "Sharing..." : "Share comment"}
              variant="secondary"
              type="submit"
              className="min-w-[160px]"
              disabled={status.commentSubmitting}
            />
          </div>
        </form>
      )}

      <div className="space-y-4">
        {timeline.map(({ user, entries }) => (
          <div
            key={user.id}
            className="rounded-2xl border border-white/10 bg-slate-900/60 p-5"
          >
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-white">{user.name}</p>
                <p className="text-xs text-white/50">{user.email}</p>
              </div>
              <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] uppercase tracking-[0.2em] text-white/60">
                {user.role}
              </span>
            </div>
            {entries.length === 0 ? (
              <p className="mt-4 text-xs text-white/50">
                No activity in this range.
              </p>
            ) : (
              <div className="mt-4 space-y-3">
                {entries.map((entry) => (
                  <div
                    key={entry.id}
                    className="rounded-xl border border-white/10 bg-slate-950/40 p-4"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-white/50">
                      <span>{formatDateTime(entry.timestamp)}</span>
                      {entry.type === "log" ? (
                        <span className="rounded-full border border-white/10 bg-white/5 px-2 py-1 text-[10px] uppercase tracking-[0.2em] text-white/60">
                          {entry.category}
                        </span>
                      ) : (
                        <span className="rounded-full border border-white/10 bg-white/5 px-2 py-1 text-[10px] uppercase tracking-[0.2em] text-white/60">
                          Comment
                        </span>
                      )}
                    </div>
                    <p className="mt-2 text-sm text-white">
                      {entry.description}
                    </p>
                    {entry.task && (
                      <p className="mt-2 text-xs text-white/60">
                        Task: {entry.task.title}
                      </p>
                    )}
                    {entry.type === "comment" && entry.author && (
                      <p className="mt-2 text-xs text-white/60">
                        From {entry.author.name}
                      </p>
                    )}
                    {entry.type === "log" && entry.hoursSpent > 0 && (
                      <p className="mt-2 text-xs text-white/60">
                        Hours: {entry.hoursSpent}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      {currentUser && (
        <p className="text-xs text-white/40">
          Viewing timeline as {currentUser.name}.
        </p>
      )}
    </div>
  );
}
