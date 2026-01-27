"use client";

import Link from "next/link";

export default function PageHeader({
  title,
  subtitle,
  eyebrow,
  backHref,
  backLabel = "Back",
  actions,
  viewToggle,
}) {
  return (
    <div className="flex flex-col gap-4 border-b border-[color:var(--color-border)] pb-5 lg:flex-row lg:items-end lg:justify-between">
      <div className="flex items-start gap-3">
        {backHref ? (
          <Link
            href={backHref}
            className="mt-1 inline-flex h-9 w-9 items-center justify-center rounded-full border border-[color:var(--color-border)] text-[color:var(--color-text-muted)] transition hover:border-[color:var(--color-accent)] hover:text-[color:var(--color-text)]"
            aria-label={backLabel}
          >
            <svg
              viewBox="0 0 24 24"
              className="h-4 w-4"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
            >
              <path
                d="M15 6l-6 6 6 6"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </Link>
        ) : null}
        <div>
          {eyebrow ? (
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[color:var(--color-text-subtle)]">
              {eyebrow}
            </p>
          ) : null}
          <h1 className="mt-2 text-2xl font-semibold text-[color:var(--color-text)]">
            {title}
          </h1>
          {subtitle ? (
            <p className="mt-2 text-sm text-[color:var(--color-text-muted)]">
              {subtitle}
            </p>
          ) : null}
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        {actions}
        {viewToggle}
      </div>
    </div>
  );
}
