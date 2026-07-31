import { primaryButtonClasses, secondaryButtonClasses } from "./fields/inputStyles";

interface StepNavButtonsProps {
  onBack?: () => void;
  showBack: boolean;
  submitLabel?: string;
  isSubmitting?: boolean;
}

/** Back / continue buttons shown at the bottom of every wizard topic. */
export function StepNavButtons({ onBack, showBack, submitLabel = "Save and continue", isSubmitting }: StepNavButtonsProps) {
  return (
    <div className="flex flex-col-reverse gap-3 pt-2 sm:flex-row sm:justify-between">
      {showBack ? (
        <button type="button" onClick={onBack} className={secondaryButtonClasses}>
          Back
        </button>
      ) : (
        <span aria-hidden="true" />
      )}
      <button type="submit" className={primaryButtonClasses} disabled={isSubmitting}>
        {submitLabel}
      </button>
    </div>
  );
}
