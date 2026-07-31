import type { ReactNode } from "react";

import { Container, SiteHeader } from "@/components/ui";

export default function DocumentsLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-canvas">
      <SiteHeader backToHome />
      <Container as="main" id="main-content" className="flex-1 py-8 sm:py-10">
        {children}
      </Container>
    </div>
  );
}
