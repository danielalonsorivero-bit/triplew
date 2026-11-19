// Imágenes del panel: se reducen en el navegador antes de guardarlas,
// para que nadie suba por error una foto de 12 MB del móvil.

const loadImage = (file) =>
  new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => resolve({ img, url });
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('no-image')); };
    img.src = url;
  });

// Devuelve { blob, url, width, height, before, after }.
export async function shrink(file, maxSide = 2000, quality = 0.82, maxBytes = Infinity) {
  if (!file.type.startsWith('image/')) throw new Error('no-image');
  if (file.size > 25e6) throw new Error('too-big');
  const { img, url } = await loadImage(file);
  const scale = Math.min(1, maxSide / Math.max(img.naturalWidth, img.naturalHeight));
  const w = Math.round(img.naturalWidth * scale);
  const h = Math.round(img.naturalHeight * scale);
  const canvas = document.createElement('canvas');
  canvas.width = w; canvas.height = h;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#000'; ctx.fillRect(0, 0, w, h); // PNG con transparencia: fondo negro, como la web
  ctx.drawImage(img, 0, 0, w, h);
  URL.revokeObjectURL(url);
  const encode = (q) => new Promise((r) => canvas.toBlob(r, 'image/jpeg', q));
  let blob = await encode(quality);
  for (let q = quality - 0.08; blob.size > maxBytes && q >= 0.4; q -= 0.08) blob = await encode(q);
  return { blob, url: URL.createObjectURL(blob), width: w, height: h, before: file.size, after: blob.size };
}

// Colores dominantes y saturados de una imagen (para proponer el color del show a partir del cartel).
export async function palette(src, count = 5) {
  const img = await new Promise((resolve, reject) => {
    const i = new Image();
    i.crossOrigin = 'anonymous';
    i.onload = () => resolve(i);
    i.onerror = reject;
    i.src = src;
  });
  const s = 64;
  const c = document.createElement('canvas');
  c.width = s; c.height = s;
  const ctx = c.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(img, 0, 0, s, s);
  const { data } = ctx.getImageData(0, 0, s, s);
  const buckets = new Map();
  for (let i = 0; i < data.length; i += 4) {
    const [r, g, b] = [data[i], data[i + 1], data[i + 2]];
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    const sat = max === 0 ? 0 : (max - min) / max;
    if (sat < 0.35 || max < 60) continue; // fuera grises, negros y blancos
    const key = `${r >> 5}-${g >> 5}-${b >> 5}`;
    const e = buckets.get(key) || { n: 0, r: 0, g: 0, b: 0, sat: 0 };
    e.n++; e.r += r; e.g += g; e.b += b; e.sat += sat;
    buckets.set(key, e);
  }
  const hex = (v) => Math.round(v).toString(16).padStart(2, '0');
  const picked = [];
  for (const e of [...buckets.values()].sort((a, b) => b.n * (b.sat / b.n) - a.n * (a.sat / a.n))) {
    const col = [e.r / e.n, e.g / e.n, e.b / e.n];
    if (picked.some((p) => Math.hypot(p[0] - col[0], p[1] - col[1], p[2] - col[2]) < 70)) continue;
    picked.push(col);
    if (picked.length >= count) break;
  }
  return picked.map((c) => `#${c.map(hex).join('')}`.toUpperCase());
}

// Color de texto que se lee sobre un color dado: casi negro o hueso.
export function inkFor(hex) {
  const n = parseInt(hex.slice(1), 16);
  const lin = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
  const L = 0.2126 * lin((n >> 16) & 255) + 0.7152 * lin((n >> 8) & 255) + 0.0722 * lin(n & 255);
  return L > 0.22 ? '#0B0B0B' : '#F2F0EA';
}

export const kb = (bytes) => (bytes > 1e6 ? `${(bytes / 1e6).toFixed(1).replace('.', ',')} MB` : `${Math.max(1, Math.round(bytes / 1e3))} KB`);

// Recorta al centro y deja la imagen exactamente en w × h (p. ej. 1200 × 630 para compartir en redes).
export async function cover(file, w, h, quality = 0.82, maxBytes = Infinity) {
  if (!file.type.startsWith('image/')) throw new Error('no-image');
  if (file.size > 25e6) throw new Error('too-big');
  const { img, url } = await loadImage(file);
  const s = Math.max(w / img.naturalWidth, h / img.naturalHeight);
  const sw = w / s, sh = h / s;
  const canvas = document.createElement('canvas');
  canvas.width = w; canvas.height = h;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#000'; ctx.fillRect(0, 0, w, h);
  ctx.drawImage(img, (img.naturalWidth - sw) / 2, (img.naturalHeight - sh) * 0.35, sw, sh, 0, 0, w, h);
  URL.revokeObjectURL(url);
  const encode = (q) => new Promise((r) => canvas.toBlob(r, 'image/jpeg', q));
  let blob = await encode(quality);
  for (let q = quality - 0.08; blob.size > maxBytes && q >= 0.4; q -= 0.08) blob = await encode(q);
  return { blob, url: URL.createObjectURL(blob), width: w, height: h, before: file.size, after: blob.size };
}
