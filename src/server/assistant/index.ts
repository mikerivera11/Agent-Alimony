import { getServerEnv } from "@/lib/env";

import type { AssistantAdapter } from "./adapter";
import { FoundryAssistantAdapter } from "./foundry-adapter";
import { LocalAssistantAdapter } from "./local-adapter";

export * from "./adapter";
export * from "./guardrails";
export { KNOWLEDGE_BASE, SUGGESTED_QUESTIONS, type KnowledgeEntry } from "./knowledgeBase";
export { retrieveKnowledge, type RetrievalHit } from "./retrieval";
export { FoundryAssistantAdapter } from "./foundry-adapter";
export { LocalAssistantAdapter } from "./local-adapter";

/**
 * Resolves the adapter selected by `ASSISTANT_PROVIDER`. Defaults to the
 * local statute-reference adapter, which needs no AI provider and is safe
 * to run anywhere.
 */
export function getAssistantAdapter(): AssistantAdapter {
  const env = getServerEnv();
  switch (env.ASSISTANT_PROVIDER) {
    case "foundry":
      return new FoundryAssistantAdapter();
    case "local":
    default:
      return new LocalAssistantAdapter();
  }
}
