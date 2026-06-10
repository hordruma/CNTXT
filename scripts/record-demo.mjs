// Remy records her own demo: drives a scripted session over the WebSocket
// channel, captures her spoken audio (16-bit PCM, 16 kHz mono), and writes
// docs/demo-audio.wav. Mux with her portrait via ffmpeg (see npm run demo:video).
import "dotenv/config";
import WebSocket from "ws";
import { writeFile, mkdir } from "node:fs/promises";

const CUES = [
  "Stage direction: you are recording your own 60-second hackathon demo video. Introduce yourself in two warm sentences: you're Remy, the CNTXT client advocate for professional services — law firms, dental and medical offices — built on the Napster Omniagent API, and unlike an intake form, you work for the client.",
  "Stage direction: demonstrate a real intake, live, narrating briefly as you actually do it for demo client Maya Brennan (maya@example.com, 416-555-0190), a slip-and-fall outside Riverside Mall in Ontario: run the conflict check, create her client record, open the matter, and start the BigLaw file workup, and say that BigLaw's hundred-agent swarm takes it from here. Keep it under twenty seconds of speech.",
  "Stage direction: explain in two sentences that the whole time you quietly build an advocacy brief — the client's goals, worries, and budget — so the firm starts the engagement knowing what the client actually needs. Record two advocacy notes for Maya now: her goal of fair compensation, and her worry about legal costs.",
  "Stage direction: explain in two sentences that you follow the client across every surface — web portal, front-desk kiosk, phone — one agent, one memory, so Maya is greeted by name wherever she shows up.",
  "Stage direction: sign off the video in one line: CNTXT — your advocate, everywhere.",
];

const SERVER = process.env.CNTXT_SERVER || `http://localhost:${process.env.PORT || 3100}`;
const clientId = "maya-brennan-demo";

const r = await fetch(`${SERVER}/api/session`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ channelType: "websocket", clientId, profile: { name: "Maya Brennan", surface: "demo-recording" } }),
});
const { token } = await r.json();
const d = JSON.parse(Buffer.from(token, "base64").toString());
const ws = new WebSocket(d.url.replace(/^http/, "ws"), { headers: { Authorization: `Bearer ${d.token}` } });

const chunks = [];
const handled = new Set();
let cueIdx = 0;
let lastAudio = 0;
let speaking = false;

function cue() {
  if (cueIdx >= CUES.length) return finish();
  console.log(`[cue ${cueIdx + 1}/${CUES.length}]`);
  ws.send(JSON.stringify({ type: "send_message", data: { role: "system", text: CUES[cueIdx++], trigger_response: true, delay: false } }));
  speaking = false;
}

ws.on("open", () => { console.log("[connected]"); setTimeout(cue, 1500); });

ws.on("message", async (raw) => {
  let ev; try { ev = JSON.parse(raw.toString()); } catch { return; }
  switch (ev.event ?? ev.type) {
    case "audio_received": {
      const b64 = ev.data?.data;
      if (b64) { chunks.push(Buffer.from(b64, "base64")); lastAudio = Date.now(); speaking = true; }
      break;
    }
    case "function_implicitly_called": {
      const { name, arguments: rawArgs, call_id } = ev.data ?? {};
      if (handled.has(call_id)) break;
      handled.add(call_id);
      const args = typeof rawArgs === "string" ? JSON.parse(rawArgs || "{}") : (rawArgs ?? {});
      if (name === "record_advocacy_note") args.clientId = clientId;
      console.log(`  ⚙ ${name}`);
      const res = await fetch(`${SERVER}/api/tools/${name}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(args) });
      ws.send(JSON.stringify({ type: "send_function_output", data: { call_id, output: JSON.stringify(await res.json()), delay: false } }));
      break;
    }
  }
});

// Advance when she has spoken and then been silent for 2.5s.
const pacer = setInterval(() => {
  if (speaking && Date.now() - lastAudio > 2500) {
    chunks.push(Buffer.alloc(16000 * 2 * 0.4)); // 0.4s beat between segments
    cue();
  }
}, 250);
setTimeout(finish, 240000); // hard cap

async function finish() {
  clearInterval(pacer);
  const pcm = Buffer.concat(chunks);
  const wav = Buffer.concat([wavHeader(pcm.length, 16000, 1, 16), pcm]);
  await mkdir("docs", { recursive: true });
  await writeFile("docs/demo-audio.wav", wav);
  console.log(`[saved] docs/demo-audio.wav (${(pcm.length / 32000).toFixed(1)}s of speech)`);
  ws.close();
  process.exit(0);
}

function wavHeader(dataLen, rate, channels, bits) {
  const h = Buffer.alloc(44);
  h.write("RIFF", 0); h.writeUInt32LE(36 + dataLen, 4); h.write("WAVE", 8);
  h.write("fmt ", 12); h.writeUInt32LE(16, 16); h.writeUInt16LE(1, 20);
  h.writeUInt16LE(channels, 22); h.writeUInt32LE(rate, 24);
  h.writeUInt32LE(rate * channels * bits / 8, 28); h.writeUInt16LE(channels * bits / 8, 32);
  h.writeUInt16LE(bits, 34); h.write("data", 36); h.writeUInt32LE(dataLen, 40);
  return h;
}
