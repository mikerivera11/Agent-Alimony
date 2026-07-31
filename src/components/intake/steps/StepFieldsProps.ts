import type { Control, FieldErrors, UseFormRegister } from "react-hook-form";

/** Shared prop shape for every per-topic field component in the wizard. */
export interface StepFieldsProps<T extends Record<string, unknown>> {
  register: UseFormRegister<T>;
  errors: FieldErrors<T>;
  control: Control<T>;
}
