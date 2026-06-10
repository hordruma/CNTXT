# CNTXT — your advocate, everywhere

**A cross-surface client-advocate agent for professional services, built on the
[Napster Omniagent API](https://developers.napster.com/docs) with end-to-end
[BigLaw](https://github.com/discover-legal/BigLaw) intake integration.**

Law firms, dental offices, medical practices, accountancies — every professional
service runs intake, and every client experiences it as a form with a pulse.
CNTXT replaces that with **Remy**: a persistent voice-and-video agent who works
for the *client*, not the firm. Remy does the intake — but as a **customer
advocate**: translating jargon, surfacing costs and timelines unprompted,
addressing anxiety before paperwork, and quietly compiling an **advocacy brief**
of what the client actually wants, so the provider can deliver their best work.

One agent. Every surface. The client who starts on the firm's website is greeted
by name at the front-desk kiosk — same memory, same relationship.

## What it demonstrates

| Omniagent capability | Where |
|---|---|
| **Cross-surface persistent memory** | Same `externalClientId` on the web portal (WebRTC) and the kiosk (WebSocket) → Remy remembers the client on every surface |
| **Voice + video avatar** | Web SDK widget on the portal (`web/`) |
| **Implicit tool calling** | Six custom functions bridged live to BigLaw (`server/tools.mjs`) |
| **Per-session personalization** | `externalClientProfile` carries name + surface into every session |
| **Agent-to-agent orchestration** | `start_file_workup` hands off to BigLaw's DyTopo multi-agent swarm (100+ agents) for engagement letters, deadlines, and document checklists |

## Architecture

```
                         Napster Omniagent API
                    (companion · agent · functions)
                          ▲              │
              session tokens      function_implicitly_called
                          │              ▼
┌─────────────┐    ┌─────────────────────────────┐    ┌──────────────────┐
│ Web portal   │    │  CNTXT server (Express)     │    │ BigLaw instance  │
│ WebRTC + SDK │◄──►│  /api/session               │◄──►│ conflict check   │
├─────────────┤    │  /api/tools/:name  ─────────┼───►│ clients/matters  │
│ Kiosk        │    │  /api/advocacy/:clientId    │    │ DyTopo swarm     │
│ WebSocket    │    │  (demo fallback if BigLaw   │    │ (or labeled demo │
└─────────────┘    │   is unreachable)           │    │  fallback)       │
                    └─────────────────────────────┘    └──────────────────┘
```

Tools use the **implicit flow**: the agent's call is delivered to whichever
surface the client is on, forwarded to the local CNTXT server, bridged to
BigLaw, and answered with `send_function_output` — no public webhook needed,
runs entirely on localhost.

### The six tools

1. `check_conflict` — conflict-of-interest screen before any engagement
2. `create_client` — client record in the practice-management system
3. `open_matter` — opens the file (practice area, jurisdiction)
4. `start_file_workup` — kicks off BigLaw's back-office agent swarm; the `goal`
   is phrased **in the client's own words** — their voice travels into the system
5. `get_file_status` — progress check on the workup
6. `record_advocacy_note` — silently captures goals, concerns, constraints, and
   preferences throughout the conversation → the provider's advocacy brief

## Run it

```bash
npm install
cp .env.example .env        # add your NAPSTER_API_KEY
npm run setup               # provisions companion + functions + agent (idempotent)
npm run dev                 # CNTXT server on :3100
npm run dev:web             # web portal on :5180 (Vite, proxies /api)
```

**Surface 1 — web portal:** open http://localhost:5180, give your name, talk to
Remy. The right-hand panel shows file-startup progress and the advocacy brief
forming in real time.

**Surface 2 — front-desk kiosk:** in another terminal, with the *same* identity:

```bash
npm run kiosk -- --user jane-doe --name "Jane Doe"
```

Remy greets the returning client with full memory of the web conversation.

**Advocacy brief for the provider:**

```bash
curl localhost:3100/api/advocacy/jane-doe
```

### BigLaw

Point `BIGLAW_URL` at a running [BigLaw](https://github.com/discover-legal/BigLaw)
instance for live conflict checks, client/matter creation, and swarm-driven file
workup. Without one, every tool falls back to a deterministic in-memory demo
backend — responses are explicitly tagged `"backend": "demo"` and the UI shows a
"BigLaw: demo mode" chip. Nothing ever pretends to be live.

## Repo map

```
server/    Express server: session minting, tool bridge, advocacy briefs
  napster.mjs   Omniagent API client
  biglaw.mjs    BigLaw bridge + labeled demo fallback
  tools.mjs     tool definitions (registered with Napster) + dispatch
scripts/   setup-agent.mjs — idempotent provisioning
web/       client portal (Vite + Web SDK, WebRTC video avatar)
clients/   kiosk.mjs — WebSocket surface, same agent, same memory
config/    provisioned agent IDs (generated by setup)
data/      advocacy briefs (generated at runtime)
```

## Honest limitations

- The kiosk uses the documented `send_message` text command rather than PCM
  audio streaming, keeping the second surface dependency-free; the WebSocket
  channel itself is audio-native.
- Custom companion avatar generation rejected our brand portrait (resolution
  below the pipeline's minimum), so the agent currently wears a Napster stock
  companion face. `scripts/setup-agent.mjs` already handles the custom path,
  polling, and graceful fallback.
- Hackathon API keys are time-boxed; re-run `npm run setup` with your own key
  to re-provision from scratch.

---

Built solo for the **Napster Omniagent API Hackathon** (Microsoft Build 2026).
