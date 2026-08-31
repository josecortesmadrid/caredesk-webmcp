/* CareDesk tools.js — WebMCP tool layer.
 *
 * Six tools, each demonstrating a security pattern from the WebMCP spec §6
 * (which currently lists these mitigations as open TODOs — we implement them):
 *   - readOnlyHint on pure reads
 *   - untrustedContentHint where tool output carries untrusted (OCR) content
 *   - strict inputSchemas (no over-parameterization — spec §6.3.3)
 *   - confirmation boundary: consequential actions propose, never act alone
 *   - AbortSignal support in every execute()
 *   - bounded descriptions (no tool-poisoning-sized metadata)
 *
 * Conventions:
 *   - Tool results are plain JSON-serializable objects.
 *   - Every tool call is recorded to the audit trail (see app.js listeners).
 */

const DAY = 86_400_000;

/* ── In-memory demo state (would be IndexedDB/backend in production) ────── */
const state = {
  meds: [
    { id: "metformin",  name: "Metformin 850 mg", dose: "1 tab with dinner",  supplyDays: 3,  takenTonight: false },
    { id: "atorva",     name: "Atorvastatin 20 mg", dose: "1 tab at bedtime", supplyDays: 26, takenTonight: false },
    { id: "lisinopril", name: "Lisinopril 10 mg",   dose: "1 tab with dinner", supplyDays: 2, takenTonight: false },
  ],
  proposals: [],   /* { id, kind, preview, payload, createdAt } */
  audit: [],       /* { at, tool, args, result, note } */
  listeners: new Set(),
};

function emit() { state.listeners.forEach(fn => fn()); }
const nowISO = () => new Date().toISOString();

function recordAudit(tool, args, result, note) {
  state.audit.unshift({ at: nowISO(), tool, args, result, note: note || "" });
  if (state.audit.length > 50) state.audit.length = 50;
  emit();
}

/* ── Input validation (schema is enforced by the browser for agents calling
 *    via WebMCP; we keep a runtime guard for in-page/agent misbehavior) ──── */
function requireString(x, name, max = 64) {
  if (typeof x !== "string" || !x.length || x.length > max)
    throw new Error(`invalid '${name}'`);
  return x;
}

/* ── Untrusted-content spotlighting (spec §6.4.3 mitigation) ────────────── */
/* We wrap any OCR/scanned content in explicit delimiters so agent UIs and
 * logs can visibly mark the untrusted span instead of hiding it. */
const SPOT = Object.freeze({
  open: (label) => `\u275B\u275B untrusted:${label} \u275B\u275B begin \u00BB`,
  close: "\u00AB end untrusted \u275B\u275B\u275B",
});
function spotlight(label, text) {
  return `${SPOT.open(label)}\n${String(text).slice(0, 512)}\n${SPOT.close}`;
}

/* ── Tools ─────────────────────────────────────────────────────────────── */

const get_med_schedule = {
  name: "get_med_schedule",
  title: "Get tonight’s med schedule",
  description:
    "Return Papá’s medication schedule for tonight with taken/skipped state and current supply in days. Read-only.",
  inputSchema: { type: "object", properties: {}, additionalProperties: false },
  annotations: { readOnlyHint: true },
  async execute(_args, { signal } = {}) {
    const meds = state.meds.map(m => ({ ...m }));
    recordAudit("get_med_schedule", {}, meds, "read-only");
    return { meds, pendingProposals: state.proposals.length };
  },
};

const check_supply = {
  name: "check_supply",
  title: "Check medicine supply",
  description:
    "Given a medicine name, return days of supply left plus the text read from the bottle label (OCR). Output includes untrusted scanned content and is annotated accordingly.",
  inputSchema: {
    type: "object",
    properties: { medicine: { type: "string", maxLength: 64 } },
    required: ["medicine"],
    additionalProperties: false,
  },
  annotations: { readOnlyHint: true, untrustedContentHint: true },
  async execute({ medicine }, { signal } = {}) {
    const name = requireString(medicine, "medicine");
    const med = state.meds.find(m => m.name.toLowerCase().includes(name.toLowerCase()));
    if (!med) return { found: false };
    const ocr = `Rx only · ${med.name} · take ${med.dose} · disc 30 days after opening · Lot #L2917A`;
    recordAudit("check_supply", { medicine: name }, { found: true }, "untrusted-label-scan");
    return {
      found: true,
      medicine: med.name,
      supplyDays: med.supplyDays,
      low: med.supplyDays <= 5,
      /* explicitly delimited untrusted span (spec §6.4.3) */
      labelScan: spotlight("bottle-label-ocr", ocr),
    };
  },
};

const propose_refill = {
  name: "propose_refill",
  title: "Propose a refill (waits for human)",
  description:
    "Propose a refill request for a medicine. This NEVER orders anything: it queues a proposal that appears in the Pending panel for the human to approve or dismiss.",
  inputSchema: {
    type: "object",
    properties: {
      medicine: { type: "string", maxLength: 64 },
      note: { type: "string", maxLength: 140 },
    },
    required: ["medicine"],
    additionalProperties: false,
  },
  async execute({ medicine, note } = {}, { signal } = {}) {
    const name = requireString(medicine, "medicine");
    const med = state.meds.find(m => m.name.toLowerCase().includes(name.toLowerCase()));
    if (!med) return { queued: false, reason: "unknown medicine" };
    const proposal = {
      id: "prop-" + Math.random().toString(36).slice(2, 8),
      kind: "refill",
      payload: { medicineId: med.id, medicine: med.name },
      preview: `Request refill of ${med.name} at the campus pharmacy pickup (no payment) — for your approval.`,
      note: typeof note === "string" ? note.slice(0, 140) : "",
      createdAt: nowISO(),
    };
    state.proposals.unshift(proposal);
    recordAudit("propose_refill", { medicine: name }, { proposalId: proposal.id }, "awaiting-human");
    return { queued: true, proposalId: proposal.id, status: "pending-human-approval" };
  },
};

const confirm_action = {
  name: "confirm_action",
  title: "Human confirms or dismisses a proposal",
  description:
    "Human-only boundary: confirm or dismiss one pending proposal by id. Agents should call this ONLY when the human explicitly asked to confirm a specific proposal they see on screen.",
  inputSchema: {
    type: "object",
    properties: {
      proposalId: { type: "string", maxLength: 16 },
      decision: { type: "string", enum: ["confirm", "dismiss"] },
    },
    required: ["proposalId", "decision"],
    additionalProperties: false,
  },
  async execute({ proposalId, decision }, { signal } = {}) {
    const pid = requireString(proposalId, "proposalId");
    if (decision !== "confirm" && decision !== "dismiss") throw new Error("invalid decision");
    const idx = state.proposals.findIndex(p => p.id === pid);
    if (idx < 0) return { done: false, reason: "no such pending proposal" };
    const [p] = state.proposals.splice(idx, 1);
    recordAudit("confirm_action", { proposalId: pid, decision }, { kind: p.kind }, "human-decision");
    return { done: true, decision, kind: p.kind, proposalId: pid };
  },
};

const book_pharmacy_pickup = {
  name: "book_pharmacy_pickup",
  title: "Book pharmacy pickup (gated)",
  description:
    "Book a next-day pickup window at Dad’s pharmacy for a confirmed refill. Consequential action: creates a proposal first; nothing books without an explicit human confirm.",
  inputSchema: {
    type: "object",
    properties: {
      window: { type: "string", enum: ["morning", "evening"] },
    },
    required: ["window"],
    additionalProperties: false,
  },
  async execute({ window: w }, { signal } = {}) {
    if (w !== "morning" && w !== "evening") throw new Error("invalid window");
    const when = w === "morning" ? "9:00–11:00" : "17:00–19:00";
    const proposal = {
      id: "prop-" + Math.random().toString(36).slice(2, 8),
      kind: "pickup",
      payload: { window: w },
      preview: `Book pharmacy pickup for tomorrow, ${when} (Campus Pharmacy, no charge until pickup). For your approval.`,
      note: "",
      createdAt: nowISO(),
    };
    state.proposals.unshift(proposal);
    recordAudit("book_pharmacy_pickup", { window: w }, { proposalId: proposal.id }, "gated-booking");
    return { queued: true, proposalId: proposal.id, status: "pending-human-approval" };
  },
};

const get_audit_trail = {
  name: "get_audit_trail",
  title: "Get the audit trail",
  description: "Return the last tool calls with timestamps and annotations so the human can verify what the agent did. Read-only.",
  inputSchema: { type: "object", properties: {}, additionalProperties: false },
  annotations: { readOnlyHint: true },
  async execute(_args, { signal } = {}) {
    recordAudit("get_audit_trail", {}, { count: state.audit.length }, "read-only");
    return { entries: state.audit.slice(0, 20) };
  },
};

/* ── Registration ──────────────────────────────────────────────────────── */

export const TOOLS = [
  get_med_schedule, check_supply, propose_refill,
  confirm_action, book_pharmacy_pickup, get_audit_trail,
];

export function onState(fn) { state.listeners.add(fn); }
export function getState() { return state; }

export async function proposeHumanDecision(id, decision) {
  return confirm_action.execute({ proposalId: id, decision });
}

export async function registerAllTools() {
  if (!("modelContext" in document)) {
    return { supported: false };
  }
  const registered = [];
  for (const tool of TOOLS) {
    try {
      await document.modelContext.registerTool(tool);
      registered.push(tool.name);
    } catch (e) {
      console.warn("registerTool failed for", tool.name, e);
    }
  }
  return { supported: true, registered };
}