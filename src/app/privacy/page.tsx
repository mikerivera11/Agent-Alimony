import type { Metadata } from "next";
import Link from "next/link";

import { QuickExitLink } from "@/components/intake";

export const metadata: Metadata = {
  title: "Privacy — Florida Support Guide",
};

export default function PrivacyPage() {
  return (
    <div className="flex flex-1 flex-col bg-slate-50">
      <header className="flex items-center justify-between gap-3 border-b border-slate-200 bg-white px-4 py-3 sm:px-8">
        <Link href="/" className="text-base font-semibold text-slate-900 underline-offset-4 hover:underline">
          ← Florida Support Guide
        </Link>
        <QuickExitLink />
      </header>
      <main id="main-content" className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-4 py-10 sm:px-8">
        <h1 className="text-3xl font-bold text-slate-950">Privacy notice</h1>
        <p className="text-lg text-slate-700">
          This page explains, in plain language, what happens to information you type into this tool.
        </p>

        <section className="flex flex-col gap-2">
          <h2 className="text-xl font-semibold text-slate-950">No account, no login</h2>
          <p className="text-slate-800">
            You don&apos;t create an account or sign in to use this preview. There is nothing tying your answers
            to your identity beyond what you choose to type.
          </p>
        </section>

        <section className="flex flex-col gap-2">
          <h2 className="text-xl font-semibold text-slate-950">Where your draft lives</h2>
          <p className="text-slate-800">
            Your answers are saved only in this browser&apos;s local storage, on this device. They are not sent
            to a server, database, or any third party by this preview. That also means:
          </p>
          <ul className="list-disc pl-6 text-slate-800">
            <li>Opening this tool on a different device or browser starts you with a blank draft.</li>
            <li>Clearing your browser&apos;s site data, using private/incognito mode, or reinstalling your browser will erase your draft.</li>
            <li>Anyone with access to this browser profile could see your saved answers — consider that if you share a device.</li>
          </ul>
        </section>

        <section className="flex flex-col gap-2">
          <h2 className="text-xl font-semibold text-slate-950">Document uploads</h2>
          <p className="text-slate-800">
            The local preview checks an uploaded PDF or image in memory, reports safe metadata, and immediately
            discards the bytes. It does not perform real extraction. In Azure production, source documents will be
            stored in a private Blob container and automatically deleted after <strong>7 days</strong>.
          </p>
        </section>

        <section className="flex flex-col gap-2">
          <h2 className="text-xl font-semibold text-slate-950">What we don&apos;t do</h2>
          <ul className="list-disc pl-6 text-slate-800">
            <li>We don&apos;t sell your information.</li>
            <li>We don&apos;t share your answers with advertisers.</li>
            <li>We don&apos;t use your answers to give you legal advice — see the {" "}
              <Link href="/legal" className="font-semibold underline">legal disclaimer</Link>.
            </li>
          </ul>
        </section>

        <section className="flex flex-col gap-2">
          <h2 className="text-xl font-semibold text-slate-950">Your safety</h2>
          <p className="text-slate-800">
            If someone else has access to this device, remember that your browser history and saved local data
            could reveal that you visited this site. The &quot;Quick exit&quot; link at the top of every page
            takes you to a neutral page immediately.
          </p>
        </section>
      </main>
    </div>
  );
}
