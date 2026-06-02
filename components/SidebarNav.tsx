'use client';

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

import { UserButton, SignInButton, useAuth } from "@clerk/nextjs";
import { setActiveWorkspaceAction } from "@/lib/actions";

const navItems = [
  { label: "Dashboard", href: "/" },
  { label: "Imports", href: "/imports" },
  { label: "New Import", href: "/imports/new" },
  { label: "Records", href: "/records" },
  { label: "Activity", href: "/activity" },
  { label: "Analytics", href: "/analytics" },
  { label: "Settings", href: "/settings" },
];

type SidebarNavProps = {
  workspaces: Array<{ id: string; name: string }>;
  activeWorkspaceId: string | null;
};

export default function SidebarNav({ workspaces, activeWorkspaceId }: SidebarNavProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { isLoaded, userId } = useAuth();

  const handleWorkspaceChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newId = e.target.value;
    if (newId) {
      await setActiveWorkspaceAction(newId);
      router.refresh();
    }
  };

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
        <p className="text-xs text-[var(--muted)] mb-2">Workspace</p>
        <select
          value={activeWorkspaceId || ""}
          onChange={handleWorkspaceChange}
          className="w-full bg-[var(--bg)] border border-[var(--border)] rounded px-2 py-1 text-sm outline-none focus:border-[var(--accent)] transition"
        >
          {workspaces.map((ws) => (
            <option key={ws.id} value={ws.id}>
              {ws.name}
            </option>
          ))}
          {workspaces.length === 0 && (
            <option value="">No active workspace</option>
          )}
        </select>
        <p className="text-xs text-[var(--muted)] mt-3">Default Profile</p>
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

      <div className="mt-auto border-t border-[var(--border)] pt-4 flex flex-col gap-3">
        <div className="flex items-center justify-between text-xs text-[var(--muted)]">
          <div>
            <p>SignalForge v1 • Ops Console</p>
            {isLoaded && userId ? (
              <p className="mt-1 text-[var(--accent)]">Authenticated</p>
            ) : isLoaded && !userId ? (
              <SignInButton mode="modal">
                <button className="mt-1 text-[var(--accent)] hover:underline">Sign In</button>
              </SignInButton>
            ) : null}
          </div>
          {isLoaded && userId && <UserButton />}
        </div>
        <div className="flex items-center gap-3 text-[10px] text-[var(--muted)]">
          <Link href="/terms" className="hover:text-[var(--text)] transition-colors">Terms of Service</Link>
          <Link href="/privacy" className="hover:text-[var(--text)] transition-colors">Privacy Policy</Link>
        </div>
      </div>
    </aside>
  );
}
