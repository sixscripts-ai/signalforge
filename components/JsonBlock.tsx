type JsonBlockProps = {
  data: unknown;
};

export default function JsonBlock({ data }: JsonBlockProps) {
  return (
    <pre className="max-h-64 overflow-auto rounded-lg border border-[var(--border)] bg-[#050b16] p-4 text-xs text-slate-200">
      {JSON.stringify(data, null, 2)}
    </pre>
  );
}
