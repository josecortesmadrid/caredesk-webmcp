/* CareDesk app.js — UI wiring: meds list, proposals, audit trail, WebMCP status + i18n. */
import { registerAllTools, onState, getState, proposeHumanDecision } from "./tools.js";
import { mountToggle, proposalTitle, actionLabels, emptyProposalsText, supplyText } from "./i18n.js";

const $ = (sel) => document.querySelector(sel);

function renderMeds() {
  const { meds } = getState();
  $("#med-list").innerHTML = meds.map(m => `
    <li>
      <div><strong>${m.name}</strong><div class="dose">${m.dose}</div></div>
      <div class="supply ${m.supplyDays <= 5 ? "low" : "ok"}"></span>
    </li>`).join("");
  document.querySelectorAll("#med-list .supply").forEach((el, i) => {
    const m = meds[i];
    el.textContent = supplyText(m.supplyDays, m.supplyDays <= 5);
  });
}

function renderProposals() {
  const { proposals } = getState();
  const wrap = $("#proposals");
  const count = $("#pending-count");
  count.textContent = String(proposals.length);
  count.classList.toggle("zero", proposals.length === 0);
  if (!proposals.length) {
    wrap.innerHTML = `<p class="empty">${emptyProposalsText()}</p>`;
    return;
  }
  const labels = actionLabels();
  wrap.innerHTML = proposals.map(p => `
    <div class="proposal" data-id="${p.id}">
      <h3>${proposalTitle(p.kind)}</h3>
      <p class="detail">${p.preview}${p.note ? ` — <em>${p.note}</em>` : ""}</p>
      <div class="actions">
        <button class="confirm" data-decision="confirm">${labels.confirm}</button>
        <button class="dismiss" data-decision="dismiss">${labels.dismiss}</button>
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
  mountToggle();
  renderAll();
  onState(renderAll);
  initStatus();
});

/* human buttons → confirm boundary (the ONLY path that decisions take) */
document.addEventListener("click", async (ev) => {
  const btn = ev.target.closest("button[data-decision]");
  if (btn) {
    const id = btn.closest(".proposal")?.dataset.id;
    if (!id) return;
    btn.disabled = true;
    await proposeHumanDecision(id, btn.dataset.decision);
    return;
  }
  const runAtk = ev.target.closest("#run-attacks");
  if (runAtk) {
    runAtk.disabled = true;
    const { runAttacks } = await import("./security.js");
    await runAttacks();
    runAtk.disabled = false;
  }
});