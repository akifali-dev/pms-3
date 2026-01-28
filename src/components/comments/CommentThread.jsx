"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useToast } from "@/components/ui/ToastProvider";
import useOutsideClick from "@/hooks/useOutsideClick";

const buildErrorMessage = (data, fallback) =>
  data?.error ?? data?.message ?? fallback;

export default function CommentThread({
  entityType,
  entityId,
  currentUser,
  users = [],
  variant = "task",
  autoFocus = false,
  onCommentAdded,
}) {
  const { addToast } = useToast();
  const [comments, setComments] = useState([]);
  const [lastReadAt, setLastReadAt] = useState(null);
  const [status, setStatus] = useState({
    loading: false,
    submitting: false,
  });
  const [message, setMessage] = useState("");
  const [isExpanded, setIsExpanded] = useState(false);
  const [mentionState, setMentionState] = useState({
    open: false,
    query: "",
    anchorIndex: null,
  });
  const mentionRef = useRef(null);
  const inputRef = useRef(null);

  useOutsideClick(mentionRef, () => setMentionState((prev) => ({ ...prev, open: false })), mentionState.open);

  const filteredUsers = useMemo(() => {
    if (!mentionState.query) {
      return users;
    }
    const query = mentionState.query.toLowerCase();
    return users.filter(
      (user) =>
        user.name?.toLowerCase().includes(query) ||
        user.email?.toLowerCase().includes(query)
    );
  }, [mentionState.query, users]);

  const visibleComments = useMemo(() => {
    if (variant === "chat" || isExpanded) {
      return comments;
    }

    if (!comments.length) {
      return [];
    }

    if (lastReadAt) {
      const unread = comments.filter(
        (comment) => new Date(comment.createdAt) > new Date(lastReadAt)
      );
      if (unread.length) {
        return unread;
      }
    }

    return comments.slice(-1);
  }, [comments, isExpanded, lastReadAt, variant]);

  const collapsedCount = useMemo(() => {
    if (variant === "chat" || isExpanded) {
      return 0;
    }
    return Math.max(0, comments.length - visibleComments.length);
  }, [comments.length, isExpanded, variant, visibleComments.length]);

  useEffect(() => {
    if (!entityType || !entityId) {
      setComments([]);
      setLastReadAt(null);
      return;
    }

    const loadComments = async () => {
      setStatus((prev) => ({ ...prev, loading: true }));
      try {
        const response = await fetch(
          `/api/comments?entityType=${entityType}&entityId=${entityId}`
        );
        const data = await response.json();
        if (!response.ok) {
          throw new Error(buildErrorMessage(data, "Unable to load comments."));
        }
        setComments(data?.comments ?? []);
        setLastReadAt(data?.readState?.lastReadAt ?? null);
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Unable to load comments.";
        addToast({
          title: "Comments unavailable",
          message,
          variant: "error",
        });
        setComments([]);
      } finally {
        setStatus((prev) => ({ ...prev, loading: false }));
      }
    };

    loadComments();
  }, [addToast, entityId, entityType]);

  useEffect(() => {
    if (!entityType || !entityId || status.loading) {
      return;
    }

    const markRead = async () => {
      try {
        await fetch("/api/comments/mark-read", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ entityType, entityId }),
        });
        setLastReadAt(new Date().toISOString());
      } catch (error) {
        // Silent fail to avoid blocking UI.
      }
    };

    markRead();
  }, [entityId, entityType, status.loading]);

  useEffect(() => {
    if (autoFocus && inputRef.current) {
      inputRef.current.focus();
    }
  }, [autoFocus]);

  const handleMessageChange = (event) => {
    const value = event.target.value;
    setMessage(value);

    const cursorIndex = event.target.selectionStart ?? value.length;
    const slice = value.slice(0, cursorIndex);
    const atIndex = slice.lastIndexOf("@");
    if (atIndex >= 0) {
      const query = slice.slice(atIndex + 1);
      if (query.length >= 1 && !query.includes(" ")) {
        setMentionState({ open: true, query, anchorIndex: atIndex });
        return;
      }
    }
    setMentionState({ open: false, query: "", anchorIndex: null });
  };

  const handleMentionSelect = (user) => {
    if (mentionState.anchorIndex === null) {
      return;
    }

    const before = message.slice(0, mentionState.anchorIndex);
    const after = message.slice(mentionState.anchorIndex + mentionState.query.length + 1);
    const mentionText = `@${user.name}`;
    const nextValue = `${before}${mentionText} ${after}`.replace(/\s+/g, " ");
    setMessage(nextValue);
    setMentionState({ open: false, query: "", anchorIndex: null });
    requestAnimationFrame(() => {
      inputRef.current?.focus();
    });
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    const trimmed = message.trim();
    if (!trimmed) {
      return;
    }

    setStatus((prev) => ({ ...prev, submitting: true }));
    try {
      const response = await fetch("/api/comments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          entityType,
          entityId,
          message: trimmed,
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(buildErrorMessage(data, "Unable to send comment."));
      }
      setComments((prev) => [...prev, data.comment]);
      onCommentAdded?.(data.comment);
      setMessage("");
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unable to send comment.";
      addToast({
        title: "Comment failed",
        message,
        variant: "error",
      });
    } finally {
      setStatus((prev) => ({ ...prev, submitting: false }));
    }
  };

  return (
    <div className="space-y-3">
      {status.loading ? (
        <p className="text-xs text-[color:var(--color-text-subtle)]">Loading comments...</p>
      ) : comments.length === 0 ? (
        <p className="text-xs text-[color:var(--color-text-subtle)]">No comments yet.</p>
      ) : (
        <div className="space-y-3">
          {collapsedCount > 0 ? (
            <button
              type="button"
              onClick={() => setIsExpanded(true)}
              className="text-left text-xs text-[color:var(--color-text-muted)] hover:text-[color:var(--color-text)]"
            >
              +{collapsedCount} more
            </button>
          ) : null}
          {visibleComments.map((comment) => {
            const isCurrentUser = comment.createdBy?.id === currentUser?.id;
            return (
              <div
                key={comment.id}
                className={`rounded-xl border border-[color:var(--color-border)] px-3 py-2 text-xs ${
                  variant === "chat"
                    ? "bg-[color:var(--color-muted-bg)]"
                    : "bg-[color:var(--color-card)]"
                }`}
              >
                <p className="text-[color:var(--color-text-muted)]">
                  {isCurrentUser ? "You" : comment.createdBy?.name ?? "Teammate"}
                </p>
                <p className="mt-1 text-sm text-[color:var(--color-text)]">
                  {comment.message}
                </p>
              </div>
            );
          })}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-2">
        <div className="relative" ref={mentionRef}>
          <textarea
            ref={inputRef}
            rows={3}
            value={message}
            onChange={handleMessageChange}
            placeholder="Add a comment..."
            className="w-full rounded-xl border border-[color:var(--color-border)] bg-[color:var(--color-input)] px-3 py-2 text-sm text-[color:var(--color-text)] outline-none focus:border-[color:var(--color-accent)]"
          />
          {mentionState.open && filteredUsers.length > 0 ? (
            <div className="absolute bottom-full left-0 z-10 mb-2 w-full rounded-xl border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-2 text-xs shadow-lg">
              {filteredUsers.map((user) => (
                <button
                  key={user.id}
                  type="button"
                  onClick={() => handleMentionSelect(user)}
                  className="flex w-full items-center justify-between rounded-lg px-2 py-2 text-left text-[color:var(--color-text)] hover:bg-[color:var(--color-muted-bg)]"
                >
                  <span>{user.name}</span>
                  <span className="text-[10px] uppercase tracking-[0.2em] text-[color:var(--color-text-subtle)]">
                    {user.role}
                  </span>
                </button>
              ))}
            </div>
          ) : null}
        </div>
        <div className="flex justify-end">
          <button
            type="submit"
            disabled={status.submitting}
            className="rounded-full border border-[color:var(--color-border)] px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-[color:var(--color-text-muted)] transition hover:border-[color:var(--color-accent)] hover:text-[color:var(--color-text)] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {status.submitting ? "Sending..." : "Send"}
          </button>
        </div>
      </form>
    </div>
  );
}
