import type { Metadata } from "next";

import { ResultsExperience } from "@/components/results";

export const metadata: Metadata = {
  title: "Results — Florida Support Guide",
  description:
    "A transparent, plain-language child support and alimony estimate built from your reviewed intake, with full formula traces, citations, and a downloadable PDF.",
};

export default function ResultsPage() {
  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold tracking-tight text-ink sm:text-4xl">Your results</h1>
        <p className="text-lg text-ink-muted">
          A plain-language, transparent estimate built from your reviewed answers — with every confirmed fact,
          formula step, and citation shown so you and your attorney can verify it.
        </p>
      </header>

      <ResultsExperience />
    </div>
  );
}
