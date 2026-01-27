"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { navigationItems } from "@/lib/navigation";

const iconMap = {
  Dashboard: (
    <svg
      viewBox="0 0 24 24"
      className="h-5 w-5"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
    >
      <path
        d="M4 4h7v7H4zM13 4h7v4h-7zM13 10h7v10h-7zM4 13h7v7H4z"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  ),
  Projects: (
    <svg
      viewBox="0 0 24 24"
      className="h-5 w-5"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
    >
      <path
        d="M4 7a2 2 0 0 1 2-2h4l2 2h6a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V7Z"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  ),
  Milestones: (
    <svg
      viewBox="0 0 24 24"
      className="h-5 w-5"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
    >
      <path
        d="M4 19V5l8 4 8-4v14l-8-4-8 4Z"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  ),
  Activity: (
    <svg
      viewBox="0 0 24 24"
      className="h-5 w-5"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
    >
      <path
        d="M4 12h4l2-5 4 10 2-5h4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  ),
  Reports: (
    <svg
      viewBox="0 0 24 24"
      className="h-5 w-5"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
    >
      <path
        d="M4 19h16M6 16V8m6 8V5m6 11v-6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  ),
  "Create user": (
    <svg
      viewBox="0 0 24 24"
      className="h-5 w-5"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
    >
      <path
        d="M12 12a4 4 0 1 0-4-4 4 4 0 0 0 4 4Z"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M4 20a8 8 0 0 1 16 0M19 8v4m2-2h-4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  ),
};

export default function Sidebar({ activeRole, collapsed, onToggle }) {
  const pathname = usePathname();

  const visibleItems = navigationItems.filter((item) =>
    activeRole ? item.roles.includes(activeRole.id) : false
  );

  return (
    <aside
      className="fixed left-0 top-0 z-40 flex h-screen flex-col border-r border-[color:var(--color-border)] bg-[color:var(--color-sidebar)] transition-[width] duration-200"
      style={{ width: "var(--sidebar-width)" }}
    >
      <div className="flex items-center justify-between px-5 py-5">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[color:var(--color-accent-muted)] text-base font-semibold text-[color:var(--color-accent)]">
            PM
          </span>
          {!collapsed ? (
            <div>
              <p className="text-sm font-semibold text-[color:var(--color-text)]">
                PMS Cloud
              </p>
              <p className="text-xs text-[color:var(--color-text-subtle)]">
                Workspace
              </p>
            </div>
          ) : null}
        </div>
        <button
          type="button"
          onClick={onToggle}
          className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-[color:var(--color-border)] text-[color:var(--color-text-subtle)] transition hover:border-[color:var(--color-accent)] hover:text-[color:var(--color-text)]"
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          <svg
            viewBox="0 0 24 24"
            className="h-4 w-4"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
          >
            <path
              d={
                collapsed
                  ? "M9 6l6 6-6 6"
                  : "M15 6l-6 6 6 6"
              }
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
      </div>

      <nav className="mt-2 flex-1 space-y-2 px-3">
        {visibleItems.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`group relative flex items-center gap-3 rounded-2xl px-3 py-2 text-sm font-semibold transition ${
                isActive
                  ? "bg-[color:var(--color-accent-muted)] text-[color:var(--color-accent)]"
                  : "text-[color:var(--color-text-muted)] hover:bg-[color:var(--color-muted-bg)] hover:text-[color:var(--color-text)]"
              }`}
            >
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[color:var(--color-muted-bg)] text-[color:var(--color-text)] transition group-hover:text-[color:var(--color-accent)]">
                {iconMap[item.label]}
              </span>
              {!collapsed ? (
                <span className="flex-1">{item.label}</span>
              ) : (
                <span className="pointer-events-none absolute left-full top-1/2 z-50 ml-3 -translate-y-1/2 whitespace-nowrap rounded-lg border border-[color:var(--color-border)] bg-[color:var(--color-surface)] px-3 py-1 text-xs font-semibold text-[color:var(--color-text)] opacity-0 shadow-lg transition group-hover:opacity-100">
                  {item.label}
                </span>
              )}
            </Link>
          );
        })}
        {!visibleItems.length && (
          <p className="px-3 text-xs text-[color:var(--color-text-subtle)]">
            No routes available for this role.
          </p>
        )}
      </nav>
    </aside>
  );
}
