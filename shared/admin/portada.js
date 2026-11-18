// Paso «Portada» de cada show: qué luchadores entran a escena en el hero de la portada.
// Por defecto es automático (los luchadores de los combates con retrato), igual que la web.
// Si se elige a mano, se guarda en show.hero = [{ wrestler: slug, text? }].

import { S, h, icon, field, choice, change, setLive, toast, go, imgSrc, nameInput, rowTools, dateNice, isPast } from './app.js';

const norm = (t) => (t || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
const bySlug = (slug) => S.roster.find((w) => w.slug === slug);
const byName = (name) => S.roster.find((w) => norm(w.name) === norm(name));
const MAX_HERO = 8;

// Misma lógica que heroSlides() de la web (shared/lib.js), con los datos del panel.
export function slidesFor(show) {
  const card = show?.card ?? [];
  const slides = [];
  if (show?.hero?.length) {
    for (const x of show.hero) {
      const w = bySlug(x.wrestler);
      if (!w || !(x.photo || w.photo)) continue;
      const m = card.find((c) => c.sides?.includes(w.name));
      slides.push({ w, photo: x.photo || w.photo, pos: x.photoPos || w.photoPos, match: m?.title, opponents: m?.sides?.filter((n) => n !== w.name) ?? [], text: x.text ?? m?.note });
    }
  } else {
    for (const m of card) {
      for (const name of m.sides ?? []) {
        const w = byName(name);
        if (!w?.photo || slides.some((s) => s.w.slug === w.slug)) continue;
        slides.push({ w, photo: w.photo, pos: w.photoPos, match: m.title, opponents: m.sides.filter((n) => n !== name), text: m.note, provisional: m.provisional });
      }
    }
  }
  if (!slides.length) {
    const div = show?.brand === 'levelone' ? 'levelone' : 'absoluto';
    const champ = (w) => S.titles.some((t) => t.holder === w.slug);
    const pool = S.roster.filter((x) => x.photo && x.division === div).sort((a, b) => champ(b) - champ(a));
    for (const w of pool.slice(0, 5)) {
      const t = S.titles.find((x) => x.holder === w.slug);
      slides.push({ w, photo: w.photo, pos: w.photoPos, match: t ? `Campeón ${t.name.replace(/^Campeonatos? /, '')}` : undefined, text: w.nickname, fallback: true });
    }
  }
  return slides;
}

export function heroPane(s) {
  const manual = !!s.hero;
  const slides = slidesFor(s);
  const upcoming = S.shows.filter((x) => !isPast(x)).sort((a, b) => a.date.localeCompare(b.date));
  const pos = upcoming.indexOf(s);
  const when = isPast(s) ? 'Este show ya se celebró: ya no sale en la portada.'
    : pos === 0 ? 'Es el próximo show: es el que sale ahora en la portada.'
    : pos > 0 ? `Saldrá en la portada cuando pase ${upcoming[pos - 1].name} (${dateNice(upcoming[pos - 1].date)}), sin que nadie tenga que hacer nada.`
    : '';
  return h('div', {},
    h('p', { class: 'note' }, icon(pos === 0 ? 'star' : 'check'), h('span', {}, when)),
    h('div', { class: 'grid two hero-grid' },
      h('div', {},
        h('fieldset', { class: 'fs' }, h('legend', {}, '¿Quién sale en la portada?'),
          choice('hero-mode', [
            { value: 'auto', label: 'Automático', note: 'Los luchadores de los combates, en el orden del cartel. Se actualiza solo al cambiar los combates.' },
            { value: 'manual', label: 'Elegir yo', note: 'Tú decides quién sale, en qué orden y con qué frase.' },
          ], manual ? 'manual' : 'auto', (v) => {
            S.view.keepScroll = true;
            change(() => {
              if (v === 'auto') delete s.hero;
              else s.hero = slidesFor({ ...s, hero: undefined }).filter((x) => !x.fallback).map((x) => ({ wrestler: x.w.slug }));
            });
          })),
        manual ? manualList(s) : autoInfo(s, slides)),
      h('div', { class: 'hero-side' }, h('h3', { class: 'pane-h' }, 'Así se verá'), heroPreview(s, slides),
        h('p', { class: 'muted-s' }, 'Vista aproximada. En la web los luchadores van pasando solos, con sus animaciones.'))));
}

function autoInfo(s, slides) {
  const missing = [];
  for (const m of s.card || []) for (const n of m.sides || []) { const w = byName(n); if (n.trim() && w && !w.photo && !missing.includes(w.name)) missing.push(w.name); }
  return h('div', { class: 'hero-auto' },
    slides[0]?.fallback
      ? h('p', { class: 'warn' }, icon('alert'), 'Aún no hay combates con luchadores que tengan retrato. Mientras tanto salen los campeones de la división.')
      : h('p', { class: 'pane-p' }, `Salen ${slides.length} ${slides.length === 1 ? 'luchador' : 'luchadores'}.`),
    missing.length ? h('p', { class: 'warn' }, icon('alert'), `No salen porque no tienen retrato: ${missing.join(', ')}. Súbelo en su ficha de Luchadores.`) : null);
}

function manualList(s) {
  const list = s.hero;
  const add = (name) => {
    const w = byName(name);
    if (!w) { toast(`«${name}» no tiene ficha. Créala antes en Luchadores.`); return; }
    if (!w.photo) { toast(`${w.name} no tiene retrato. Súbelo antes en su ficha.`); return; }
    if (list.some((x) => x.wrestler === w.slug)) { toast(`${w.name} ya está en la portada.`); return; }
    S.view.keepScroll = true;
    change(() => { list.push({ wrestler: w.slug }); });
  };
  return h('div', { class: 'hero-man' },
    h('p', { class: 'pane-p' }, 'Ordena con las flechas. La frase es opcional: si la dejas vacía, sale el título del combate.'),
    h('ol', { class: 'hist' }, list.map((x, i) => {
      const w = bySlug(x.wrestler);
      const m = (s.card || []).find((c) => c.sides?.includes(w?.name));
      return h('li', { class: 'hist-i' },
        h('div', { class: 'hist-top' },
          h('span', { class: 'hero-who' }, w?.photo ? h('img', { src: imgSrc(w.photo), alt: '' }) : h('span', { class: 'ac-ph' }, icon('user')), h('b', {}, w?.name || 'Ficha borrada')),
          rowTools(list, i, 'luchador de la portada')),
        field('Frase (opcional)', { value: x.text || '', max: 90, attrs: { placeholder: m?.title || 'Por ejemplo: vuelve tras dos años fuera del ring' },
          oninput: (v) => { setLive(() => { if (v.trim()) x.text = v; else delete x.text; }); S.heroRepaint?.(); } }));
    })),
    list.length < MAX_HERO
      ? nameInput('', () => {}, 'Añadir luchador', 'individual', { onpick: add, exclude: list.map((x) => bySlug(x.wrestler)?.name), placeholder: 'Escribe el nombre y elige de la lista' })
      : h('p', { class: 'muted-s' }, `Máximo ${MAX_HERO} luchadores: más se hace pesado.`),
    !list.length ? h('p', { class: 'warn' }, icon('alert'), 'Sin nadie elegido, la portada usará el modo automático.') : null);
}

// Vista previa sencilla del hero: foto en blanco y negro, nombre grande y pestañas.
function heroPreview(s, slidesIn) {
  let slides = slidesIn;
  let i = Math.min(S.heroI || 0, Math.max(0, slides.length - 1));
  const stage = h('div', { class: 'hp', style: `--show:${s.color || '#E3EE2B'}` });
  const paint = () => {
    const x = slides[i];
    if (!x) { stage.replaceChildren(h('p', { class: 'hp-empty' }, 'Sin luchadores')); return; }
    const vs = x.opponents?.length && x.opponents.length <= 2 ? x.opponents : [];
    stage.replaceChildren(
      h('img', { src: imgSrc(x.photo), alt: '', style: `object-position:${(x.pos || 'center 20%').split(' ')[0]} 4%` }),
      h('div', { class: 'hp-copy' },
        h('p', { class: 'hp-name' }, x.w.name),
        vs.length ? h('p', { class: 'hp-vs' }, 'contra ', h('b', {}, vs.join(' y '))) : null,
        (x.match || x.text) ? h('p', { class: 'hp-why' }, [x.match, x.text].filter(Boolean).join('. ')) : null),
      h('div', { class: 'hp-tabs' }, slides.map((y, k) => h('button', { type: 'button', class: k === i ? 'on' : '', onclick: () => { i = k; S.heroI = k; paint(); } }, y.w.name))),
      h('div', { class: 'hp-led' }, h('b', {}, s.name || 'Nuevo show'), ` · ${s.date ? dateNice(s.date) : 'sin fecha'}`));
  };
  S.heroRepaint = () => { slides = slidesFor(s); i = Math.min(i, Math.max(0, slides.length - 1)); paint(); };
  paint();
  return stage;
}
