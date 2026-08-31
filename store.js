/* CareDesk store.js — persistence + care history (IndexedDB).
 * Real caregivers need history: what was taken, what ran out, when.
 * Also demonstrates that WebMCP tools can sit on real state, not a toy.
 */

const DB = "caredesk";
const VERSION = 1;

function open() {
  return new Promise((res, rej) => {
    const req = indexedDB.open(DB, VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains("events"))
        db.createObjectStore("events", { keyPath: "id", autoIncrement: true });
    };
    req.onsuccess = () => res(req.result);
    req.onerror = () => rej(req.error);
  });
}

export async function appendEvent(kind, payload) {
  const db = await open();
  return new Promise((res, rej) => {
    const tx = db.transaction("events", "readwrite");
    tx.objectStore("events").add({ kind, payload: JSON.stringify(payload), at: new Date().toISOString() });
    tx.oncomplete = () => res(true);
    tx.onerror = () => rej(tx.error);
  });
}

export async function recentEvents(limit = 30) {
  const db = await open();
  return new Promise((res, rej) => {
    const tx = db.transaction("events", "readonly");
    const items = [];
    const cur = tx.objectStore("events").openCursor(null, "prev");
    cur.onsuccess = () => {
      const c = cur.result;
      if (c && items.length < limit) { items.push(c.value); c.continue(); }
      else res(items);
    };
    cur.onerror = () => rej(cur.error);
  });
}

/* Supply-days snapshot history for a simple sparkline in UI */
export async function supplyHistory(medicineId) {
  const evs = await recentEvents(200);
  return evs.filter(e => {
    try {
      const p = JSON.parse(e.payload);
      return p?.medicineId === medicineId || p?.payload?.medicineId === medicineId;
    } catch { return false; }
  });
}