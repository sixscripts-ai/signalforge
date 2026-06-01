type ErrorEntry = {
  rowIndex: number;
  field: string;
  message: string;
  severity?: string;
};

type ErrorTableProps = {
  errors: ErrorEntry[];
};

export default function ErrorTable({ errors }: ErrorTableProps) {
  return (
    <div className="overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--panel)]">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-[var(--border)] text-sm">
          <thead className="bg-[var(--panel-soft)] text-[var(--muted)]">
            <tr>
              <th className="px-4 py-3 text-left font-medium">Row</th>
              <th className="px-4 py-3 text-left font-medium">Field</th>
              <th className="px-4 py-3 text-left font-medium">Message</th>
              <th className="px-4 py-3 text-left font-medium">Severity</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--border)]">
            {errors.map((error, index) => (
              <tr key={`${error.rowIndex}-${index}`} className="hover:bg-white/5">
                <td className="px-4 py-3 text-[var(--muted)]">{error.rowIndex}</td>
                <td className="px-4 py-3 text-[var(--text)]">{error.field}</td>
                <td className="px-4 py-3 text-[var(--text)]">{error.message}</td>
                <td className="px-4 py-3 text-rose-300">
                  {error.severity ?? "error"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
