import type { Metadata } from "next";

import { IntakeExperience } from "@/components/intake";

export const metadata: Metadata = {
  title: "Guided intake — Florida Support Guide",
};

export default function IntakePage() {
  return <IntakeExperience />;
}
