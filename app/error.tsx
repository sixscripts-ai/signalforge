"use client";

import { useEffect } from "react";
import SectionHeader from "@/components/SectionHeader";
import EmptyState from "@/components/EmptyState";

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log the error to an error reporting service
    console.error(error);
  }, [error]);

  return (
    <div className="space-y-8">
      <SectionHeader title="Error" description="Something went wrong." />
      
      <EmptyState
        title="Failed to load data"
        description={error.message || "An unexpected error occurred while fetching data."}
        action={
          <button
            onClick={() => reset()}
            className="rounded-lg border border-[var(--accent-border)] bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-[var(--accent-strong)]"
          >
            Try again
          </button>
        }
      />
    </div>
  );
}
