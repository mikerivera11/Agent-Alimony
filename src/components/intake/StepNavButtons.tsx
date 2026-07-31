import { Button } from "@/components/ui";

interface StepNavButtonsProps {
  onBack?: () => void;
  showBack: boolean;
  submitLabel?: string;
  isSubmitting?: boolean;
}

/**
 * Back / continue buttons shown at the bottom of every wizard topic. On small
 * screens the bar sticks to the bottom of the viewport so the primary action
 * stays within thumb reach; on larger screens it sits inline under the form.
 */
export function StepNavButtons({ onBack, showBack, submitLabel = "Save and continue", isSubmitting }: StepNavButtonsProps) {
  return (
    <div className="sticky bottom-0 z-10 -mx-4 mt-2 flex flex-col-reverse gap-3 border-t border-border bg-canvas/90 px-4 py-3 backdrop-blur sm:static sm:mx-0 sm:flex-row sm:justify-between sm:border-0 sm:bg-transparent sm:px-0 sm:py-0 sm:backdrop-blur-none">
      {showBack ? (
        <Button type="button" variant="secondary" onClick={onBack} className="max-sm:w-full">
          Back
        </Button>
      ) : (
        <span aria-hidden="true" className="hidden sm:block" />
      )}
      <Button type="submit" loading={isSubmitting} className="max-sm:w-full">
        {submitLabel}
      </Button>
    </div>
  );
}
