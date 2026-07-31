"use client";

import { useState } from "react";
import Link from "next/link";

import { primaryButtonClasses } from "./fields/inputStyles";

interface ConsentGateProps {
  startHref: string;
}
/**
 * Requires an explicit privacy/consent acknowledgement before the "Start"
 * button becomes usable. Kept as its own small client component so the
 * surrounding landing page can stay a plain server-rendered page.
 */
export function ConsentGate({ startHref }: ConsentGateProps) {
  const [acknowledged, setAcknowledged] = useState(false);

  return (
    <div className="flex flex-col gap-4 rounded-2xl border-2 border-info-border bg-info-surface p-5 sm:p-6">
      <label htmlFor="consent-checkbox" className="flex min-h-11 cursor-pointer items-start gap-3 text-base text-info-text">
        <input
          id="consent-checkbox"
          type="checkbox"
          checked={acknowledged}
          onChange={(event) => setAcknowledged(event.target.checked)}
          className="mt-1 size-5 accent-primary"
        />
        <span>
          I understand this tool gives general legal information and a financial estimate only — it is not legal
          advice and not a lawyer, and I&apos;ve read the{" "}
          <Link href="/legal" className="font-semibold underline">
            legal disclaimer
          </Link>{" "}
          and{" "}
          <Link href="/privacy" className="font-semibold underline">
            privacy notice
          </Link>
          .
        </span>
      </label>
      <div className="flex flex-col gap-3 sm:flex-row">
        <Link
          href={startHref}
          aria-disabled={!acknowledged}
          onClick={(event) => {
            if (!acknowledged) event.preventDefault();
          }}
          className={`${primaryButtonClasses} ${!acknowledged ? "pointer-events-none opacity-50" : ""}`}
        >
          Start my guided intake
        </Link>
      </div>
      {!acknowledged ? (
        <p className="text-sm text-info-text">Check the box above to continue.</p>
      ) : null}
    </div>
  );
}
