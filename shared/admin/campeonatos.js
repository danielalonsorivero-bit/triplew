// Sección Campeonatos del panel.
// El cambio de campeón es un asistente: quién gana, en qué show, y el panel hace el resto
// (el campeón anterior pasa al historial con sus fechas y las fichas de ambos se actualizan).
// Así nadie tiene que tocar a mano el historial ni las fichas, que es donde se cometerían errores.

import { S, h, icon, field, change, persist, setLive, toast, go, render, imgSrc, same, nameInput, rowTools, dateNice, isPast } from './app.js';
import { wrestlerBy } from './luchadores.js';

const COLORS = ['#E8C547', '#2BD46A', '#F59E2B', '#E11D48', '#5EC8F2', '#A78BFA', '#F2F0EA', '#FF6B9A'];
const today = () => new Date().toISOString().slice(0, 10);
const norm = (t) => (t || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
export const titleBy = (slug) => S.titles.find((t) => t.slug === slug);
const byName = (name) => S.roster.find((w) => norm(w.name) === norm(name));
const pastShows = () => S.shows.filter(isPast).sort((a, b) => b.date.localeCompare(a.date));
const showName = (slug) => S.shows.find((s) => s.slug === slug)?.name;
const days = (a, b) => Math.max(0, Math.round((new Date(b) - new Date(a)) / 86400000));
const published = () => JSON.parse(S.publishedTitles);

// Las fichas de luchador llevan también sus títulos (la web los usa en la ficha y la portada).
// Se recalculan siempre a partir de los campeonatos, para que nunca se contradigan.
export function syncRosterTitles() {
  for (const w of S.roster) {
    const mine = S.titles.filter((t) => t.holder === w.slug).map((t) => t.slug);
    if (mine.length) { if (JSON.stringify(mine) !== JSON.stringify(w.titles || [])) w.titles = mine; } else if (w.titles) delete w.titles;
  }
}

// ---------- Validación ----------
export function checkTitle(t) {
  const errs = [], warns = [];
  const add = (list, field, msg) => list.push({ kind: 'title', slug: t.slug, field, msg, show: t.name || 'Campeonato sin nombre' });
  if (!t.name || t.name.trim().length < 3) add(errs, 'name', 'Falta el nombre del campeonato.');
  if (t.holder && !wrestlerBy(t.holder)) add(errs, 'holder', 'El campeón actual ya no tiene ficha. Elige otro o deja el título vacante.');
  if (t.since && t.since > today()) add(errs, 'since', 'La fecha del reinado actual está en el futuro.');
  (t.history || []).forEach((x, i) => {
    if (!x.name?.trim()) add(errs, `h-${i}`, `Al campeón anterior número ${i + 1} le falta el nombre.`);
    if (x.from && x.to && x.from > x.to) add(errs, `h-${i}`, `${x.name || `Campeón ${i + 1}`}: la fecha de inicio es posterior a la de fin.`);
  });
  if (t.holder && !t.since) add(warns, 'since', 'Falta la fecha en que ganó el título: la web no puede contar los días de reinado.');
  return { errs, warns };
}
export const changedTitles = () => {
  const before = new Map(published().map((t) => [t.slug, t]));
  return S.titles.filter((t) => !before.has(t.slug) || !same(before.get(t.slug), t));
};
export const removedTitles = () => published().filter((p) => !titleBy(p.slug));

// ---------- Lista ----------
export function titlesHome() {
  return h('div', { class: 'home' },
    h('div', { class: 'scr-head' },
      h('div', {}, h('h1', { class: 'scr-title' }, 'Campeonatos'),
        h('p', { class: 'scr-sub' }, `${S.titles.length} cinturones · ${S.titles.filter((t) => !t.holder).length} vacantes`)),
      h('button', { class: 'btn2 hd', type: 'button', onclick: newTitle }, icon('plus'), 'Nuevo campeonato')),
    h('p', { class: 'lead' }, 'Pulsa un cinturón para anunciar un nuevo campeón o completar su historial.'),
    h('ul', { class: 'belts' }, S.titles.map((t) => {
      const w = t.holder && wrestlerBy(t.holder);
      const { errs, warns } = checkTitle(t);
      const before = published().find((p) => p.slug === t.slug);
      return h('li', {}, h('a', { href: `#campeonato/${t.slug}`, class: 'belt-card', style: `--t:${t.color}`, onclick: (e) => { e.preventDefault(); go({ name: 'title', slug: t.slug }); } },
        w?.photo ? h('img', { src: imgSrc(w.photo), alt: '', style: `object-position:${(w.photoPos || 'center 20%').split(' ')[0]} 10%` }) : h('span', { class: 'belt-q' }, '?'),
        h('span', { class: 'belt-b' },
          h('span', { class: 'belt-name' }, t.name),
          h('span', { class: 'belt-holder' }, w ? w.name : 'Vacante'),
          h('span', { class: 'belt-meta' }, w && t.since ? `${days(t.since, today())} días de reinado` : w ? 'Sin fecha de reinado' : 'Sin campeón ahora mismo'),
          h('span', { class: 'sr-chips' },
            !before ? h('span', { class: 'chip new' }, 'Nuevo') : !same(before, t) ? h('span', { class: 'chip new' }, 'Con cambios') : null,
            errs.length ? h('span', { class: 'chip bad' }, icon('alert'), 'Falta información') : warns.length ? h('span', { class: 'chip warn' }, 'Sin fecha') : null,
            t.provisionalHistory ? h('span', { class: 'chip' }, 'Historial incompleto') : null))));
    })));
}

function newTitle() {
  let n = S.titles.length + 1, slug = `campeonato-${n}`;
  while (titleBy(slug)) slug = `campeonato-${++n}`;
  change(() => { S.titles.push({ slug, name: '', short: '', holder: null, color: COLORS.find((c) => !S.titles.some((t) => t.color === c)) || COLORS[0], since: null, wonAt: null, history: [], provisionalHistory: true, team: false }); }, { rerender: false });
  go({ name: 'title', slug, sec: 'datos' });
}

// ---------- Ficha de un campeonato ----------
export function titleEditor() {
  const t = titleBy(S.view.slug);
  if (!t) return h('p', {}, 'Ese campeonato ya no existe.');
  const errOf = (f) => { const c = checkTitle(t); const e = c.errs.find((x) => x.field === f); const w = c.warns.find((x) => x.field === f); return e ? { msg: e.msg } : w ? { msg: w.msg, warn: true } : null; };
  const isNew = !published().some((p) => p.slug === t.slug);
  return h('div', { class: 'ed ted', style: `--c:${t.color};--ci:#0B0B0B` },
    h('a', { href: '#', class: 'back', onclick: (e) => { e.preventDefault(); go({ name: 'titles' }); } }, icon('back'), 'Todos los campeonatos'),
    h('div', { class: 'ed-head' },
      h('span', { class: 'belt-dot' }),
      h('div', { class: 'ed-tt' }, h('h1', { class: 'scr-title' }, t.name || 'Nuevo campeonato'),
        h('p', { class: 'ed-sub' }, t.team ? 'Campeonato de parejas' : 'Campeonato individual')),
      h('a', { class: 'btn2 hd', href: '/campeonatos/', target: '_blank', rel: 'noopener' }, 'Ver en la web', icon('ext'))),
    isNew && !t.name ? secDatos(t, errOf) : null,
    secHolder(t, errOf),
    secHistory(t),
    isNew && !t.name ? null : secDatos(t, errOf),
    deleteTitle(t));
}

function holderCard(t, w) {
  return h('div', { class: 'holder', 'data-field': 'holder' },
    w?.photo ? h('img', { src: imgSrc(w.photo), alt: '', style: `object-position:${(w.photoPos || 'center 20%').split(' ')[0]} 10%` }) : h('span', { class: 'belt-q' }, '?'),
    h('div', {},
      h('p', { class: 'holder-l' }, t.team ? 'Campeones actuales' : 'Campeón actual'),
      h('p', { class: 'holder-n' }, w ? w.name : 'Vacante'),
      w ? h('p', { class: 'holder-m' }, t.since ? `Desde el ${dateNice(t.since)} · ${days(t.since, today())} días` : 'Sin fecha', t.wonAt && showName(t.wonAt) ? ` · ${showName(t.wonAt)}` : '') : null));
}

function secHolder(t, errOf) {
  const w = t.holder && wrestlerBy(t.holder);
  const box = h('div', { class: 'vt' });
  const idle = () => box.replaceChildren(
    h('button', { class: 'btn1', type: 'button', onclick: () => wizard(box, t, idle) }, icon('star'), t.team ? 'Nuevos campeones' : 'Nuevo campeón'),
    w ? h('button', { class: 'btn2', type: 'button', onclick: () => fixReign(box, t, idle) }, 'Corregir fecha o show del reinado') : null,
    w ? h('button', { class: 'lnk danger', type: 'button', onclick: () => vacate(box, t, idle) }, 'Dejar el título vacante') : null);
  idle();
  const e = errOf('holder') || errOf('since');
  return h('section', { class: 'pane wsec' },
    h('h2', { class: 'pane-h' }, t.team ? 'Campeones actuales' : 'Campeón actual'),
    holderCard(t, w),
    e ? h('p', { class: e.warn ? 'warn' : 'err' }, icon('alert'), e.msg) : null,
    box);
}

// Elegir show (pone la fecha sola) o, si no fue en un show, una fecha.
function whenPicker(st, onup) {
  const shows = pastShows();
  const dateIn = h('input', { type: 'date', value: st.date || '', max: today(), onchange: (e) => { st.date = e.target.value; onup(); } });
  const sel = h('select', { onchange: (e) => { st.show = e.target.value || null; const s = S.shows.find((x) => x.slug === st.show); if (s) st.date = s.date; dateIn.value = st.date || ''; dateWrap.hidden = !!st.show; onup(); } },
    h('option', { value: '' }, 'No fue en un show / no lo sé'),
    shows.map((s) => h('option', { value: s.slug, selected: s.slug === st.show }, `${s.name} · ${dateNice(s.date)}`)));
  const dateWrap = h('label', { class: 'when-d' }, '¿Qué día?', dateIn);
  dateWrap.hidden = !!st.show;
  return h('div', { class: 'when' }, h('label', {}, '¿En qué show?', sel), dateWrap);
}

function wizard(box, t, idle) {
  const st = { who: null, show: pastShows()[0]?.slug || null, date: pastShows()[0]?.date || '' };
  const out = h('div', { class: 'wz-out' });
  const picked = h('div', {});
  const old = t.holder && wrestlerBy(t.holder);
  const paint = () => {
    const w = st.who && wrestlerBy(st.who);
    picked.replaceChildren(w
      ? h('div', { class: 'rlist one' }, h('li', {}, w.photo ? h('img', { src: imgSrc(w.photo), alt: '' }) : h('span', { class: 'ac-ph' }, icon('user')), h('span', {}, w.name),
        h('button', { class: 'ib', type: 'button', 'aria-label': 'Elegir a otro', onclick: () => { st.who = null; paint(); } }, icon('x'))))
      : nameInput('', () => {}, t.team ? 'Pareja o facción ganadora' : 'Ganador', t.team ? 'parejas' : 'individual', { onpick: (name) => {
        const x = byName(name);
        if (!x) { toast(`«${name}» no tiene ficha. Créala antes en Luchadores.`); return; }
        if (x.slug === t.holder) { toast(`${x.name} ya es el campeón.`); return; }
        st.who = x.slug; paint();
      }, placeholder: 'Escribe el nombre y elige de la lista' }));
    let msg = null, ok = false;
    if (!w) msg = 'Elige quién ha ganado.';
    else if (!st.date) msg = 'Elige el show o el día.';
    else if (st.date > today()) msg = 'Esa fecha todavía no ha llegado.';
    else if (t.since && st.date < t.since) msg = `Esa fecha es anterior al reinado actual (${dateNice(t.since)}).`;
    else ok = true;
    out.replaceChildren(
      ok ? h('p', { class: 'wz-sum' }, h('b', {}, w.name), ` ${t.team ? 'pasan a ser campeones' : 'pasa a ser campeón'} desde el ${dateNice(st.date)}${st.show ? ` (${showName(st.show)})` : ''}.`,
        old ? h('span', {}, ` ${old.name} pasa al historial${t.since ? ` con su reinado del ${dateNice(t.since)} al ${dateNice(st.date)}` : ''}.`) : '')
        : h('p', { class: 'muted-s' }, msg),
      h('div', { class: 'btns' },
        h('button', { class: 'btn2', type: 'button', onclick: idle }, 'Cancelar'),
        h('button', { class: 'btn1', type: 'button', disabled: !ok, onclick: () => {
          S.view.keepScroll = true;
          change(() => {
            if (old) t.history.unshift({ name: old.name, slug: old.slug, ...(t.since ? { from: t.since } : {}), to: st.date, ...(t.wonAt ? { show: t.wonAt } : {}) });
            t.holder = st.who; t.since = st.date; t.wonAt = st.show || null;
            syncRosterTitles();
          });
          toast(`${w.name}: ${t.team ? 'nuevos campeones' : 'nuevo campeón'}. Puedes deshacerlo.`);
        } }, icon('check'), 'Confirmar el cambio')));
  };
  box.replaceChildren(h('div', { class: 'sub-form' },
    h('p', { class: 'pane-h' }, t.team ? 'Nuevos campeones' : 'Nuevo campeón'),
    picked, whenPicker(st, () => paint()), out));
  paint();
}

function fixReign(box, t, idle) {
  const st = { show: t.wonAt || null, date: t.since || '' };
  box.replaceChildren(h('div', { class: 'sub-form' },
    h('p', { class: 'pane-h' }, 'Corregir el reinado actual'),
    h('p', { class: 'pane-p' }, 'Solo para arreglar un dato mal puesto. Si ha cambiado el campeón, usa «Nuevo campeón».'),
    whenPicker(st, () => {}),
    h('div', { class: 'btns' },
      h('button', { class: 'btn2', type: 'button', onclick: idle }, 'Cancelar'),
      h('button', { class: 'btn1', type: 'button', onclick: () => {
        if (st.date && st.date > today()) { toast('Esa fecha todavía no ha llegado.'); return; }
        S.view.keepScroll = true;
        change(() => { t.since = st.date || null; t.wonAt = st.show || null; });
        toast('Reinado corregido');
      } }, 'Guardar'))));
}

function vacate(box, t, idle) {
  const w = wrestlerBy(t.holder);
  const st = { show: null, date: today() };
  box.replaceChildren(h('div', { class: 'sub-form' },
    h('p', { class: 'pane-h' }, 'Dejar el título vacante'),
    h('p', { class: 'pane-p' }, `${w.name} pasará al historial y el cinturón quedará sin dueño hasta el próximo campeón.`),
    whenPicker(st, () => {}),
    h('div', { class: 'btns' },
      h('button', { class: 'btn2', type: 'button', onclick: idle }, 'Cancelar'),
      h('button', { class: 'btn2 danger', type: 'button', onclick: () => {
        if (!st.date || st.date > today() || (t.since && st.date < t.since)) { toast('Revisa la fecha.'); return; }
        S.view.keepScroll = true;
        change(() => {
          t.history.unshift({ name: w.name, slug: w.slug, ...(t.since ? { from: t.since } : {}), to: st.date, note: 'Dejó el título vacante' });
          t.holder = null; t.since = null; t.wonAt = null;
          syncRosterTitles();
        });
        toast('Título vacante. Puedes deshacerlo.');
      } }, 'Dejar vacante'))));
}

function secHistory(t) {
  const list = t.history || (t.history = []);
  const shows = [...S.shows].sort((a, b) => b.date.localeCompare(a.date));
  return h('section', { class: 'pane wsec' },
    h('h2', { class: 'pane-h' }, 'Campeones anteriores', h('small', {}, ` ${list.length}`)),
    h('p', { class: 'pane-p' }, 'Del más reciente al más antiguo. Cuando anuncias un nuevo campeón, el anterior se añade aquí solo. Usa esto para completar el pasado.'),
    h('label', { class: 'tick' }, h('input', { type: 'checkbox', checked: !!t.provisionalHistory, onchange: (e) => change(() => { t.provisionalHistory = e.target.checked; }, { rerender: false }) }), 'Historial incompleto (la web lo indica)'),
    h('ol', { class: 'hist' }, list.map((x, i) => {
      const dIn = (k, label) => h('label', {}, label, h('input', { type: 'date', value: x[k] || '', max: today(), onchange: (e) => { S.view.keepScroll = true; change(() => { if (e.target.value) x[k] = e.target.value; else delete x[k]; }); } }));
      const span = x.from && x.to && x.from <= x.to ? `${days(x.from, x.to)} días` : '';
      return h('li', { class: 'hist-i', 'data-field': `h-${i}` },
        h('div', { class: 'hist-top' }, h('span', { class: 'match-n' }, `${i + 1}`), rowTools(list, i, 'campeón anterior')),
        nameInput(x.name || '', (v) => { x.name = v; const w = byName(v); if (w) x.slug = w.slug; else delete x.slug; }, t.team ? 'Pareja o facción' : 'Luchador', t.team ? 'parejas' : 'individual'),
        h('div', { class: 'hist-d' }, dIn('from', 'Desde'), dIn('to', 'Hasta'), span && h('span', { class: 'muted-s' }, span),
          h('label', {}, 'Lo ganó en', h('select', { onchange: (e) => { S.view.keepScroll = true; change(() => { if (e.target.value) x.show = e.target.value; else delete x.show; }); } },
            h('option', { value: '' }, 'Sin show'), shows.map((s) => h('option', { value: s.slug, selected: s.slug === x.show }, `${s.name} · ${s.date?.slice(0, 4) || ''}`))))),
        x.from && x.to && x.from > x.to ? h('p', { class: 'err' }, icon('alert'), 'La fecha «Desde» es posterior a «Hasta».') : null,
        field('Nota (opcional)', { value: x.note || '', max: 90, attrs: { placeholder: 'Por ejemplo: reinado más largo de la historia' }, oninput: (v) => setLive(() => { if (v.trim()) x.note = v; else delete x.note; }) }));
    })),
    h('button', { class: 'btn2 add', type: 'button', onclick: () => { S.view.keepScroll = true; change(() => { list.push({ name: '' }); }); } }, icon('plus'), 'Añadir un campeón anterior'));
}

function secDatos(t, errOf) {
  return h('section', { class: 'pane wsec' },
    h('h2', { class: 'pane-h' }, 'Datos del cinturón'),
    h('div', { class: 'grid' },
      field('Nombre', { value: t.name || '', required: true, max: 40, err: errOf('name'), attrs: { 'data-field': 'name', placeholder: 'Por ejemplo: Campeonato Absoluto' },
        oninput: (v) => setLive(() => { t.name = v; document.querySelector('.ed-head .scr-title').textContent = v || 'Nuevo campeonato'; }) }),
      field('Nombre corto', { value: t.short || '', max: 16, attrs: { placeholder: 'Por ejemplo: Absoluto' }, hint: 'Para etiquetas pequeñas.',
        oninput: (v) => setLive(() => { t.short = v; }) }),
      h('div', { class: 'fld' }, h('label', {}, 'Color del cinturón'),
        h('div', { class: 'swatches' }, COLORS.map((c) => h('button', { type: 'button', class: `sw${t.color === c ? ' on' : ''}`, style: `--sw:${c}`, 'aria-label': `Color ${c}`, 'aria-pressed': t.color === c ? 'true' : 'false',
          onclick: () => { S.view.keepScroll = true; change(() => { t.color = c; }); } })))),
      h('label', { class: 'tick' }, h('input', { type: 'checkbox', checked: !!t.team, disabled: !!t.holder,
        onchange: (e) => { S.view.keepScroll = true; change(() => { t.team = e.target.checked; }); } }), 'Es un campeonato de parejas',
        t.holder ? h('small', { class: 'muted-s' }, ' (se puede cambiar cuando esté vacante)') : null)));
}

function deleteTitle(t) {
  const wrap = h('div', { class: 'danger-z' });
  const blocked = t.holder || (t.history || []).some((x) => x.name?.trim());
  const ask = () => wrap.replaceChildren(
    h('p', {}, `¿Borrar «${t.name || 'este campeonato'}»? Desaparecerá de la web al publicar. Puedes deshacerlo.`),
    h('div', { class: 'btns' },
      h('button', { class: 'btn2', type: 'button', onclick: idle }, 'No, dejarlo'),
      h('button', { class: 'btn2 danger', type: 'button', onclick: () => { change(() => { S.titles = S.titles.filter((x) => x !== t); syncRosterTitles(); }, { rerender: false }); go({ name: 'titles' }); toast('Campeonato borrado. Puedes deshacerlo.'); } }, icon('trash'), 'Sí, borrarlo')));
  const idle = () => wrap.replaceChildren(blocked
    ? h('p', { class: 'muted-s' }, icon('lock'), 'Un campeonato con campeón o con historial no se puede borrar, para no perder su historia.')
    : h('button', { class: 'lnk danger', type: 'button', onclick: ask }, icon('trash'), 'Borrar este campeonato'));
  idle();
  return wrap;
}
