/**
 * Shared Tailwind class fragments for the `/documents` experience.
 * Mirrors the conventions used elsewhere in the app (min 44px touch
 * targets, visible focus rings, high-contrast slate/blue palette) so this
 * feature looks and behaves consistently without importing from other
 * ownership areas.
 */
export const primaryButtonClasses =
  "min-h-11 min-w-11 inline-flex items-center justify-center gap-2 rounded-md bg-blue-800 px-5 py-2.5 text-base font-semibold text-white shadow-sm hover:bg-blue-900 focus:outline-none focus:ring-2 focus:ring-blue-800 focus:ring-offset-2 disabled:cursor-not-allowed disabled:bg-slate-400";

export const secondaryButtonClasses =
  "min-h-11 min-w-11 inline-flex items-center justify-center gap-2 rounded-md border border-slate-500 bg-white px-5 py-2.5 text-base font-semibold text-slate-900 shadow-sm hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-800 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50";

export const dangerButtonClasses =
  "min-h-11 min-w-11 inline-flex items-center justify-center gap-2 rounded-md border-2 border-red-800 bg-red-50 px-5 py-2.5 text-base font-semibold text-red-900 shadow-sm hover:bg-red-100 focus:outline-none focus:ring-2 focus:ring-red-800 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50";

export const cardClasses = "flex flex-col gap-3 rounded-lg border border-slate-300 bg-white p-4 shadow-sm";

export const badgeClasses =
  "inline-flex w-fit items-center rounded-full border border-amber-800 bg-amber-100 px-2.5 py-0.5 text-xs font-bold uppercase tracking-wide text-amber-950";

export const alertClasses =
  "flex flex-col gap-1 rounded-md border-2 border-red-800 bg-red-50 p-4 text-red-950";

export const successClasses =
  "flex flex-col gap-1 rounded-md border-2 border-green-800 bg-green-50 p-4 text-green-950";

export const fileInputClasses =
  "block w-full cursor-pointer rounded-md border border-slate-400 bg-white text-base text-slate-900 shadow-sm file:mr-4 file:min-h-11 file:cursor-pointer file:rounded-md file:border-0 file:bg-blue-800 file:px-4 file:py-2.5 file:text-base file:font-semibold file:text-white hover:file:bg-blue-900 focus-within:ring-2 focus-within:ring-blue-700 focus-within:ring-offset-1";
