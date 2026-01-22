"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";

const ToastContext = createContext(null);

const variantStyles = {
  success: "border-emerald-500/30 bg-emerald-500/10 text-emerald-200",
  error: "border-rose-500/30 bg-rose-500/10 text-rose-200",
  warning: "border-amber-500/30 bg-amber-500/10 text-amber-200",
  info: "border-sky-500/30 bg-sky-500/10 text-sky-200",
};

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const removeToast = useCallback((id) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  }, []);

  const addToast = useCallback((toast) => {
    const id = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const nextToast = {
      id,
      title: toast.title ?? "Notification",
      message: toast.message ?? "Your action is ready.",
      variant: toast.variant ?? "info",
    };

    setToasts((prev) => [nextToast, ...prev].slice(0, 4));

    window.setTimeout(() => removeToast(id), 4500);
  }, [removeToast]);

  const value = useMemo(() => ({ addToast }), [addToast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <ToastViewport toasts={toasts} onDismiss={removeToast} />
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);

  if (!context) {
    throw new Error("useToast must be used within ToastProvider");
  }

  return context;
}

function ToastViewport({ toasts, onDismiss }) {
  return (
    <div
      className="fixed right-6 top-6 z-50 flex w-full max-w-sm flex-col gap-3"
      role="status"
      aria-live="polite"
    >
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={`rounded-2xl border px-4 py-3 shadow-lg backdrop-blur ${
            variantStyles[toast.variant]
          }`}
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-white">{toast.title}</p>
              <p className="text-xs text-white/70">{toast.message}</p>
            </div>
            <button
              type="button"
              onClick={() => onDismiss(toast.id)}
              className="rounded-full border border-white/10 px-2 py-1 text-xs text-white/70 transition hover:text-white"
            >
              Close
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
