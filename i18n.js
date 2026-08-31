/* CareDesk i18n.js — bilingual caregiver support (EN/ES).
 * Care is personal; for many US families Spanish comes first.
 * Toggle persists to localStorage. Default: browser language.
 */

const STR = {
  en: {
    tag: `Care coordination where <strong>you</strong> and your <strong>agent</strong> share one desk.`,
    medsTitle: "Tonight’s meds <span class=\"who\">for Papá</span>",
    medHint: `Ask your agent: <em>“Check Dad’s evening meds and what needs a refill.”</em>`,
    supplyDays: (d) => `${d}d supply`,
    low: " · LOW",
    pendingTitle: `Pending <span class="who">agent proposals</span>`,
    empty: `Nothing pending. Proposals appear here for <strong>your</strong> approval — the agent never acts alone.`,
    auditTitle: `Audit trail <span class="who">every tool call, visible</span>`,
    refill: "💊 Refill request", pickup: "🚚 Pharmacy pickup", taken: "✅ Mark med taken",
    confirm: "Confirm", dismiss: "Dismiss",
  },
  es: {
    tag: `Coordinación de cuidado donde <strong>tú</strong> y tu <strong>agente</strong> comparten un mismo escritorio.`,
    medsTitle: `Medicinas de esta noche <span class="who">para Papá</span>`,
    medHint: `Dile a tu agente: <em>«Revisa las medicinas de papá y qué hace falta reabastecer.»</em>`,
    supplyDays: (d) => `surtido ${d} d`,
    low: " · BAJO",
    pendingTitle: `Pendiente <span class="who">propuestas del agente</span>`,
    empty: `Nada pendiente. Las propuestas aparecen aquí para que <strong>tú</strong> las apruebes — el agente nunca actúa solo.`,
    auditTitle: `Registro de auditoría <span class="who">cada llamada, a la vista</span>`,
    refill: "💊 Solicitud de resurtido", pickup: "🚚 Recogida en farmacia", taken: "✅ Medicamento tomado",
    confirm: "Confirmar", dismiss: "Descartar",
  },
};

let lang;
try { lang = localStorage.getItem("caredesk-lang") || (navigator.language?.startsWith("es") ? "es" : "en"); }
catch { lang = "en"; }

export function t() { return STR[lang] || STR.en; }
export function getLang() { return lang; }
export function setLang(l) {
  if (!STR[l]) return;
  lang = l;
  try { localStorage.setItem("caredesk-lang", l); } catch {}
  applyStatic();
  document.dispatchEvent(new CustomEvent("caredesk:lang"));
}

function applyStatic() {
  document.documentElement.lang = lang;
  const s = t();
  document.querySelector(".tag") && (document.querySelector(".tag").innerHTML = s.tag);
  const h2s = document.querySelectorAll("h2");
  if (h2s[0]) h2s[0].innerHTML = s.medsTitle;
  if (h2s[1]) h2s[1].innerHTML = `${s.pendingTitle} <span class="badge" id="pending-count">0</span>`;
  if (h2s[2]) h2s[2].innerHTML = s.auditTitle;
  const hint = document.querySelector("#panel-meds .hint");
  hint && (hint.innerHTML = s.medHint);
  const lp = document.querySelector("#run-attacks");
  lp && (lp.textContent = lang === "es" ? "Ejecutar ataques ▶" : "Run attacks ▶");
}

/* add the toggle button to header */
export function mountToggle() {
  const host = document.querySelector("#webmcp-status")?.parentElement || document.querySelector("header");
  const b = document.createElement("button");
  b.className = "lang-toggle";
  b.textContent = lang === "es" ? "EN" : "ES";
  b.title = "language / idioma";
  b.addEventListener("click", () => { setLang(lang === "es" ? "en" : "es"); b.textContent = lang === "es" ? "EN" : "ES"; });
  host.appendChild(b);
  applyStatic();
}

/* proposal labels helpers used by app.js */
export function proposalTitle(kind) { return t()[kind === "refill" ? "refill" : kind === "pickup" ? "pickup" : "taken"]; }
export function actionLabels() { return { confirm: t().confirm, dismiss: t().dismiss }; }
export function emptyProposalsText() { return t().empty; }
export function supplyText(days, isLow) { return t().supplyDays(days) + (isLow ? t().low : ""); }