import type { Metadata } from "next";
import { Suspense } from "react";

import { IntakeExperience } from "@/components/intake";

export const metadata: Metadata = {
  title: "Guided intake — Florida Support Guide",
};

export default function IntakePage() {
  return (
    // `IntakeExperience` reads `?step=` so `/results` can link straight to a
    // topic; Next requires that behind a Suspense boundary to keep this page
    // statically renderable.
    <Suspense fallback={<p className="p-6 text-lg text-ink-muted">Loading your saved answers…</p>}>
      <IntakeExperience />
    </Suspense>
  );
}
