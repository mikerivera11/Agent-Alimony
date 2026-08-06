import type { Metadata } from "next";

import { AssistantChat } from "@/components/assistant";
import { QuickExitLink } from "@/components/intake";
import { Container, SiteHeader } from "@/components/ui";

export const metadata: Metadata = {
  title: "Ask a legal or financial-options question — Florida Support Guide",
  description:
    "Choose statute-grounded Florida family-law information or a source-grounded guide for comparing settlement funding options.",
};

export default function AssistantPage() {
  return (
    <div className="flex min-h-screen flex-1 flex-col bg-canvas">
      <SiteHeader backToHome actions={<QuickExitLink />} />
      <Container as="main" id="main-content" width="prose" className="flex flex-1 flex-col gap-6 py-10 sm:py-12">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-ink sm:text-4xl">Ask a focused guide</h1>
          <p className="mt-3 text-base text-ink-muted">
            Choose Florida law for statute-grounded legal information, or Financial options to compare ways of
            funding a settlement without turning the chat into a stock picker or transaction service.
          </p>
        </div>

        <AssistantChat />
      </Container>
    </div>
  );
}
