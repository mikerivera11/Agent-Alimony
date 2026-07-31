import type { ReactNode } from "react";
import Link from "next/link";

export default function DocumentsLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-slate-50">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-white px-4 py-3 sm:px-8">
        <Link href="/" className="text-base font-semibold text-slate-900 underline-offset-4 hover:underline">
          ← Florida Support Guide
        </Link>
      </header>
      <main id="main-content" className="mx-auto w-full max-w-3xl flex-1 px-4 py-8 sm:px-8">
        {children}
      </main>
    </div>
  );
}
