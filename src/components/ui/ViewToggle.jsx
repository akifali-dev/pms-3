"use client";

export default function ViewToggle({ value, onChange }) {
  return (
    <div className="flex items-center rounded-full border border-[color:var(--color-border)] bg-[color:var(--color-muted-bg)] p-1 text-xs text-[color:var(--color-text-muted)]">
      <button
        type="button"
        onClick={() => onChange("grid")}
        title="Grid view"
        aria-label="Grid view"
        className={`inline-flex h-8 w-8 items-center justify-center rounded-full transition ${
          value === "grid"
            ? "bg-[color:var(--color-accent-muted)] text-[color:var(--color-accent)]"
            : "text-[color:var(--color-text-muted)]"
        }`}
      >
        <svg
          viewBox="0 0 24 24"
          className="h-4 w-4"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
        >
          <path
            d="M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>
      <button
        type="button"
        onClick={() => onChange("list")}
        title="List view"
        aria-label="List view"
        className={`inline-flex h-8 w-8 items-center justify-center rounded-full transition ${
          value === "list"
            ? "bg-[color:var(--color-accent-muted)] text-[color:var(--color-accent)]"
            : "text-[color:var(--color-text-muted)]"
        }`}
      >
        <svg
          viewBox="0 0 24 24"
          className="h-4 w-4"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
        >
          <path
            d="M8 6h12M4 6h.01M8 12h12M4 12h.01M8 18h12M4 18h.01"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>
    </div>
  );
}
