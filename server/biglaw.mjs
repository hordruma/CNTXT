// Bridge to a BigLaw instance (https://github.com/discover-legal/BigLaw).
//
// CNTXT drives BigLaw's intake surface end-to-end: conflict check → client
// creation → matter creation → task kickoff (which fans out to BigLaw's own
// DyTopo agent swarm — agent-to-agent orchestration across two platforms).
//
// If no BigLaw instance is reachable at BIGLAW_URL, every call falls back to a
// deterministic in-memory demo backend. Fallback responses are explicitly
// tagged `"backend": "demo"` so nothing ever pretends to be a live system.

const BIGLAW_URL = process.env.BIGLAW_URL || "http://localhost:3101";

// ---------------------------------------------------------------------------
// In-memory demo backend (used only when BigLaw is unreachable)
// ---------------------------------------------------------------------------
const demo = {
  clients: new Map(),
  matters: new Map(),
  tasks: new Map(),
  nextId: 1,
  id(prefix) { return `${prefix}-${String(this.nextId++).padStart(4, "0")}`; },
};

async function bigLawFetch(method, path, body) {
  const res = await fetch(`${BIGLAW_URL}${path}`, {
    method,
    headers: body ? { "Content-Type": "application/json" } : {},
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(6000),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`BigLaw ${method} ${path} → ${res.status}: ${JSON.stringify(data)}`);
  return { backend: "biglaw", ...data };
}

// Try live BigLaw first; on connection failure run the demo equivalent.
async function withFallback(live, fallback) {
  try {
    return await live();
  } catch (err) {
    const reason = err.cause?.code || err.name || err.message;
    console.warn(`[biglaw] live call failed (${reason}) — using demo backend`);
    return { backend: "demo", note: "BigLaw instance unreachable; deterministic demo data.", ...(await fallback()) };
  }
}

export const biglaw = {
  checkConflict({ clientName }) {
    return withFallback(
      () => bigLawFetch("POST", "/clients/check-conflict", { clientName }),
      () => {
        // Demo rule: any name containing "acme" trips a conflict so the
        // conflict path is demonstrable on camera.
        const conflict = /acme/i.test(clientName);
        return {
          clientName,
          conflict,
          details: conflict
            ? "Existing engagement for Acme Corp (M-2024-117) — adverse party overlap."
            : "No conflicts found against the current client roster.",
        };
      },
    );
  },

  createClient({ name, email, phone }) {
    return withFallback(
      () => bigLawFetch("POST", "/clients", { name, email, phone }),
      () => {
        const id = demo.id("CL");
        const client = { id, name, email, phone, createdAt: new Date().toISOString() };
        demo.clients.set(id, client);
        return client;
      },
    );
  },

  openMatter({ clientId, displayName, practiceArea, jurisdiction }) {
    const matterNumber = `M-${new Date().getFullYear()}-${String(Math.abs(hash(displayName)) % 900 + 100)}`;
    return withFallback(
      () => bigLawFetch("POST", `/clients/${clientId}/matters`, { matterNumber, displayName, practiceArea, jurisdiction }),
      () => {
        const matter = { matterNumber, clientId, displayName, practiceArea, jurisdiction, status: "open" };
        demo.matters.set(matterNumber, matter);
        return matter;
      },
    );
  },

  submitIntakeTask({ matterNumber, goal }) {
    return withFallback(
      () => bigLawFetch("POST", "/tasks", { type: "roundtable", matterNumber, goal }),
      () => {
        const id = demo.id("T");
        const task = {
          id, matterNumber, goal, status: "running",
          swarm: "DyTopo roundtable — T0 orchestrator + 4 managers + specialist pool",
          submittedAt: new Date().toISOString(),
        };
        demo.tasks.set(id, task);
        return task;
      },
    );
  },

  getTaskStatus({ taskId }) {
    return withFallback(
      () => bigLawFetch("GET", `/tasks/${taskId}`),
      () => {
        const task = demo.tasks.get(taskId);
        if (!task) return { taskId, status: "not_found" };
        return {
          ...task,
          status: "complete",
          summary: "File startup complete: engagement letter drafted, deadline chart computed, document checklist issued to client portal.",
        };
      },
    );
  },
};

function hash(s) {
  let h = 0;
  for (const c of s) h = (h * 31 + c.charCodeAt(0)) | 0;
  return h;
}
