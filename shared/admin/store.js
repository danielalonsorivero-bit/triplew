// Dónde guarda el panel su trabajo.
// Modo demostración: todo se queda en este navegador (IndexedDB), la web pública no cambia.
// Versión final: "publish" enviará los ficheros al GitHub de la asociación, que reconstruye la web.

const DB = 'triplew-panel';
const open = () =>
  new Promise((resolve, reject) => {
    const r = indexedDB.open(DB, 1);
    r.onupgradeneeded = () => r.result.createObjectStore('kv');
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });

async function tx(mode, fn) {
  const db = await open();
  return new Promise((resolve, reject) => {
    const t = db.transaction('kv', mode);
    const req = fn(t.objectStore('kv'));
    t.oncomplete = () => resolve(req?.result);
    t.onerror = () => reject(t.error);
  });
}

export const get = (key) => tx('readonly', (s) => s.get(key)).catch(() => undefined);
export const set = (key, value) => tx('readwrite', (s) => s.put(value, key)).catch(() => undefined);
export const del = (key) => tx('readwrite', (s) => s.delete(key)).catch(() => undefined);

export const mode = 'demo';
