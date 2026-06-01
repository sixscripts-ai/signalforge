import SidebarNav from "./SidebarNav";

type AppShellProps = {
  children: React.ReactNode;
};

export default function AppShell({ children }: AppShellProps) {
  return (
    <div className="min-h-screen bg-[var(--bg)] text-[var(--text)]">
      <div className="relative flex min-h-screen">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(56,189,248,0.08),transparent_55%)]" />
        <SidebarNav />
        <div className="relative flex-1 px-6 py-8 lg:px-10">
          <div className="mx-auto w-full max-w-6xl space-y-8">{children}</div>
        </div>
      </div>
    </div>
  );
}
