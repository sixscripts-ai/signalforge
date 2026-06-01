import Link from "next/link";
import type { ImportJob } from "@prisma/client";
import StatusBadge from "./StatusBadge";
import { formatDateTime, formatNumber } from "@/lib/format";

type ImportTableProps = {
  imports: ImportJob[];
};

export default function ImportTable({ imports }: ImportTableProps) {
  return (
    <div className="overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--panel)]">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-[var(--border)] text-sm">
          <thead className="bg-[var(--panel-soft)] text-[var(--muted)]">
            <tr>
              <th className="px-4 py-3 text-left font-medium">File</th>
              <th className="px-4 py-3 text-left font-medium">Source</th>
              <th className="px-4 py-3 text-left font-medium">Status</th>
              <th className="px-4 py-3 text-right font-medium">Rows</th>
              <th className="px-4 py-3 text-right font-medium">Valid</th>
              <th className="px-4 py-3 text-right font-medium">Invalid</th>
              <th className="px-4 py-3 text-right font-medium">Duplicates</th>
              <th className="px-4 py-3 text-left font-medium">Created</th>
              <th className="px-4 py-3 text-left font-medium">Completed</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--border)]">
            {imports.map((job) => (
              <tr key={job.id} className="hover:bg-white/5">
                <td className="px-4 py-3">
                  <Link
                    href={`/imports/${job.id}`}
                    className="font-medium text-[var(--text)] hover:text-[var(--accent)]"
                  >
                    {job.filename}
                  </Link>
                </td>
                <td className="px-4 py-3 uppercase text-[var(--muted)]">
                  {job.sourceType}
                </td>
                <td className="px-4 py-3">
                  <StatusBadge status={job.status} />
                </td>
                <td className="px-4 py-3 text-right text-[var(--text)]">
                  {formatNumber(job.totalRows)}
                </td>
                <td className="px-4 py-3 text-right text-emerald-300">
                  {formatNumber(job.validRows)}
                </td>
                <td className="px-4 py-3 text-right text-rose-300">
                  {formatNumber(job.invalidRows)}
                </td>
                <td className="px-4 py-3 text-right text-amber-300">
                  {formatNumber(job.duplicateRows)}
                </td>
                <td className="px-4 py-3 text-[var(--muted)]">
                  {formatDateTime(job.createdAt)}
                </td>
                <td className="px-4 py-3 text-[var(--muted)]">
                  {formatDateTime(job.completedAt)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
