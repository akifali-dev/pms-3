"use client";

import { useToast } from "./ToastProvider";

const variants = {
  primary:
    "bg-[color:var(--button-primary-bg)] text-[color:var(--button-primary-text)] shadow-sm hover:bg-[color:var(--button-primary-hover)] focus-visible:outline-[color:var(--color-accent)]",
  secondary:
    "border border-[color:var(--button-secondary-border)] bg-transparent text-[color:var(--button-secondary-text)] hover:bg-[color:var(--button-secondary-hover)]",
  success: "bg-emerald-500/90 text-white hover:bg-emerald-400",
  warning: "bg-amber-500/90 text-slate-900 hover:bg-amber-400",
  info: "bg-sky-500/90 text-white hover:bg-sky-400",
  danger: "bg-rose-500/90 text-white hover:bg-rose-400",
};

export default function ActionButton({
  label,
  toast,
  onClick,
  variant = "primary",
  size = "md",
  className = "",
  type = "button",
  disabled = false,
}) {
  const { addToast } = useToast();

  const sizes = {
    sm: "px-3 py-2 text-xs",
    md: "px-4 py-2.5 text-sm",
    lg: "px-5 py-3 text-base",
  };

  const handleClick = () => {
    if (disabled) {
      return;
    }
    if (onClick) {
      onClick();
    }
    if (toast) {
      addToast(toast);
    }
  };

  return (
    <button
      type={type}
      disabled={disabled}
      className={`inline-flex items-center justify-center gap-2 rounded-xl font-semibold transition ${
        sizes[size]
      } ${variants[variant]} ${disabled ? "opacity-60" : ""} ${className}`}
      onClick={handleClick}
    >
      {label}
    </button>
  );
}
