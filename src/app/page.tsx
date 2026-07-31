import type { Metadata } from "next";
import Link from "next/link";

import { ConsentGate, QuickExitLink } from "@/components/intake";
import { Alert, Badge, Card, Container, SiteHeader } from "@/components/ui";

export const metadata: Metadata = {
  title: "Florida Support Guide",
};

export default function Home() {
  return (
    <div className="flex flex-1 flex-col bg-canvas">
      <SiteHeader actions={<QuickExitLink />} />
      <Container as="main" id="main-content" className="flex flex-1 flex-col gap-10 py-10 sm:py-14">
        <div className="flex flex-col gap-4">
          <Badge tone="brand">Preview — Florida, current law only</Badge>
          <h1 className="text-3xl font-bold tracking-tight text-ink sm:text-4xl">
            Understand Florida alimony and child support, one plain-language question at a time
          </h1>
          <p className="text-lg text-ink-muted">
            This tool organizes income, expenses, parenting time, and supporting records, then shows every
            calculation step and the Florida source behind it.
          </p>
        </div>

        <section aria-labelledby="what-this-is">
          <Card className="flex flex-col gap-3">
            <h2 id="what-this-is" className="text-xl font-semibold text-ink">
              What this is — and isn&apos;t
            </h2>
            <ul className="flex flex-col gap-2.5 text-ink">
              <li>
                ✅ <strong>General legal information and a financial estimate tool.</strong> It helps you organize
                facts the way Florida courts look at them.
              </li>
              <li>
                ❌ <strong>Not legal advice, and not a lawyer.</strong> No attorney-client relationship is created by
                using this tool.
              </li>
              <li>
                📍 <strong>Florida law only, as it currently stands.</strong> It does not cover other states or
                older versions of Florida&apos;s alimony law.
              </li>
            </ul>
          </Card>
        </section>

        <section aria-labelledby="how-your-info-works">
          <Card className="flex flex-col gap-3">
            <h2 id="how-your-info-works" className="text-xl font-semibold text-ink">
              How your information is handled
            </h2>
            <ul className="flex flex-col gap-2.5 text-ink">
              <li>
                🔒 <strong>No account or login.</strong> Your draft is saved in this browser for the local MVP.
              </li>
              <li>
                💻 <strong>Browser-bound.</strong> Switching devices, browsers, or clearing site data means your
                saved draft is gone for good.
              </li>
              <li>
                🗓️ <strong>Seven-day upload retention.</strong> In production, uploaded source files are deleted
                after 7 days. The local preview validates uploads but does not retain their bytes.
              </li>
            </ul>
          </Card>
        </section>

        <section aria-labelledby="safety">
          <Alert variant="danger" emphasis hideIcon className="flex-col">
            <h2 id="safety" className="text-xl font-semibold text-danger-text">
              If you&apos;re not safe right now
            </h2>
            <p className="text-danger-text">
              If you are in immediate danger, call 911. The National Domestic Violence Hotline is available any time
              at{" "}
              <a href="tel:18007997233" className="font-semibold underline">
                1-800-799-7233
              </a>
              . Use the &quot;Quick exit&quot; link at the top of this page any time to leave immediately.
            </p>
          </Alert>
        </section>

        <ConsentGate startHref="/intake" />

        <Link
          href="/documents"
          className="w-fit rounded font-semibold text-primary underline underline-offset-4 hover:text-primary-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-canvas"
        >
          See the document checklist and mock extraction preview
        </Link>

        <Link
          href="/assistant"
          className="w-fit rounded font-semibold text-primary underline underline-offset-4 hover:text-primary-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-canvas"
        >
          Ask a question about Florida family law
        </Link>

        <p className="text-sm text-ink-muted">
          Read the full{" "}
          <Link href="/legal" className="font-semibold text-primary underline underline-offset-4 hover:text-primary-hover">
            legal disclaimer
          </Link>{" "}
          or{" "}
          <Link href="/privacy" className="font-semibold text-primary underline underline-offset-4 hover:text-primary-hover">
            privacy notice
          </Link>{" "}
          any time.
        </p>
      </Container>
    </div>
  );
}
