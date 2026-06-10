# Submission package — Napster Omniagent API Hackathon

**To:** hackathon@napster.com
**Deadline:** June 9, 11:59 PM ET (extended)

---

## Email body (copy-paste)

**Subject:** Hackathon submission — CNTXT: your advocate, everywhere

Hi Napster team,

Submitting **CNTXT** for the Omniagent API Hackathon.

**Repo:** https://github.com/hordruma/CNTXT
**Demo video:** [LINK — attach or paste unlisted YouTube/Drive link]

**Description:**

CNTXT is a client-advocate agent for professional services — law firms, dental
and medical offices, accountancies. Its agent, Remy, flips the intake script:
instead of a gatekeeper that interrogates prospects, Remy is the *client's*
advocate inside the provider's systems. Remy runs full legal intake by voice —
conflict check, client record, matter opening, then hands off to BigLaw
(github.com/discover-legal/BigLaw), an open-source legal AI platform, whose
100+ agent DyTopo swarm completes file startup: engagement letter, deadline
computation, document checklist. Agent-to-agent orchestration across two
platforms, triggered by conversation.

What makes it an *Omniagent* build: the same client is recognized across
surfaces. Start on the firm's web portal (WebRTC video avatar via the Web SDK),
walk up to the front-desk kiosk (raw WebSocket channel) — Remy greets you by
name and picks up mid-thread, via externalClientId-scoped memory. Six custom
implicit-flow functions bridge the conversation to BigLaw's REST API, with a
deterministic, clearly-labeled fallback so judges can run the repo standalone.
Throughout every conversation Remy silently compiles an "advocacy brief" — the
client's goals, anxieties, budget constraints, preferences — delivered to the
provider with the opened file, so the firm starts the engagement already
knowing what the client actually needs.

Voice of the customer, with a file number.

Thanks — had a blast with the API.

Horatiu
h@discover.legal

---

## 60-second demo video script

| t | Shot | Say |
|---|------|-----|
| 0–8s | Title card / portal landing | "This is CNTXT — a client advocate for law firms, dental offices, any professional service. Built on the Napster Omniagent API." |
| 8–30s | Web portal, talking to Remy | Give your name, describe a slip-and-fall. Let Remy run the conflict check and open the file — point at the right-hand panel as steps light up: "Conflict check, client record, matter opened — and now it's handing off to BigLaw's hundred-agent swarm for full file startup." |
| 30–40s | Advocacy feed close-up | "And the whole time, Remy's been quietly building an advocacy brief — what I want, what I'm worried about. The firm gets my voice, not just my paperwork." |
| 40–55s | Kiosk terminal, same name | "Now I walk up to the front-desk kiosk — different channel, same agent." Remy greets you by name with memory of the web chat. "Web to kiosk to phone — one agent, every surface." |
| 55–60s | Repo / title card | "CNTXT. Your advocate, everywhere." |

**Recording checklist:**
- `npm run dev` + `npm run dev:web` running; mic allowed in browser
- Use a fresh client name (memory demo works best clean): e.g. "Maya Brennan"
- Kiosk: `npm run kiosk -- --user maya-brennan --name "Maya Brennan"`
- If asked about costs in the web session, Remy's cost-anxiety handling is a
  great on-camera moment — say "I'm worried about what this will cost"
