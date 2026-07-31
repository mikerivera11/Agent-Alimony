import type { Metadata } from "next";

import { IntakeExperience } from "@/components/intake";

export const metadata: Metadata = {
  title: "Guided intake — Florida Support Guide",
};

interface IntakePageProps {
  searchParams: Promise<{ demo?: string | string[] }>;
}

export default async function IntakePage({ searchParams }: IntakePageProps) {
  const params = await searchParams;
  const isDemo = params.demo === "1" || params.demo === "true";

  return <IntakeExperience isDemo={isDemo} />;
}
