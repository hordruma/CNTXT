import { NapsterCompanionApiSdk } from "@touchcastllc/napster-companion-api";
import "@touchcastllc/napster-companion-api/styles";

const $ = (sel) => document.querySelector(sel);

// Stable client identity. The same ID used at the kiosk (clients/kiosk.mjs)
// or on the phone is what makes Remy one continuous person across surfaces.
function clientIdFor(name) {
  return name.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 32);
}

$("#gate-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const name = $("#client-name").value.trim();
  if (!name) return;
  $("#gate-error").hidden = true;
  e.target.querySelector("button").disabled = true;
  try {
    await startSession(name);
  } catch (err) {
    console.error(err);
    $("#gate-error").textContent = `Couldn't start the session: ${err.message}`;
    $("#gate-error").hidden = false;
    e.target.querySelector("button").disabled = false;
  }
});

async function startSession(name) {
  const clientId = clientIdFor(name);
  localStorage.setItem("cntxt.clientId", clientId);

  const res = await fetch("/api/session", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      channelType: "webrtc",
      clientId,
      profile: { name, surface: "web-portal", firm: "Hartwell & Cole LLP" },
    }),
  });
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || `HTTP ${res.status}`);
  const { token } = await res.json();

  $("#gate").hidden = true;
  $("#session").hidden = false;
  $("#client-chip").textContent = `${name} · web portal`;

  const instance = await NapsterCompanionApiSdk.init(token, {
    mountContainer: "#avatar-container",
    onData: (event) => handleEvent(instance, clientId, event),
  });

  // SDK builds vary in how they surface session events; attach to whichever
  // emitter shape this build exposes so no tool call is ever missed.
  for (const attach of ["on", "addEventListener", "subscribe"]) {
    if (typeof instance?.[attach] === "function") {
      try { instance[attach]("data", (ev) => handleEvent(instance, clientId, ev)); } catch { /* shape mismatch */ }
      break;
    }
  }
  window.cntxt = { instance, clientId }; // console access for debugging/demo
}

const handledCalls = new Set();

async function handleEvent(instance, clientId, event) {
  const payload = typeof event === "string" ? safeParse(event) : event;
  // Server events arrive as { event: "<name>", data: {...} }.
  const kind = payload?.event ?? payload?.type;
  if (!kind) return;
  console.debug("[cntxt event]", kind, payload);

  if (kind === "function_implicitly_called") {
    const { name, arguments: rawArgs, call_id } = payload.data ?? payload;
    if (handledCalls.has(call_id)) return;
    handledCalls.add(call_id);
    await runTool(instance, clientId, { name, rawArgs, call_id });
  }
}

async function runTool(instance, clientId, { name, rawArgs, call_id }) {
  const args = typeof rawArgs === "string" ? safeParse(rawArgs) ?? {} : (rawArgs ?? {});
  // The agent doesn't know its own session identifiers — inject ours so
  // advocacy notes land in this client's brief.
  if (name === "record_advocacy_note") args.clientId = clientId;

  let output;
  try {
    const res = await fetch(`/api/tools/${encodeURIComponent(name)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(args),
    });
    output = await res.json();
  } catch (err) {
    output = { error: `tool bridge failed: ${err.message}` };
  }

  instance.sendCommand({
    type: "send_function_output",
    data: { call_id, output: JSON.stringify(output), delay: false },
  });

  reflectInUI(name, args, output);
}

// --- Telemetry panel: makes the invisible plumbing visible on camera --------
function reflectInUI(name, args, output) {
  const step = document.querySelector(`#intake-steps li[data-step="${name}"]`);
  if (step) {
    step.classList.add(output?.error ? "failed" : "done");
    const detail = {
      check_conflict: output?.conflict ? `⚠ ${output.details}` : "clear",
      create_client: output?.id ?? "",
      open_matter: output?.matterNumber ?? "",
      start_file_workup: output?.id ? `task ${output.id}` : "",
    }[name];
    if (detail) step.dataset.detail = detail;
  }
  if (name === "record_advocacy_note" && !output?.error) {
    const feed = $("#advocacy-feed");
    feed.querySelector(".empty")?.remove();
    const li = document.createElement("li");
    li.innerHTML = `<b>${escapeHtml(args.category ?? "note")}</b> ${escapeHtml(args.note ?? "")}`;
    feed.prepend(li);
  }
  if (output?.backend) {
    const chip = $("#backend-chip");
    chip.hidden = false;
    chip.textContent = output.backend === "biglaw" ? "BigLaw: live" : "BigLaw: demo mode";
    chip.className = output.backend === "biglaw" ? "live" : "demo";
  }
}

function safeParse(s) { try { return JSON.parse(s); } catch { return null; } }
function escapeHtml(s) { return String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c])); }
