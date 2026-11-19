// Panel de administración de Triple W. Publica de verdad a través de /api/admin (ver store.js);
// sin esa función, funciona en modo demostración.
// Principio: prevenir el error antes que avisar de él. Listas en vez de texto libre,
// fechas y horas con selector, fotos que se reducen solas, deshacer siempre a mano
// y nada se publica si falta algo imprescindible.

import showsJson from '../data/shows.json';
import rosterJson from '../data/roster.json';
import titlesJson from '../data/titles.json';
import homeJson from '../data/portada-triplew.json';
import pagesJson from '../data/paginas-triplew.json';
import hofJson from '../data/salon-fama-triplew.json';
import { cronicaBlocksFor } from '../cronica.js';
import { shrink, palette, inkFor, kb } from './img.js';
import * as store from './store.js';
import { rosterHome, wrestlerEditor, newWrestlerForm, checkWrestler, changedRoster, removedRoster, wrestlerBy } from './luchadores.js';
import { heroPane } from './portada.js';
import { homeEditor, checkHome, homeChanged } from './portada-home.js';
import { ajustesEditor, checkSeo } from './ajustes.js';
import { historiaEditor, sitioEditor, checkPages, checkHof, pagesChanged, hofChanged } from './paginas.js';
import { titlesHome, titleEditor, checkTitle, changedTitles, removedTitles, titleBy } from './campeonatos.js';

const BRANDS = {
  triplew: { name: 'Triple W', color: '#E3EE2B' },
  levelone: { name: 'Level One', color: '#2BD46A' },
};
const METHODS = ['pin', 'sumisión', 'descalificación', 'cuenta fuera', 'rendición'];
const MAX_GALLERY = 60;
const today = () => new Date().toISOString().slice(0, 10);
const clone = (o) => JSON.parse(JSON.stringify(o));

// ---------- Estado ----------
export const S = {
  shows: clone(showsJson.shows),
  roster: clone(rosterJson.wrestlers),
  publishedRoster: JSON.stringify(rosterJson.wrestlers),
  titles: clone(titlesJson.titles),
  publishedTitles: JSON.stringify(titlesJson.titles),
  home: clone(homeJson),
  publishedHome: JSON.stringify(homeJson),
  pages: clone(pagesJson),
  publishedPages: JSON.stringify(pagesJson),
  hof: clone(hofJson),
  publishedHof: JSON.stringify(hofJson),
  venues: clone(showsJson.venues),
  published: JSON.stringify(showsJson.shows),
  publishedVenues: JSON.stringify(showsJson.venues),
  files: new Map(), // ruta pública -> { blob, url }
  view: { name: 'home' },
  undo: [],
  redo: [],
  notice: null,
  publishOpen: false,
  restored: false,
};

export const isPast = (s) => s.date && s.date <= today();
const venues = new Proxy({}, { get: (_, k) => S.venues[k], ownKeys: () => Reflect.ownKeys(S.venues), getOwnPropertyDescriptor: (_, k) => ({ enumerable: true, configurable: true, value: S.venues[k] }) });
const venuesChanged = () => JSON.stringify(S.venues) !== S.publishedVenues;
const showBy = (slug) => S.shows.find((s) => s.slug === slug);
export const imgSrc = (p) => (p && S.files.get(p)?.url) || p;

const docNow = () => JSON.stringify({ shows: S.shows, venues: S.venues, roster: S.roster, titles: S.titles, home: S.home, pages: S.pages, hof: S.hof });
const docLoad = (j) => { const d = JSON.parse(j); S.shows = d.shows; S.venues = d.venues; S.roster = d.roster; S.titles = d.titles; S.home = d.home; S.pages = d.pages; S.hof = d.hof; };
export function snapshot() {
  const now = docNow();
  if (S.undo.at(-1) === now) return;
  S.undo.push(now);
  if (S.undo.length > 80) S.undo.shift();
  S.redo = [];
}
function undo() {
  if (!S.undo.length) return;
  S.redo.push(docNow());
  docLoad(S.undo.pop());
  if (S.view.name === 'show' && !showBy(S.view.slug)) S.view = { name: 'home' };
  if (S.view.name === 'wrestler' && !wrestlerBy(S.view.slug)) S.view = { name: 'roster' };
  if (S.view.name === 'title' && !titleBy(S.view.slug)) S.view = { name: 'titles' };
  toast('Deshecho');
  persist(); render();
}
function redoFn() {
  if (!S.redo.length) return;
  S.undo.push(docNow());
  docLoad(S.redo.pop());
  toast('Rehecho');
  persist(); render();
}

let persistT;
export function persist(now = false) {
  clearTimeout(persistT);
  persistT = setTimeout(async () => {
    const files = [...S.files.entries()].map(([path, f]) => ({ path, blob: f.blob, published: !!f.published }));
    await store.set(store.draftKey(), { shows: S.shows, venues: S.venues, roster: S.roster, titles: S.titles, home: S.home, pages: S.pages, hof: S.hof, remote: S.remote, files, at: Date.now() });
  }, now ? 0 : 400);
  refreshBar();
  if (S.view.name === 'show') {
    const old = document.querySelector('.steps'), sh = showBy(S.view.slug);
    if (old && sh) old.replaceWith(stepsNav(sh, STEPS.find((x) => x.k === S.view.step) || STEPS[0]));
  }
}

// Cambio estructural: se guarda para deshacer y se vuelve a pintar.
export function change(fn, { rerender = true } = {}) {
  snapshot();
  fn();
  persist();
  if (rerender) render();
}

// ---------- Utilidades de DOM ----------
export function h(tag, attrs = {}, ...kids) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v == null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k === 'style') el.style.cssText = v;
    else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else if (k === 'html') el.innerHTML = v;
    else if (v === true) el.setAttribute(k, '');
    else el.setAttribute(k, v);
  }
  for (const k of kids.flat(Infinity)) if (k != null && k !== false) el.append(k.nodeType ? k : document.createTextNode(k));
  return el;
}

const ICONS = {
  plus: 'M12 5v14M5 12h14',
  eye: 'M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12zM12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6z',
  eyeoff: 'M3 3l18 18M10.6 5.1A10.5 10.5 0 0 1 12 5c6.5 0 10 7 10 7a17 17 0 0 1-3.2 4.1M6.6 6.6A17 17 0 0 0 2 12s3.5 7 10 7a9.7 9.7 0 0 0 5.4-1.6M9.9 9.9a3 3 0 0 0 4.2 4.2',
  up: 'M12 19V5M6 11l6-6 6 6',
  down: 'M12 5v14M6 13l6 6 6-6',
  trash: 'M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3',
  check: 'M5 12.5l4.5 4.5L19 7.5',
  alert: 'M12 8v5M12 16.5v.5M10.3 3.9 2.4 18a2 2 0 0 0 1.7 3h15.8a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z',
  undo: 'M9 14 4 9l5-5M4 9h10a6 6 0 0 1 0 12h-3',
  redo: 'M15 14l5-5-5-5M20 9H10a6 6 0 0 0 0 12h3',
  upload: 'M12 16V4M7 9l5-5 5 5M4 16v3a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-3',
  back: 'M15 18l-6-6 6-6',
  ext: 'M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5',
  x: 'M6 6l12 12M18 6 6 18',
  user: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM4 21a8 8 0 0 1 16 0',
  star: 'M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9Z',
  lock: 'M6 11h12v10H6zM8.5 11V7.5a3.5 3.5 0 0 1 7 0V11',
  play: 'M8 5v14l11-7Z',
  wand: 'M15 4V2M15 10V8M11 6h2M17 6h2M4 20 14 10M13 11l-1-1',
};
export const icon = (n, cls = '') =>
  h('span', { class: `ic ${cls}`, 'aria-hidden': 'true', html: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="${ICONS[n]}"/></svg>` });

const dateFmt = new Intl.DateTimeFormat('es-ES', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
export const dateNice = (d) => (d ? dateFmt.format(new Date(d)) : 'Sin fecha');
export const slugify = (t) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

let toastT;
export function toast(msg) {
  const el = document.querySelector('.adm-toast');
  if (!el) return;
  el.textContent = msg;
  el.classList.add('on');
  clearTimeout(toastT);
  toastT = setTimeout(() => el.classList.remove('on'), 2200);
}

// ---------- Validación ----------
// Bloqueos: impiden publicar. Avisos: no impiden, pero se enseñan.
function check(s) {
  const errs = [], warns = [];
  const add = (list, step, field, msg) => list.push({ step, field, msg, slug: s.slug, show: s.name || 'Show sin nombre' });
  if (!s.name || s.name.trim().length < 3) add(errs, 'datos', 'name', 'Falta el nombre del show.');
  if (!s.date) add(errs, 'datos', 'date', 'Falta la fecha.');
  if (!s.brand) add(errs, 'datos', 'brand', 'Elige si es de Triple W o de Level One.');
  if (!s.venue) add(errs, 'datos', 'venue', 'Elige la sala.');
  if (s.ticket?.type === 'venta' && !isPast(s)) {
    const u = s.ticket.url || '';
    if (!u) add(errs, 'datos', 'ticket', 'Falta el enlace de venta de entradas.');
    else if (!/^https:\/\/\S+\.\S+/.test(u)) add(errs, 'datos', 'ticket', 'El enlace de entradas no es una dirección web válida (debe empezar por https://).');
    else if (!/entradium\.com/.test(u)) add(warns, 'datos', 'ticket', 'El enlace de entradas no es de Entradium. Comprueba que es el correcto.');
  }
  (s.card || []).forEach((m, i) => {
    if (!m.title?.trim() && !(m.sides || []).some((x) => x.trim())) add(errs, 'combates', `card-${i}`, `El combate ${i + 1} está vacío. Rellénalo o bórralo.`);
  });
  (s.results || []).forEach((r, i) => { if (!r.text?.trim()) add(errs, 'resultados', `res-${i}`, `El resultado ${i + 1} está vacío. Rellénalo o bórralo.`); });
  (s.videos || []).forEach((v, i) => { if (!v.youtube) add(errs, 'fotos', `vid-${i}`, `El vídeo ${i + 1} no tiene un enlace de YouTube válido.`); });
  if (!isPast(s) && !s.poster) add(warns, 'cartel', 'poster', 'Este show aún no tiene cartel.');
  if (isPast(s) && !(s.results || []).length) add(warns, 'resultados', 'results', 'El show ya se celebró y no tiene resultados.');
  return { errs, warns };
}
// Quita lo vacío (listas sin elementos, textos en blanco) para que abrir y cerrar no cuente como cambio.
function normalize(o) {
  if (Array.isArray(o)) return o.map(normalize);
  if (o && typeof o === 'object') {
    const out = {};
    for (const [k, v] of Object.entries(o)) {
      if (k.startsWith('_')) continue;
      const n = normalize(v);
      if (n === '' || n == null || (Array.isArray(n) && !n.length)) continue;
      out[k] = n;
    }
    return out;
  }
  return typeof o === 'string' ? o.trim() === '' ? '' : o : o;
}
export const same = (a, b) => JSON.stringify(normalize(a)) === JSON.stringify(normalize(b));
const changedShows = () => {
  const before = new Map(JSON.parse(S.published).map((s) => [s.slug, s]));
  return S.shows.filter((s) => !before.has(s.slug) || !same(before.get(s.slug), s));
};

// ---------- Pintado ----------
const app = document.getElementById('app');

export function render() {
  const y = scrollY;
  const keepScroll = S.view.keepScroll;
  S.view.keepScroll = false;
  app.replaceChildren(
    topbar(),
    h('div', { class: 'adm-body' }, sidebar(), h('main', { class: 'adm-main', id: 'main' }, ({ show: showEditor, roster: rosterHome, wrestler: wrestlerEditor, 'wrestler-new': newWrestlerForm, titles: titlesHome, title: titleEditor, portada: homeEditor, historia: historiaEditor, sitio: sitioEditor, ajustes: ajustesEditor }[S.view.name] || home)())),
    publishBar(),
    h('div', { class: 'adm-toast', role: 'status' }),
  );
  if (keepScroll) scrollTo(0, y); else scrollTo(0, 0);
  // Tras añadir a alguien a una rumble, el cursor vuelve a la caja para seguir añadiendo sin usar el ratón.
  if (S.focusAdd != null) { document.querySelector(`[data-field="card-${S.focusAdd}"] .rumble input`)?.focus({ preventScroll: true }); S.focusAdd = null; }
  refreshBar();
}

function topbar() {
  return h('header', { class: 'adm-top' },
    h('a', { class: 'adm-brand', href: '#', onclick: (e) => { e.preventDefault(); go({ name: 'home' }); } },
      h('img', { src: '/logo/whitewolf-blanco.svg', alt: '', width: 30, height: 29 }),
      h('span', {}, 'Panel ', h('b', {}, 'Triple W'))),
    store.mode === 'demo' ? h('span', { class: 'adm-demo', title: store.setupPending ? 'Falta configurar el guardado en Vercel (token de GitHub y contraseña).' : 'Los cambios se quedan en este ordenador. La web pública no cambia.' }, 'Modo demostración') : null,
    h('div', { class: 'adm-top-r' },
      h('button', { class: 'tbtn', type: 'button', onclick: undo, disabled: !S.undo.length, title: 'Deshacer (Ctrl+Z)' }, icon('undo'), h('span', {}, 'Deshacer')),
      h('button', { class: 'tbtn', type: 'button', onclick: redoFn, disabled: !S.redo.length, title: 'Rehacer (Ctrl+Mayús+Z)' }, icon('redo'), h('span', {}, 'Rehacer'))));
}

function sidebar() {
  const items = [
    { k: 'shows', label: 'Shows', view: 'home' },
    { k: 'portada', label: 'Portada', view: 'portada' },
    { k: 'roster', label: 'Luchadores', view: 'roster' },
    { k: 'titulos', label: 'Campeonatos', view: 'titles' },
    { k: 'paginas', label: 'Historia y Salón de la Fama', view: 'historia' },
    { k: 'sitio', label: 'Redes y contacto', view: 'sitio' },
    { k: 'ajustes', label: 'Ajustes', view: 'ajustes' },
  ];
  return h('nav', { class: 'adm-side', 'aria-label': 'Secciones del panel' },
    h('div', { class: 'side-list' },
      items.map((it) => {
        const cur = it.k === (/^(roster|wrestler)/.test(S.view.name) ? 'roster' : /^title/.test(S.view.name) ? 'titulos' : S.view.name === 'portada' ? 'portada' : S.view.name === 'historia' ? 'paginas' : S.view.name === 'sitio' ? 'sitio' : S.view.name === 'ajustes' ? 'ajustes' : 'shows');
        return it.view
        ? h('a', { href: { roster: '#luchadores', titles: '#campeonatos', portada: '#portada', historia: '#historia', sitio: '#redes', ajustes: '#ajustes' }[it.view] || '#', class: cur ? 'on' : null, 'aria-current': cur ? 'page' : null, onclick: (e) => { e.preventDefault(); go({ name: it.view }); } }, it.label)
        : h('span', { class: 'off', title: 'Disponible en la siguiente versión del prototipo' }, it.label, h('small', {}, 'Pronto'));
      })),
    h('div', { class: 'side-foot' },
      h('p', {}, store.mode === 'demo'
        ? 'Modo demostración: los cambios se quedan en este ordenador y la web no cambia.'
        : 'Los cambios se guardan y la web se vuelve a publicar sola en 1 o 2 minutos.'),
      h('a', { href: '/', target: '_blank', rel: 'noopener' }, 'Ver la web ', icon('ext')),
      store.mode === 'real' ? h('button', { class: 'lnk', type: 'button', onclick: () => { store.clearKey(); location.reload(); } }, 'Cerrar sesión') : null));
}

export function go(view) {
  S.view = view;
  S.publishOpen = false;
  if (view.name === 'show') location.hash = `show/${view.slug}/${view.step || 'datos'}`;
  else if (view.name === 'wrestler') location.hash = `luchador/${view.slug}`;
  else if (view.name === 'roster') location.hash = 'luchadores';
  else if (view.name === 'title') location.hash = `campeonato/${view.slug}`;
  else if (view.name === 'titles') location.hash = 'campeonatos';
  else if (view.name === 'portada') location.hash = 'portada';
  else if (view.name === 'historia') location.hash = 'historia';
  else if (view.name === 'sitio') location.hash = 'redes';
  else if (view.name === 'ajustes') location.hash = 'ajustes';
  else history.replaceState(null, '', location.pathname);
  render();
}

// ---------- Inicio de Shows ----------
function home() {
  const upcoming = S.shows.filter((s) => !isPast(s)).sort((a, b) => a.date.localeCompare(b.date));
  const past = S.shows.filter(isPast).sort((a, b) => b.date.localeCompare(a.date));
  // Por completar: todos los shows celebrados a los que les falta algo, del más reciente al más antiguo.
  const missing = (s) => [!(s.results || []).length && 'resultados', !(s.gallery || []).length && 'fotos', !s.cronica && 'crónica'].filter(Boolean);
  const pending = past.filter((s) => missing(s).length);
  const SHOWN = 3;
  return h('div', { class: 'home' },
    S.restored && h('div', { class: 'note' }, icon('undo'),
      h('p', {}, 'Has recuperado los cambios sin publicar de la última vez.'),
      h('button', { class: 'lnk', type: 'button', onclick: discardAll }, 'Descartarlos y empezar de cero')),
    h('div', { class: 'scr-head' },
      h('div', {}, h('h1', { class: 'scr-title' }, 'Shows'),
        h('p', { class: 'scr-sub' }, `${S.shows.length} shows · ${upcoming.length} próximos · ${past.length} celebrados`)),
      h('button', { class: 'btn1 hd', type: 'button', onclick: newShow }, icon('plus'), 'Nuevo show')),
    h('p', { class: 'lead' }, '¿Qué quieres hacer?'),
    h('div', { class: 'tasks' },
      h('button', { class: 'task', type: 'button', onclick: newShow },
        h('span', { class: 'task-ic' }, icon('plus')),
        h('span', { class: 'task-t' }, 'Nuevo show'),
        h('span', { class: 'task-d' }, 'Nombre, fecha, sala, cartel, entradas y combates.')),
      pending.length
        ? h('div', { class: 'task todo' },
          h('span', { class: 'task-ic' }, icon('star')),
          h('span', { class: 'task-t' }, pending.length === 1 ? '1 show por completar' : `${pending.length} shows por completar`),
          h('ul', { class: 'todo-list' },
            pending.slice(0, S.allPending ? pending.length : SHOWN).map((p) => h('li', {},
              h('a', { href: `#show/${p.slug}`, onclick: (e) => { e.preventDefault(); const m = missing(p)[0]; go({ name: 'show', slug: p.slug, step: m === 'resultados' ? 'resultados' : m === 'fotos' ? 'fotos' : 'cronica' }); } },
                h('b', {}, p.name), h('span', {}, `Falta: ${missing(p).join(', ')}`))))),
          pending.length > SHOWN && h('button', { class: 'lnk', type: 'button', onclick: () => { S.allPending = !S.allPending; S.view.keepScroll = true; render(); } },
            S.allPending ? 'Ver menos' : `Ver los ${pending.length - SHOWN} restantes`))
        : h('div', { class: 'task done' },
          h('span', { class: 'task-ic' }, icon('check')),
          h('span', { class: 'task-t' }, 'Todo al día'),
          h('span', { class: 'task-d' }, 'Todos los shows celebrados tienen resultados, fotos y crónica.'))),
    h('h2', { class: 'list-h' }, 'Próximos', h('small', {}, upcoming.length)),
    upcoming.length ? h('ul', { class: 'shows' }, upcoming.map(showRow)) : h('p', { class: 'empty' }, 'No hay ningún show anunciado. Pulsa «Nuevo show» para crear el siguiente.'),
    h('h2', { class: 'list-h' }, 'Celebrados', h('small', {}, past.length)),
    h('ul', { class: 'shows' }, past.map(showRow)));
}

function showRow(s) {
  const chips = [];
  const { errs } = check(s);
  if (errs.length) chips.push(h('span', { class: 'chip bad' }, icon('alert'), 'Falta información'));
  if (isPast(s)) {
    if (!(s.results || []).length) chips.push(h('span', { class: 'chip warn' }, 'Sin resultados'));
    if (!(s.gallery || []).length) chips.push(h('span', { class: 'chip warn' }, 'Sin fotos'));
    if (!s.cronica) chips.push(h('span', { class: 'chip warn' }, 'Sin crónica'));
  } else {
    if (!s.poster) chips.push(h('span', { class: 'chip warn' }, 'Sin cartel'));
    if (!(s.card || []).length) chips.push(h('span', { class: 'chip warn' }, 'Sin combates'));
  }
  const before = JSON.parse(S.published).find((p) => p.slug === s.slug);
  if (!before) chips.unshift(h('span', { class: 'chip new' }, 'Nuevo'));
  else if (!same(before, s)) chips.unshift(h('span', { class: 'chip new' }, 'Con cambios'));
  return h('li', {},
    h('a', { href: `#show/${s.slug}/datos`, class: 'show-row', style: `--c:${s.color || '#444'}`, onclick: (e) => { e.preventDefault(); go({ name: 'show', slug: s.slug, step: 'datos' }); } },
      s.poster ? h('img', { class: 'sr-poster', src: imgSrc(s.poster), alt: '', loading: 'lazy' }) : h('span', { class: 'sr-poster none' }),
      h('span', { class: 'sr-main' },
        h('span', { class: 'sr-name' }, s.name || 'Show sin nombre'),
        h('span', { class: 'sr-meta' }, `${dateNice(s.date)} · ${BRANDS[s.brand]?.name || '—'} · ${venues[s.venue]?.name || 'Sin sala'}`)),
      h('span', { class: 'sr-chips' }, chips)));
}

function newShow() {
  const base = 'show-nuevo';
  let slug = base, n = 2;
  while (showBy(slug)) slug = `${base}-${n++}`;
  change(() => {
    S.shows.push({ slug, name: '', brand: 'triplew', date: '', doors: '17:30', start: '18:00', venue: 'lucharama', ticket: { type: 'inversa' }, color: BRANDS.triplew.color, ink: inkFor(BRANDS.triplew.color), tagline: '', card: [], _new: true });
  }, { rerender: false });
  go({ name: 'show', slug, step: 'datos' });
}

// ---------- Editor de un show ----------
const STEPS = [
  { k: 'datos', label: 'Datos' },
  { k: 'cartel', label: 'Cartel y color' },
  { k: 'combates', label: 'Combates' },
  { k: 'portada', label: 'Portada' },
  { k: 'resultados', label: 'Resultados', past: true },
  { k: 'fotos', label: 'Fotos y vídeos', past: true },
  { k: 'cronica', label: 'Crónica', past: true },
];

function showEditor() {
  const s = showBy(S.view.slug);
  if (!s) return h('p', {}, 'Ese show ya no existe.');
  const step = STEPS.find((x) => x.k === S.view.step) || STEPS[0];
  const locked = step.past && !isPast(s);
  return h('div', { class: 'ed', style: `--c:${s.color};--ci:${s.ink}` },
    h('a', { href: '#', class: 'back', onclick: (e) => { e.preventDefault(); go({ name: 'home' }); } }, icon('back'), 'Todos los shows'),
    h('div', { class: 'ed-head' },
      s.poster ? h('img', { class: 'ed-poster', src: imgSrc(s.poster), alt: '' }) : null,
      h('div', { class: 'ed-tt' },
        h('h1', { class: 'scr-title' }, s.name || 'Nuevo show'),
        h('p', { class: 'ed-sub' }, s.date ? `${dateNice(s.date)}${isPast(s) ? ' · ya celebrado' : ''}` : 'Empieza por el nombre y la fecha.')),
      h('div', { class: 'hd-btns' },
        previewBtn(step.k === 'portada' ? '' : `shows/${s.slug}`, step.k === 'portada' ? 'Vista previa de la portada' : 'Vista previa'),
        JSON.parse(S.published).some((p) => p.slug === s.slug)
          ? h('a', { class: 'btn2 hd', href: `/shows/${s.slug}/`, target: '_blank', rel: 'noopener' }, 'Ver en la web', icon('ext')) : null)),
    stepsNav(s, step),
    locked
      ? h('div', { class: 'locked' }, icon('lock'),
        h('div', {}, h('p', { class: 'locked-t' }, 'Esto se rellena después del show.'),
          h('p', {}, `Se abrirá solo el ${dateNice(s.date)}. Así nadie publica resultados de un show que aún no ha pasado.`)))
      : h('section', { class: 'pane' }, PANES[step.k](s)),
    h('div', { class: 'pager' },
      prevNext(s, step)));
}

function stepsNav(s, step) {
  const { errs, warns } = check(s);
  const stepState = (k) => (errs.some((e) => e.step === k) ? 'bad' : warns.some((e) => e.step === k) ? 'warn' : null);
  return h('nav', { class: 'steps', 'aria-label': 'Partes del show' },
    STEPS.map((x, i) => {
      const off = x.past && !isPast(s);
      const st = stepState(x.k);
      return h('a', {
        href: `#show/${s.slug}/${x.k}`, class: `step${x.k === step.k ? ' on' : ''}${off ? ' later' : ''}${st ? ` st-${st}` : ''}`,
        'aria-current': x.k === step.k ? 'step' : null,
        onclick: (e) => { e.preventDefault(); go({ name: 'show', slug: s.slug, step: x.k }); },
      }, h('span', { class: 'step-n' }, st ? icon('alert') : off ? icon('lock') : i + 1), x.label,
      st && h('span', { class: 'sr-only' }, st === 'bad' ? ' (falta información)' : ' (aviso)'));
    }));
}

function prevNext(s, step) {
  const i = STEPS.indexOf(step);
  const prev = STEPS[i - 1], next = STEPS[i + 1];
  return [
    prev ? h('button', { class: 'btn2', type: 'button', onclick: () => go({ name: 'show', slug: s.slug, step: prev.k }) }, icon('back'), prev.label) : h('span'),
    next && !(next.past && !isPast(s)) ? h('button', { class: 'btn2 fwd', type: 'button', onclick: () => go({ name: 'show', slug: s.slug, step: next.k }) }, `Siguiente: ${next.label}`) : h('span'),
  ];
}

// Campo de texto que guarda al escribir sin repintar (para no perder el foco).
export function field(label, { value = '', oninput, onchange, type = 'text', hint, max, id, required, attrs = {}, area = false, err: e } = {}) {
  const err = e?.msg, warn = e?.warn;
  const fid = id || `f${Math.random().toString(36).slice(2, 8)}`;
  const counter = max ? h('span', { class: 'count' }, `${value.length}/${max}`) : null;
  const input = h(area ? 'textarea' : 'input', {
    id: fid, type: area ? null : type, maxlength: max, required, 'aria-invalid': err ? 'true' : null,
    'aria-describedby': hint || err ? `${fid}-h` : null, ...attrs,
    oninput: (e) => { if (counter) counter.textContent = `${e.target.value.length}/${max}`; oninput?.(e.target.value, e); },
    onchange: (e) => onchange?.(e.target.value, e),
    onfocus: () => snapshot(),
  });
  if (area) input.value = value; else input.value = value;
  return h('div', { class: `fld${err ? (warn ? ' has-warn' : ' has-err') : ''}`, 'data-field': attrs['data-field'] },
    h('label', { for: fid }, label, required && h('span', { class: 'req' }, ' obligatorio')),
    input,
    (hint || err || counter) && h('div', { class: 'fld-h', id: `${fid}-h` }, err ? h('span', { class: warn ? 'warn' : 'err' }, icon('alert'), err) : hint, counter));
}

// Opciones grandes en lugar de desplegables: se ve todo y no hay forma de equivocarse de campo.
export function choice(name, options, current, onpick) {
  return h('div', { class: 'choice', role: 'radiogroup' },
    options.map((o) => h('label', { class: `opt${o.value === current ? ' on' : ''}`, style: o.color ? `--oc:${o.color}` : null },
      h('input', { type: 'radio', name, value: o.value, checked: o.value === current, onchange: () => onpick(o.value) }),
      o.color && h('span', { class: 'opt-dot' }),
      h('span', { class: 'opt-t' }, o.label),
      o.note && h('span', { class: 'opt-d' }, o.note))));
}

export const setLive = (fn) => { fn(); persist(); };

const PANES = {
  portada: (s) => heroPane(s),
  datos(s) {
    // Los fallos solo se enseñan en rojo después de intentar publicar; los avisos, siempre.
    const errOf = (f) => { const c = check(s); const e = S.showErrors && c.errs.find((x) => x.field === f); const w = c.warns.find((x) => x.field === f); return e ? { msg: e.msg } : w ? { msg: w.msg, warn: true } : null; };
    const isNew = !JSON.parse(S.published).some((p) => p.slug === s.slug);
    return h('div', { class: 'grid' },
      field('Nombre del show', {
        value: s.name, max: 60, required: true, attrs: { 'data-field': 'name', autocomplete: 'off', placeholder: 'Por ejemplo: Top 1 2026' },
        oninput: (v) => setLive(() => { s.name = v; document.querySelector('.ed-head .scr-title').textContent = v || 'Nuevo show'; }),
        onchange: () => { if (isNew && s.name.trim()) renameSlug(s); },
        hint: 'Tal como aparece en el cartel.',
      }),
      h('fieldset', { class: 'fs' }, h('legend', {}, '¿De quién es el show?'),
        choice('brand', Object.entries(BRANDS).map(([value, b]) => ({ value, label: b.name, color: b.color })), s.brand,
          (v) => change(() => { const wasDefault = Object.values(BRANDS).some((b) => b.color === s.color); s.brand = v; if (wasDefault) { s.color = BRANDS[v].color; s.ink = inkFor(s.color); } }, { rerender: true }))),
      h('div', { class: 'row3' },
        field('Fecha', { type: 'date', value: s.date, required: true, attrs: { 'data-field': 'date' }, err: errOf('date'),
          onchange: (v) => change(() => { s.date = v; }) }),
        field('Abren puertas', { type: 'time', value: s.doors || '', attrs: { step: 300 }, onchange: (v) => change(() => { s.doors = v; }, { rerender: false }) }),
        field('Empieza', { type: 'time', value: s.start || '', attrs: { step: 300 }, onchange: (v) => change(() => { s.start = v; }, { rerender: false }) })),
      h('fieldset', { class: 'fs' }, h('legend', {}, 'Sala'),
        choice('venue', Object.entries(S.venues).map(([value, v]) => ({ value, label: v.name, note: v.address })), s.venue,
          (v) => change(() => { s.venue = v; })),
        venueTools(s)),
      h('fieldset', { class: 'fs', 'data-field': 'ticket' }, h('legend', {}, 'Entradas'),
        choice('ticket', [
          { value: 'venta', label: 'Venta de entradas', note: 'Se compran antes en Entradium. La web pondrá un botón grande de «Compra tu entrada».' },
          { value: 'inversa', label: 'Entrada inversa', note: 'Se entra gratis y se paga al salir lo que cada uno quiera.' },
          { value: 'gratis', label: 'Gratis', note: 'Se entra gratis y no se paga nada.' },
          { value: 'taquilla', label: 'En taquilla', note: 'Las entradas se compran en la puerta el mismo día.' },
          { value: 'agotado', label: 'Agotadas', note: 'Ya no quedan entradas. La web lo dice y quita el botón de compra.' },
        ], s.ticket?.type, (v) => change(() => { s.ticket = v === 'venta' ? { type: 'venta', url: s.ticket?.url || '' } : { type: v, ...(s.ticket?.url ? { url: s.ticket.url } : {}) }; })),
        s.ticket?.type === 'venta' && field('Enlace de Entradium', {
          type: 'url', value: s.ticket.url || '', required: true, err: errOf('ticket'),
          attrs: { placeholder: 'https://entradium.com/events/…', inputmode: 'url', autocomplete: 'off' },
          hint: 'Copia la dirección de la página del evento en Entradium y pégala aquí.',
          oninput: (v) => setLive(() => { s.ticket.url = v.trim(); }),
          onchange: () => { S.view.keepScroll = true; render(); },
        })),
      field('Frase del cartel', { area: true, value: s.tagline || '', max: 140, attrs: { rows: 2, placeholder: 'Una línea que enganche. Sale debajo del nombre.' },
        oninput: (v) => setLive(() => { s.tagline = v; }) }),
      dangerZone(s));
  },

  cartel(s) {
    const drop = dropZone({
      label: s.poster ? 'Cambiar el cartel' : 'Sube el cartel del show',
      hint: 'Arrastra aquí la imagen o pulsa para elegirla. JPG o PNG, vertical como en Instagram, de hasta 25 MB. El panel la deja sola en 1500 píxeles como máximo y menos de 1,5 MB.',
      multiple: false,
      onfiles: async ([f]) => {
        const r = await shrink(f, 1500, 0.85, 1.5e6);
        const path = `/carteles/${s.slug}-${Date.now().toString(36)}.jpg`;
        S.files.set(path, { blob: r.blob, url: r.url });
        change(() => { s.poster = path; }, { rerender: false });
        toast(`Cartel listo: ${r.width} × ${r.height} px, ${kb(r.before)} → ${kb(r.after)}`);
        S.suggest = await palette(r.url).catch(() => []);
        S.view.keepScroll = true; render();
      },
    });
    const sw = [...new Set([...(S.suggest || []), BRANDS[s.brand]?.color, s.color].filter(Boolean))].slice(0, 7);
    if (s.poster && !S.suggest) palette(imgSrc(s.poster)).then((p) => { S.suggest = p; S.view.keepScroll = true; render(); }).catch(() => { S.suggest = []; });
    return h('div', { class: 'grid two' },
      h('div', {}, s.poster
        ? h('figure', { class: 'poster-big' }, h('img', { src: imgSrc(s.poster), alt: `Cartel de ${s.name}` }),
          h('button', { class: 'lnk danger', type: 'button', onclick: () => change(() => { delete s.poster; }) }, icon('trash'), 'Quitar el cartel'))
        : null, drop),
      h('div', {},
        h('h3', { class: 'pane-h' }, 'Color del show'),
        h('p', { class: 'pane-p' }, 'Cada show tiene su color, sacado del cartel. Se usa en los botones y detalles de su página. Elige uno de los que hemos encontrado en el cartel:'),
        h('div', { class: 'swatches', role: 'radiogroup', 'aria-label': 'Color del show' },
          sw.map((c) => h('button', { type: 'button', role: 'radio', 'aria-checked': c.toUpperCase() === s.color?.toUpperCase() ? 'true' : 'false', class: 'sw', style: `--sw:${c}`, title: c,
            onclick: () => change(() => { s.color = c; s.ink = inkFor(c); }, { rerender: true }) }, h('span', { class: 'sr-only' }, c))),
          h('label', { class: 'sw custom', title: 'Otro color' }, icon('plus'),
            h('input', { type: 'color', value: s.color || '#ffffff', 'aria-label': 'Elegir otro color',
              onchange: (e) => change(() => { s.color = e.target.value.toUpperCase(); s.ink = inkFor(s.color); }) }))),
        h('p', { class: 'pane-p' }, 'Así quedarán los botones. El color del texto se elige solo para que siempre se lea.'),
        h('div', { class: 'cta-prev', style: `--c:${s.color};--ci:${s.ink}` },
          h('span', { class: 'cta-btn' }, ({ venta: 'Compra tu entrada', inversa: 'Entrada inversa', gratis: 'Entrada gratuita', taquilla: 'Entrada en taquilla', agotado: 'Entradas agotadas' })[s.ticket?.type] || 'Entrada inversa'),
          h('span', { class: 'cta-tag' }, s.name || 'Nombre del show'))));
  },

  combates(s) {
    const card = s.card || [];
    return h('div', {},
      h('p', { class: 'pane-p' }, 'Los combates anunciados, en el orden del cartel. Al escribir un nombre, el panel te sugiere los del roster: si eliges uno, su foto y su ficha se enlazan solas. También puedes escribir cualquier otro nombre.'),
      h('ol', { class: 'matches' }, card.map((m, i) => matchCard(s, m, i))),
      h('button', { class: 'btn2 add', type: 'button', onclick: () => { S.view.keepScroll = true; change(() => { (s.card ||= []).push({ title: '', sides: ['', ''] }); }); } }, icon('plus'), 'Añadir combate'));
  },

  resultados(s) {
    const results = s.results || [];
    const card = s.card || [];
    return h('div', {},
      card.length ? h('div', { class: 'helper' },
        h('h3', { class: 'pane-h' }, icon('wand'), 'Escribir un resultado sin teclear'),
        h('p', { class: 'pane-p' }, 'Elige el combate, quién ganó y cómo. La frase se escribe sola y la puedes retocar después.'),
        resultBuilder(s)) : null,
      h('h3', { class: 'pane-h' }, 'Resultados de este show', h('small', {}, ` ${results.length}`)),
      results.length ? h('ol', { class: 'results' }, results.map((r, i) => h('li', { class: 'res' },
        h('span', { class: 'res-n' }, i + 1),
        field(`Resultado ${i + 1}`, { area: true, value: r.text, attrs: { rows: 2, 'data-field': `res-${i}` }, oninput: (v) => setLive(() => { r.text = v; }) }),
        h('label', { class: 'tick' }, h('input', { type: 'checkbox', checked: !!r.provisional, onchange: (e) => change(() => { if (e.target.checked) r.provisional = true; else delete r.provisional; }, { rerender: false }) }), 'Pendiente de confirmar'),
        rowTools(s.results, i, 'resultado')))) : h('p', { class: 'empty' }, 'Todavía no hay resultados. Usa el asistente de arriba o añade uno a mano.'),
      h('button', { class: 'btn2 add', type: 'button', onclick: () => { S.view.keepScroll = true; change(() => { (s.results ||= []).push({ text: '' }); }); } }, icon('plus'), 'Añadir un resultado a mano'));
  },

  fotos(s) {
    const gallery = s.gallery || [];
    const drop = dropZone({
      label: 'Sube las fotos del show',
      hint: `Arrastra aquí todas a la vez o pulsa para elegirlas. Se reducen solas. Máximo ${MAX_GALLERY}.`,
      multiple: true,
      onfiles: async (files) => {
        s.gallery ||= [];
        const room = MAX_GALLERY - s.gallery.length;
        if (room <= 0) { toast(`Ya hay ${MAX_GALLERY} fotos, que es el máximo.`); return; }
        const list = files.slice(0, room);
        let before = 0, after = 0;
        const added = [];
        const prog = document.querySelector('.drop-prog');
        for (const [k, f] of list.entries()) {
          if (prog) prog.textContent = `Preparando foto ${k + 1} de ${list.length}…`;
          try {
            const r = await shrink(f, 2000, 0.82, 2.5e6);
            // Nombre único: nunca pisa una foto que ya exista en la web aunque se haya quitado de la galería.
            const path = `/fotos/por-carpeta/${s.slug}/${Date.now().toString(36)}-${k}.jpg`;
            S.files.set(path, { blob: r.blob, url: r.url });
            added.push(path); before += r.before; after += r.after;
          } catch { /* no era una imagen: se ignora sin romper nada */ }
        }
        change(() => { s.gallery.push(...added); }, { rerender: false });
        const skipped = files.length - added.length;
        toast(`${added.length} fotos añadidas (${kb(before)} → ${kb(after)})${skipped ? `. ${skipped} no se han añadido` : ''}`);
        S.view.keepScroll = true; render();
      },
    });
    return h('div', {},
      h('h3', { class: 'pane-h' }, 'Fotos', h('small', {}, ` ${gallery.length}`)),
      drop,
      gallery.length ? h('p', { class: 'pane-p' }, 'Arrastra las fotos para cambiar el orden. La primera sale de fondo en la cabecera del show salvo que marques otra con la estrella.') : null,
      h('ul', { class: 'gal' }, gallery.map((p, i) => galleryItem(s, p, i))),
      h('h3', { class: 'pane-h' }, 'Vídeos', h('small', {}, ` ${(s.videos || []).length}`)),
      h('p', { class: 'pane-p' }, 'Pega el enlace de YouTube de cada combate. Al elegir quién lucha, el vídeo sale también en la ficha de cada luchador.'),
      h('ul', { class: 'vids' }, (s.videos || []).map((v, i) => videoItem(s, v, i))),
      h('button', { class: 'btn2 add', type: 'button', onclick: () => change(() => { (s.videos ||= []).push({ youtube: '', title: '', sides: [] }); }) }, icon('plus'), 'Añadir un vídeo'));
  },

  cronica(s) {
    const prev = h('div', { class: 'cron-prev' });
    const paint = () => {
      const blocks = cronicaBlocksFor(s.cronica || '', S.roster);
      prev.replaceChildren(...(blocks.length ? blocks.map((b) => h(b.kind === 'h' ? 'h4' : 'p', { class: `cb ${b.kind}`, html: b.html })) : [h('p', { class: 'empty' }, 'Aquí verás cómo queda.')]));
      prev.querySelectorAll('a').forEach((a) => { a.target = '_blank'; a.rel = 'noopener'; });
    };
    paint();
    let t;
    return h('div', { class: 'grid two cron' },
      h('div', {},
        field('Crónica del show', { area: true, value: s.cronica || '', attrs: { rows: 18, placeholder: 'Pega aquí el texto de la publicación de Instagram, tal cual.' },
          hint: 'Deja una línea en blanco entre párrafos. Los emojis se quitan solos.',
          oninput: (v) => setLive(() => { if (v.trim()) s.cronica = v; else delete s.cronica; clearTimeout(t); t = setTimeout(paint, 250); }) })),
      h('div', {},
        h('h3', { class: 'pane-h' }, 'Así se verá'),
        h('ul', { class: 'legend' },
          h('li', {}, h('span', { class: 'lg lg-lead' }), 'El primer párrafo se destaca'),
          h('li', {}, h('span', { class: 'lg lg-res' }), 'Las frases con resultado se marcan solas'),
          h('li', {}, h('span', { class: 'lg lg-link' }), 'Los nombres del roster se enlazan a su ficha')),
        prev));
  },
};

function renameSlug(s) {
  let slug = slugify(`${s.name} ${(s.date || today()).slice(0, 4)}`.replace(/\b(\d{4}) \1$/, '$1')) || 'show';
  if (slug === s.slug) return;
  let n = 2; const base = slug;
  while (showBy(slug)) slug = `${base}-${n++}`;
  // Las rutas de fotos nuevas siguen al show.
  const remap = (p) => (p && p.includes(`/${s.slug}`) ? p.replace(`/${s.slug}`, `/${slug}`) : p);
  for (const [p, f] of [...S.files]) { const np = remap(p); if (np !== p) { S.files.delete(p); S.files.set(np, f); } }
  s.poster = remap(s.poster); if (!s.poster) delete s.poster;
  if (s.gallery) s.gallery = s.gallery.map(remap);
  s.slug = slug;
  S.view.slug = slug;
  history.replaceState(null, '', `#show/${slug}/${S.view.step || 'datos'}`);
  persist();
}

// Añadir una sala nueva o quitar una que ya no se usa. Una sala con shows no se puede borrar.
function venueTools(s) {
  const wrap = h('div', { class: 'vt' });
  const idle = () => wrap.replaceChildren(
    h('button', { class: 'lnk', type: 'button', onclick: addForm }, icon('plus'), 'Añadir sala nueva'),
    h('button', { class: 'lnk', type: 'button', onclick: manage }, 'Quitar salas'));
  const addForm = () => {
    const d = { name: '', address: '', map: '' };
    const err = h('div', { class: 'fld-h' });
    wrap.replaceChildren(h('div', { class: 'sub-form' },
      h('p', { class: 'pane-h' }, 'Sala nueva'),
      field('Nombre de la sala', { required: true, max: 50, attrs: { placeholder: 'Por ejemplo: Sala Revi' }, oninput: (v) => { d.name = v; } }),
      field('Dirección', { max: 90, attrs: { placeholder: 'Calle, número, código postal y ciudad' }, oninput: (v) => { d.address = v; } }),
      field('Enlace de Google Maps (opcional)', { type: 'url', attrs: { placeholder: 'https://maps.app.goo.gl/…' }, oninput: (v) => { d.map = v.trim(); } }),
      err,
      h('div', { class: 'btns' },
        h('button', { class: 'btn2', type: 'button', onclick: idle }, 'Cancelar'),
        h('button', { class: 'btn1', type: 'button', onclick: () => {
          const name = d.name.trim();
          if (name.length < 2) { err.replaceChildren(h('span', { class: 'err' }, icon('alert'), 'Escribe el nombre de la sala.')); return; }
          if (Object.values(S.venues).some((v) => v.name.toLowerCase() === name.toLowerCase())) { err.replaceChildren(h('span', { class: 'err' }, icon('alert'), 'Ya hay una sala con ese nombre.')); return; }
          if (d.map && !/^https:\/\//.test(d.map)) { err.replaceChildren(h('span', { class: 'err' }, icon('alert'), 'El enlace de Maps debe empezar por https://')); return; }
          let key = slugify(name) || 'sala'; let n = 2; const base = key; while (S.venues[key]) key = `${base}-${n++}`;
          S.view.keepScroll = true;
          change(() => { S.venues[key] = { name, ...(d.address.trim() ? { address: d.address.trim() } : {}), ...(d.map ? { map: d.map } : {}) }; s.venue = key; });
          toast(`Sala «${name}» añadida`);
        } }, 'Guardar sala'))));
  };
  const manage = () => {
    const uses = (k) => S.shows.filter((x) => x.venue === k).length;
    wrap.replaceChildren(h('div', { class: 'sub-form' },
      h('p', { class: 'pane-h' }, 'Quitar salas'),
      h('p', { class: 'pane-p' }, 'Solo se puede quitar una sala que no tenga ningún show. Así ningún show se queda sin sala.'),
      h('ul', { class: 'vlist' }, Object.entries(S.venues).map(([k, v]) => {
        const n = uses(k);
        return h('li', {}, h('span', {}, h('b', {}, v.name), h('small', {}, n ? ` · ${n} ${n === 1 ? 'show' : 'shows'}` : ' · sin shows')),
          n ? h('span', { class: 'muted-s' }, icon('lock'), 'En uso')
            : h('button', { class: 'btn2 danger', type: 'button', onclick: () => { S.view.keepScroll = true; change(() => { delete S.venues[k]; }); toast(`Sala «${v.name}» quitada. Puedes deshacerlo.`); } }, icon('trash'), 'Quitar'));
      })),
      h('button', { class: 'btn2', type: 'button', onclick: idle }, 'Hecho')));
  };
  idle();
  return wrap;
}

function dangerZone(s) {
  const wrap = h('div', { class: 'danger-z' });
  const ask = () => wrap.replaceChildren(
    h('p', {}, `¿Borrar «${s.name || 'este show'}»? Desaparecerá de la web al publicar. Puedes deshacerlo.`),
    h('div', { class: 'btns' },
      h('button', { class: 'btn2', type: 'button', onclick: idle }, 'No, dejarlo'),
      h('button', { class: 'btn2 danger', type: 'button', onclick: () => { change(() => { S.shows = S.shows.filter((x) => x !== s); }, { rerender: false }); go({ name: 'home' }); toast('Show borrado. Puedes deshacerlo.'); } }, icon('trash'), 'Sí, borrar el show')));
  const idle = () => wrap.replaceChildren(h('button', { class: 'lnk danger', type: 'button', onclick: ask }, icon('trash'), 'Borrar este show'));
  idle();
  return wrap;
}

export function rowTools(list, i, what) {
  const act = (fn) => () => { S.view.keepScroll = true; change(fn); };
  return h('div', { class: 'rt' },
    h('button', { class: 'ib', type: 'button', title: 'Subir', 'aria-label': `Subir ${what}`, disabled: i === 0, onclick: act(() => { [list[i - 1], list[i]] = [list[i], list[i - 1]]; }) }, icon('up')),
    h('button', { class: 'ib', type: 'button', title: 'Bajar', 'aria-label': `Bajar ${what}`, disabled: i === list.length - 1, onclick: act(() => { [list[i + 1], list[i]] = [list[i], list[i + 1]]; }) }, icon('down')),
    h('button', { class: 'ib danger', type: 'button', title: 'Quitar', 'aria-label': `Quitar ${what}`, onclick: () => { act(() => { list.splice(i, 1); })(); toast(`${what[0].toUpperCase() + what.slice(1)} quitado. Puedes deshacerlo.`); } }, icon('trash')));
}

// Texto predictivo: al escribir, sugiere nombres del roster (por orden alfabético) que empiecen
// por lo escrito, en cualquier palabra del nombre. Se puede escribir cualquier otro nombre.
const norm = (t) => t.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
const sortedRoster = () => [...S.roster].sort((a, b) => a.name.localeCompare(b.name, 'es'));
const isTeam = (w) => w.division === 'parejas' || (w.members || []).length > 0;
let acId = 0;
export function nameInput(value, onset, label, kind, opt = {}) {
  const known = (v) => S.roster.some((w) => w.name === v.trim());
  const status = h('span', { class: 'who-st' });
  let paint = (v) => {
    status.replaceChildren(v.trim() ? (known(v) ? h('span', { class: 'ok' }, icon('check'), 'En el roster: se enlaza su ficha') : h('span', { class: 'free' }, 'Nombre libre: no tiene ficha en la web')) : '');
  };
  paint(value);
  const id = `ac${++acId}`;
  const list = h('ul', { class: 'ac', id, role: 'listbox', hidden: true });
  let items = [], act = -1;
  const input = h('input', { type: 'text', value, id: `${id}-in`, placeholder: opt.placeholder || (kind === 'parejas' ? 'Nombre de la pareja o «Por decidir»' : 'Nombre o «Por decidir»'),
    autocomplete: 'off', role: 'combobox', 'aria-autocomplete': 'list', 'aria-expanded': 'false', 'aria-controls': id });
  const close = () => { list.hidden = true; input.setAttribute('aria-expanded', 'false'); act = -1; };
  const pick = (w) => {
    if (opt.onpick) { opt.onpick(w.name); return; }
    input.value = w.name; onset(w.name); paint(w.name); persist(); close();
  };
  const show = () => {
    const q = norm(input.value.trim());
    if (!q) { close(); return; }
    const pool = kind === 'parejas' ? (() => { const so = sortedRoster(); return [...so.filter(isTeam), ...so.filter((w) => !isTeam(w))]; })() : sortedRoster();
    items = pool.filter((w) => norm(w.name).split(/[\s«»"'-]+/).some((p) => p.startsWith(q)) || norm(w.name).startsWith(q))
      .filter((w) => w.name !== input.value && !(opt.exclude || []).includes(w.name)).slice(0, 7);
    if (!items.length) { close(); return; }
    list.replaceChildren(...items.map((w, k) => h('li', { role: 'option', id: `${id}-${k}`, class: k === act ? 'on' : '',
      onmousedown: (e) => { e.preventDefault(); pick(w); } },
      w.photo ? h('img', { src: imgSrc(w.photo), alt: '' }) : h('span', { class: 'ac-ph' }, icon('user')),
      h('span', {}, w.name, isTeam(w) && h('small', {}, ' · pareja o facción')))));
    list.hidden = false; input.setAttribute('aria-expanded', 'true');
  };
  if (opt.onpick) {
    paint = () => {};
    input.addEventListener('input', () => { act = -1; show(); });
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && (list.hidden || act < 0)) { e.preventDefault(); const v = input.value.trim(); if (v) opt.onpick(S.roster.find((x) => norm(x.name) === norm(v))?.name || v); }
    });
  } else {
    input.addEventListener('focus', () => snapshot());
    input.addEventListener('input', () => { act = -1; paint(input.value); setLive(() => onset(input.value)); show(); });
  }
  input.addEventListener('keydown', (e) => {
    if (list.hidden) return;
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault(); act = (act + (e.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length;
      [...list.children].forEach((li, k) => li.classList.toggle('on', k === act));
      input.setAttribute('aria-activedescendant', `${id}-${act}`);
    } else if (e.key === 'Enter' && act >= 0) { e.preventDefault(); pick(items[act]); }
    else if (e.key === 'Escape') close();
  });
  input.addEventListener('blur', () => {
    close();
    if (opt.onpick) return;
    // Si coincide con alguien del roster sin importar mayúsculas ni tildes, se corrige solo.
    const w = S.roster.find((x) => norm(x.name) === norm(input.value.trim()));
    if (w && w.name !== input.value) { input.value = w.name; onset(w.name); paint(w.name); persist(); }
  });
  return h('div', { class: 'who' }, label && h('label', { class: 'who-l', for: `${id}-in` }, label), h('div', { class: 'ac-wrap' }, input, list), opt.onpick ? null : status);
}

// Rumble: no hay dos lados, sino una lista de confirmados (puede estar vacía) y, si se quiere, sorpresas.
const MAX_RUMBLE = 40;
function rumbleBox(m, i) {
  const add = (name) => {
    if (m.sides.includes(name)) { toast(`${name} ya está en la lista`); return; }
    if (m.sides.length >= MAX_RUMBLE) return;
    S.view.keepScroll = true; S.focusAdd = i;
    change(() => { m.sides.push(name); });
  };
  const n = m.sides.length;
  return h('div', { class: 'rumble' },
    h('p', { class: 'who-l' }, 'Luchadores confirmados', h('small', {}, ` ${n}`)),
    h('p', { class: 'pane-p' }, 'Pon solo los que ya estén anunciados; no hace falta tenerlos todos. Si no quieres anunciar ninguno, déjalo vacío.'),
    n ? h('ul', { class: 'rlist' }, m.sides.map((name, k) => {
      const w = S.roster.find((x) => x.name === name);
      return h('li', {},
        w?.photo ? h('img', { src: imgSrc(w.photo), alt: '' }) : h('span', { class: 'ac-ph' }, icon('user')),
        h('span', {}, name),
        h('button', { class: 'ib', type: 'button', 'aria-label': `Quitar a ${name}`, title: 'Quitar', onclick: () => { S.view.keepScroll = true; change(() => { m.sides.splice(k, 1); }); } }, icon('x')));
    })) : null,
    n < MAX_RUMBLE
      ? nameInput('', () => {}, n ? 'Añadir otro luchador' : 'Añadir un luchador', 'individual', { onpick: add, exclude: m.sides, placeholder: 'Escribe un nombre y pulsa Intro' })
      : h('p', { class: 'muted-s' }, `Has llegado al máximo de ${MAX_RUMBLE}.`),
    h('label', { class: 'tick' }, h('input', { type: 'checkbox', checked: !!m.surprises, onchange: (e) => change(() => { if (e.target.checked) m.surprises = true; else delete m.surprises; }, { rerender: false }) }),
      'Habrá luchadores sorpresa (la web lo anuncia con un «?»)'));
}

function matchCard(s, m, i) {
  if (!m.sides) m.sides = [];
  const kind = m.type === 'parejas' || m.type === 'rumble' ? m.type : 'individual';
  const unit = kind === 'parejas' ? 'Pareja' : 'Luchador';
  return h('li', { class: 'match', 'data-field': `card-${i}` },
    h('div', { class: 'match-h' }, h('span', { class: 'match-n' }, `Combate ${i + 1}`), rowTools(s.card, i, 'combate')),
    h('fieldset', { class: 'fs' }, h('legend', {}, 'Tipo de lucha'),
      choice(`kind-${i}`, [{ value: 'individual', label: 'Individual' }, { value: 'parejas', label: 'Parejas' }, { value: 'rumble', label: 'Rumble', note: 'Todos contra todos' }], kind,
        (v) => { S.view.keepScroll = true; change(() => {
          if (v === 'individual') delete m.type; else m.type = v;
          if (v === 'rumble') { m.sides = m.sides.filter((x) => x.trim()); if (m.surprises === undefined) m.surprises = true; }
          else { delete m.surprises; while (m.sides.length < 2) m.sides.push(''); }
        }); })),
    field('Tipo de combate o título en juego', { value: m.title || '', max: 70, attrs: { placeholder: kind === 'rumble' ? 'Por ejemplo: Total Rumble' : kind === 'parejas' ? 'Por ejemplo: Campeonatos de Parejas' : 'Por ejemplo: Campeonato Absoluto · Lucha de escaleras' },
      oninput: (v) => setLive(() => { m.title = v; }) }),
    kind === 'rumble' ? rumbleBox(m, i) : h('div', { class: 'sides' },
      m.sides.map((side, k) => [
        k > 0 && h('span', { class: 'vs' }, 'contra'),
        h('div', { class: 'side' }, nameInput(side, (v) => { m.sides[k] = v; }, `${unit} ${k + 1}`, kind),
          m.sides.length > 2 && h('button', { class: 'ib danger', type: 'button', 'aria-label': `Quitar ${unit.toLowerCase()} ${k + 1}`, title: 'Quitar', onclick: () => { S.view.keepScroll = true; change(() => { m.sides.splice(k, 1); }); } }, icon('x'))),
      ]),
      h('button', { class: 'lnk', type: 'button', onclick: () => { S.view.keepScroll = true; change(() => { m.sides.push(''); }); } }, icon('plus'), kind === 'parejas' ? 'Añadir otra pareja' : 'Añadir otro luchador')),
    field('Nota (opcional)', { value: m.note || '', max: 160, attrs: { placeholder: 'Por ejemplo: quien gane, a por el título en Top 1' },
      oninput: (v) => setLive(() => { if (v.trim()) m.note = v; else delete m.note; }) }),
    h('label', { class: 'tick' }, h('input', { type: 'checkbox', checked: !!m.provisional, onchange: (e) => change(() => { if (e.target.checked) m.provisional = true; else delete m.provisional; }, { rerender: false }) }), 'Pendiente de confirmar'));
}

function resultBuilder(s) {
  const card = (s.card || []).filter((m) => m.type === 'rumble' || (m.sides || []).some((x) => x.trim()));
  const st = S.rb || (S.rb = { m: 0, w: '', how: 'pin', title: false, other: '' });
  if (st.m >= card.length) st.m = 0;
  const m = card[st.m];
  const sides = (m?.sides || []).filter((x) => x.trim());
  const rumble = m?.type === 'rumble';
  const OTHER = '__otro';
  if (!sides.includes(st.w) && !(rumble && st.w === OTHER)) st.w = sides[0] || (rumble ? OTHER : '');
  const sentence = () => {
    if (rumble) return `${(st.w === OTHER ? st.other.trim() : st.w) || '…'} ganó la ${m.title?.trim() || 'rumble'}.`;
    const losers = sides.filter((x) => x !== st.w);
    const list = losers.length > 1 ? `${losers.slice(0, -1).join(', ')} y ${losers.at(-1)}` : losers[0] || '…';
    const t = /campeonato/i.test(m?.title || '') ? (st.title ? ` y retuvo el ${m.title}` : ` y ganó el ${m.title}`) : '';
    return `${st.w || '…'} venció a ${list}${t} (${st.how}).`;
  };
  const out = h('p', { class: 'rb-out' }, sentence());
  const up = () => { out.textContent = sentence(); };
  const isTitle = /campeonato/i.test(m?.title || '');
  return h('div', { class: 'rb' },
    h('div', { class: 'rb-row' },
      h('label', {}, 'Combate', h('select', { onchange: (e) => { st.m = +e.target.value; S.view.keepScroll = true; render(); } },
        card.map((c, k) => h('option', { value: k, selected: k === st.m }, `${k + 1}. ${c.title || (c.type === 'rumble' ? 'Rumble' : c.sides.filter(Boolean).join(' contra '))}`)))),
      h('label', {}, 'Ganó', h('select', { onchange: (e) => { st.w = e.target.value; if (rumble) { S.view.keepScroll = true; render(); } else up(); } },
        sides.map((x) => h('option', { value: x, selected: x === st.w }, x)),
        rumble && h('option', { value: OTHER, selected: st.w === OTHER }, 'Otro (un luchador sorpresa)'))),
      rumble && st.w === OTHER && h('label', {}, 'Nombre del ganador', h('input', { type: 'text', value: st.other, placeholder: 'Escribe el nombre', oninput: (e) => { st.other = e.target.value; up(); } })),
      !rumble && h('label', {}, 'Cómo', h('select', { onchange: (e) => { st.how = e.target.value; up(); } }, METHODS.map((x) => h('option', { selected: x === st.how }, x)))),
      !rumble && isTitle && h('label', { class: 'tick' }, h('input', { type: 'checkbox', checked: st.title, onchange: (e) => { st.title = e.target.checked; up(); } }), 'Ya era el campeón')),
    out,
    h('button', { class: 'btn1', type: 'button', onclick: () => { S.view.keepScroll = true; change(() => { (s.results ||= []).push({ text: sentence() }); }); toast('Resultado añadido'); } }, icon('plus'), 'Añadir este resultado'));
}

let dragFrom = null;
function galleryItem(s, p, i) {
  const isHero = (s.heroPhoto || s.gallery[0]) === p;
  return h('li', {
    class: `gi${isHero ? ' hero' : ''}`, draggable: 'true',
    ondragstart: (e) => { dragFrom = i; e.dataTransfer.effectAllowed = 'move'; },
    ondragover: (e) => { e.preventDefault(); e.currentTarget.classList.add('over'); },
    ondragleave: (e) => e.currentTarget.classList.remove('over'),
    ondrop: (e) => { e.preventDefault(); if (dragFrom == null || dragFrom === i) return; const from = dragFrom; dragFrom = null; S.view.keepScroll = true; change(() => { const [x] = s.gallery.splice(from, 1); s.gallery.splice(i, 0, x); }); },
  },
  h('img', { src: imgSrc(p), alt: '', loading: 'lazy' }),
  isHero && h('span', { class: 'gi-badge' }, 'Cabecera'),
  h('div', { class: 'gi-tools' },
    h('button', { class: 'ib', type: 'button', title: 'Usar de fondo en la cabecera del show', 'aria-label': 'Usar de fondo en la cabecera', 'aria-pressed': isHero ? 'true' : 'false', onclick: () => { S.view.keepScroll = true; change(() => { if (i === 0) delete s.heroPhoto; else s.heroPhoto = p; }); } }, icon('star')),
    h('button', { class: 'ib danger', type: 'button', title: 'Quitar foto', 'aria-label': 'Quitar foto', onclick: () => { S.view.keepScroll = true; change(() => { s.gallery.splice(i, 1); if (s.heroPhoto === p) delete s.heroPhoto; }); toast('Foto quitada. Puedes deshacerlo.'); } }, icon('trash'))));
}

const ytId = (v) => {
  const t = (v || '').trim();
  if (/^[\w-]{11}$/.test(t)) return t;
  const m = t.match(/(?:youtu\.be\/|v=|shorts\/|embed\/|live\/)([\w-]{11})/);
  return m ? m[1] : '';
};

function videoItem(s, v, i) {
  const thumb = h('div', { class: 'vid-th' });
  const paintThumb = () => thumb.replaceChildren(v.youtube
    ? h('img', { src: `https://i.ytimg.com/vi/${v.youtube}/mqdefault.jpg`, alt: '' })
    : h('span', {}, icon('play'), 'Pega el enlace'));
  paintThumb();
  const linkErr = h('div', { class: 'fld-h' });
  const vsides = v.sides || [];
  return h('li', { class: 'vid', 'data-field': `vid-${i}` },
    thumb,
    h('div', { class: 'vid-f' },
      h('div', { class: 'fld' }, h('label', {}, 'Enlace de YouTube'),
        h('input', { type: 'url', value: v.youtube ? `https://youtu.be/${v.youtube}` : '', placeholder: 'https://www.youtube.com/watch?v=…', onfocus: () => snapshot(),
          oninput: (e) => { const id = ytId(e.target.value); v.youtube = id; paintThumb(); linkErr.replaceChildren(e.target.value.trim() && !id ? h('span', { class: 'err' }, icon('alert'), 'No reconozco este enlace. Cópialo desde el botón «Compartir» de YouTube.') : ''); persist(); } }),
        linkErr),
      field('Título', { value: v.title || '', max: 80, attrs: { placeholder: 'Por ejemplo: Newt Nova contra Reaper' }, oninput: (x) => setLive(() => { v.title = x; }) }),
      h('div', { class: 'fld' }, h('label', {}, 'Quién sale en el vídeo'),
        h('div', { class: 'sides compact' },
          vsides.map((side, k) => h('div', { class: 'side' }, nameInput(side, (x) => { v.sides[k] = x; }, `Luchador ${k + 1} del vídeo`),
            h('button', { class: 'ib danger', type: 'button', 'aria-label': 'Quitar', onclick: () => { S.view.keepScroll = true; change(() => { v.sides.splice(k, 1); }); } }, icon('x')))),
          h('button', { class: 'lnk', type: 'button', onclick: () => { S.view.keepScroll = true; change(() => { (v.sides ||= []).push(''); }); } }, icon('plus'), 'Añadir luchador')))),
    rowTools(s.videos, i, 'vídeo'));
}

export function dropZone({ label, hint, multiple, onfiles }) {
  const input = h('input', { type: 'file', accept: 'image/*', multiple, class: 'sr-only', tabindex: -1,
    onchange: (e) => take([...e.target.files]) });
  const prog = h('span', { class: 'drop-prog', 'aria-live': 'polite' });
  let busy = false;
  const zone = h('div', {
    class: 'drop', role: 'button', tabindex: 0,
    onclick: () => !busy && input.click(),
    onkeydown: (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); input.click(); } },
    ondragover: (e) => { e.preventDefault(); zone.classList.add('over'); },
    ondragleave: () => zone.classList.remove('over'),
    ondrop: (e) => { e.preventDefault(); zone.classList.remove('over'); take([...e.dataTransfer.files]); },
  }, icon('upload', 'big'), h('span', { class: 'drop-t' }, label), h('span', { class: 'drop-h' }, hint), prog, input);
  async function take(files) {
    const imgs = files.filter((f) => f.type.startsWith('image/'));
    if (!imgs.length) { prog.textContent = 'Eso no es una imagen. Prueba con un JPG o PNG.'; return; }
    busy = true; zone.classList.add('busy'); prog.textContent = 'Preparando…';
    try { await onfiles(multiple ? imgs : imgs.slice(0, 1)); }
    catch (e) { prog.textContent = e?.message === 'too-big' ? 'Esa imagen pesa más de 25 MB. Expórtala más pequeña y vuelve a probar.' : 'No se ha podido leer la imagen. Prueba con otra.'; }
    busy = false; zone.classList.remove('busy');
  }
  return zone;
}

// ---------- Barra de publicar ----------
function publishBar() {
  return h('div', { class: 'pub', id: 'pub' });
}

function refreshBar() {
  const bar = document.getElementById('pub');
  if (!bar) return;
  const ch = changedShows();
  const removed = JSON.parse(S.published).filter((p) => !showBy(p.slug));
  const vch = venuesChanged();
  const wch = changedRoster();
  const wrm = removedRoster();
  const tch = changedTitles();
  const trm = removedTitles();
  const hch = homeChanged();
  const pch = pagesChanged(), fch = hofChanged();
  const has = ch.length || removed.length || vch || wch.length || wrm.length || tch.length || trm.length || hch || pch || fch;
  bar.classList.toggle('on', !!has);
  if (!has) { bar.replaceChildren(); return; }
  const problems = [...ch.flatMap((s) => check(s).errs), ...wch.flatMap((w) => checkWrestler(w).errs), ...tch.flatMap((t) => checkTitle(t).errs), ...(hch ? checkHome().errs : []), ...(pch ? [...checkPages().errs, ...checkSeo().errs] : []), ...(fch ? checkHof().errs : [])];
  const warns = [...ch.flatMap((s) => check(s).warns), ...wch.flatMap((w) => checkWrestler(w).warns), ...tch.flatMap((t) => checkTitle(t).warns), ...(hch ? checkHome().warns : []), ...(pch ? [...checkPages().warns, ...checkSeo().warns] : [])];
  const parts = [];
  const nS = ch.length + removed.length, nW = wch.length + wrm.length;
  if (nS) parts.push(nS === 1 ? '1 show' : `${nS} shows`);
  if (nW) parts.push(nW === 1 ? '1 luchador' : `${nW} luchadores`);
  const nT = tch.length + trm.length;
  if (nT) parts.push(nT === 1 ? '1 campeonato' : `${nT} campeonatos`);
  if (hch) parts.push('la portada');
  if (pch || fch) parts.push('las páginas');
  if (vch) parts.push('las salas');
  const isPubW = (w) => JSON.parse(S.publishedRoster).some((p) => p.slug === w.slug);
  bar.replaceChildren(
    h('div', { class: 'pub-in' },
      h('div', { class: 'pub-st' },
        h('b', {}, `Cambios sin publicar en ${parts.length > 1 ? `${parts.slice(0, -1).join(', ')} y ${parts.at(-1)}` : parts[0]}`),
        h('span', {}, 'Se guardan solos en este ordenador mientras trabajas.')),
      h('div', { class: 'btns' },
        h('button', { class: 'btn2', type: 'button', onclick: discardAll }, 'Descartar cambios'),
        h('button', { class: 'btn1', type: 'button', onclick: () => { S.publishOpen = !S.publishOpen; S.showErrors = true; if (S.view.name !== 'home') { S.view.keepScroll = true; render(); } else refreshBar(); } }, 'Revisar y publicar'))),
    S.publishOpen ? h('div', { class: 'pub-review' },
      problems.length
        ? [h('p', { class: 'pub-h bad' }, icon('alert'), 'Antes de publicar falta esto:'),
          h('ul', { class: 'issues' }, problems.map((p) => h('li', {}, h('a', { href: '#', onclick: (e) => { e.preventDefault(); jump(p); } }, h('b', {}, p.show), ` · ${p.msg}`))))]
        : [h('p', { class: 'pub-h ok' }, icon('check'), 'Todo listo para publicar.'),
          h('ul', { class: 'issues' },
            ch.map((s) => h('li', {}, h('b', {}, s.name), JSON.parse(S.published).some((p) => p.slug === s.slug) ? ' · cambios' : ' · nuevo show')),
            removed.map((s) => h('li', {}, h('b', {}, s.name), ' · se borra')),
            wch.map((w) => h('li', {}, h('b', {}, w.name), isPubW(w) ? ' · cambios en su ficha' : ' · nueva ficha')),
            wrm.map((w) => h('li', {}, h('b', {}, w.name), ' · se borra su ficha')),
            tch.map((t) => h('li', {}, h('b', {}, t.name || 'Campeonato nuevo'), ' · cambios')),
            trm.map((t) => h('li', {}, h('b', {}, t.name), ' · se borra')),
            hch && h('li', {}, h('b', {}, 'Portada'), ' · cambios en los bloques'),
            pch && h('li', {}, h('b', {}, 'Historia, redes, contacto y ajustes'), ' · cambios en textos o enlaces'),
            fch && h('li', {}, h('b', {}, 'Salón de la Fama'), ' · cambios en los miembros'),
            vch && h('li', {}, h('b', {}, 'Salas'), ' · cambios en la lista de salas')),
          warns.length ? h('ul', { class: 'issues soft' }, warns.map((p) => h('li', {}, h('a', { href: '#', onclick: (e) => { e.preventDefault(); jump(p); } }, `Aviso: ${p.msg}`), ` (${p.show})`))) : null,
          h('div', { class: 'pub-go' }, h('button', { class: 'btn1 big', type: 'button', onclick: publish }, 'Publicar en la web'),
            store.mode === 'demo' && h('span', {}, 'Demostración: la web real no cambia.'))]) : '');
}

function jump(p) {
  S.publishOpen = false;
  go(p.kind === 'wrestler' ? { name: 'wrestler', slug: p.slug } : p.kind === 'title' ? { name: 'title', slug: p.slug } : p.kind === 'home' ? { name: 'portada' } : p.kind === 'page' ? { name: p.view } : { name: 'show', slug: p.slug, step: p.step });
  requestAnimationFrame(() => {
    const el = document.querySelector(`[data-field="${p.field}"]`);
    el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    el?.querySelector('input, textarea')?.focus({ preventScroll: true });
    el?.classList.add('flash');
  });
}

async function publish() {
  if (S.busy) return;
  // Se limpian campos vacíos antes de comparar y publicar.
  S.shows = S.shows.map((x) => { const n = normalize(x); n.slug = x.slug; return n; });
  S.roster = S.roster.map((x) => { const n = normalize(x); n.slug = x.slug; return n; });
  S.titles = S.titles.map((x) => { const n = normalize(x); n.slug = x.slug; if (!n.history) n.history = []; return n; });
  if (store.mode === 'real' && !(await publishReal())) return;
  S.published = JSON.stringify(S.shows);
  S.publishedVenues = JSON.stringify(S.venues);
  S.publishedRoster = JSON.stringify(S.roster);
  S.publishedTitles = JSON.stringify(S.titles);
  S.publishedHome = JSON.stringify(S.home);
  S.publishedPages = JSON.stringify(S.pages);
  S.publishedHof = JSON.stringify(S.hof);
  if (store.mode === 'demo') for (const f of S.files.values()) f.published = true;
  if (store.mode === 'demo') await store.set('published', { shows: S.shows, venues: S.venues, roster: S.roster, titles: S.titles, home: S.home, pages: S.pages, hof: S.hof });
  S.publishOpen = false;
  S.undo = []; S.redo = [];
  persist(true);
  render();
  toast(store.mode === 'real' ? 'Publicado. La web se actualiza sola en 1 o 2 minutos.' : 'Publicado (demostración). En la versión real la web se actualiza en unos 2 minutos.');
}

// ---------- Vista previa ----------
// Abre en otra pestaña la página REAL de la web pintada con los cambios sin publicar
// (sites/triplew/pages/vista-previa.astro). Las fotos nuevas viajan dentro de la petición.
const BUNDLED = { shows: showsJson, roster: rosterJson, titles: titlesJson, home: homeJson, pages: pagesJson, hof: hofJson };
const PREVIEW_IMG_BUDGET = 3.2e6;
export const previewBtn = (path, label = 'Vista previa') => (store.hasServer
  ? h('button', { class: 'btn1 hd', type: 'button', title: 'Ver cómo quedará antes de publicar', onclick: () => openPreview(path) }, icon('eye'), label) : null);

export async function openPreview(path) {
  const win = window.open('', '_blank');
  if (!win) { toast('El navegador ha bloqueado la pestaña nueva. Permite las ventanas emergentes para este sitio.'); return; }
  win.document.title = 'Vista previa';
  win.document.body.innerHTML = '<p style="font:16px system-ui;padding:2rem;color:#f2f0ea;background:#0b0b0b;margin:0;min-height:100vh">Preparando la vista previa…</p>';
  const draft = fullFiles(S, S.remote || BUNDLED);
  const all = JSON.stringify(draft);
  const key = path.split('/')[1] || '';
  const pending = [...S.files].filter(([p, f]) => !f.published && all.includes(`"${p}"`))
    .sort((a, b) => (key && b[0].includes(key) ? 1 : 0) - (key && a[0].includes(key) ? 1 : 0));
  const images = {}; let budget = PREVIEW_IMG_BUDGET, skipped = 0;
  for (const [p, f] of pending) {
    if (f.blob.size * 1.37 > budget) { skipped++; continue; }
    images[p] = await new Promise((res) => { const fr = new FileReader(); fr.onload = () => res(String(fr.result)); fr.onerror = () => res(null); fr.readAsDataURL(f.blob); });
    if (!images[p]) delete images[p]; else budget -= images[p].length;
  }
  if (skipped) toast(`${skipped} ${skipped === 1 ? 'foto nueva no sale' : 'fotos nuevas no salen'} en la vista previa (son demasiadas). Al publicar sí saldrán.`);
  const form = win.document.createElement('form');
  form.method = 'POST'; form.action = '/vista-previa'; form.enctype = 'multipart/form-data';
  const input = win.document.createElement('input');
  input.type = 'hidden'; input.name = 'data'; input.value = JSON.stringify({ path, draft, images });
  form.append(input); win.document.body.append(form); form.submit();
}

// ---------- Publicación real (GitHub a través de /api/admin) ----------
// S.remote guarda los 6 ficheros tal como están publicados. Se envía solo lo que cambia, junto con
// lo que el panel cree que hay publicado; si alguien publicó entretanto, la función no pisa nada.
const FILE_NAMES = { shows: 'los shows', roster: 'los luchadores', titles: 'los campeonatos', home: 'la portada', pages: 'los textos y ajustes de la web', hof: 'el Salón de la Fama' };
const listNames = (keys) => { const n = keys.map((k) => FILE_NAMES[k]); return n.length > 1 ? `${n.slice(0, -1).join(', ')} y ${n.at(-1)}` : n[0]; };

function fullFiles(D = S, R = S.remote || BUNDLED) {
  return {
    shows: { ...R.shows, venues: D.venues, shows: D.shows },
    roster: { ...R.roster, wrestlers: D.roster },
    titles: { ...R.titles, titles: D.titles },
    home: D.home, pages: D.pages, hof: D.hof,
  };
}

// Pone en el panel el contenido de un fichero (sin tocar qué se considera publicado).
function setDoc(k, obj) {
  const o = clone(obj);
  if (k === 'shows') { S.shows = o.shows; S.venues = o.venues; }
  if (k === 'roster') S.roster = o.wrestlers;
  if (k === 'titles') S.titles = o.titles;
  if (k === 'home') S.home = o;
  if (k === 'pages') S.pages = o;
  if (k === 'hof') S.hof = o;
}
// Pone una parte del panel tal como está publicada.
function takeRemote(k, obj) {
  S.remote[k] = clone(obj);
  setDoc(k, obj);
  if (k === 'shows') { S.published = JSON.stringify(obj.shows); S.publishedVenues = JSON.stringify(obj.venues); }
  if (k === 'roster') S.publishedRoster = JSON.stringify(obj.wrestlers);
  if (k === 'titles') S.publishedTitles = JSON.stringify(obj.titles);
  if (k === 'home') S.publishedHome = JSON.stringify(obj);
  if (k === 'pages') S.publishedPages = JSON.stringify(obj);
  if (k === 'hof') S.publishedHof = JSON.stringify(obj);
}
const applyRemote = (files) => { S.remote = {}; for (const k of Object.keys(FILE_NAMES)) takeRemote(k, files[k]); };

// Capa que tapa el panel mientras se publica: nadie puede tocar nada a medias.
function busy(msg) {
  let el = document.querySelector('.pub-busy');
  if (!msg) { el?.remove(); S.busy = false; return; }
  S.busy = true;
  if (!el) { el = h('div', { class: 'pub-busy', role: 'status', 'aria-live': 'polite' }, h('div', {}, h('span', { class: 'spin' }), h('p', {}))); document.body.append(el); }
  el.querySelector('p').textContent = msg;
}

// Ventana con un mensaje y botones. Devuelve el valor del botón pulsado.
function dialog(title, text, buttons) {
  return new Promise((resolve) => {
    const close = (v) => { el.remove(); resolve(v); };
    const el = h('div', { class: 'dlg-bg' }, h('div', { class: 'dlg', role: 'alertdialog', 'aria-modal': 'true', 'aria-labelledby': 'dlg-t' },
      h('h2', { id: 'dlg-t' }, title), ...[].concat(text).map((t) => h('p', {}, t)),
      h('div', { class: 'btns' }, buttons.map((b) => h('button', { class: b.main ? 'btn1' : 'btn2', type: 'button', onclick: () => close(b.value) }, b.label)))));
    document.body.append(el);
    el.querySelector('.btn1, .btn2')?.focus();
  });
}

const KEEP = 'No se ha publicado nada y tus cambios siguen aquí, guardados en este ordenador.';
async function failed(r, path) {
  busy(null);
  if (r.status === 401) {
    await dialog('Hay que volver a entrar', ['La contraseña del panel ha cambiado.', KEEP], [{ label: 'Entrar de nuevo', value: 1, main: true }]);
    store.clearKey(); location.reload(); return false;
  }
  const msg = r.error === 'network' ? 'No hay conexión con el servidor. Comprueba internet y vuelve a pulsar «Publicar en la web».'
    : r.error === 'too-big' ? `La foto ${path || ''} pesa demasiado para subirla. Quítala y vuelve a subirla.`
    : r.error === 'bad-image' || r.error === 'bad-path' ? `La foto ${path || ''} no es válida. Quítala y vuelve a subirla.`
    : r.error === 'github-access' ? 'GitHub no deja guardar: el permiso (token) ha caducado o no es válido. Avisa a quien gestiona la web.'
    : r.error === 'setup' ? 'El guardado todavía no está configurado en el servidor.'
    : 'Algo ha fallado al guardar. Espera un minuto y vuelve a intentarlo.';
  await dialog('No se ha podido publicar', [msg, KEEP], [{ label: 'Entendido', value: 1, main: true }]);
  return false;
}

async function publishReal(force = []) {
  const files = fullFiles();
  // Solo se envía lo que cambia de verdad (sin contar campos vacíos): el resto de ficheros no se toca.
  const keys = Object.keys(files).filter((k) => !same(files[k], S.remote[k]));
  const all = JSON.stringify(files);
  const pending = [...S.files].filter(([p, f]) => !f.published && all.includes(`"${p}"`));
  const images = [];
  busy('Publicando…');
  for (const [i, [path, f]] of pending.entries()) {
    busy(`Subiendo fotos: ${i + 1} de ${pending.length}`);
    let data;
    try { data = await store.toBase64(f.blob); } catch { return failed({ error: 'bad-image' }, path); }
    const r = await store.call('image', { path, data });
    if (!r.ok) return failed(r, path);
    images.push({ path, sha: r.sha });
  }
  if (!keys.length && !images.length) { busy(null); return true; }
  busy('Guardando los cambios…');
  const send = () => store.call('publish', {
    files: Object.fromEntries(keys.map((k) => [k, files[k]])),
    base: Object.fromEntries(keys.map((k) => [k, S.remote[k]])),
    images, force, summary: keys.length ? listNames(keys) : 'fotos',
  });
  let r = await send();
  if (r.status === 409 && r.error === 'race') r = await send();
  if (r.status === 409 && r.error === 'conflict') {
    busy(null);
    const ck = Object.keys(r.current);
    const v = await dialog('Alguien ha publicado mientras trabajabas',
      [`Desde otro ordenador se han publicado cambios en ${listNames(ck)}. Para no borrar su trabajo, no se ha publicado nada.`,
        'Puedes ver lo que hay publicado ahora (se pierden tus cambios en esa parte) o publicar lo tuyo encima (se pierde lo de la otra persona en esa parte).'],
      [{ label: 'Cancelar', value: 'cancel' }, { label: 'Ver lo publicado', value: 'take' }, { label: 'Publicar lo mío encima', value: 'mine', main: true }]);
    if (v === 'take') { for (const k of ck) takeRemote(k, r.current[k]); S.undo = []; S.redo = []; S.publishOpen = false; persist(); render(); toast('Cargado lo que hay publicado ahora'); }
    if (v === 'mine') { for (const k of ck) S.remote[k] = r.current[k]; return publishReal(ck); }
    return false;
  }
  if (!r.ok) return failed(r);
  for (const k of keys) S.remote[k] = clone(files[k]);
  for (const im of images) S.files.get(im.path).published = true;
  busy(null);
  return true;
}

async function discardAll() {
  if (store.mode === 'real') {
    // Se vuelve a lo que hay publicado ahora mismo (por si alguien publicó desde otro ordenador).
    const r = await store.call('load');
    if (r.ok) applyRemote(r.files); else for (const k of Object.keys(FILE_NAMES)) takeRemote(k, S.remote[k]);
    for (const [p, f] of [...S.files]) if (!f.published) S.files.delete(p);
    S.restored = false; S.undo = []; S.redo = [];
    await store.set(store.draftKey(), null);
    go({ name: /^(roster|wrestler)/.test(S.view.name) ? 'roster' : /^title/.test(S.view.name) ? 'titles' : S.view.name === 'portada' ? 'portada' : S.view.name === 'historia' ? 'historia' : S.view.name === 'sitio' ? 'sitio' : S.view.name === 'ajustes' ? 'ajustes' : 'home' });
    toast('Cambios descartados');
    return;
  }
  const pub = await store.get('published');
  S.shows = clone(pub?.shows || showsJson.shows);
  S.venues = clone(pub?.venues || showsJson.venues);
  S.roster = clone(pub?.roster || rosterJson.wrestlers);
  S.publishedRoster = JSON.stringify(S.roster);
  S.titles = clone(pub?.titles || titlesJson.titles);
  S.publishedTitles = JSON.stringify(S.titles);
  S.home = clone(pub?.home || homeJson);
  S.publishedHome = JSON.stringify(S.home);
  S.pages = clone(pub?.pages || pagesJson);
  S.publishedPages = JSON.stringify(S.pages);
  S.hof = clone(pub?.hof || hofJson);
  S.publishedHof = JSON.stringify(S.hof);
  S.published = JSON.stringify(S.shows);
  S.publishedVenues = JSON.stringify(S.venues);
  for (const [p, f] of [...S.files]) if (!f.published) S.files.delete(p);
  S.restored = false; S.undo = []; S.redo = [];
  await store.set(store.draftKey(), null);
  go({ name: /^(roster|wrestler)/.test(S.view.name) ? 'roster' : /^title/.test(S.view.name) ? 'titles' : S.view.name === 'portada' ? 'portada' : S.view.name === 'historia' ? 'historia' : S.view.name === 'sitio' ? 'sitio' : S.view.name === 'ajustes' ? 'ajustes' : 'home' });
  toast('Cambios descartados');
}

// ---------- Arranque ----------
// Pantalla de entrada (solo en modo real).
function loginScreen(msg) {
  const err = h('p', { class: 'err', role: 'alert' }, msg ? [icon('alert'), msg] : null);
  const pw = h('input', { type: 'password', id: 'pw', autocomplete: 'current-password', required: true });
  // Ojo para ver lo que se escribe. El cursor se queda donde estaba.
  const eye = h('button', { class: 'pw-eye', type: 'button', 'aria-label': 'Mostrar la contraseña', 'aria-pressed': 'false', title: 'Mostrar la contraseña',
    onclick: () => {
      const show = pw.type === 'password';
      pw.type = show ? 'text' : 'password';
      eye.setAttribute('aria-pressed', String(show));
      eye.setAttribute('aria-label', show ? 'Ocultar la contraseña' : 'Mostrar la contraseña'); eye.title = eye.getAttribute('aria-label');
      eye.replaceChildren(icon(show ? 'eyeoff' : 'eye'));
      pw.focus();
    } }, icon('eye'));
  const remember = h('input', { type: 'checkbox', checked: true });
  const btn = h('button', { class: 'btn1 big', type: 'submit' }, 'Entrar');
  app.replaceChildren(h('main', { class: 'login' }, h('form', {
    onsubmit: async (e) => {
      e.preventDefault();
      if (!pw.value) return;
      btn.disabled = true; btn.textContent = 'Comprobando…'; err.replaceChildren();
      const r = await store.call('load', {}, pw.value);
      if (r.ok) { store.setKey(pw.value, remember.checked); return start(r.files); }
      btn.disabled = false; btn.textContent = 'Entrar';
      err.replaceChildren(icon('alert'), r.status === 401 ? 'Contraseña incorrecta.' : r.error === 'network' ? 'No hay conexión. Comprueba internet.' : 'El servidor no responde bien. Prueba en un minuto.');
      pw.select();
    },
  },
  h('img', { src: '/logo/whitewolf-blanco.svg', alt: '', width: 64, height: 62 }),
  h('h1', {}, 'Panel ', h('b', {}, 'Triple W')),
  h('div', { class: 'fld' }, h('label', { for: 'pw' }, 'Contraseña'), h('div', { class: 'pw-wrap' }, pw, eye)),
  h('label', { class: 'tick' }, remember, 'Recordarla en este ordenador'),
  err, btn)));
  pw.focus();
}

async function boot() {
  await store.detect();
  if (store.mode !== 'real') return start();
  if (!store.getKey()) return loginScreen();
  const r = await store.call('load');
  if (r.status === 401) { store.clearKey(); return loginScreen('La contraseña ha cambiado. Escribe la nueva.'); }
  if (!r.ok) {
    app.replaceChildren(h('main', { class: 'login' }, h('div', {},
      h('h1', {}, 'No se pueden cargar los datos'),
      h('p', {}, r.error === 'network' ? 'No hay conexión con el servidor. Comprueba internet.' : r.error === 'github-access' ? 'GitHub no da acceso: el permiso (token) ha caducado o no es válido. Avisa a quien gestiona la web.' : 'El servidor no responde bien ahora mismo.'),
      h('button', { class: 'btn1', type: 'button', onclick: () => location.reload() }, 'Volver a intentarlo'))));
    return;
  }
  start(r.files);
}

async function start(remote) {
  if (remote) applyRemote(remote);
  else {
  const pub = await store.get('published');
  if (pub?.shows) { S.shows = clone(pub.shows); S.published = JSON.stringify(pub.shows); }
  if (pub?.venues) { S.venues = clone(pub.venues); S.publishedVenues = JSON.stringify(pub.venues); }
  if (pub?.roster) { S.roster = clone(pub.roster); S.publishedRoster = JSON.stringify(pub.roster); }
  if (pub?.titles) { S.titles = clone(pub.titles); S.publishedTitles = JSON.stringify(pub.titles); }
  if (pub?.home) { S.home = clone(pub.home); S.publishedHome = JSON.stringify(pub.home); }
  if (pub?.pages) { S.pages = clone(pub.pages); S.publishedPages = JSON.stringify(pub.pages); }
  if (pub?.hof) { S.hof = clone(pub.hof); S.publishedHof = JSON.stringify(pub.hof); }
  }
  const draft = await store.get(store.draftKey());
  if (remote && draft?.remote) {
    // Solo se recupera lo que de verdad quedó sin publicar. Si mientras tanto alguien publicó en esa
    // parte, el panel sigue comparando con la versión antigua: al publicar saldrá el aviso de choque.
    const mine = fullFiles(draft, draft.remote);
    for (const k of Object.keys(FILE_NAMES)) {
      if (same(mine[k], draft.remote[k])) continue;
      takeRemote(k, draft.remote[k]); setDoc(k, mine[k]); S.restored = true;
    }
  }
  if (draft?.files) for (const f of draft.files) S.files.set(f.path, { blob: f.blob, url: URL.createObjectURL(f.blob), published: f.published });
  // Fotos ya publicadas que la web ya sirve: no hace falta guardarlas más en este ordenador.
  if (store.mode === 'real') {
    await Promise.all([...S.files].filter(([, f]) => f.published).map(async ([p]) => {
      const ok = await fetch(p, { method: 'HEAD', cache: 'no-store' }).then((x) => x.ok).catch(() => false);
      if (ok) S.files.delete(p);
    }));
  }
  if (!remote) {
  if (draft?.venues) S.venues = draft.venues;
  if (draft?.roster && JSON.stringify(draft.roster) !== S.publishedRoster) { S.roster = draft.roster; S.restored = true; }
  if (draft?.titles && JSON.stringify(draft.titles) !== S.publishedTitles) { S.titles = draft.titles; S.restored = true; }
  if (draft?.home && JSON.stringify(draft.home) !== S.publishedHome) { S.home = draft.home; S.restored = true; }
  if (draft?.pages && JSON.stringify(draft.pages) !== S.publishedPages) { S.pages = draft.pages; S.restored = true; }
  if (draft?.hof && JSON.stringify(draft.hof) !== S.publishedHof) { S.hof = draft.hof; S.restored = true; }
  if (draft?.shows && (JSON.stringify(draft.shows) !== S.published || venuesChanged())) { S.shows = draft.shows; S.restored = true; }
  }
  S.view = viewFromHash();
  render();
}

function viewFromHash() {
  const m = location.hash.match(/^#show\/([^/]+)\/?(\w+)?/);
  if (m && showBy(m[1])) return { name: 'show', slug: m[1], step: m[2] || 'datos' };
  const l = location.hash.match(/^#luchador\/([^/]+)/);
  if (l && wrestlerBy(l[1])) return { name: 'wrestler', slug: l[1] };
  if (/^#luchador/.test(location.hash)) return { name: 'roster' };
  const c = location.hash.match(/^#campeonato\/([^/]+)/);
  if (c && titleBy(c[1])) return { name: 'title', slug: c[1] };
  if (/^#campeonato/.test(location.hash)) return { name: 'titles' };
  if (location.hash === '#portada') return { name: 'portada' };
  if (location.hash === '#historia') return { name: 'historia' };
  if (location.hash === '#redes') return { name: 'sitio' };
  if (location.hash === '#ajustes') return { name: 'ajustes' };
  return { name: 'home' };
}

addEventListener('keydown', (e) => {
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z' && !/^(INPUT|TEXTAREA)$/.test(document.activeElement?.tagName)) {
    e.preventDefault(); e.shiftKey ? redoFn() : undo();
  }
});
addEventListener('popstate', () => { S.view = viewFromHash(); render(); });

boot();
