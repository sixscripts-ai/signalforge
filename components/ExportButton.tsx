"use client";

import { useState, useCallback } from "react";

type ExportButtonProps = {
  scope: "records" | "import-rows" | "import-records";
  importJobId?: string;
  label?: string;
  variant?: "primary" | "ghost";
};

export default function ExportButton({
  scope,
  importJobId,
  label = "Export",
  variant = "ghost",
}: ExportButtonProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isExporting, setIsExporting] = useState<string | null>(null);

  const handleExport = useCallback(
    async (format: "csv" | "json" | "xlsx") => {
      setIsExporting(format);
      setIsOpen(false);

      try {
        const res = await fetch("/api/exports", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ format, scope, importJobId }),
        });

        if (!res.ok) {
          const data = await res.json();
          alert(data.error || "Export failed.");
          return;
        }

        // Download the blob
        const blob = await res.blob();
        const disposition = res.headers.get("Content-Disposition");
        const match = disposition?.match(/filename="?(.+?)"?$/);
        const filename = match?.[1] ?? `export.${format}`;

        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      } catch {
        alert("Export failed. Please try again.");
      } finally {
        setIsExporting(null);
      }
    },
    [scope, importJobId]
  );

  const baseClasses =
    variant === "primary"
      ? "rounded-lg border border-[var(--accent-border)] bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-[var(--accent-strong)] disabled:opacity-50"
      : "rounded-lg border border-[var(--border)] bg-[var(--panel-soft)] px-3 py-1.5 text-sm text-[var(--muted)] transition hover:text-[var(--text)] disabled:opacity-50";

  return (
    <div className="relative inline-block">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        disabled={!!isExporting}
        className={baseClasses}
      >
        {isExporting ? `Exporting ${isExporting.toUpperCase()}...` : label}
      </button>

      {isOpen && (
        <>
          <div
            className="fixed inset-0 z-10"
            onClick={() => setIsOpen(false)}
          />
          <div className="absolute right-0 z-20 mt-1 w-36 rounded-xl border border-[var(--border)] bg-[var(--panel)] p-1 shadow-lg">
            <button
              type="button"
              onClick={() => handleExport("csv")}
              className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-[var(--text)] transition hover:bg-[var(--panel-soft)]"
            >
              <span className="text-xs uppercase tracking-wider text-[var(--muted)] w-10">
                CSV
              </span>
              <span>Spreadsheet</span>
            </button>
            <button
              type="button"
              onClick={() => handleExport("json")}
              className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-[var(--text)] transition hover:bg-[var(--panel-soft)]"
            >
              <span className="text-xs uppercase tracking-wider text-[var(--muted)] w-10">
                JSON
              </span>
              <span>Structured</span>
            </button>
            <button
              type="button"
              onClick={() => handleExport("xlsx")}
              className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-[var(--text)] transition hover:bg-[var(--panel-soft)]"
            >
              <span className="text-xs uppercase tracking-wider text-[var(--muted)] w-10">
                XLSX
              </span>
              <span>Excel</span>
            </button>
          </div>
        </>
      )}
    </div>
  );
}
