import type { NormalizedRecord, ImportJob } from "@prisma/client";
import { formatCurrency, formatDateTime } from "@/lib/format";

type RecordWithImport = NormalizedRecord & { importJob: ImportJob };

type RecordsTableProps = {
  records: RecordWithImport[];
};

export default function RecordsTable({ records }: RecordsTableProps) {
  return (
    <div className="overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--panel)]">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-[var(--border)] text-sm">
          <thead className="bg-[var(--panel-soft)] text-[var(--muted)]">
            <tr>
              <th className="px-4 py-3 text-left font-medium">External ID</th>
              <th className="px-4 py-3 text-left font-medium">Name</th>
              <th className="px-4 py-3 text-left font-medium">Email</th>
              <th className="px-4 py-3 text-left font-medium">Company</th>
              <th className="px-4 py-3 text-left font-medium">Category</th>
              <th className="px-4 py-3 text-right font-medium">Amount</th>
              <th className="px-4 py-3 text-left font-medium">Status</th>
              <th className="px-4 py-3 text-left font-medium">Import</th>
              <th className="px-4 py-3 text-left font-medium">Created</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--border)]">
            {records.map((record) => (
              <tr key={record.id} className="hover:bg-white/5">
                <td className="px-4 py-3 text-[var(--muted)]">
                  {record.externalId ?? "-"}
                </td>
                <td className="px-4 py-3 text-[var(--text)]">
                  {record.name ?? "-"}
                </td>
                <td className="px-4 py-3 text-[var(--muted)]">
                  {record.email ?? "-"}
                </td>
                <td className="px-4 py-3 text-[var(--text)]">
                  {record.company ?? "-"}
                </td>
                <td className="px-4 py-3 text-[var(--muted)]">
                  {record.category ?? "-"}
                </td>
                <td className="px-4 py-3 text-right text-[var(--text)]">
                  {record.amount ? formatCurrency(record.amount) : "-"}
                </td>
                <td className="px-4 py-3 text-[var(--muted)]">
                  {record.status ?? "-"}
                </td>
                <td className="px-4 py-3 text-[var(--muted)]">
                  {record.importJob.filename}
                </td>
                <td className="px-4 py-3 text-[var(--muted)]">
                  {formatDateTime(record.createdAt)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
