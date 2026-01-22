"use client";

import { useState } from "react";
import Sidebar from "./Sidebar";
import ActionButton from "../ui/ActionButton";
import { quickActions, roleOptions } from "@/lib/navigation";

export default function AppShell({ children }) {
  const [activeRole, setActiveRole] = useState(roleOptions[0]);

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <div className="flex min-h-screen flex-col lg:flex-row">
        <Sidebar activeRole={activeRole} onRoleChange={setActiveRole} />
        <div className="flex flex-1 flex-col">
          <header className="border-b border-white/10 bg-slate-950/80 px-6 py-6">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-white/40">
                  Project Management System
                </p>
                <h1 className="text-2xl font-semibold text-white">
                  Welcome, {activeRole.label}
                </h1>
                <p className="text-sm text-white/60">
                  Centralize delivery, reporting, and collaboration at scale.
                </p>
              </div>
              <div className="flex flex-wrap gap-3">
                {quickActions.map((action) => (
                  <ActionButton
                    key={action.id}
                    label={action.label}
                    variant={action.variant}
                    toast={{
                      title: action.label,
                      message: action.description,
                      variant: action.variant,
                    }}
                  />
                ))}
              </div>
            </div>
          </header>
          <main className="flex-1 px-6 py-8">
            <div className="mx-auto w-full max-w-6xl space-y-8">
              {children}
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}
