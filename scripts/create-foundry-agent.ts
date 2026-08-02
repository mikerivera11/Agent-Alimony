/**
 * Creates (or reports) the Florida Support Guide agent in the Azure AI Foundry
 * project, so it is visible on the portal's Agents page.
 *
 * Why this exists: agents are data-plane objects with no ARM representation, so
 * Bicep cannot create them. The running app creates one lazily on first use —
 * but only when `ASSISTANT_PROVIDER=agent`. While the provider is set to
 * `foundry` (the chat-completions tier), nothing ever calls the Agent Service,
 * so the project's agent list stays empty and the portal shows nothing. This
 * script performs that same bootstrap on demand from an operator's machine.
 *
 * It deliberately imports the instructions and tool definition from the adapter
 * rather than restating them, so the agent shown in the portal is the same
 * agent the application talks to.
 *
 * Requires: `az login`, and an Entra principal holding Azure AI Developer on
 * the Foundry project. The Foundry account must also allow network access from
 * the machine running this (see README, "Viewing the agent in AI Foundry").
 *
 * Run with: npm run foundry:agent
 */

import { DefaultAzureCredential } from "@azure/identity";

import { TOOL_DEFINITIONS, agentNameFor } from "../src/server/assistant/agent-adapter";
import { AGENT_INSTRUCTIONS } from "../src/server/assistant/systemPrompt";

/** Matches the adapter's scope. The OpenAI data-plane audience is rejected here. */
const TOKEN_SCOPE = "https://ai.azure.com/.default";

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is not set. Export it, or copy it from the App Service settings.`);
  }
  return value;
}

interface Agent {
  readonly id?: string;
  readonly name?: string;
}

async function main(): Promise<void> {
  const endpoint = required("AZURE_FOUNDRY_PROJECT_ENDPOINT").replace(/\/$/, "");
  const model = required("AZURE_FOUNDRY_AGENT_MODEL");
  const apiVersion = process.env.AZURE_FOUNDRY_AGENT_API_VERSION ?? "v1";
  const name = agentNameFor(model);

  const token = await new DefaultAzureCredential().getToken(TOKEN_SCOPE);
  if (!token) throw new Error("Could not acquire an Entra ID token. Run `az login` first.");

  const call = async (method: string, body?: unknown): Promise<Response> =>
    fetch(`${endpoint}/agents?api-version=${encodeURIComponent(apiVersion)}`, {
      method,
      headers: { "content-type": "application/json", authorization: `Bearer ${token.token}` },
      body: body === undefined ? undefined : JSON.stringify(body),
    });

  const listed = await call("GET");
  if (!listed.ok) {
    throw new Error(
      `Listing agents failed with HTTP ${listed.status}. ` +
        (listed.status === 401
          ? "The token was rejected: check the principal holds Azure AI Developer on the project."
          : listed.status === 403
            ? "Access is blocked by the account firewall. See README, 'Viewing the agent in AI Foundry'."
            : await listed.text()),
    );
  }

  const existing = ((await listed.json()) as { data?: readonly Agent[] }).data ?? [];
  if (existing.some((agent) => agent.name === name)) {
    console.log(`Agent already exists: ${name} (model ${model}).`);
    return;
  }

  const created = await call("POST", {
    name,
    definition: {
      kind: "prompt",
      model,
      instructions: AGENT_INSTRUCTIONS,
      tools: TOOL_DEFINITIONS,
    },
  });
  if (!created.ok) {
    throw new Error(`Creating the agent failed with HTTP ${created.status}: ${await created.text()}`);
  }

  await created.json();
  console.log(`Created agent ${name} on model ${model}.`);
  console.log("It should now appear on the Agents page in the Azure AI Foundry portal.");
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
