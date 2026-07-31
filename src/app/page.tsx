import type { Metadata } from "next";
import Link from "next/link";

import { ConsentGate, QuickExitLink } from "@/components/intake";

export const metadata: Metadata = {
  title: "Florida Support Guide",
};

export default function Home() {
  return (
    <div className="flex flex-1 flex-col bg-slate-50">
      <header className="flex items-center justify-end gap-3 border-b border-slate-200 bg-white px-4 py-3 sm:px-8">
        <QuickExitLink />
      </header>
      <main id="main-content" className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-8 px-4 py-10 sm:px-8">
        <div className="flex flex-col gap-3">
          <p className="inline-block w-fit rounded-full bg-blue-100 px-3 py-1 text-sm font-semibold text-blue-900">
            Preview — Florida, current law only
          </p>
          <h1 className="text-3xl font-bold text-slate-950 sm:text-4xl">
            Understand Florida alimony and child support, one plain-language question at a time
          </h1>
          <p className="text-lg text-slate-700">
            This tool organizes income, expenses, parenting time, and supporting records, then shows every
            calculation step and the Florida source behind it.
          </p>
        </div>

        <section aria-labelledby="what-this-is" className="flex flex-col gap-3 rounded-lg border border-slate-300 bg-white p-5">
          <h2 id="what-this-is" className="text-xl font-semibold text-slate-950">
            What this is — and isn&apos;t
          </h2>
          <ul className="flex flex-col gap-2 text-slate-800">
            <li>
              ✅ <strong>General legal information and a financial estimate tool.</strong> It helps you organize
              facts the way Florida courts look at them.
            </li>
            <li>
              ❌ <strong>Not legal advice, and not a lawyer.</strong> No attorney-client relationship is created by
              using this tool.
            </li>
            <li>
              📍 <strong>Florida law only, as it currently stands.</strong> It does not cover other states or
              older versions of Florida&apos;s alimony law.
            </li>
          </ul>
        </section>

        <section aria-labelledby="how-your-info-works" className="flex flex-col gap-3 rounded-lg border border-slate-300 bg-white p-5">
          <h2 id="how-your-info-works" className="text-xl font-semibold text-slate-950">
            How your information is handled
          </h2>
          <ul className="flex flex-col gap-2 text-slate-800">
            <li>
              🔒 <strong>No account or login.</strong> Your draft is saved in this browser for the local MVP.
            </li>
            <li>
              💻 <strong>Browser-bound.</strong> Switching devices, browsers, or clearing site data means your
              saved draft is gone for good.
            </li>
            <li>
              🗓️ <strong>Seven-day upload retention.</strong> In production, uploaded source files are deleted
              after 7 days. The local preview validates uploads but does not retain their bytes.
            </li>
          </ul>
        </section>

        <section aria-labelledby="safety" className="flex flex-col gap-3 rounded-lg border-2 border-red-800 bg-red-50 p-5">
          <h2 id="safety" className="text-xl font-semibold text-red-950">
            If you&apos;re not safe right now
          </h2>
          <p className="text-red-950">
            If you are in immediate danger, call 911. The National Domestic Violence Hotline is available any time
            at{" "}
            <a href="tel:18007997233" className="font-semibold underline">
              1-800-799-7233
            </a>
            . Use the &quot;Quick exit&quot; link at the top of this page any time to leave immediately.
          </p>
        </section>

        <ConsentGate startHref="/intake" demoHref="/intake?demo=1" />

        <Link href="/documents" className="font-semibold text-blue-800 underline">
          See the document checklist and mock extraction preview
        </Link>

        <p className="text-sm text-slate-600">
          Read the full{" "}
          <Link href="/legal" className="font-semibold underline">
            legal disclaimer
          </Link>{" "}
          or{" "}
          <Link href="/privacy" className="font-semibold underline">
            privacy notice
          </Link>{" "}
          any time.
        </p>
      </main>
    </div>
  );
}
