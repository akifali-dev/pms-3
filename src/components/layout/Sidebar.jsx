"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { navigationItems, roleOptions } from "@/lib/navigation";
import { useToast } from "@/components/ui/ToastProvider";

export default function Sidebar({ activeRole, onRoleChange }) {
  const pathname = usePathname();
  const { addToast } = useToast();

  return (
    <aside className="flex w-full flex-col gap-8 border-b border-white/10 bg-slate-950/80 px-6 py-6 text-white lg:w-72 lg:border-b-0 lg:border-r">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-white/40">
          Role
        </p>
        <div className="mt-3 space-y-2">
          {roleOptions.map((role) => (
            <button
              key={role.id}
              type="button"
              onClick={() => {
                onRoleChange(role);
                addToast({
                  title: "Role switched",
                  message: `Switched to ${role.label} view.`,
                  variant: "info",
                });
              }}
              className={`w-full rounded-xl border px-3 py-2 text-left text-sm transition ${
                activeRole.id === role.id
                  ? "border-white/40 bg-white/10 text-white"
                  : "border-white/10 text-white/70 hover:border-white/30"
              }`}
            >
              <p className="font-semibold">{role.label}</p>
              <p className="text-xs text-white/60">{role.description}</p>
            </button>
          ))}
        </div>
      </div>

      <nav className="space-y-1">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-white/40">
          Navigation
        </p>
        <div className="mt-3 space-y-2">
          {navigationItems.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() =>
                  addToast({
                    title: "Navigation",
                    message: `Opening ${item.label}.`,
                    variant: "info",
                  })
                }
                className={`flex items-center justify-between rounded-xl border px-4 py-2 text-sm transition ${
                  isActive
                    ? "border-white/40 bg-white/10 text-white"
                    : "border-white/10 text-white/70 hover:border-white/30"
                }`}
              >
                <span className="font-semibold">{item.label}</span>
                <span className="text-xs text-white/50">→</span>
              </Link>
            );
          })}
        </div>
      </nav>

      <div className="space-y-3 rounded-2xl border border-white/10 bg-white/5 p-4">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-white/40">
          Status
        </p>
        <div>
          <p className="text-sm font-semibold text-white">Auth placeholder</p>
          <p className="text-xs text-white/60">
            Protected routes are ready for real authentication.
          </p>
        </div>
      </div>
    </aside>
  );
}
