"use client";

/**
 * Shared renderer for assistant answers, used by both the standalone chat page
 * and the inline per-section helper so an answer looks and behaves identically
 * wherever it appears.
 */

export function renderInline(text: string) {
  return text.split(/(\*\*[^*]+\*\*)/g).map((part, index) =>
    part.startsWith("**") && part.endsWith("**") ? (
      <strong key={index}>{part.slice(2, -2)}</strong>
    ) : (
      <span key={index}>{part}</span>
    ),
  );
}

/**
 * Renders the small subset of Markdown the knowledge base uses: paragraphs,
 * bullet lists, bold spans, and dividers. A full Markdown renderer is not
 * worth the dependency or the extra injection surface for this.
 */
export function AnswerBody({ content }: { content: string }) {
  const blocks = content.split(/\n\n+/);

  return (
    <div className="space-y-3">
      {blocks.map((block, blockIndex) => {
        const key = `${blockIndex}-${block.slice(0, 16)}`;

        if (block.trim() === "---") {
          return <hr key={key} className="border-border" />;
        }

        const lines = block.split("\n");
        if (lines.every((line) => line.trimStart().startsWith("- "))) {
          return (
            <ul key={key} className="list-disc space-y-1 pl-5">
              {lines.map((line, lineIndex) => (
                <li key={`${key}-${lineIndex}`}>{renderInline(line.trimStart().slice(2))}</li>
              ))}
            </ul>
          );
        }

        return <p key={key}>{renderInline(block)}</p>;
      })}
    </div>
  );
}
