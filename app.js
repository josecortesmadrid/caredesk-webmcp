/* CareDesk app.js — UI wiring: meds list, proposals, audit trail, WebMCP status. */
import { registerAllTools, onState, getState, proposeHumanDecision } from "./tools.js";

const $ = (sel) => document.querySelector(sel);

function renderMeds() {
  const { meds } = getState();
  $("#med-list").innerHTML = meds.map(m => `
    <li>
      <div><strong>${m.name}</strong><div class="dose">${m.dose}</div></div>
      <div class="supply ${m.supplyDays <= 5 ? "low" : "ok"}">
        ${m.supplyDays}d supply${m.supplyDays <= 5 ? " · LOW" : ""}
      </div>
    </li>`).join("");
}

function renderProposals() {
  const { proposals } = getState();
  const wrap = $("#proposals");
  const count = $("#pending-count");
  count.textContent = String(proposals.length);
  count.classList.toggle("zero", proposals.length === 0);
  if (!proposals.length) {
    wrap.innerHTML = `<p class="empty">Nothing pending. Proposals appear here for <strong>your</strong> approval — the agent never acts alone.</p>`;
    return;
  }
  wrap.innerHTML = proposals.map(p => `
    <div class="proposal" data-id="${p.id}">
      <h3>${p.kind === "refill" ? "💊 Refill request" : "🚚 Pharmacy pickup"}</h3>
      <p class="detail">${p.preview}${p.note ? ` — <em>${p.note}</em>` : ""}</p>
      <div class="actions">
        <button class="confirm" data-decision="confirm">Confirm</button>
        <button class="dismiss" data-decision="dismiss">Dismiss</button>
      </div>
    </div>`).join("");
}

function renderAudit() {
  const { audit } = getState();
  $("#audit-trail").innerHTML = audit.slice(0, 12).map(a => {
    const time = a.at.slice(11, 19);
    const ro = /get_|check_/.test(a.tool) ? `<span class="ro">read-only</span>` : "";
    const un = /untrusted/.test(a.note) ? `<span class="untrusted">untrusted ⚠</span>` : "";
    return `<li><span class="t">${time}</span> <span class="tool">${a.tool}</span>${ro}${un} <span class="muted">${a.note}</span></li>`;
  }).join("");
}

function renderAll() { renderMeds(); renderProposals(); renderAudit(); }

async function initStatus() {
  const el = $("#webmcp-status"), txt = $("#webmcp-status-text");
  if ("modelContext" in document) {
    const res = await registerAllTools();
    if (res.supported && res.registered.length) {
      el.classList.add("ok");
      txt.textContent = `WebMCP live · ${res.registered.length} tools registered`;
    } else {
      el.classList.add("warn");
      txt.textContent = "WebMCP API present, registration failed (open console)";
    }
  } else {
    el.classList.add("warn");
    txt.innerHTML = `WebMCP not active — enable <code>chrome://flags/#enable-webmcp-testing</code> (Chrome 149+) or open in ChatGPT’s in-app browser`;
  }
}

window.addEventListener("DOMContentLoaded", () => {
  renderAll();
  onState(renderAll);
  initStatus();
});

/* human buttons → confirm boundary (the ONLY path that decisions take) */
document.addEventListener("click", async (ev) => {
  const btn = ev.target.closest("button[data-decision]");
  if (!btn) return;
  const id = btn.closest(".proposal")?.dataset.id;
  if (!id) return;
  btn.disabled = true;
  await proposeHumanDecision(id, btn.dataset.decision);
});