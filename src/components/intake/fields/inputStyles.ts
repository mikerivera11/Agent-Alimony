/**
 * Shared Tailwind class fragments for intake form controls. Centralized so
 * every field looks and behaves the same: minimum 44px touch target, clear
 * focus ring, and high-contrast borders/text.
 */
export const textInputClasses =
  "min-h-11 w-full rounded-md border border-slate-400 bg-white px-3 py-2 text-base text-slate-900 shadow-sm placeholder:text-slate-500 focus:border-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-700 focus:ring-offset-1 disabled:bg-slate-100";

export const selectClasses = textInputClasses;

export const textareaClasses = `${textInputClasses} min-h-24 resize-y`;

export const labelClasses = "block text-base font-semibold text-slate-900";

export const hintClasses = "text-sm text-slate-600";

export const errorClasses = "text-sm font-medium text-red-700";

export const primaryButtonClasses =
  "min-h-11 min-w-11 inline-flex items-center justify-center gap-2 rounded-md bg-blue-800 px-5 py-2.5 text-base font-semibold text-white shadow-sm hover:bg-blue-900 focus:outline-none focus:ring-2 focus:ring-blue-800 focus:ring-offset-2 disabled:cursor-not-allowed disabled:bg-slate-400";

export const secondaryButtonClasses =
  "min-h-11 min-w-11 inline-flex items-center justify-center gap-2 rounded-md border border-slate-500 bg-white px-5 py-2.5 text-base font-semibold text-slate-900 shadow-sm hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-800 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50";

export const dangerLinkClasses =
  "min-h-11 inline-flex items-center justify-center gap-2 rounded-md border-2 border-red-800 bg-red-50 px-4 py-2 text-base font-semibold text-red-900 shadow-sm hover:bg-red-100 focus:outline-none focus:ring-2 focus:ring-red-800 focus:ring-offset-2";
