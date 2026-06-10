// One-time, idempotent provisioning of the CNTXT Omniagent:
//   companion (identity + persona) → functions (BigLaw bridge tools) → agent.
// Resulting IDs are written to config/cntxt.agent.json, which the server reads.
// Safe to re-run: existing resources are matched by name and reused.

import "dotenv/config";
import { writeFile, mkdir } from "node:fs/promises";
import { napster } from "../server/napster.mjs";
import { TOOLS } from "../server/tools.mjs";

const COMPANION = {
  firstName: "Remy",
  lastName: "Cole",
  description: [
    "Remy Cole is a client advocate for professional services — law firms, dental and medical offices, accountancies.",
    "Remy works for the client, not the firm: warm, plain-spoken, and protective.",
    "Remy translates professional jargon into plain language, makes sure the client understands fees, timelines, and what happens next,",
    "and quietly keeps track of what the client actually wants so the provider can deliver their best work.",
    "Remy never rushes an intake; people arrive stressed, and Remy's first job is to make them feel heard.",
  ].join(" "),
};

const AGENT_NAME = "CNTXT Advocate";

const INSTRUCTIONS = `You are CNTXT, a client advocate embedded in a professional-services practice.

Who you are:
- You represent the CLIENT's interests inside the provider's systems. You are not a salesperson and not a gatekeeper.
- The session profile tells you who you are speaking with; greet returning clients by name and pick up where you left off — you remember them across the website, the kiosk, and the phone.

How you work an intake:
1. Listen first. Let the client explain in their own words. Ask one question at a time.
2. As soon as you have their full name, run check_conflict. If a conflict exists, explain plainly what that means for them and what their options are.
3. Collect contact details, then create_client and open_matter with an accurate practice area and jurisdiction.
4. When the picture is complete, start_file_workup with a goal written in the client's own voice.
5. Throughout the ENTIRE conversation, silently record_advocacy_note every time the client reveals a goal, concern, constraint, budget sensitivity, or preference. Never announce you are taking notes.

Advocacy duties:
- Translate legal/medical/financial jargon into plain language without being asked.
- Proactively explain what the provider will do next, roughly what things cost, and how long they take.
- If the client seems anxious, address the anxiety before the paperwork.
- If something is outside the provider's competence or an emergency (medical emergency, imminent court deadline, danger to a person), say so immediately and direct them to the right place.

Keep spoken replies short — two or three sentences — this is a voice conversation.`;

async function stockCompanion() {
  const stock = await napster.listStockCompanions();
  const pool = (stock?.items ?? stock ?? []).filter((c) => c.status === "completed");
  if (!pool.length) throw new Error("No usable stock companions available.");
  // Prefer a professional-register companion for the advocate role.
  const pick = pool.find((c) => /leader|interview|insight|professional/i.test(c.headline ?? "")) ?? pool[0];
  console.log(`✓ stock companion: ${pick.id} (${pick.firstName?.trim()} ${pick.lastName?.trim()})`);
  return pick.id;
}

async function ensureCompanion() {
  const existing = await napster.listCompanions();
  const list = existing?.items ?? existing ?? [];
  const found = list.find((c) => c.firstName === COMPANION.firstName && c.lastName === COMPANION.lastName);
  if (found?.status === "completed") {
    console.log(`✓ companion reused: ${found.id}`);
    return found.id;
  }
  try {
    const created = await napster.createCompanion(COMPANION);
    // Avatar generation is async; sessions can only be opened against a
    // companion whose status reaches "completed".
    for (let i = 0; i < 12; i++) {
      const check = await napster.getCompanion(created.id);
      if (check.status === "completed") {
        console.log(`✓ companion created: ${created.id}`);
        return created.id;
      }
      if (check.status === "failed") throw new Error("avatar generation failed");
      await new Promise((r) => setTimeout(r, 5000));
    }
    throw new Error("avatar generation timed out");
  } catch (err) {
    // Custom companion creation needs picture assets the hackathon key may not
    // provision; fall back to a Napster stock companion so setup never dead-ends.
    console.warn(`! custom companion unavailable (${err.message}) — using a stock companion`);
    return stockCompanion();
  }
}

async function ensureFunctions() {
  const existing = await napster.listFunctions();
  const list = existing?.items ?? existing ?? [];
  const byName = new Map(list.map((f) => [f.data?.name ?? f.name, f]));
  const ids = [];
  for (const tool of TOOLS) {
    const body = { data: tool.data, flow: tool.flow, ...(tool.prompt ? { prompt: tool.prompt } : {}) };
    const found = byName.get(tool.data.name);
    if (found) {
      await napster.updateFunction(found.id, body);
      console.log(`✓ function updated: ${tool.data.name} (${found.id})`);
      ids.push(found.id);
    } else {
      const created = await napster.createFunction(body);
      console.log(`✓ function created: ${tool.data.name} (${created.id})`);
      ids.push(created.id);
    }
  }
  return ids;
}

async function ensureAgent(companionId, functionIds) {
  const body = {
    companionId,
    name: AGENT_NAME,
    voiceId: "alloy",
    functions: functionIds,
    providerSettings: {
      temperature: 0.6,
      instructions: INSTRUCTIONS,
    },
  };
  const existing = await napster.listAgents();
  const list = existing?.items ?? existing ?? [];
  const found = list.find((a) => a.name === AGENT_NAME);
  if (found) {
    await napster.patchAgent(found.id, body);
    console.log(`✓ agent updated: ${found.id}`);
    return found.id;
  }
  const created = await napster.createAgent(body);
  console.log(`✓ agent created: ${created.id}`);
  return created.id;
}

const companionId = await ensureCompanion();
const functionIds = await ensureFunctions();
const agentId = await ensureAgent(companionId, functionIds);

await mkdir("config", { recursive: true });
await writeFile(
  "config/cntxt.agent.json",
  JSON.stringify({ agentId, companionId, functionIds, provisionedAt: new Date().toISOString() }, null, 2),
);
console.log(`\nCNTXT provisioned. agentId=${agentId}\n→ npm run dev (server) + npm run dev:web (web surface)`);
