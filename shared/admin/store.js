// Dónde guarda el panel su trabajo.
// - Borradores: siempre en este navegador (IndexedDB), para no perder nada si se cierra la pestaña.
// - Publicar:
//   · Modo real: /api/admin (función de Vercel) guarda en GitHub y la web se reconstruye sola.
//   · Modo demostración (sin función, o sin configurar): se da por publicado solo en este navegador.
// Los borradores de un modo y otro van separados: lo que se probó en la demo nunca se publica de verdad.

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

// 'demo' | 'real'. setupPending = la función existe pero aún no tiene token/contraseña.
export let mode = 'demo';
export let setupPending = false;
// true si el servidor tiene las funciones del panel (publicar y vista previa).
export let hasServer = false;
export const draftKey = () => (mode === 'real' ? 'draft-real' : 'draft');

const API = '/api/admin';
const KEY = 'triplew-panel-key';
export const getKey = () => { try { return localStorage.getItem(KEY) || sessionStorage.getItem(KEY) || ''; } catch { return ''; } };
export const setKey = (k, remember) => { try { (remember ? localStorage : sessionStorage).setItem(KEY, k); } catch { /* sin almacenamiento: se pedirá otra vez */ } };
export const clearKey = () => { try { localStorage.removeItem(KEY); sessionStorage.removeItem(KEY); } catch { /* nada */ } };

export async function detect() {
  try {
    const r = await fetch(API, { cache: 'no-store' });
    if (!r.ok) return mode;
    const j = await r.json();
    hasServer = true;
    if (j.ready) mode = 'real'; else setupPending = true;
  } catch { /* sin función (p. ej. en local): demostración */ }
  return mode;
}

// Llama a la función. Devuelve { ok, status, ...respuesta }. Nunca lanza: un fallo de red es { ok:false, error:'network' }.
export async function call(action, body = {}, key = getKey()) {
  try {
    const r = await fetch(API, { method: 'POST', headers: { 'content-type': 'application/json', 'x-panel-key': key }, body: JSON.stringify({ action, ...body }) });
    const j = await r.json().catch(() => ({}));
    return { ...j, ok: r.ok, status: r.status };
  } catch {
    return { ok: false, status: 0, error: 'network' };
  }
}

export const toBase64 = (blob) => new Promise((resolve, reject) => {
  const fr = new FileReader();
  fr.onload = () => resolve(String(fr.result).split(',')[1]);
  fr.onerror = () => reject(fr.error);
  fr.readAsDataURL(blob);
});
