import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import AppShell from "@/components/AppShell";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "SignalForge — Data Intake Ops",
  description:
    "Import CSV and JSON data, validate against schemas, deduplicate records, and monitor import quality.",
};

export const viewport: Viewport = {
  themeColor: "#060b16",
};

import { ClerkProvider } from "@clerk/nextjs";
import { getCurrentWorkspace, getUserWorkspaces } from "@/lib/auth";

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const workspace = await getCurrentWorkspace();
  const workspaces = await getUserWorkspaces();

  return (
    <ClerkProvider>
      <html
        lang="en"
        className={`${geistSans.variable} ${geistMono.variable} h-full antialiased bg-[var(--bg)]`}
      >
        <body className="min-h-full">
          <AppShell workspaces={workspaces} activeWorkspaceId={workspace?.id || null}>
            {children}
          </AppShell>
        </body>
      </html>
    </ClerkProvider>
  );
}
