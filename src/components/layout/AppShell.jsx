"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import Sidebar from "./Sidebar";
import ThemeToggle from "@/components/ui/ThemeToggle";
import { getRoleById } from "@/lib/roles";
import AccessDeniedToast from "@/components/layout/AccessDeniedToast";
import { useToast } from "@/components/ui/ToastProvider";
import useOutsideClick from "@/hooks/useOutsideClick";
import NotificationDrawer from "@/components/notifications/NotificationDrawer";
import RouteProgress from "@/components/layout/RouteProgress";
import FloatingTaskTimer from "@/components/layout/FloatingTaskTimer";
import {
  NotificationCountsProvider,
  useNotificationCounts,
} from "@/components/notifications/NotificationCountsContext";

const SIDEBAR_STATE_KEY = "pms.sidebar.collapsed";

function normalizeTitle(value) {
  if (!value) return "";
  return value.replace(/^\(\d+\)\s*/, "").replace(/^●\s*/, "");
}

function AppShellContent({ children, session }) {
  const router = useRouter();
  const pathname = usePathname();
  const { addToast } = useToast();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const profileRef = useRef(null);
  const baseTitleRef = useRef(null);
  const { counts } = useNotificationCounts();
  const role = getRoleById(session?.role);
  const roleLabel = role?.label ?? "Guest";
  const userName = session?.name ?? "Guest";

  useEffect(() => {
    if (typeof window === "undefined") return;
    const stored = window.localStorage.getItem(SIDEBAR_STATE_KEY);
    if (stored === "true") {
      setIsCollapsed(true);
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(SIDEBAR_STATE_KEY, String(isCollapsed));
  }, [isCollapsed]);

  useEffect(() => {
    if (typeof document === "undefined") return;
    const cleaned = normalizeTitle(document.title);
    baseTitleRef.current = cleaned || baseTitleRef.current;
  }, [pathname]);

  useEffect(() => {
    if (typeof document === "undefined") return;
    const baseTitle = baseTitleRef.current ?? normalizeTitle(document.title);
    if (counts.total > 0) {
      document.title = `(${counts.total}) ${baseTitle}`;
    } else {
      baseTitleRef.current = normalizeTitle(document.title);
      document.title = baseTitle;
    }
  }, [counts.total]);

  useOutsideClick(profileRef, () => setIsProfileOpen(false), isProfileOpen);

  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    addToast({
      title: "Signed out",
      message: "Your session has been closed.",
      variant: "info",
    });
    router.push("/auth/sign-in");
  };

  return (
    <div
      className="h-screen bg-[color:var(--color-bg)] text-[color:var(--color-text)]"
      style={{
        "--sidebar-width": isCollapsed ? "5rem" : "18rem",
        "--header-height": "4.5rem",
      }}
    >
      <AccessDeniedToast />
      <Sidebar
        activeRole={role}
        collapsed={isCollapsed}
        onToggle={() => setIsCollapsed((prev) => !prev)}
      />

      <header className="fixed left-[var(--sidebar-width)] right-0 top-0 z-30 flex h-[var(--header-height)] items-center justify-between border-b border-[color:var(--color-border)] bg-[color:var(--color-header)] px-6">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[color:var(--color-text-subtle)]">
            PMS Cloud
          </p>
        </div>
        <div className="flex items-center gap-4">
          <ThemeToggle />
          <button
            type="button"
            className="relative inline-flex h-9 w-9 items-center justify-center rounded-full border border-[color:var(--color-border)] text-[color:var(--color-text-muted)] transition hover:border-[color:var(--color-accent)] hover:text-[color:var(--color-text)]"
            aria-label="Notifications"
            onClick={() => setIsNotificationsOpen(true)}
          >
            <svg
              viewBox="0 0 24 24"
              aria-hidden="true"
              className="h-4 w-4"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.6"
            >
              <path
                d="M15 17h5l-1.4-1.4A2 2 0 0 1 18 14.2V11a6 6 0 1 0-12 0v3.2a2 2 0 0 1-.6 1.4L4 17h11Z"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path
                d="M9.5 17a2.5 2.5 0 0 0 5 0"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            {counts.total > 0 ? (
              <span className="absolute -right-1 -top-1 inline-flex min-w-[1.2rem] items-center justify-center rounded-full bg-[color:var(--color-accent)] px-1 text-[10px] font-semibold text-white">
                {counts.total}
              </span>
            ) : null}
          </button>
          <div className="relative" ref={profileRef}>
            <button
              type="button"
              onClick={() => setIsProfileOpen((prev) => !prev)}
              className="flex cursor-pointer items-center gap-3 rounded-full border border-[color:var(--color-border)] px-3 py-1.5 text-left transition hover:border-[color:var(--color-accent)]"
              aria-expanded={isProfileOpen}
              aria-haspopup="menu"
            >
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[color:var(--color-muted-bg)] text-sm font-semibold text-[color:var(--color-text)]">
                {userName.charAt(0).toUpperCase()}
              </span>
              <span className="hidden flex-col sm:flex">
                <span className="text-sm font-semibold">{userName}</span>
                <span className="text-xs text-[color:var(--color-text-subtle)]">
                  {roleLabel}
                </span>
              </span>
            </button>
            {isProfileOpen ? (
              <div className="absolute right-0 mt-3 w-48 rounded-2xl border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-2 text-sm shadow-xl">
                {session ? (
                  <button
                    type="button"
                    onClick={() => {
                      setIsProfileOpen(false);
                      handleLogout();
                    }}
                    className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-[color:var(--color-text)] transition hover:bg-[color:var(--color-muted-bg)]"
                  >
                    Sign out
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      setIsProfileOpen(false);
                      router.push("/auth/sign-in");
                    }}
                    className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-[color:var(--color-text)] transition hover:bg-[color:var(--color-muted-bg)]"
                  >
                    Sign in
                  </button>
                )}
              </div>
            ) : null}
          </div>
        </div>
      </header>
      <RouteProgress />

      <main className="fixed bottom-0 left-[var(--sidebar-width)] right-0 top-[var(--header-height)] overflow-y-auto px-6 py-6">
        <div className="mx-auto w-full max-w-6xl space-y-8">
          {children}
        </div>
      </main>

      <NotificationDrawer
        isOpen={isNotificationsOpen}
        onClose={() => setIsNotificationsOpen(false)}
      />
      <FloatingTaskTimer session={session} />
    </div>
  );
}

export default function AppShell({ children, session }) {
  return (
    <NotificationCountsProvider>
      <AppShellContent session={session}>{children}</AppShellContent>
    </NotificationCountsProvider>
  );
}
