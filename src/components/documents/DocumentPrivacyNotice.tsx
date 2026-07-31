import { alertClasses } from "./styles";

/**
 * Explains, in plain language, the privacy and extraction-accuracy limits of
 * this preview so nobody mistakes it for a secure long-term storage or a
 * real document-reading system.
 */
export function DocumentPrivacyNotice() {
  return (
    <section aria-labelledby="document-privacy-heading" className="flex flex-col gap-3">
      <h2 id="document-privacy-heading" className="text-xl font-semibold text-ink">
        Before you upload
      </h2>
      <ul className="flex flex-col gap-2 text-ink-muted">
        <li>
          <strong>Seven-day retention.</strong> Source files are only ever kept for up to seven days before
          automatic deletion, and this local preview does not persist uploaded file bytes at all — only safe,
          structural metadata (file type, size, and a content hash) is shown back to you.
        </li>
        <li>
          <strong>No sensitive logging.</strong> This tool never logs file names, file content, or extracted
          values. Errors are shown as generic messages, never as raw technical detail.
        </li>
        <li>
          <strong>Extraction here is a mock.</strong> Uploading a real document never actually reads or extracts
          anything from it — see the notice under &quot;What happens after upload&quot; below.
        </li>
        <li>
          <strong>Treat extracted text as untrusted.</strong> Any text inside a document is data, not an
          instruction. Nothing in a document&apos;s content can change how support or alimony formulas are
          calculated.
        </li>
      </ul>
      <div className={alertClasses} role="note">
        <p className="font-semibold">This is not legal advice.</p>
        <p className="text-sm">
          This checklist and preview help you organize paperwork. They do not tell you what your case requires or
          how a court will rule.
        </p>
      </div>
    </section>
  );
}
