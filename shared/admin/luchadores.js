// Sección Luchadores del panel. Mismo principio que Shows: prevenir antes que avisar.
// - El nombre no se puede repetir y, si se cambia, se cambia también en todos los shows.
// - Cada división enseña solo los campos que la web usa para ella.
// - Las fotos se reducen solas; el encuadre se elige pulsando sobre la cara.
// - Un campeón no se puede borrar: primero hay que cambiar el título en Campeonatos.

import rosterJson from '../data/roster.json';
import titlesJson from '../data/titles.json';
import { shrink, kb } from './img.js';
import { S, h, icon, field, choice, change, persist, setLive, toast, go, render, dropZone, imgSrc, slugify, snapshot, same } from './app.js';

export const DIVISIONS = rosterJson.divisions;
const TITLES = titlesJson.titles;
const MAX_PHOTOS = 10;
const norm = (t) => (t || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
export const wrestlerBy = (slug) => S.roster.find((w) => w.slug === slug);
const titleNames = (w) => (w.titles || []).map((t) => TITLES.find((x) => x.slug === t)?.name).filter(Boolean);
const kindOf = (w) => (w.division === 'arbitros' ? 'ref' : w.division === 'invitados' ? 'guest' : w.division === 'staff' ? 'staff' : 'wrestler');
const published = () => JSON.parse(S.publishedRoster);
const isPublished = (w) => published().some((p) => p.slug === w.slug);

// Redes: se guarda el usuario (sin @) o el enlace completo; la web monta el enlace.
const NETS = [
  { k: 'instagram', label: 'Instagram', base: 'https://www.instagram.com/', host: /instagram\.com\/([\w.]+)/ },
  { k: 'tiktok', label: 'TikTok', base: 'https://www.tiktok.com/@', host: /tiktok\.com\/@?([\w.]+)/ },
  { k: 'x', label: 'X (Twitter)', base: 'https://x.com/', host: /(?:x|twitter)\.com\/(\w+)/ },
  { k: 'youtube', label: 'YouTube', base: 'https://www.youtube.com/@', host: null },
  { k: 'facebook', label: 'Facebook', base: 'https://www.facebook.com/', host: /facebook\.com\/([\w.]+)/ },
  { k: 'twitch', label: 'Twitch', base: 'https://www.twitch.tv/', host: /twitch\.tv\/(\w+)/ },
  { k: 'web', label: 'Web propia', base: '', host: null },
];
const socialOf = (w) => ({ ...(w.instagram ? { instagram: w.instagram } : {}), ...(w.social || {}) });
// Limpia lo que pegue la persona: un enlace de la propia red se convierte en el usuario.
function cleanHandle(net, raw) {
  let v = (raw || '').trim();
  if (!v) return { value: '' };
  if (net.k === 'web' || net.k === 'youtube') {
    if (/^https?:\/\//.test(v)) return { value: v };
    if (net.k === 'web') return /^[\w-]+(\.[\w-]+)+/.test(v) ? { value: `https://${v}` } : { value: v, err: 'Pega la dirección completa, por ejemplo https://miweb.com' };
  }
  const m = net.host && v.match(net.host);
  if (m) return { value: m[1] };
  if (/^https?:\/\//.test(v)) return { value: v };
  v = v.replace(/^@/, '');
  if (/\s/.test(v)) return { value: v, err: 'Un nombre de usuario no lleva espacios.' };
  return { value: v };
}
const socialUrl = (net, v) => (/^https?:\/\//.test(v) ? v : net.base + v);

// ---------- Validación ----------
export function checkWrestler(w) {
  const errs = [], warns = [];
  const add = (list, field, msg) => list.push({ kind: 'wrestler', slug: w.slug, field, msg, show: w.name || 'Luchador sin nombre' });
  if (!w.name || w.name.trim().length < 2) add(errs, 'name', 'Falta el nombre.');
  else { const o = S.roster.find((x) => x !== w && norm(x.name) === norm(w.name)); if (o) add(errs, 'name', `Ese nombre ya lo usa la ficha de ${o.name}.`); }
  if (!DIVISIONS[w.division]) add(errs, 'division', 'Elige la división.');
  const soc = socialOf(w);
  for (const net of NETS) if (soc[net.k] && cleanHandle(net, soc[net.k]).err) add(errs, `soc-${net.k}`, `${net.label}: ${cleanHandle(net, soc[net.k]).err}`);
  if (w.video && !/^https:\/\//.test(w.video)) add(errs, 'video', 'El enlace del vídeo debe empezar por https://');
  if (!w.photo) add(warns, 'photo', 'No tiene retrato: en la web sale una silueta con interrogante.');
  return { errs, warns };
}
export const changedRoster = () => {
  const before = new Map(published().map((w) => [w.slug, w]));
  return S.roster.filter((w) => !before.has(w.slug) || !same(before.get(w.slug), w));
};
export const removedRoster = () => published().filter((p) => !wrestlerBy(p.slug));

// ---------- Lista ----------
export function rosterHome() {
  const q = S.rosterQ || '';
  // Filtros acumulables: varias divisiones a la vez (vacío = todas) y, aparte, estados.
  const divSel = S.rosterDiv || (S.rosterDiv = new Set());
  const stSel = S.rosterSt || (S.rosterSt = new Set());
  const sort = S.rosterSort || 'az';
  const match = (w) => !q || norm(w.name).split(/[\s«»"'-]+/).some((p) => p.startsWith(norm(q))) || norm(w.name).includes(norm(q)) || norm(w.nickname).includes(norm(q));
  const noPhoto = (w) => !w.photo;
  const prov = (w) => (w.provisional || []).length > 0;
  const STATUS = [
    { k: 'nophoto', label: 'Sin retrato', test: noPhoto },
    { k: 'prov', label: 'Por confirmar', test: prov },
  ];
  let list = S.roster.filter((w) => (!divSel.size || divSel.has(w.division)) && STATUS.every((x) => !stSel.has(x.k) || x.test(w)) && match(w));
  if (sort === 'az') list = [...list].sort((a, b) => a.name.localeCompare(b.name, 'es'));
  // Ordenar a mano solo tiene sentido viendo una división en el orden de la web y sin buscar.
  const canDrag = sort === 'web' && divSel.size === 1 && !stSel.size && !q;
  const toggle = (set, k) => { set.has(k) ? set.delete(k) : set.add(k); S.view.keepScroll = true; render(); };
  const pick = (patch) => { Object.assign(S, patch); S.view.keepScroll = true; render(); };
  const search = h('input', { type: 'search', class: 'r-search', value: q, placeholder: 'Buscar por nombre o apodo', 'aria-label': 'Buscar luchador',
    oninput: (e) => { S.rosterQ = e.target.value; const pos = e.target.selectionStart; S.view.keepScroll = true; render(); const el = document.querySelector('.r-search'); el?.focus(); el?.setSelectionRange(pos, pos); } });
  return h('div', { class: 'home' },
    h('div', { class: 'scr-head' },
      h('div', {}, h('h1', { class: 'scr-title' }, 'Luchadores'),
        h('p', { class: 'scr-sub' }, `${S.roster.length} fichas · ${S.roster.filter(noPhoto).length} sin retrato · ${S.roster.filter(prov).length} con datos por confirmar`)),
      h('button', { class: 'btn1 hd', type: 'button', onclick: newWrestler }, icon('plus'), 'Nuevo luchador')),
    h('div', { class: 'r-tools' }, search,
      h('div', { class: 'seg', role: 'radiogroup', 'aria-label': 'Orden' },
        [['az', 'A–Z'], ['web', 'Orden de la web']].map(([k, l]) => h('button', { type: 'button', role: 'radio', 'aria-checked': sort === k ? 'true' : 'false', class: sort === k ? 'on' : '', onclick: () => pick({ rosterSort: k }) }, l)))),
    h('div', { class: 'filters', 'aria-label': 'Divisiones' },
      h('button', { type: 'button', 'aria-pressed': divSel.size ? 'false' : 'true', class: `fchip${divSel.size ? '' : ' on'}`, onclick: () => { divSel.clear(); S.view.keepScroll = true; render(); } }, 'Todas', h('small', {}, S.roster.length)),
      Object.entries(DIVISIONS).map(([k, d]) => {
        const n = S.roster.filter((w) => w.division === k).length;
        const on = divSel.has(k);
        return h('button', { type: 'button', 'aria-pressed': on ? 'true' : 'false', class: `fchip dv${on ? ' on' : ''}`, style: `--dc:${d.color}`, onclick: () => toggle(divSel, k) },
          h('span', { class: 'fbox', 'aria-hidden': 'true' }, on ? icon('check') : ''), d.name, h('small', {}, n));
      })),
    h('div', { class: 'filters st', 'aria-label': 'Estado' },
      h('span', { class: 'muted-s' }, 'Solo los que tienen:'),
      STATUS.map((x) => {
        const on = stSel.has(x.k);
        return h('button', { type: 'button', 'aria-pressed': on ? 'true' : 'false', class: `fchip st${on ? ' on' : ''}`, onclick: () => toggle(stSel, x.k) },
          h('span', { class: 'fbox', 'aria-hidden': 'true' }, on ? icon('check') : ''), x.label, h('small', {}, S.roster.filter(x.test).length));
      })),
    h('p', { class: 'muted-s r-hint' }, canDrag
      ? 'Arrastra las fichas para cambiar el orden en que salen en la web.'
      : 'Para cambiar el orden en que salen en la web, marca una sola división y elige «Orden de la web».'),
    list.length
      ? h('ul', { class: 'shows wl' }, list.map((w) => wrestlerRow(w, canDrag)))
      : h('p', { class: 'empty' }, q ? `No hay nadie que se llame «${q}» con estos filtros. Puedes crearlo con «Nuevo luchador».` : 'No hay nadie con estos filtros.'));
}

let dragSlug = null;
function wrestlerRow(w, draggable) {
  const chips = [];
  const { errs } = checkWrestler(w);
  if (errs.length) chips.push(h('span', { class: 'chip bad' }, icon('alert'), 'Falta información'));
  if (!w.photo) chips.push(h('span', { class: 'chip warn' }, 'Sin retrato'));
  if ((w.provisional || []).length) chips.push(h('span', { class: 'chip' }, 'Por confirmar'));
  const t = titleNames(w);
  if (t.length) chips.push(h('span', { class: 'chip champ' }, icon('star'), 'Campeón'));
  const before = published().find((p) => p.slug === w.slug);
  if (!before) chips.unshift(h('span', { class: 'chip new' }, 'Nuevo'));
  else if (!same(before, w)) chips.unshift(h('span', { class: 'chip new' }, 'Con cambios'));
  return h('li', draggable ? {
    draggable: 'true',
    ondragstart: (e) => { dragSlug = w.slug; e.dataTransfer.effectAllowed = 'move'; },
    ondragover: (e) => { if (!dragSlug) return; const from = wrestlerBy(dragSlug); if (from?.division !== w.division) return; e.preventDefault(); e.currentTarget.classList.add('over'); },
    ondragleave: (e) => e.currentTarget.classList.remove('over'),
    ondrop: (e) => {
      e.preventDefault(); e.currentTarget.classList.remove('over');
      const from = wrestlerBy(dragSlug); dragSlug = null;
      if (!from || from === w || from.division !== w.division) return;
      S.view.keepScroll = true;
      change(() => { const r = S.roster; const a = r.indexOf(from); r.splice(a, 1); r.splice(r.indexOf(w) + (a <= r.indexOf(w) ? 1 : 0), 0, from); });
    },
  } : {},
  h('a', { href: `#luchador/${w.slug}`, class: 'show-row w-row', style: `--dc:${DIVISIONS[w.division]?.color || '#666'}`, onclick: (e) => { e.preventDefault(); go({ name: 'wrestler', slug: w.slug }); } },
    w.photo ? h('img', { class: 'w-thumb', src: imgSrc(w.photo), alt: '', loading: 'lazy', style: `object-position:${(w.photoPos || 'center 20%').split(' ')[0]} 10%` }) : h('span', { class: 'w-thumb none' }, '?'),
    h('span', { class: 'sr-main' },
      h('span', { class: 'sr-name' }, w.emoji ? `${w.name} ${w.emoji}` : w.name || 'Sin nombre'),
      h('span', { class: 'sr-meta' },
        w.nickname ? `«${w.nickname}»` : t.length ? t.join(', ') : '')),
    DIVISIONS[w.division] && h('span', { class: 'div-tag' }, DIVISIONS[w.division].name),
    h('span', { class: 'sr-chips' }, chips)));
}

// Alta: primero solo nombre y división, para que la ficha nazca con un nombre válido y único.
function newWrestler() {
  S.newW = { name: '', division: 'levelone' };
  go({ name: 'wrestler-new' });
}
export function newWrestlerForm() {
  const d = S.newW || (S.newW = { name: '', division: 'levelone' });
  const err = h('div', { class: 'fld-h' });
  const dup = () => S.roster.find((x) => norm(x.name) === norm(d.name));
  const create = () => {
    const name = d.name.trim().replace(/\s+/g, ' ');
    if (name.length < 2) { err.replaceChildren(h('span', { class: 'err' }, icon('alert'), 'Escribe el nombre.')); return; }
    if (dup()) { err.replaceChildren(h('span', { class: 'err' }, icon('alert'), `«${dup().name}» ya tiene ficha. Búscalo en la lista.`)); return; }
    let slug = slugify(name) || 'luchador', n = 2; const base = slug;
    while (wrestlerBy(slug) || published().some((p) => p.slug === slug)) slug = `${base}-${n++}`;
    change(() => { S.roster.push({ slug, name, division: d.division }); }, { rerender: false });
    S.newW = null;
    go({ name: 'wrestler', slug });
    toast(`Ficha de ${name} creada. Ahora añade su retrato.`);
  };
  return h('div', { class: 'ed' },
    h('a', { href: '#', class: 'back', onclick: (e) => { e.preventDefault(); go({ name: 'roster' }); } }, icon('back'), 'Todos los luchadores'),
    h('h1', { class: 'scr-title' }, 'Nuevo luchador'),
    h('p', { class: 'lead' }, 'Empieza por el nombre y la división. Lo demás lo rellenas después, con calma.'),
    h('div', { class: 'grid' },
      field('Nombre tal como se anuncia', { value: d.name, required: true, max: 40, attrs: { placeholder: 'Por ejemplo: Pibito Canario', autocomplete: 'off' },
        oninput: (v) => { d.name = v; err.replaceChildren(dup() ? h('span', { class: 'err' }, icon('alert'), `«${dup().name}» ya tiene ficha.`) : ''); } }),
      err,
      h('fieldset', { class: 'fs' }, h('legend', {}, 'División'),
        choice('nw-div', Object.entries(DIVISIONS).map(([value, x]) => ({ value, label: x.name, color: x.color })), d.division, (v) => { d.division = v; S.view.keepScroll = true; render(); })),
      h('div', { class: 'btns' },
        h('button', { class: 'btn2', type: 'button', onclick: () => go({ name: 'roster' }) }, 'Cancelar'),
        h('button', { class: 'btn1', type: 'button', onclick: create }, icon('plus'), 'Crear la ficha'))));
}

// ---------- Ficha ----------
export function wrestlerEditor() {
  const w = wrestlerBy(S.view.slug);
  if (!w) return h('p', {}, 'Esa ficha ya no existe.');
  const d = DIVISIONS[w.division] || { name: '—', color: '#888' };
  const errOf = (f) => { const c = checkWrestler(w); const e = c.errs.find((x) => x.field === f); const wa = c.warns.find((x) => x.field === f); return e ? { msg: e.msg } : wa ? { msg: wa.msg, warn: true } : null; };
  return h('div', { class: 'ed wed', style: `--c:${d.color};--ci:#0B0B0B` },
    h('a', { href: '#', class: 'back', onclick: (e) => { e.preventDefault(); go({ name: 'roster' }); } }, icon('back'), 'Todos los luchadores'),
    h('div', { class: 'ed-head' },
      w.photo ? h('img', { class: 'ed-poster w-head', src: imgSrc(w.photo), alt: '', style: `object-position:${(w.photoPos || 'center 20%').split(' ')[0]} 8%` }) : null,
      h('div', { class: 'ed-tt' },
        h('h1', { class: 'scr-title' }, w.name || 'Sin nombre'),
        h('p', { class: 'ed-sub' }, d.name, titleNames(w).length ? ` · Campeón: ${titleNames(w).join(', ')}` : '')),
      isPublished(w) ? h('a', { class: 'btn2 hd', href: `/roster/${w.slug}/`, target: '_blank', rel: 'noopener' }, 'Ver en la web', icon('ext')) : null),
    h('nav', { class: 'jumps', 'aria-label': 'Partes de la ficha' },
      [['w-datos', 'Datos'], ['w-retrato', 'Retrato'], ['w-fotos', 'Fotos'], ['w-ficha', 'Ficha técnica'], ['w-redes', 'Redes y vídeo']].map(([id, l]) =>
        h('a', { href: `#${id}`, onclick: (e) => { e.preventDefault(); document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' }); } }, l))),
    secDatos(w, errOf),
    secRetrato(w),
    secFotos(w),
    secFicha(w),
    secRedes(w, errOf),
    deleteZone(w));
}

const provTick = (w, key, label = 'Por confirmar') =>
  h('label', { class: 'tick' }, h('input', { type: 'checkbox', checked: (w.provisional || []).includes(key),
    onchange: (e) => change(() => { const p = new Set(w.provisional || []); e.target.checked ? p.add(key) : p.delete(key); if (p.size) w.provisional = [...p]; else delete w.provisional; }, { rerender: false }) }), label);

function secDatos(w, errOf) {
  const oldName = w.name;
  // Aviso en el momento si el nombre ya existe: se ve antes de salir del campo.
  const live = h('div', { class: 'fld-h' });
  const paintLive = () => { const e = checkWrestler(w).errs.find((x) => x.field === 'name'); live.replaceChildren(e ? h('span', { class: 'err' }, icon('alert'), e.msg) : ''); };
  const nameF = field('Nombre', { value: w.name, required: true, max: 40, attrs: { 'data-field': 'name', autocomplete: 'off' },
    hint: 'Si lo cambias, se cambia solo en todos los shows, resultados y crónicas.',
    oninput: (v) => setLive(() => { w.name = v; document.querySelector('.ed-head .scr-title').textContent = v || 'Sin nombre'; paintLive(); nameF.classList.toggle('has-err', !!live.textContent); }),
    onchange: (v) => renameEverywhere(w, oldName, v) });
  paintLive(); nameF.classList.toggle('has-err', !!live.textContent);
  return h('section', { class: 'pane wsec', id: 'w-datos' },
    h('h2', { class: 'pane-h' }, 'Datos'),
    h('div', { class: 'grid' },
      h('div', { class: 'fld-pair' }, nameF, live, provTick(w, 'name')),
      h('fieldset', { class: 'fs', 'data-field': 'division' }, h('legend', {}, 'División'),
        choice('w-div', Object.entries(DIVISIONS).map(([value, x]) => ({ value, label: x.name, color: x.color })), w.division,
          (v) => { S.view.keepScroll = true; change(() => { w.division = v; }); }),
        provTick(w, 'division')),
      h('div', { class: 'grid two tight' },
        h('div', { class: 'fld-pair' },
          field('Apodo (opcional)', { value: w.nickname || '', max: 40, attrs: { placeholder: 'Sin comillas: El Rey de los Canallas' },
            hint: 'La web le pone las comillas.',
            oninput: (v) => setLive(() => { const t = v.replace(/^[«"“']+|[»"”']+$/g, ''); if (t.trim()) w.nickname = t; else delete w.nickname; }) }),
          provTick(w, 'nickname')),
        h('div', { class: 'fld-pair' }, emojiField(w), provTick(w, 'emoji'))),
      field('Biografía (opcional)', { area: true, value: w.bio || w.notes || '', max: 600, attrs: { rows: 4, placeholder: 'Dos o tres frases: quién es, de dónde viene, qué ha ganado.' },
        oninput: (v) => setLive(() => { delete w.notes; if (v.trim()) w.bio = v; else delete w.bio; }) })));
}

// Un solo emoji: se usa en las crónicas y en las listas. Si pegan varios, se queda el primero.
function emojiField(w) {
  const seg = (t) => [...new Intl.Segmenter('es', { granularity: 'grapheme' }).segment(t)].map((x) => x.segment).filter((g) => /\p{Extended_Pictographic}|\p{Regional_Indicator}/u.test(g));
  return field('Emoji (opcional)', { value: w.emoji || '', attrs: { placeholder: '🐺', class: 'emoji-in', autocomplete: 'off' },
    hint: 'Uno solo. En Mac: Ctrl+Cmd+Espacio. En Windows: tecla Windows + punto.',
    oninput: (v, e) => setLive(() => { const g = seg(v); if (g.length) { w.emoji = g[0]; if (e.target.value !== g[0]) e.target.value = g[0]; } else { delete w.emoji; if (v && !g.length) e.target.value = ''; } }) });
}

// Cambiar el nombre en los shows: combates, vídeos, resultados y crónicas.
function renameEverywhere(w, oldName, v) {
  const nn = v.trim().replace(/\s+/g, ' ');
  if (!oldName || !nn || nn === oldName || checkWrestler(w).errs.some((e) => e.field === 'name')) return;
  if (!isPublished(w)) {
    // Ficha nueva: su dirección sigue al nombre.
    let slug = slugify(nn) || w.slug, n = 2; const base = slug;
    while ((wrestlerBy(slug) && wrestlerBy(slug) !== w) || published().some((p) => p.slug === slug)) slug = `${base}-${n++}`;
    if (slug !== w.slug) { remapFiles(w, slug); w.slug = slug; S.view.slug = slug; history.replaceState(null, '', `#luchador/${slug}`); }
  }
  const re = new RegExp(oldName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g');
  let n = 0;
  for (const s of S.shows) {
    const before = JSON.stringify(s);
    for (const m of s.card || []) m.sides = (m.sides || []).map((x) => (x === oldName ? nn : x));
    for (const vd of s.videos || []) vd.sides = (vd.sides || []).map((x) => (x === oldName ? nn : x));
    for (const r of s.results || []) r.text = r.text.replace(re, nn);
    if (s.cronica) s.cronica = s.cronica.replace(re, nn);
    if (JSON.stringify(s) !== before) n++;
  }
  w.name = nn;
  persist();
  S.view.keepScroll = true; render();
  if (n) toast(`Nombre cambiado también en ${n} ${n === 1 ? 'show' : 'shows'}.`);
}
function remapFiles(w, slug) {
  const remap = (p) => (p && S.files.has(p) && p.includes(w.slug) ? p.replaceAll(w.slug, slug) : p);
  for (const [p, f] of [...S.files]) { const np = remap(p); if (np !== p) { S.files.delete(p); S.files.set(np, f); } }
  if (w.photo) w.photo = remap(w.photo);
  if (w.photos) w.photos = w.photos.map(remap);
}

// Retrato: se sube, se reduce y se elige el encuadre pulsando sobre la cara.
function secRetrato(w) {
  const x = parseFloat((w.photoPos || 'center 20%').split(' ')[0]);
  const posX = Number.isFinite(x) ? x : 50;
  const drop = dropZone({
    label: w.photo ? 'Cambiar el retrato' : 'Sube el retrato',
    hint: 'Foto vertical, de cuerpo entero o de cintura para arriba, con fondo oscuro. JPG o PNG de hasta 25 MB: el panel la reduce sola.',
    multiple: false,
    onfiles: async ([f]) => {
      const r = await shrink(f, 1600, 0.82, 900e3);
      const path = `/luchadores/${w.slug}-${Date.now().toString(36)}.jpg`;
      S.files.set(path, { blob: r.blob, url: r.url });
      S.view.keepScroll = true;
      change(() => { w.photo = path; w.photoPos = 'center 20%'; });
      toast(`Retrato listo: ${r.width} × ${r.height} px, ${kb(r.before)} → ${kb(r.after)}. Ahora pulsa sobre su cara.`);
    },
  });
  if (!w.photo) return h('section', { class: 'pane wsec', id: 'w-retrato', 'data-field': 'photo' }, h('h2', { class: 'pane-h' }, 'Retrato'),
    h('p', { class: 'pane-p' }, 'Es la foto grande de su ficha, de la lista de luchadores y de la portada.'), drop);
  const setPos = (e) => {
    const r = e.currentTarget.getBoundingClientRect();
    const px = Math.round(Math.min(100, Math.max(0, ((e.clientX - r.left) / r.width) * 100)));
    S.view.keepScroll = true;
    change(() => { w.photoPos = `${px}% 20%`; });
  };
  const pos = `${posX}% 8%`;
  return h('section', { class: 'pane wsec', id: 'w-retrato', 'data-field': 'photo' },
    h('h2', { class: 'pane-h' }, 'Retrato'),
    h('p', { class: 'pane-p' }, 'Pulsa sobre su cara en la foto de la izquierda. A la derecha ves cómo queda recortada en la web.'),
    h('div', { class: 'frame' },
      h('div', { class: 'frame-src', onclick: setPos, title: 'Pulsa sobre la cara' },
        h('img', { src: imgSrc(w.photo), alt: `Retrato de ${w.name}` }),
        h('span', { class: 'frame-mark', style: `left:${posX}%` })),
      h('div', { class: 'frame-out' },
        h('figure', {}, h('div', { class: 'fo-card' }, h('img', { src: imgSrc(w.photo), alt: '', style: `object-position:${pos}` })), h('figcaption', {}, 'Lista y combates')),
        h('figure', {}, h('div', { class: 'fo-wide' }, h('img', { src: imgSrc(w.photo), alt: '', style: `object-position:${pos}` })), h('figcaption', {}, 'Cabecera de su ficha')))),
    drop);
}

let dragFrom = null;
function secFotos(w) {
  const photos = w.photos || [];
  const room = MAX_PHOTOS - photos.length;
  const drop = dropZone({
    label: 'Sube fotos en acción',
    hint: `Arrastra aquí varias a la vez. Se reducen solas. Máximo ${MAX_PHOTOS} (quedan ${room}).`,
    multiple: true,
    onfiles: async (files) => {
      const left = MAX_PHOTOS - (w.photos || []).length;
      if (left <= 0) { toast(`Ya tiene ${MAX_PHOTOS} fotos, que es el máximo. Quita alguna antes.`); return; }
      const added = [];
      for (const f of files.slice(0, left)) {
        try {
          const r = await shrink(f, 2000, 0.82, 1.2e6);
          const path = `/fotos/por-carpeta/${w.slug}/${Date.now().toString(36)}${added.length}.jpg`;
          S.files.set(path, { blob: r.blob, url: r.url });
          added.push(path);
        } catch { /* no era una imagen */ }
      }
      S.view.keepScroll = true;
      change(() => { (w.photos ||= []).push(...added); });
      const skipped = files.length - added.length;
      toast(`${added.length} fotos añadidas${skipped ? `. ${skipped} no caben o no son imágenes` : ''}`);
    },
  });
  return h('section', { class: 'pane wsec', id: 'w-fotos' },
    h('h2', { class: 'pane-h' }, 'Fotos en acción', h('small', {}, ` ${photos.length} de ${MAX_PHOTOS}`)),
    room > 0 ? drop : h('p', { class: 'muted-s' }, icon('lock'), `Ya tiene ${MAX_PHOTOS} fotos. Para subir otra, quita alguna.`),
    photos.length ? h('p', { class: 'pane-p' }, 'Arrastra para cambiar el orden. Con la estrella, una foto pasa a ser su retrato.') : null,
    h('ul', { class: 'gal' }, photos.map((p, i) => h('li', {
      class: `gi${p === w.photo ? ' hero' : ''}`, draggable: 'true',
      ondragstart: (e) => { dragFrom = i; e.dataTransfer.effectAllowed = 'move'; },
      ondragover: (e) => { e.preventDefault(); e.currentTarget.classList.add('over'); },
      ondragleave: (e) => e.currentTarget.classList.remove('over'),
      ondrop: (e) => { e.preventDefault(); if (dragFrom == null || dragFrom === i) return; const from = dragFrom; dragFrom = null; S.view.keepScroll = true; change(() => { const [x] = w.photos.splice(from, 1); w.photos.splice(i, 0, x); }); },
    },
    h('img', { src: imgSrc(p), alt: '', loading: 'lazy' }),
    p === w.photo && h('span', { class: 'gi-badge' }, 'Retrato'),
    h('div', { class: 'gi-tools' },
      h('button', { class: 'ib', type: 'button', title: 'Usar como retrato', 'aria-label': 'Usar como retrato', 'aria-pressed': p === w.photo ? 'true' : 'false', onclick: () => { S.view.keepScroll = true; change(() => { w.photo = p; w.photoPos = 'center 20%'; }); toast('Ahora es su retrato. Revisa el encuadre arriba.'); } }, icon('star')),
      h('button', { class: 'ib danger', type: 'button', title: 'Quitar foto', 'aria-label': 'Quitar foto', onclick: () => { S.view.keepScroll = true; change(() => { w.photos.splice(i, 1); }); toast('Foto quitada. Puedes deshacerlo.'); } }, icon('trash')))))));
}

// Ficha técnica: cada división enseña solo lo que la web usa.
function secFicha(w) {
  const k = kindOf(w);
  const txt = (key, label, ph, max = 40, extra = {}) => field(label, { value: w[key] || '', max, attrs: { placeholder: ph }, ...extra,
    oninput: (v) => setLive(() => { if (v.trim()) w[key] = v; else delete w[key]; }) });
  const teams = [...new Set(S.roster.map((x) => x.team).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'es'));
  const teamField = () => h('div', { class: 'fld-pair' },
    field('Equipo o facción (opcional)', { value: w.team || '', max: 40, attrs: { placeholder: teams.length ? `Por ejemplo: ${teams[0]}` : '', list: 'teams-dl' },
      hint: 'Escríbelo igual que en las otras fichas del equipo.',
      oninput: (v) => setLive(() => { if (v.trim()) w.team = v; else delete w.team; }) }),
    h('datalist', { id: 'teams-dl' }, teams.map((t) => h('option', { value: t }))),
    provTick(w, 'team'));
  const rows = {
    wrestler: [txt('hometown', 'Procedencia', 'Ciudad o país'), txt('debut', 'Debut en Triple W', 'Por ejemplo: 2019', 20), txt('finisher', 'Movimiento final', 'Por ejemplo: Canario Driver'), w.division === 'parejas' ? membersField(w) : teamField()],
    ref: [txt('hometown', 'Procedencia', 'Ciudad o país'), txt('debut', 'Arbitra en Triple W desde', 'Por ejemplo: 2015', 20)],
    guest: [txt('from', 'Viene de (promotora o club)', 'Por ejemplo: Lucha Libre Madrid'), txt('country', 'País', 'Por ejemplo: Portugal'), txt('debut', 'Primera visita a Triple W', 'Por ejemplo: 2024', 20), txt('finisher', 'Movimiento final', ''), teamField()],
    staff: [txt('role', 'Función', 'Por ejemplo: Presentador'), txt('hometown', 'Procedencia', 'Ciudad o país'), txt('debut', 'En Triple W desde', 'Por ejemplo: 2012', 20)],
  }[k];
  const t = titleNames(w);
  return h('section', { class: 'pane wsec', id: 'w-ficha' },
    h('h2', { class: 'pane-h' }, 'Ficha técnica'),
    h('p', { class: 'pane-p' }, 'Es la tabla que miran las promotoras. Lo que dejes en blanco sale como «Por confirmar».'),
    h('div', { class: 'grid two tight' }, rows),
    k === 'wrestler' && h('p', { class: 'muted-s titles-note' }, icon('star'),
      t.length ? `Campeón: ${t.join(', ')}. Los títulos se cambian en la sección Campeonatos.` : 'Sin títulos ahora mismo. Los títulos se cambian en la sección Campeonatos.'));
}

// Integrantes de una pareja o facción: solo luchadores con ficha, para que se enlacen.
function membersField(w) {
  const members = w.members || [];
  const pool = S.roster.filter((x) => x !== w && x.division !== 'parejas' && !members.includes(x.slug)).sort((a, b) => a.name.localeCompare(b.name, 'es'));
  return h('div', { class: 'fld' },
    h('label', {}, 'Integrantes'),
    members.length ? h('ul', { class: 'rlist' }, members.map((slug) => {
      const m = wrestlerBy(slug);
      return h('li', {}, m?.photo ? h('img', { src: imgSrc(m.photo), alt: '' }) : h('span', { class: 'ac-ph' }, icon('user')), h('span', {}, m?.name || slug),
        h('button', { class: 'ib', type: 'button', 'aria-label': `Quitar a ${m?.name || slug}`, onclick: () => { S.view.keepScroll = true; change(() => { w.members = members.filter((x) => x !== slug); if (!w.members.length) delete w.members; }); } }, icon('x')));
    })) : null,
    h('select', { 'aria-label': 'Añadir integrante', onchange: (e) => { const v = e.target.value; if (!v) return; S.view.keepScroll = true; change(() => { (w.members ||= []).push(v); }); } },
      h('option', { value: '' }, members.length ? 'Añadir otro integrante…' : 'Elige un integrante…'),
      pool.map((x) => h('option', { value: x.slug }, x.name))),
    h('div', { class: 'fld-h' }, 'Si alguien no está en la lista, créale antes su propia ficha.'));
}

function secRedes(w, errOf) {
  const soc = socialOf(w);
  const setNet = (net, raw, inputEl, out) => {
    const { value, err } = cleanHandle(net, raw);
    const s = { ...socialOf(w) };
    if (value) s[net.k] = value; else delete s[net.k];
    delete w.instagram;
    if (Object.keys(s).length) w.social = s; else delete w.social;
    out.replaceChildren(err ? h('span', { class: 'err' }, icon('alert'), err) : value ? h('span', { class: 'ok' }, icon('check'), 'Enlaza a ', h('a', { href: socialUrl(net, value), target: '_blank', rel: 'noopener' }, socialUrl(net, value).replace(/^https?:\/\/(www\.)?/, ''))) : '');
    if (!err && inputEl && value !== raw.trim() && document.activeElement !== inputEl) inputEl.value = value;
    persist();
  };
  return h('section', { class: 'pane wsec', id: 'w-redes' },
    h('h2', { class: 'pane-h' }, 'Redes y vídeo'),
    h('p', { class: 'pane-p' }, 'Pega el enlace de su perfil o escribe solo su usuario. El panel lo deja bien solo.'),
    h('div', { class: 'grid two tight' }, NETS.map((net) => {
      const out = h('div', { class: 'fld-h who-st' });
      const input = h('input', { type: 'text', value: soc[net.k] || '', placeholder: net.k === 'web' ? 'https://…' : net.k === 'youtube' ? 'Enlace del canal' : '@usuario o enlace', autocomplete: 'off', id: `soc-${net.k}`,
        onfocus: () => snapshot(), oninput: (e) => setNet(net, e.target.value, null, out), onchange: (e) => setNet(net, e.target.value, e.target, out) });
      queueMicrotask(() => soc[net.k] && setNet(net, soc[net.k], null, out));
      return h('div', { class: `fld${errOf(`soc-${net.k}`) ? ' has-err' : ''}`, 'data-field': `soc-${net.k}` }, h('label', { for: `soc-${net.k}` }, net.label), input, out);
    })),
    field('Vídeo de su entrada (opcional)', { type: 'url', value: w.video || '', err: errOf('video'), attrs: { placeholder: 'https://www.youtube.com/watch?v=…', 'data-field': 'video' },
      hint: 'Sale como botón «Ver su entrada en vídeo» en su ficha.',
      oninput: (v) => setLive(() => { if (v.trim()) w.video = v.trim(); else delete w.video; }) }));
}

function deleteZone(w) {
  const wrap = h('div', { class: 'danger-z' });
  const inShows = S.shows.filter((s) => JSON.stringify([s.card, s.results, s.videos]).includes(w.name)).length;
  const champ = titleNames(w);
  const ask = () => wrap.replaceChildren(
    h('p', {}, `¿Borrar la ficha de ${w.name}? Desaparecerá de la web al publicar.${inShows ? ` Su nombre seguirá en ${inShows} ${inShows === 1 ? 'show' : 'shows'}, pero sin enlace a su ficha.` : ''} Puedes deshacerlo.`),
    h('div', { class: 'btns' },
      h('button', { class: 'btn2', type: 'button', onclick: idle }, 'No, dejarla'),
      h('button', { class: 'btn2 danger', type: 'button', onclick: () => {
        change(() => { S.roster = S.roster.filter((x) => x !== w); for (const x of S.roster) if (x.members?.includes(w.slug)) x.members = x.members.filter((m) => m !== w.slug); }, { rerender: false });
        go({ name: 'roster' }); toast('Ficha borrada. Puedes deshacerlo.');
      } }, icon('trash'), 'Sí, borrar la ficha')));
  const idle = () => wrap.replaceChildren(champ.length
    ? h('p', { class: 'muted-s' }, icon('lock'), `No se puede borrar: es campeón (${champ.join(', ')}). Cambia antes el título en Campeonatos.`)
    : h('button', { class: 'lnk danger', type: 'button', onclick: ask }, icon('trash'), 'Borrar esta ficha'));
  idle();
  return wrap;
}
