"use client";

import { useId, useState } from "react";

import { uploadDocument } from "./apiClient";
import type { ExtractionProposalDTO, SafeUploadedDocumentMetadata } from "./apiContracts";
import { describeUploadExtractionOutcome } from "./extractionMessages";
import { alertClasses, fileInputClasses, primaryButtonClasses, successClasses } from "./styles";
import { checkFileBeforeUpload } from "./validateClientFileSelection";

type UploadStatus = "idle" | "uploading" | "success" | "error";

interface UploadPanelState {
  status: UploadStatus;
  errorMessage: string | null;
  document: SafeUploadedDocumentMetadata | null;
  outcome: ReturnType<typeof describeUploadExtractionOutcome> | null;
}

const INITIAL_STATE: UploadPanelState = { status: "idle", errorMessage: null, document: null, outcome: null };

interface UploadPanelProps {
  /** Called only when the upload produced one or more proposals (only ever possible for the designated demo fixture's bytes). */
  onProposals?: (proposals: ExtractionProposalDTO[]) => void;
}

/**
 * Accepts a single PDF/JPEG/PNG upload (10MB max), sends it to
 * `/api/documents/upload`, and shows back only safe metadata plus a plain
 * explanation of what extraction did (or, for any real document, did not
 * do). Never renders a success-shaped view when the request actually
 * failed.
 */
export function UploadPanel({ onProposals }: UploadPanelProps) {
  const [state, setState] = useState<UploadPanelState>(INITIAL_STATE);
  const inputId = useId();

  async function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) {
      return;
    }

    const clientCheck = checkFileBeforeUpload(file);
    if (!clientCheck.ok) {
      setState({ status: "error", errorMessage: clientCheck.message ?? "That file cannot be uploaded.", document: null, outcome: null });
      return;
    }

    setState({ status: "uploading", errorMessage: null, document: null, outcome: null });

    const response = await uploadDocument(file);

    if (!response.ok) {
      setState({ status: "error", errorMessage: response.error.message, document: null, outcome: null });
      return;
    }

    const outcome = describeUploadExtractionOutcome(response.extraction);
    setState({ status: "success", errorMessage: null, document: response.document, outcome });

    if (response.extraction.proposals.length > 0) {
      onProposals?.(response.extraction.proposals);
    }
  }

  return (
    <section aria-labelledby="upload-heading" className="flex flex-col gap-3">
      <h2 id="upload-heading" className="text-xl font-semibold text-slate-950">
        Upload a document
      </h2>
      <p className="text-sm text-slate-700">
        Accepts PDF, JPEG, or PNG files up to 10MB. This local preview does not store the file itself — only safe
        metadata (file type, size, and a content fingerprint) is shown below.
      </p>

      <label htmlFor={inputId} className="block text-base font-semibold text-slate-900">
        Choose a file
      </label>
      <input
        id={inputId}
        type="file"
        accept="application/pdf,image/jpeg,image/png"
        className={fileInputClasses}
        onChange={(event) => {
          void handleFileChange(event);
        }}
        disabled={state.status === "uploading"}
        aria-describedby={`${inputId}-hint`}
      />
      <p id={`${inputId}-hint`} className="text-xs text-slate-600">
        Your file type is verified by its actual content, not just its name or extension.
      </p>

      {state.status === "uploading" ? (
        <p role="status" className="text-sm font-medium text-slate-700">
          Uploading and validating…
        </p>
      ) : null}

      {state.status === "error" && state.errorMessage ? (
        <div role="alert" className={alertClasses}>
          <p className="font-semibold">Upload failed</p>
          <p className="text-sm">{state.errorMessage}</p>
        </div>
      ) : null}

      {state.status === "success" && state.document && state.outcome ? (
        <div role="status" className={successClasses}>
          <p className="font-semibold">File validated</p>
          <dl className="grid grid-cols-1 gap-x-4 gap-y-1 text-sm sm:grid-cols-2">
            <div>
              <dt className="font-semibold">Display name</dt>
              <dd>{state.document.sanitizedDisplayFilename}</dd>
            </div>
            <div>
              <dt className="font-semibold">Detected type</dt>
              <dd>{state.document.detectedMimeType}</dd>
            </div>
            <div>
              <dt className="font-semibold">Size</dt>
              <dd>{(state.document.byteSize / 1024).toFixed(1)} KB</dd>
            </div>
            <div>
              <dt className="font-semibold">Content fingerprint (SHA-256)</dt>
              <dd className="break-all font-mono text-xs">{state.document.sha256}</dd>
            </div>
          </dl>
          <div className="mt-2 rounded-md bg-white/70 p-3">
            <p className="font-semibold">{state.outcome.headline}</p>
            <p className="text-sm">{state.outcome.detail}</p>
          </div>
        </div>
      ) : null}

      <button
        type="button"
        className={`${primaryButtonClasses} w-fit`}
        onClick={() => setState(INITIAL_STATE)}
        disabled={state.status === "idle" || state.status === "uploading"}
      >
        Clear result
      </button>
    </section>
  );
}
