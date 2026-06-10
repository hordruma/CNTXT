import "dotenv/config";
import express from "express";
import path from "node:path";
import { readFile } from "node:fs/promises";
import { napster } from "./napster.mjs";
import { dispatchTool, getAdvocacyBrief } from "./tools.mjs";

const PORT = Number(process.env.PORT) || 3100;
const app = express();
app.use(express.json());

async function agentConfig() {
  try {
    return JSON.parse(await readFile(path.resolve("config/cntxt.agent.json"), "utf8"));
  } catch {
    throw new Error("Agent not provisioned yet — run `npm run setup` first.");
  }
}

// Create a per-session connection for either surface. The same
// externalClientId on web and kiosk is what gives CNTXT one continuous
// memory of the client across surfaces.
app.post("/api/session", async (req, res) => {
  try {
    const { channelType = "webrtc", clientId, profile } = req.body ?? {};
    if (!clientId || !/^[A-Za-z0-9_-]{1,32}$/.test(clientId)) {
      return res.status(400).json({ error: "clientId is required: 1-32 chars of [A-Za-z0-9_-]" });
    }
    const { agentId } = await agentConfig();
    const connection = await napster.createConnection(agentId, {
      channelType,
      externalClientId: clientId,
      ...(profile ? { externalClientProfile: profile } : {}),
    });
    console.log(`[session] ${channelType} session for ${clientId}`);
    res.json(connection);
  } catch (err) {
    console.error("[session]", err.message);
    res.status(502).json({ error: err.message });
  }
});

// Runtime tool dispatch: surfaces forward `function_implicitly_called`
// events here; we bridge to BigLaw (or the demo backend) and return output.
app.post("/api/tools/:name", async (req, res) => {
  const { name } = req.params;
  try {
    const result = await dispatchTool(name, req.body);
    console.log(`[tool] ${name}(${JSON.stringify(req.body)}) → ${JSON.stringify(result).slice(0, 200)}`);
    res.json(result);
  } catch (err) {
    console.error(`[tool] ${name} failed:`, err.message);
    res.status(400).json({ error: err.message });
  }
});

// The advocacy brief: what the agent learned about this client's goals and
// concerns, ready for the provider to read before first contact.
app.get("/api/advocacy/:clientId", async (req, res) => {
  res.json(await getAdvocacyBrief(req.params.clientId));
});

// Serve the built web app in production; in dev, `npm run dev:web` (Vite)
// proxies /api here instead.
const dist = path.resolve("web/dist");
app.use(express.static(dist));

app.listen(PORT, () => {
  console.log(`CNTXT server → http://localhost:${PORT}`);
  console.log(`BigLaw bridge → ${process.env.BIGLAW_URL || "http://localhost:3101"} (falls back to demo backend if unreachable)`);
});
