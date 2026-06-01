'use client';

import { useMemo, useState } from "react";
import Link from "next/link";
import SectionHeader from "@/components/SectionHeader";
import UploadDropzone from "@/components/UploadDropzone";
import DataPreviewTable from "@/components/DataPreviewTable";
import ValidationSummary from "@/components/ValidationSummary";
import ErrorTable from "@/components/ErrorTable";
import StepIndicator from "@/components/StepIndicator";
import { MAX_ROW_COUNT, MAX_UPLOAD_BYTES } from "@/lib/constants";
import { parseImportFile } from "@/lib/parser";
import { mapFieldVariants, normalizeRow } from "@/lib/normalizer";
import { validateRow } from "@/lib/validators";
import { computeDedupeKey } from "@/lib/dedupe";

const ACCEPTED_TYPES = [".csv", ".json"].join(",");

export default function NewImportPage() {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<{
    columns: string[];
    rows: Record<string, unknown>[];
    warnings: string[];
  } | null>(null);
  const [validationErrors, setValidationErrors] = useState<
    { rowIndex: number; field: string; message: string }[]
  >([]);
  const [counts, setCounts] = useState({ total: 0, valid: 0, invalid: 0, duplicate: 0 });
  const [error, setError] = useState<string | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [importId, setImportId] = useState<string | null>(null);

  const steps = useMemo(() => {
    if (!file) {
      return [
        { label: "Upload", status: "active" as const },
        { label: "Validate", status: "pending" as const },
        { label: "Import", status: "pending" as const },
      ];
    }

    if (!importId) {
      return [
        { label: "Upload", status: "complete" as const },
        { label: "Validate", status: "active" as const },
        { label: "Import", status: "pending" as const },
      ];
    }

    return [
      { label: "Upload", status: "complete" as const },
      { label: "Validate", status: "complete" as const },
      { label: "Import", status: "complete" as const },
    ];
  }, [file, importId]);

  const handleFileSelected = async (nextFile: File) => {
    setError(null);
    setImportId(null);

    if (nextFile.size > MAX_UPLOAD_BYTES) {
      setError(`File exceeds ${MAX_UPLOAD_BYTES / 1024 / 1024}MB limit.`);
      return;
    }

    try {
      const content = await nextFile.text();
      const parsed = parseImportFile({
        filename: nextFile.name,
        content,
        mimeType: nextFile.type,
        maxRows: MAX_ROW_COUNT,
      });

      const dedupeSet = new Set<string>();
      const errors: { rowIndex: number; field: string; message: string }[] = [];
      let valid = 0;
      let invalid = 0;
      let duplicate = 0;

      parsed.rows.forEach((row, index) => {
        const rowIndex = index + 1;
        const mapped = mapFieldVariants(row);
        const normalized = normalizeRow(mapped);
        const validation = validateRow(rowIndex, mapped, normalized);
        let status = validation.status;
        const dedupeKey = computeDedupeKey(normalized, `preview-${rowIndex}`);

        if (status === "valid") {
          if (dedupeSet.has(dedupeKey)) {
            status = "duplicate";
          } else {
            dedupeSet.add(dedupeKey);
          }
        }

        if (status === "valid") valid += 1;
        if (status === "invalid") invalid += 1;
        if (status === "duplicate") duplicate += 1;

        if (validation.errors.length) {
          errors.push(
            ...validation.errors.map((err) => ({
              rowIndex,
              field: err.field,
              message: err.message,
            }))
          );
        }
      });

      setFile(nextFile);
      setPreview({
        columns: parsed.columns,
        rows: parsed.rows.slice(0, 8),
        warnings: parsed.warnings ?? [],
      });
      setValidationErrors(errors.slice(0, 12));
      setCounts({ total: parsed.rows.length, valid, invalid, duplicate });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to parse file.");
    }
  };

  const handleImport = async () => {
    if (!file) return;
    setIsImporting(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch("/api/imports", {
        method: "POST",
        body: formData,
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
        description="Upload CSV or JSON arrays and validate before ingesting into SignalForge."
        action={
          <button
            onClick={handleImport}
            disabled={!file || isImporting}
            className="rounded-lg border border-[var(--accent-border)] bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-[var(--accent-strong)] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isImporting ? "Importing..." : "Import Valid Rows"}
          </button>
        }
      />

      <StepIndicator steps={steps} />

      <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
        <div className="space-y-6">
          <UploadDropzone
            accept={ACCEPTED_TYPES}
            hint={`CSV or JSON only · max ${MAX_ROW_COUNT} rows · ${
              MAX_UPLOAD_BYTES / 1024 / 1024
            }MB limit`}
            onFileSelected={handleFileSelected}
          />

          {preview ? (
            <div className="space-y-4">
              <h2 className="text-sm font-semibold text-[var(--text)]">
                Preview (first {preview.rows.length} rows)
              </h2>
              <DataPreviewTable columns={preview.columns} rows={preview.rows} />
            </div>
          ) : null}
        </div>

        <div className="space-y-6">
          <ValidationSummary
            total={counts.total}
            valid={counts.valid}
            invalid={counts.invalid}
            duplicate={counts.duplicate}
            warnings={preview?.warnings ?? []}
          />

          {importId ? (
            <div className="rounded-xl border border-[var(--border)] bg-[var(--panel-soft)] p-5 text-sm">
              <p className="text-[var(--text)]">Import complete.</p>
              <Link
                href={`/imports/${importId}`}
                className="mt-2 inline-flex text-[var(--accent)] hover:text-[var(--accent-strong)]"
              >
                View import details →
              </Link>
            </div>
          ) : null}

          {validationErrors.length ? (
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-[var(--text)]">
                Validation Errors (sample)
              </h3>
              <ErrorTable errors={validationErrors} />
            </div>
          ) : null}

          {error ? (
            <div className="rounded-lg border border-rose-500/30 bg-rose-500/10 p-4 text-sm text-rose-200">
              {error}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
