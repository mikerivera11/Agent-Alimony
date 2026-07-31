import { cn } from "./cn";

interface ProgressProps {
  /** Completion percentage, 0–100. */
  value: number;
  /** Accessible name for the progress bar. */
  label: string;
  className?: string;
}

/**
 * A slim, accessible progress bar. Exposes the standard `progressbar` role
 * with numeric `aria-value*` attributes; the visual fill animates its width
 * on change (respecting reduced-motion).
 */
export function Progress({ value, label, className }: ProgressProps) {
  const clamped = Math.max(0, Math.min(100, Math.round(value)));
  return (
    <div
      role="progressbar"
      aria-valuenow={clamped}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={label}
      className={cn(
        "h-2 w-full overflow-hidden rounded-pill bg-surface-2",
        className,
      )}
    >
      <div
        className="h-full rounded-pill bg-primary transition-[width] duration-500 ease-out motion-reduce:transition-none"
        style={{ width: `${clamped}%` }}
      />
    </div>
  );
}
