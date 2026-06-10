// CNTXT kiosk — the second surface.
//
// Connects to the SAME agent over the raw WebSocket channel with the SAME
// externalClientId used on the web portal, so Remy greets the client as a
// continuing conversation: web → kiosk with memory intact.
//
// The WebSocket channel is audio-native; this kiosk uses the documented
// `send_message` text command for input and prints assistant transcript
// events, which keeps the demo dependency-free on any machine. Tool calls
// (`function_implicitly_called`) are bridged to the CNTXT server exactly as
// the browser does it.
//
// Usage:  npm run kiosk -- --user jane-doe [--name "Jane Doe"]

import "dotenv/config";
import WebSocket from "ws";
import readline from "node:readline";

const args = process.argv.slice(2);
function arg(flag, fallback) {
  const i = args.indexOf(flag);
  return i >= 0 && args[i + 1] ? args[i + 1] : fallback;
}

const clientId = arg("--user");
const displayName = arg("--name", clientId);
const SERVER = process.env.CNTXT_SERVER || `http://localhost:${process.env.PORT || 3100}`;

if (!clientId || !/^[A-Za-z0-9_-]{1,32}$/.test(clientId)) {
  console.error("Usage: npm run kiosk -- --user <client-id> [--name \"Full Name\"]");
  console.error("Use the same client id as the web portal (lowercase name, dashes) to demonstrate cross-surface memory.");
  process.exit(1);
}

console.log(`\n┌─ CNTXT kiosk ─ Hartwell & Cole LLP front desk`);
console.log(`│ client: ${displayName} (${clientId})`);
console.log(`└─ requesting session…\n`);

const sessionRes = await fetch(`${SERVER}/api/session`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    channelType: "websocket",
    clientId,
    profile: { name: displayName, surface: "front-desk-kiosk", firm: "Hartwell & Cole LLP" },
  }),
});
if (!sessionRes.ok) {
  console.error(`Session failed: ${(await sessionRes.json().catch(() => ({}))).error || sessionRes.status}`);
  process.exit(1);
}
const session = await sessionRes.json();

// The websocket token decodes to the endpoint URL + an auth token.
const decoded = JSON.parse(Buffer.from(session.token, "base64").toString("utf8"));
const wsUrl = (decoded.url ?? "").replace(/^http/, "ws"); // endpoint is issued as https://
const authToken = decoded.token;
if (!wsUrl || !authToken) {
  console.error("Unexpected token shape:", Object.keys(decoded));
  process.exit(1);
}

const ws = new WebSocket(wsUrl, { headers: { Authorization: `Bearer ${authToken}` } });
const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
const handledCalls = new Set();
let assistantLine = "";

ws.on("open", () => {
  console.log("connected — Remy is listening. Type and press Enter. Ctrl+C to leave.\n");
  prompt();
});

ws.on("message", async (raw) => {
  let event;
  try { event = JSON.parse(raw.toString()); } catch { return; } // binary audio frames etc.

  // Server events arrive as { event: "<name>", data: {...} }.
  switch (event.event ?? event.type) {
    case "message_received": {
      const m = event.data?.message ?? {};
      if (m.role === "assistant" && m.action === "delta" && m.content) {
        assistantLine += m.content;
        process.stdout.write(m.content);
      } else if (m.role === "assistant" && m.action === "completed" && m.type === "message" && m.content) {
        if (!assistantLine) console.log(`Remy: ${m.content}`);
        assistantLine = "";
        console.log("");
        prompt();
      }
      break;
    }
    case "function_implicitly_called": {
      const { name, arguments: rawArgs, call_id } = event.data ?? {};
      if (handledCalls.has(call_id)) break;
      handledCalls.add(call_id);
      const toolArgs = typeof rawArgs === "string" ? JSON.parse(rawArgs || "{}") : (rawArgs ?? {});
      if (name === "record_advocacy_note") toolArgs.clientId = clientId;
      console.log(`\n  ⚙ ${name}(${JSON.stringify(toolArgs)})`);
      let output;
      try {
        const res = await fetch(`${SERVER}/api/tools/${encodeURIComponent(name)}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(toolArgs),
        });
        output = await res.json();
      } catch (err) {
        output = { error: `tool bridge failed: ${err.message}` };
      }
      console.log(`  → ${JSON.stringify(output).slice(0, 160)}`);
      ws.send(JSON.stringify({
        type: "send_function_output",
        data: { call_id, output: JSON.stringify(output), delay: false },
      }));
      break;
    }
    case "error":
      console.error("\n[server error]", JSON.stringify(event.data ?? event));
      break;
  }
});

ws.on("close", (code) => { console.log(`\nsession ended (${code})`); process.exit(0); });
ws.on("error", (err) => { console.error("\nws error:", err.message); process.exit(1); });

function prompt() {
  rl.question("you: ", (text) => {
    if (!text.trim()) return prompt();
    process.stdout.write("Remy: ");
    ws.send(JSON.stringify({
      type: "send_message",
      data: { role: "user", text: text.trim(), trigger_response: true, delay: false },
    }));
  });
}
