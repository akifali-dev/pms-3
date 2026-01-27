"use client";

import { useEffect } from "react";

export default function Modal({
  isOpen,
  title,
  description,
  onClose,
  children,
}) {
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        onClose?.();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4 py-6">
      <div
        className="absolute inset-0 bg-[color:var(--color-overlay)] backdrop-blur"
        onClick={onClose}
        role="presentation"
      />
      <div className="relative z-10 flex w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-[color:var(--color-border)] bg-[color:var(--color-card)] p-6 shadow-2xl max-h-[80vh]">
        <div className="space-y-2">
          <h3 className="text-lg font-semibold text-[color:var(--color-text)]">
            {title}
          </h3>
          {description ? (
            <p className="text-sm text-[color:var(--color-text-muted)]">
              {description}
            </p>
          ) : null}
        </div>
        <div className="mt-6 flex-1 overflow-y-auto">{children}</div>
      </div>
    </div>
  );
}
