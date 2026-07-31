"use client";

import { useState } from "react";

import { runDemoExtraction } from "./apiClient";
import type { ExtractionProposalDTO } from "./apiContracts";
import { alertClasses, badgeClasses, primaryButtonClasses } from "./styles";

type DemoStatus = "idle" | "running" | "done" | "error";

interface DemoExtractionPanelProps {
  onProposals: (proposals: ExtractionProposalDTO[]) => void;
}

/**
 * Runs the explicitly-fictional demo extraction. This never reads a real
 * uploaded file — it always calls the mock adapter with the one designated
 * demo fixture's hash and freshly generated UUIDs. Every field it returns is
 * clearly labeled "DEMO DATA ONLY" wherever it is rendered.
 */
export function DemoExtractionPanel({ onProposals }: DemoExtractionPanelProps) {
  const [status, setStatus] = useState<DemoStatus>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [proposalCount, setProposalCount] = useState(0);

  async function handleRunDemo() {
    setStatus("running");
    setErrorMessage(null);

    const response = await runDemoExtraction();

    if (!response.ok) {
      setStatus("error");
      setErrorMessage(response.error.message);
      return;
    }

    setStatus("done");
    setProposalCount(response.extraction.proposals.length);
    onProposals(response.extraction.proposals);
  }

  return (
    <section aria-labelledby="demo-extraction-heading" className="flex flex-col gap-3">
      <h2 id="demo-extraction-heading" className="text-xl font-semibold text-slate-950">
        Run fictional demo extraction
      </h2>
      <p className="text-sm text-slate-700">
        <span className={badgeClasses}>Demo data only</span>{" "}
        This does not read any file you upload. It runs the mock extraction adapter against one fixed, fictional
        example fixture and returns made-up example values so you can see how proposal review works.
      </p>

      <button
        type="button"
        className={`${primaryButtonClasses} w-fit`}
        onClick={() => {
          void handleRunDemo();
        }}
        disabled={status === "running"}
      >
        {status === "running" ? "Running fictional demo…" : "Run fictional demo extraction"}
      </button>

      {status === "error" && errorMessage ? (
        <div role="alert" className={alertClasses}>
          <p className="font-semibold">Demo extraction failed</p>
          <p className="text-sm">{errorMessage}</p>
        </div>
      ) : null}

      {status === "done" ? (
        <p role="status" className="text-sm font-medium text-slate-700">
          {proposalCount > 0
            ? `Generated ${proposalCount} fictional demo proposal${proposalCount === 1 ? "" : "s"} below. Review each one.`
            : "The demo run completed with no proposals."}
        </p>
      ) : null}
    </section>
  );
}
