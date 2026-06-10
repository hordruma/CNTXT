// CNTXT tool definitions — registered once with the Napster Omniagent API
// (POST /public/functions, flow: "implicit") and dispatched at runtime by
// whichever surface the client is on (web avatar or kiosk).
//
// Implicit flow means the agent's tool call is delivered to the connected
// client as a `function_implicitly_called` event; the client forwards it to
// this server (POST /api/tools/:name), and returns the result with a
// `send_function_output` command. Everything runs locally — no tunnel needed.

import { biglaw } from "./biglaw.mjs";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";

const NOTES_DIR = path.resolve("data");

// --- The "voice of the customer" layer -------------------------------------
// CNTXT is a client advocate, not a form-filler. Throughout the conversation
// it records what the client actually wants, worries about, and expects —
// then hands the provider an advocacy brief alongside the opened file.
async function saveAdvocacyNote({ clientId, category, note }) {
  await mkdir(NOTES_DIR, { recursive: true });
  const file = path.join(NOTES_DIR, `advocacy-${sanitize(clientId)}.json`);
  let brief = { clientId, notes: [] };
  try { brief = JSON.parse(await readFile(file, "utf8")); } catch { /* first note */ }
  brief.notes.push({ category, note, at: new Date().toISOString() });
  await writeFile(file, JSON.stringify(brief, null, 2));
  return { saved: true, totalNotes: brief.notes.length };
}

export async function getAdvocacyBrief(clientId) {
  try {
    return JSON.parse(await readFile(path.join(NOTES_DIR, `advocacy-${sanitize(clientId)}.json`), "utf8"));
  } catch {
    return { clientId, notes: [] };
  }
}

function sanitize(s) { return String(s).replace(/[^A-Za-z0-9_-]/g, "_").slice(0, 32); }

// --- Tool registry ----------------------------------------------------------
export const TOOLS = [
  {
    data: {
      name: "check_conflict",
      description: "Run a conflict-of-interest check against the firm's client roster before any engagement. Always run this before creating a client.",
      parameters: {
        type: "object",
        properties: {
          clientName: { type: "string", description: "Full legal name of the prospective client or company" },
        },
        required: ["clientName"],
      },
    },
    flow: "implicit",
    prompt: "Call this as soon as you know the prospective client's full name, before collecting further intake details.",
    handler: (args) => biglaw.checkConflict(args),
  },
  {
    data: {
      name: "create_client",
      description: "Create the client record in the practice management system once the conflict check is clear.",
      parameters: {
        type: "object",
        properties: {
          name: { type: "string", description: "Client full name" },
          email: { type: "string", description: "Client email address" },
          phone: { type: "string", description: "Client phone number" },
        },
        required: ["name"],
      },
    },
    flow: "implicit",
    prompt: "Only call after check_conflict returns no conflict and the client has confirmed their contact details.",
    handler: (args) => biglaw.createClient(args),
  },
  {
    data: {
      name: "open_matter",
      description: "Open a new matter (file) for a client: practice area, jurisdiction, and a short descriptive name.",
      parameters: {
        type: "object",
        properties: {
          clientId: { type: "string", description: "Client ID returned by create_client" },
          displayName: { type: "string", description: "Short matter description, e.g. 'Slip and fall — Riverside Mall'" },
          practiceArea: { type: "string", description: "e.g. personal-injury, family, corporate, real-estate, dental-records" },
          jurisdiction: { type: "string", description: "e.g. ontario, us-federal, new-york" },
        },
        required: ["clientId", "displayName", "practiceArea"],
      },
    },
    flow: "implicit",
    handler: (args) => biglaw.openMatter(args),
  },
  {
    data: {
      name: "start_file_workup",
      description: "Kick off the provider's back-office agent swarm to complete file startup: engagement letter, deadline computation, document checklist.",
      parameters: {
        type: "object",
        properties: {
          matterNumber: { type: "string", description: "Matter number returned by open_matter" },
          goal: { type: "string", description: "One-paragraph statement of what the client needs, in the client's own words" },
        },
        required: ["matterNumber", "goal"],
      },
    },
    flow: "implicit",
    prompt: "Phrase `goal` from the client's perspective — this is their voice travelling into the provider's system.",
    handler: (args) => biglaw.submitIntakeTask(args),
  },
  {
    data: {
      name: "get_file_status",
      description: "Check the status of a file workup task previously started with start_file_workup.",
      parameters: {
        type: "object",
        properties: {
          taskId: { type: "string", description: "Task ID returned by start_file_workup" },
        },
        required: ["taskId"],
      },
    },
    flow: "implicit",
    handler: (args) => biglaw.getTaskStatus(args),
  },
  {
    data: {
      name: "record_advocacy_note",
      description: "Record something the client wants, worries about, or expects — their goals, constraints, anxieties, budget sensitivity, preferred communication style. These notes become the advocacy brief handed to the provider with the opened file.",
      parameters: {
        type: "object",
        properties: {
          clientId: { type: "string", description: "Stable client identifier (the externalClientId for this session)" },
          category: { type: "string", description: "goal | concern | constraint | preference | expectation" },
          note: { type: "string", description: "The observation, in plain language" },
        },
        required: ["clientId", "category", "note"],
      },
    },
    flow: "implicit",
    prompt: "Use this liberally and silently throughout the conversation — every time the client reveals what matters to them. Do not announce that you are taking notes.",
    handler: (args) => saveAdvocacyNote(args),
  },
];

export async function dispatchTool(name, args) {
  const tool = TOOLS.find((t) => t.data.name === name);
  if (!tool) throw new Error(`Unknown tool: ${name}`);
  return tool.handler(args ?? {});
}
