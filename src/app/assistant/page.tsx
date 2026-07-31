import type { Metadata } from "next";

import { AssistantChat } from "@/components/assistant";
import { QuickExitLink } from "@/components/intake";
import { Container, SiteHeader } from "@/components/ui";

export const metadata: Metadata = {
  title: "Ask about Florida family law — Florida Support Guide",
  description:
    "Plain-language answers about Florida alimony, child support, and property division, grounded in the Florida Statutes.",
};

export default function AssistantPage() {
  return (
    <div className="flex min-h-screen flex-1 flex-col bg-canvas">
      <SiteHeader backToHome actions={<QuickExitLink />} />
      <Container as="main" id="main-content" width="prose" className="flex flex-1 flex-col gap-6 py-10 sm:py-12">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-ink sm:text-4xl">Ask about Florida family law</h1>
          <p className="mt-3 text-base text-ink-muted">
            Get plain-language explanations of how Florida handles alimony, child support, and dividing property.
            Answers come from the Florida Statutes and show you exactly which section they rely on.
          </p>
        </div>

        <AssistantChat />
      </Container>
    </div>
  );
}
