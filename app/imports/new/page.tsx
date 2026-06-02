'use client';

import { useMemo, useState } from "react";
import Link from "next/link";
import SectionHeader from "@/components/SectionHeader";
import UploadDropzone from "@/components/UploadDropzone";
import PreviewSummary from "@/components/PreviewSummary";
import RowReviewTable from "@/components/RowReviewTable";
import StepIndicator from "@/components/StepIndicator";
import { MAX_ROW_COUNT, MAX_UPLOAD_BYTES } from "@/lib/constants";
import type { ProcessedRow } from "@/lib/pipeline";
import type { ImportSummary } from "@/lib/pipeline";

const ACCEPTED_TYPES = [".csv", ".json"].join(",");

type PreviewState = {
  filename: string;
  sourceType: string;
  schemaProfileName: string;
  rows: ProcessedRow[];
  summary: ImportSummary;
  warnings: string[];
};

export default function NewImportPage() {
  const [isUploading, setIsUploading] = useState(false);
  const [preview, setPreview] = useState<PreviewState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [importId, setImportId] = useState<string | null>(null);

  const currentStep = useMemo(() => {
    if (importId) return 3;
    if (preview) return 1;
    return 0;
  }, [preview, importId]);

  const steps = useMemo(() => {
    const all: { label: string; status: "complete" | "active" | "pending" }[] = [
      { label: "Upload", status: "pending" },
      { label: "Preview", status: "pending" },
      { label: "Review", status: "pending" },
      { label: "Import", status: "pending" },
    ];

    for (let i = 0; i < all.length; i++) {
      if (i < currentStep) all[i].status = "complete";
      else if (i === currentStep) all[i].status = "active";
    }
    // When import is done, mark all complete
    if (importId) {
      all.forEach((s) => (s.status = "complete"));
    }

    return all;
  }, [currentStep, importId]);

  const handleFileSelected = async (file: File) => {
    setError(null);
    setImportId(null);
    setPreview(null);

    if (file.size > MAX_UPLOAD_BYTES) {
      setError(`File exceeds ${MAX_UPLOAD_BYTES / 1024 / 1024}MB limit.`);
      return;
    }

    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch("/api/imports/preview", {
        method: "POST",
        body: formData,
      });

      const payload = await res.json();
      if (!res.ok) {
        throw new Error(payload.error ?? "Preview failed.");
      }

      setPreview({
        filename: payload.filename,
        sourceType: payload.sourceType,
        schemaProfileName: payload.schemaProfileName,
        rows: payload.rows,
        summary: payload.summary,
        warnings: payload.warnings,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to preview file.");
    } finally {
      setIsUploading(false);
    }
  };

  const handleConfirmImport = async () => {
    if (!preview) return;
    setIsImporting(true);
    setError(null);

    try {
      const res = await fetch("/api/imports/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          filename: preview.filename,
          sourceType: preview.sourceType,
          originalRows: preview.rows.map((r) => r.original),
        }),
      });

      const payload = await res.json();
      if (!res.ok) {
        throw new Error(payload.error ?? "Import failed.");
      }

      setImportId(payload.import?.id ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Import failed.");
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <div className="space-y-8">
      <SectionHeader
        title="New Import"
        description="Upload CSV or JSON, preview row classifications, then confirm import."
        action={
          preview && !importId ? (
            <button
              onClick={handleConfirmImport}
              disabled={isImporting || preview.summary.importable === 0}
              className="rounded-lg border border-[var(--accent-border)] bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-[var(--accent-strong)] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isImporting
                ? "Importing..."
                : `Import ${preview.summary.importable} Rows`}
            </button>
          ) : undefined
        }
      />

      <StepIndicator steps={steps} />

      {/* Upload Phase */}
      {!importId && (
        <UploadDropzone
          accept={ACCEPTED_TYPES}
          hint={`CSV or JSON only · max ${MAX_ROW_COUNT} rows · ${
            MAX_UPLOAD_BYTES / 1024 / 1024
          }MB limit`}
          onFileSelected={handleFileSelected}
        />
      )}

      {isUploading && (
        <div className="rounded-xl border border-[var(--border)] bg-[var(--panel-soft)] p-6 text-center">
          <p className="text-sm text-[var(--muted)] animate-pulse">
            Processing file...
          </p>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="rounded-lg border border-rose-500/30 bg-rose-500/10 p-4 text-sm text-rose-200">
          {error}
        </div>
      )}

      {/* Preview + Review Phase */}
      {preview && !importId && (
        <div className="space-y-6">
          <div className="flex items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--panel-soft)] px-4 py-3">
            <span className="text-sm font-medium text-[var(--text)]">Using schema profile:</span>
            <span className="text-sm text-[var(--accent)]">{preview.schemaProfileName}</span>
          </div>

          <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-[var(--text)]">
                  Row Review
                </h2>
                <span className="text-xs text-[var(--muted)]">
                  {preview.filename}
                </span>
              </div>
              <RowReviewTable rows={preview.rows} />
            </div>
            <div>
              <PreviewSummary
                summary={preview.summary}
                warnings={preview.warnings}
              />
            </div>
          </div>
        </div>
      )}

      {/* Import Complete Phase */}
      {importId && (
        <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-6">
          <p className="text-sm font-semibold text-emerald-300">
            ✓ Import complete
          </p>
          <p className="mt-1 text-xs text-[var(--muted)]">
            {preview?.summary.importable ?? 0} rows imported successfully.
            {(preview?.summary.rejected ?? 0) > 0 &&
              ` ${preview?.summary.rejected} rows were rejected.`}
          </p>
          <Link
            href={`/imports/${importId}`}
            className="mt-3 inline-flex text-sm text-[var(--accent)] hover:text-[var(--accent-strong)]"
          >
            View import details →
          </Link>
        </div>
      )}
    </div>
  );
}
