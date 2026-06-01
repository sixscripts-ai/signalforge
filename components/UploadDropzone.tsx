'use client';

import { useState } from "react";

type UploadDropzoneProps = {
  onFileSelected: (file: File) => void;
  accept: string;
  hint: string;
};

export default function UploadDropzone({
  onFileSelected,
  accept,
  hint,
}: UploadDropzoneProps) {
  const [isDragging, setIsDragging] = useState(false);

  const handleFile = (file: File | null) => {
    if (!file) return;
    onFileSelected(file);
  };

  return (
    <label
      className={`flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed px-6 py-8 text-center transition ${
        isDragging
          ? "border-[var(--accent-border)] bg-[var(--accent-soft)]"
          : "border-[var(--border)] bg-[var(--panel)]"
      }`}
      onDragOver={(event) => {
        event.preventDefault();
        setIsDragging(true);
      }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={(event) => {
        event.preventDefault();
        setIsDragging(false);
        handleFile(event.dataTransfer.files?.[0] ?? null);
      }}
    >
      <input
        type="file"
        className="hidden"
        accept={accept}
        onChange={(event) => handleFile(event.target.files?.[0] ?? null)}
      />
      <p className="text-sm font-semibold text-[var(--text)]">
        Drag CSV or JSON here
      </p>
      <p className="mt-2 text-xs text-[var(--muted)]">{hint}</p>
    </label>
  );
}
