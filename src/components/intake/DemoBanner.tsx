interface DemoBannerProps {
  onExitDemo?: () => void;
}

/** Always shown while a fictional demo draft is loaded, so no one mistakes it for real data. */
export function DemoBanner({ onExitDemo }: DemoBannerProps) {
  return (
    <div role="status" className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-warning-border bg-warning-surface px-4 py-3 text-warning-text">
      <p className="flex items-center gap-2 text-sm font-semibold">
        <span aria-hidden="true" className="flex size-5 flex-none items-center justify-center rounded-full border border-warning-border text-xs">
          ★
        </span>
        Demo mode — every name and number here is fictional example data, not legal advice or a real case.
      </p>
      {onExitDemo ? (
        <button
          type="button"
          onClick={onExitDemo}
          className="min-h-11 rounded-lg border border-warning-border bg-surface px-3 py-1.5 text-sm font-semibold text-warning-text transition-colors hover:bg-surface-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-canvas"
        >
          Exit demo and start fresh
        </button>
      ) : null}
    </div>
  );
}
