type DataPreviewTableProps = {
  columns: string[];
  rows: Record<string, unknown>[];
};

export default function DataPreviewTable({ columns, rows }: DataPreviewTableProps) {
  return (
    <div className="overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--panel)]">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-[var(--border)] text-xs">
          <thead className="bg-[var(--panel-soft)] text-[var(--muted)]">
            <tr>
              {columns.map((column) => (
                <th key={column} className="px-3 py-2 text-left font-medium">
                  {column}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--border)]">
            {rows.map((row, rowIndex) => (
              <tr key={rowIndex} className="hover:bg-white/5">
                {columns.map((column) => (
                  <td key={`${rowIndex}-${column}`} className="px-3 py-2 text-[var(--text)]">
                    {String(row[column] ?? "-")}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
