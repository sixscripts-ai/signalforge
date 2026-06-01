type Step = {
  label: string;
  status: "complete" | "active" | "pending";
};

type StepIndicatorProps = {
  steps: Step[];
};

export default function StepIndicator({ steps }: StepIndicatorProps) {
  return (
    <div className="flex flex-wrap gap-3">
      {steps.map((step) => {
        const classes =
          step.status === "complete"
            ? "border-emerald-500/40 text-emerald-300"
            : step.status === "active"
            ? "border-[var(--accent-border)] text-[var(--accent)]"
            : "border-[var(--border)] text-[var(--muted)]";

        return (
          <span
            key={step.label}
            className={`rounded-full border px-3 py-1 text-xs uppercase tracking-[0.2em] ${classes}`}
          >
            {step.label}
          </span>
        );
      })}
    </div>
  );
}
