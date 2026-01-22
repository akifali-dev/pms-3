"use client";

import { useToast } from "./ToastProvider";

export default function PlaceholderUpload({ label, helperText }) {
  const { addToast } = useToast();

  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold text-white">{label}</p>
          <p className="text-xs text-white/60">{helperText}</p>
        </div>
        <input
          type="file"
          className="w-40 text-xs text-white/70 file:mr-3 file:rounded-full file:border-0 file:bg-white/10 file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-white"
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
