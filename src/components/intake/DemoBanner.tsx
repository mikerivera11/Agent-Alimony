interface DemoBannerProps {
  onExitDemo?: () => void;
}

/** Always shown while a fictional demo draft is loaded, so no one mistakes it for real data. */
export function DemoBanner({ onExitDemo }: DemoBannerProps) {
  return (
    <div role="status" className="flex flex-wrap items-center justify-between gap-3 bg-amber-100 px-4 py-2 text-amber-950">
      <p className="text-sm font-semibold">
        Demo mode — every name and number here is fictional example data, not legal advice or a real case.
      </p>
      {onExitDemo ? (
        <button
          type="button"
          onClick={onExitDemo}
          className="min-h-11 rounded-md border border-amber-800 bg-white px-3 py-1.5 text-sm font-semibold text-amber-950 hover:bg-amber-50"
        >
          Exit demo and start fresh
        </button>
      ) : null}
    </div>
  );
}
