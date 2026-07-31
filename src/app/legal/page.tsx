import type { Metadata } from "next";
import Link from "next/link";

import { QuickExitLink } from "@/components/intake";
import { Alert, Container, SiteHeader } from "@/components/ui";

export const metadata: Metadata = {
  title: "Legal disclaimer — Florida Support Guide",
};

export default function LegalPage() {
  return (
    <div className="flex min-h-screen flex-1 flex-col bg-canvas">
      <SiteHeader backToHome actions={<QuickExitLink />} />
      <Container as="main" id="main-content" width="prose" className="flex flex-1 flex-col gap-6 py-10 sm:py-12">
        <h1 className="text-3xl font-bold tracking-tight text-ink sm:text-4xl">Legal disclaimer</h1>

        <Alert variant="info" emphasis hideIcon className="flex-col gap-2">
          <p className="text-lg font-semibold">
            This tool provides general legal information and a financial estimate. It is not legal advice, and it
            is not a lawyer.
          </p>
          <p>
            Using this tool does not create an attorney-client relationship with anyone. Nothing here should be
            treated as a substitute for advice from a licensed Florida attorney about your specific situation.
          </p>
        </Alert>

        <section className="flex flex-col gap-2">
          <h2 className="text-xl font-semibold text-ink">Scope: Florida, current law only</h2>
          <p className="text-ink-muted">
            This tool is built around Florida&apos;s alimony and child-support statutes, Sections 61.08 and 61.30, Florida Statutes,{" "}
            <strong className="text-ink">as currently in effect</strong>. Florida substantially changed its alimony law effective July 1,
            2023. If your case was filed — or is based on a petition served — before that date, different rules
            may apply, and this tool may not reflect them accurately. This tool does not cover any state other
            than Florida.
          </p>
        </section>

        <section className="flex flex-col gap-2">
          <h2 className="text-xl font-semibold text-ink">No guarantee of accuracy</h2>
          <p className="text-ink-muted">
            Laws change, courts interpret them differently, and every case has details a general tool can&apos;t
            capture. Numbers and summaries you see here are estimates based on what you enter — they are not a
            prediction of what a court will actually order.
          </p>
        </section>

        <section className="flex flex-col gap-2">
          <h2 className="text-xl font-semibold text-ink">When to talk to a real attorney</h2>
          <p className="text-ink-muted">
            Consider consulting a licensed Florida family law attorney, especially if your situation involves any
            of the following:
          </p>
          <ul className="list-disc pl-6 text-ink-muted marker:text-ink-subtle">
            <li>Domestic violence, coercion, or safety concerns</li>
            <li>Hidden or unknown assets</li>
            <li>Business ownership or complex/self-employment income</li>
            <li>A child with special needs</li>
            <li>A dispute about which state or country should handle the case</li>
            <li>Disagreement about income, or income a court might treat as higher than reported (imputed income)</li>
            <li>A case filed, or based on a petition served, before July 1, 2023</li>
          </ul>
          <p className="text-ink-muted">
            You can find a lawyer through the{" "}
            <a
              href="https://www.floridabar.org/public/lrs/"
              target="_blank"
              rel="noreferrer"
              className="font-semibold text-primary underline underline-offset-4 hover:text-primary-hover"
            >
              Florida Bar Lawyer Referral Service
            </a>{" "}
            or the{" "}
            <a
              href="https://www.flcourts.gov/Resources-Services/Court-Improvement/Family-Courts/Family-Law-Self-Help-Information"
              target="_blank"
              rel="noreferrer"
              className="font-semibold text-primary underline underline-offset-4 hover:text-primary-hover"
            >
              Florida Courts family law self-help resources
            </a>
            .
          </p>
        </section>

        <section className="flex flex-col gap-2">
          <h2 className="text-xl font-semibold text-ink">Your data</h2>
          <p className="text-ink-muted">
            See the{" "}
            <Link href="/privacy" className="font-semibold text-primary underline underline-offset-4 hover:text-primary-hover">
              privacy notice
            </Link>{" "}
            for how your answers are (and aren&apos;t) stored.
          </p>
        </section>
      </Container>
    </div>
  );
}
