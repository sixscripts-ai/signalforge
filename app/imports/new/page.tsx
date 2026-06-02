'use client';

import { useMemo, useState, useEffect, useCallback } from "react";
import Link from "next/link";
import SectionHeader from "@/components/SectionHeader";
import UploadDropzone from "@/components/UploadDropzone";
import PreviewSummary from "@/components/PreviewSummary";
import RowReviewTable from "@/components/RowReviewTable";
import StepIndicator from "@/components/StepIndicator";
import { MAX_ROW_COUNT, MAX_UPLOAD_BYTES } from "@/lib/constants";
import type { ProcessedRow } from "@/lib/pipeline";
import type { ImportSummary } from "@/lib/pipeline";
import type { SchemaProfileConfig } from "@/lib/schema-profile";

const ACCEPTED_TYPES = [".csv", ".json"].join(",");

type PreviewState = {
  filename: string;
  sourceType: string;
  schemaProfileName: string;
  profileSnapshot: SchemaProfileConfig;
  templateName: string | null;
  rows: ProcessedRow[];
  summary: ImportSummary;
  warnings: string[];
};

type TemplateOption = {
  id: string;
  name: string;
  description: string | null;
  isDefault: string;
};

export default function NewImportPage() {
  const [isUploading, setIsUploading] = useState(false);
  const [preview, setPreview] = useState<PreviewState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [importId, setImportId] = useState<string | null>(null);

  // Template state
  const [templates, setTemplates] = useState<TemplateOption[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>("");
  const [templatesLoading, setTemplatesLoading] = useState(true);

  // Fetch available templates on mount
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/import-templates");
        if (res.ok) {
          const data: TemplateOption[] = await res.json();
          setTemplates(data);
          // Auto-select the default template if one exists
          const defaultTmpl = data.find((t) => t.isDefault === "true");
          if (defaultTmpl) {
            setSelectedTemplateId(defaultTmpl.id);
          }
        }
      } catch {
        // Silently fail — templates are optional
      } finally {
        setTemplatesLoading(false);
      }
    })();
  }, []);

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
      if (selectedTemplateId) {
        formData.append("templateId", selectedTemplateId);
      }

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
        profileSnapshot: payload.profileSnapshot,
        templateName: payload.templateName ?? null,
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

    // Build AI repair patches: rowIndex → { field → suggestedValue }
    const rowPatches: Record<number, Record<string, unknown>> = {};
    for (const row of preview.rows) {
      if (row.status === "ai_repaired") {
        for (const issue of row.issues) {
          if (issue.severity === "fixed" && issue.message.startsWith("AI repair:")) {
            if (!rowPatches[row.rowIndex]) rowPatches[row.rowIndex] = {};
            rowPatches[row.rowIndex][issue.field] = issue.cleanedValue;
          }
        }
      }
    }

    try {
      const res = await fetch("/api/imports/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          filename: preview.filename,
          sourceType: preview.sourceType,
          originalRows: preview.rows.map((r) => r.original),
          templateId: selectedTemplateId || undefined,
          rowPatches: Object.keys(rowPatches).length > 0 ? rowPatches : undefined,
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

  // ── AI Repair: handle row updates from AI suggestions ──────
  const handleRowsChange = useCallback((updatedRows: ProcessedRow[]) => {
    setPreview((prev) => {
      if (!prev) return prev;
      // Recalculate summary based on updated row statuses
      const total = updatedRows.length;
      let valid = 0, autoFixed = 0, aiRepaired = 0, needsReview = 0, rejected = 0, duplicate = 0;
      for (const row of updatedRows) {
        if (row.status === "valid") valid++;
        else if (row.status === "auto_fixed") autoFixed++;
        else if (row.status === "ai_repaired") aiRepaired++;
        else if (row.status === "needs_review") needsReview++;
        else if (row.status === "rejected") rejected++;
        else if (row.status === "duplicate") duplicate++;
      }
      return {
        ...prev,
        rows: updatedRows,
        summary: {
          total,
          valid,
          autoFixed,
          needsReview,
          rejected,
          duplicate,
          importable: valid + autoFixed + aiRepaired,
        },
      };
    });
  }, []);

  const selectedTemplate = templates.find((t) => t.id === selectedTemplateId);

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

      {/* Template Selector — only before preview begins */}
      {!importId && !isUploading && !preview && !templatesLoading && templates.length > 0 && (
        <div className="rounded-xl border border-[var(--border)] bg-[var(--panel-soft)] p-4">
          <label className="block text-xs text-[var(--muted)] mb-1">Import Template (optional)</label>
          <select
            value={selectedTemplateId}
            onChange={(e) => setSelectedTemplateId(e.target.value)}
            className="w-full rounded-lg border border-[var(--border)] bg-[var(--panel)] px-3 py-2 text-sm text-[var(--text)] outline-none focus:border-[var(--accent-border)]"
          >
            <option value="">— No template —</option>
            {templates.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}{t.isDefault === "true" ? " (Default)" : ""}
              </option>
            ))}
          </select>
          {selectedTemplate?.description && (
            <p className="mt-1 text-[11px] text-[var(--muted)]">{selectedTemplate.description}</p>
          )}
        </div>
      )}

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
            {preview.templateName && (
              <>
                <span className="text-xs text-[var(--muted)]">·</span>
                <span className="text-xs text-[var(--muted)]">Template: {preview.templateName}</span>
              </>
            )}
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
              <RowReviewTable
                rows={preview.rows}
                onRowsChange={handleRowsChange}
                profileSnapshot={preview.profileSnapshot}
              />
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
