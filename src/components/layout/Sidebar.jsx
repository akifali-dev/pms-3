"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { navigationItems } from "@/lib/navigation";
import { getRoleById } from "@/lib/roles";
import { useToast } from "@/components/ui/ToastProvider";

export default function Sidebar({ activeRole, session }) {
  const pathname = usePathname();
  const router = useRouter();
  const { addToast } = useToast();

  const role = activeRole ?? getRoleById(session?.role);

  const visibleItems = navigationItems.filter((item) =>
    role ? item.roles.includes(role.id) : false
  );

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
    <aside className="flex w-full flex-col gap-8 border-b border-white/10 bg-slate-950/80 px-6 py-6 text-white lg:w-72 lg:border-b-0 lg:border-r">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-white/40">
          Role
        </p>
        <div className="mt-3 space-y-2 rounded-2xl border border-white/10 bg-white/5 p-4">
          <p className="text-sm font-semibold text-white">
            {role?.label ?? "Guest"}
          </p>
          <p className="text-xs text-white/60">
            {role?.description ?? "Sign in to access your workspace."}
          </p>
        </div>
      </div>

      <nav className="space-y-1">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-white/40">
          Navigation
        </p>
        <div className="mt-3 space-y-2">
          {visibleItems.map((item) => {
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
          {!visibleItems.length && (
            <p className="text-xs text-white/60">
              No routes available for this role.
            </p>
          )}
        </div>
      </nav>

      <div className="space-y-3 rounded-2xl border border-white/10 bg-white/5 p-4">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-white/40">
          Status
        </p>
        <div>
          <p className="text-sm font-semibold text-white">
            {session?.name ?? "Guest"}
          </p>
          <p className="text-xs text-white/60">
            {session?.email ?? "No active session"}
          </p>
        </div>
        {session ? (
          <button
            type="button"
            onClick={handleLogout}
            className="w-full rounded-xl border border-white/15 px-3 py-2 text-xs font-semibold text-white/80 transition hover:border-white/40"
          >
            Sign out
          </button>
        ) : (
          <button
            type="button"
            onClick={() => router.push("/auth/sign-in")}
            className="w-full rounded-xl border border-white/15 px-3 py-2 text-xs font-semibold text-white/80 transition hover:border-white/40"
          >
            Sign in
          </button>
        )}
      </div>
    </aside>
  );
}
