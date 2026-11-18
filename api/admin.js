// Función de Vercel del panel (/api/admin). Recibe lo que publica el panel y lo guarda en GitHub
// como un commit; Vercel ve el commit y reconstruye la web sola (1–2 minutos).
//
// Variables de entorno (Vercel → Settings → Environment Variables):
//   GITHUB_TOKEN    token "fine-grained" con permiso Contents: Read and write SOLO sobre el repositorio.
//   ADMIN_PASSWORD  contraseña compartida del panel.
//   GITHUB_REPO     opcional, "usuario/repo" (por defecto el de este proyecto).
//   GITHUB_BRANCH   opcional, por defecto "main".
//
// Blindaje:
//   - Solo se pueden escribir 6 ficheros de datos concretos e imágenes JPG/PNG/WebP en carpetas concretas.
//   - Antes de escribir, compara lo publicado en GitHub con lo que el panel cargó: si otra persona
//     publicó entretanto, no pisa nada y avisa (409).
//   - Cada publicación es un único commit: o entra todo o no entra nada.

import { createHash, timingSafeEqual } from 'node:crypto';

const REPO = process.env.GITHUB_REPO || 'danielalonsorivero-bit/triplew';
const BRANCH = process.env.GITHUB_BRANCH || 'main';
const FILES = {
  shows: 'shared/data/shows.json',
  roster: 'shared/data/roster.json',
  titles: 'shared/data/titles.json',
  home: 'shared/data/portada-triplew.json',
  pages: 'shared/data/paginas-triplew.json',
  hof: 'shared/data/salon-fama-triplew.json',
};
const IMG_PATH = /^\/(fotos|carteles|historia|luchadores)\/[a-z0-9][a-z0-9/_.-]*\.(jpe?g|png|webp)$/;
const MAX_IMG = 3 * 1024 * 1024;
const MAX_JSON = 2 * 1024 * 1024;

const json = (status, body) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' } });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const digest = (s) => createHash('sha256').update(String(s)).digest();

// Orden de claves estable, para comparar contenidos sin depender del formato.
const stable = (v) => Array.isArray(v) ? `[${v.map(stable).join(',')}]`
  : v && typeof v === 'object' ? `{${Object.keys(v).filter((k) => v[k] !== undefined).sort().map((k) => `${JSON.stringify(k)}:${stable(v[k])}`).join(',')}}`
  : JSON.stringify(v);

async function gh(path, { method = 'GET', body, raw } = {}) {
  const r = await fetch(`https://api.github.com/repos/${REPO}${path}`, {
    method,
    headers: {
      authorization: `Bearer ${process.env.GITHUB_TOKEN}`,
      accept: raw ? 'application/vnd.github.raw+json' : 'application/vnd.github+json',
      'x-github-api-version': '2022-11-28',
      'user-agent': 'panel-triplew',
      ...(body ? { 'content-type': 'application/json' } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!r.ok) {
    const e = new Error(`GitHub ${method} ${path} → ${r.status}`);
    e.status = r.status; e.detail = await r.text().catch(() => '');
    throw e;
  }
  return raw ? r.text() : r.json();
}

const head = async () => (await gh(`/git/ref/heads/${BRANCH}`)).object.sha;
const readFile = async (key, ref) => JSON.parse(await gh(`/contents/${FILES[key]}?ref=${ref}`, { raw: true }));

export async function GET() {
  // Solo dice si el guardado real está configurado. No necesita contraseña ni revela nada.
  if (process.env.SITE_ID === 'lucharama') return json(404, { error: 'not-found' });
  return json(200, { ready: !!(process.env.GITHUB_TOKEN && process.env.ADMIN_PASSWORD) });
}

export async function POST(request) {
  if (process.env.SITE_ID === 'lucharama') return json(404, { error: 'not-found' });
  if (!process.env.GITHUB_TOKEN || !process.env.ADMIN_PASSWORD) return json(503, { error: 'setup' });

  const key = request.headers.get('x-panel-key') || '';
  if (!timingSafeEqual(digest(key), digest(process.env.ADMIN_PASSWORD))) {
    await sleep(1500); // frena a quien pruebe contraseñas a lo loco
    return json(401, { error: 'password' });
  }

  let body;
  try { body = await request.json(); } catch { return json(400, { error: 'bad-request' }); }

  try {
    if (body.action === 'load') {
      const ref = await head();
      const files = {};
      await Promise.all(Object.keys(FILES).map(async (k) => { files[k] = await readFile(k, ref); }));
      return json(200, { head: ref, files });
    }

    if (body.action === 'image') {
      const { path, data } = body;
      if (typeof path !== 'string' || !IMG_PATH.test(path) || path.includes('..')) return json(400, { error: 'bad-path', path });
      if (typeof data !== 'string') return json(400, { error: 'bad-image', path });
      const buf = Buffer.from(data, 'base64');
      if (!buf.length || buf.length > MAX_IMG) return json(413, { error: 'too-big', path });
      const isJpg = buf[0] === 0xff && buf[1] === 0xd8, isPng = buf.subarray(0, 4).toString('hex') === '89504e47';
      const isWebp = buf.subarray(0, 4).toString() === 'RIFF' && buf.subarray(8, 12).toString() === 'WEBP';
      if (!isJpg && !isPng && !isWebp) return json(400, { error: 'bad-image', path });
      const blob = await gh('/git/blobs', { method: 'POST', body: { content: data, encoding: 'base64' } });
      return json(200, { sha: blob.sha });
    }

    if (body.action === 'publish') {
      const { files = {}, base = {}, images = [], force = [] } = body;
      const keys = Object.keys(files);
      if (!keys.length && !images.length) return json(400, { error: 'empty' });
      for (const k of keys) {
        if (!FILES[k] || !files[k] || typeof files[k] !== 'object') return json(400, { error: 'bad-file', key: k });
        if (JSON.stringify(files[k]).length > MAX_JSON) return json(413, { error: 'too-big', key: k });
      }
      for (const im of images) {
        if (!IMG_PATH.test(im?.path || '') || im.path.includes('..') || !/^[0-9a-f]{40}$/.test(im.sha || '')) return json(400, { error: 'bad-path', path: im?.path });
      }

      const ref = await head();
      // ¿Ha publicado alguien más desde que el panel cargó los datos?
      const conflicts = {};
      await Promise.all(keys.map(async (k) => {
        const now = await readFile(k, ref);
        if (!force.includes(k) && stable(now) !== stable(base[k])) conflicts[k] = now;
      }));
      if (Object.keys(conflicts).length) return json(409, { error: 'conflict', head: ref, current: conflicts });

      const commit = await gh(`/git/commits/${ref}`);
      const tree = await gh('/git/trees', {
        method: 'POST',
        body: {
          base_tree: commit.tree.sha,
          tree: [
            ...keys.map((k) => ({ path: FILES[k], mode: '100644', type: 'blob', content: `${JSON.stringify(files[k], null, 2)}\n` })),
            ...images.map((im) => ({ path: `public/triplew${im.path}`, mode: '100644', type: 'blob', sha: im.sha })),
          ],
        },
      });
      const what = String(body.summary || 'cambios').slice(0, 120).replace(/[\r\n]+/g, ' ');
      const c = await gh('/git/commits', { method: 'POST', body: { message: `Panel: ${what}`, tree: tree.sha, parents: [ref] } });
      try {
        await gh(`/git/refs/heads/${BRANCH}`, { method: 'PATCH', body: { sha: c.sha, force: false } });
      } catch (e) {
        // Otro commit entró justo en medio: no se pisa; el panel puede reintentar.
        if (e.status === 422) return json(409, { error: 'race' });
        throw e;
      }
      return json(200, { head: c.sha });
    }

    return json(400, { error: 'bad-action' });
  } catch (e) {
    console.error(e.message, e.detail?.slice?.(0, 500));
    return json(502, { error: e.status === 401 || e.status === 403 || e.status === 404 ? 'github-access' : 'github', githubStatus: e.status });
  }
}
