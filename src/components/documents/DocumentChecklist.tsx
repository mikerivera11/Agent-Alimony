import { DOCUMENT_CHECKLIST } from "./checklistData";

/**
 * Plain-language checklist of Florida disclosure materials. This is purely
 * informational — nothing here is uploaded, checked, or sent anywhere; it
 * exists to help someone gather the right paperwork.
 */
export function DocumentChecklist() {
  return (
    <section aria-labelledby="document-checklist-heading" className="flex flex-col gap-4">
      <h2 id="document-checklist-heading" className="text-xl font-semibold text-slate-950">
        What to gather
      </h2>
      <p className="text-slate-800">
        Florida disclosure requirements vary by case, but these categories cover what most alimony/support cases
        need. You don&apos;t have to have everything before you start.
      </p>
      <ul className="flex flex-col gap-3">
        {DOCUMENT_CHECKLIST.map((item) => (
          <li key={item.id} className="rounded-lg border border-slate-300 bg-white p-4">
            <h3 className="text-base font-semibold text-slate-950">{item.title}</h3>
            <p className="mt-1 text-sm text-slate-700">{item.whyItHelps}</p>
            <p className="mt-2 text-xs font-medium uppercase tracking-wide text-slate-500">Examples</p>
            <ul className="list-disc pl-5 text-sm text-slate-700">
              {item.examples.map((example) => (
                <li key={example}>{example}</li>
              ))}
            </ul>
          </li>
        ))}
      </ul>
    </section>
  );
}
