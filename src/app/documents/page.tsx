import type { Metadata } from "next";

import { DocumentChecklist, DocumentPrivacyNotice, DocumentsExperience } from "@/components/documents";

export const metadata: Metadata = {
  title: "Documents — Florida Support Guide",
  description:
    "A plain-language checklist of Florida disclosure documents, plus a local-first, secure preview of document upload and mock extraction.",
};

export default function DocumentsPage() {
  return (
    <div className="flex flex-col gap-10">
      <header className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold tracking-tight text-ink sm:text-4xl">Documents</h1>
        <p className="text-lg text-ink-muted">
          Gather the right paperwork for a Florida alimony/support case, and try a secure, local-first preview of
          document upload and (mock) extraction.
        </p>
      </header>

      <DocumentChecklist />
      <DocumentPrivacyNotice />
      <DocumentsExperience />
    </div>
  );
}
