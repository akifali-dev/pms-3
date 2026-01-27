"use client";

import { useToast } from "./ToastProvider";

export default function PlaceholderUpload({ label, helperText }) {
  const { addToast } = useToast();

  return (
    <div className="rounded-2xl border border-[color:var(--color-border)] bg-[color:var(--color-card)] p-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold text-[color:var(--color-text)]">{label}</p>
          <p className="text-xs text-[color:var(--color-text-muted)]">{helperText}</p>
        </div>
        <input
          type="file"
          className="w-40 text-xs text-[color:var(--color-text-muted)] file:mr-3 file:rounded-full file:border-0 file:bg-[color:var(--color-muted-bg)] file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-[color:var(--color-text)]"
          onChange={() =>
            addToast({
              title: "Upload placeholder",
              message: "Image uploads will be available in the next release.",
              variant: "info",
            })
          }
        />
      </div>
    </div>
  );
}
