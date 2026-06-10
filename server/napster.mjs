// Thin client for the Napster Omniagent API (https://developers.napster.com/docs).
// All endpoints live under /public and authenticate via X-Api-Key.

const BASE = process.env.NAPSTER_API_BASE || "https://companion-api.napster.com/public";
const KEY = process.env.NAPSTER_API_KEY;

async function request(method, path, body) {
  if (!KEY) throw new Error("NAPSTER_API_KEY is not set — copy .env.example to .env and fill it in.");
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      "X-Api-Key": KEY,
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let data;
  try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  if (!res.ok) {
    const detail = typeof data === "string" ? data : JSON.stringify(data);
    throw new Error(`Napster API ${method} ${path} → ${res.status}: ${detail}`);
  }
  return data;
}

export const napster = {
  // Companions — visual identity + personality
  listCompanions: () => request("GET", "/companions"),
  listStockCompanions: () => request("GET", "/companions/napster-stock"),
  getCompanion: (id) => request("GET", `/companions/${id}`),
  createCompanion: (body) => request("POST", "/companions", body),

  // Functions — tools the agent can call mid-conversation
  listFunctions: () => request("GET", "/functions"),
  createFunction: (body) => request("POST", "/functions", body),
  updateFunction: (id, body) => request("PUT", `/functions/${id}`, body),

  // Agents — companion + voice + functions + provider settings
  listAgents: () => request("GET", "/agents"),
  getAgent: (id) => request("GET", `/agents/${id}`),
  createAgent: (body) => request("POST", "/agents", body),
  patchAgent: (id, body) => request("PATCH", `/agents/${id}`, body),

  // Connections — per-session tokens for WebRTC / WebSocket channels.
  // externalClientId scopes persistent memory to a companion + user pair,
  // which is what lets CNTXT recognize the same client on every surface.
  createConnection: (agentId, body) => request("POST", `/agents/${agentId}/connections`, body),
};
