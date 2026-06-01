'use client';

import Link from "next/link";
import { usePathname } from "next/navigation";

const navItems = [
  { label: "Dashboard", href: "/" },
  { label: "Imports", href: "/imports" },
  { label: "New Import", href: "/imports/new" },
  { label: "Records", href: "/records" },
  { label: "Analytics", href: "/analytics" },
  { label: "Settings", href: "/settings" },
];

export default function SidebarNav() {
  const pathname = usePathname();

  return (
    <aside className="relative z-10 flex w-64 flex-col border-r border-[var(--border)] bg-[var(--panel)] px-5 py-6">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-xs uppercase tracking-[0.3em] text-[var(--muted)]">
            SignalForge
          </div>
          <div className="text-lg font-semibold text-[var(--text)]">
            Data Intake Ops
          </div>
        </div>
        <span className="h-2.5 w-2.5 rounded-full bg-[var(--accent)] shadow-[0_0_12px_var(--accent-glow)]" />
      </div>

      <div className="mt-6 rounded-xl border border-[var(--border)] bg-[var(--panel-soft)] px-3 py-4">
        <p className="text-xs text-[var(--muted)]">Active profile</p>
        <p className="mt-2 text-sm font-semibold">Default Intake</p>
        <p className="text-xs text-[var(--muted)]">CSV + JSON</p>
      </div>

      <nav className="mt-8 flex flex-1 flex-col gap-1">
        {navItems.map((item) => {
          const isActive =
            item.href === "/"
              ? pathname === "/"
              : pathname.startsWith(item.href);

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center justify-between rounded-lg border px-3 py-2 text-sm transition ${
                isActive
                  ? "border-[var(--accent-border)] bg-[var(--accent-soft)] text-[var(--accent)]"
                  : "border-transparent text-[var(--muted)] hover:border-[var(--border)] hover:text-[var(--text)]"
              }`}
            >
              <span>{item.label}</span>
              {item.href === "/imports/new" ? (
                <span className="rounded-full border border-[var(--accent-border)] px-2 py-0.5 text-[10px] text-[var(--accent)]">
                  New
                </span>
              ) : null}
            </Link>
          );
        })}
      </nav>

      <div className="mt-auto border-t border-[var(--border)] pt-4 text-xs text-[var(--muted)]">
        <p>SignalForge v1 • Ops Console</p>
        <p className="mt-1">No auth — demo mode</p>
      </div>
    </aside>
  );
}
