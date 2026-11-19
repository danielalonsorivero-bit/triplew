// Sección «Portada» del panel: los bloques fijos de la portada que no salen de shows ni del roster.
// Prevención: cada titular tiene un número fijo de líneas con un límite de letras que cabe en el diseño,
// y las fotos tienen un mínimo y un máximo. Así se puede cambiar todo sin poder romper la maquetación.

import { S, h, icon, previewBtn, field, change, setLive, toast, imgSrc, same, nameInput, rowTools, dropZone, snapshot } from './app.js';
import { shrink } from './img.js';

const SEQ = { min: 3, max: 8 };
const GAL = { min: 6, max: 10 };
const FEAT = { min: 4, max: 10 };
// Bloques de titular: número de líneas y letras por línea (medido sobre el diseño a 1440 px y en móvil).
const BLOCKS = {
  sequence: { lines: 3, max: 18 },
  inversa: { lines: 2, max: 16 },
  youtube: { lines: 2, max: 18 },
  school: { lines: 3, max: 12 },
};
const norm = (t) => (t || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
const bySlug = (slug) => S.roster.find((w) => w.slug === slug);

export function checkHome() {
  const H = S.home, errs = [], warns = [];
  const add = (list, field, msg) => list.push({ kind: 'home', field, msg, show: 'Portada' });
  for (const [k, b] of Object.entries(BLOCKS)) {
    Array.from({ length: b.lines }, (_, i) => H[k]?.lines?.[i]).forEach((l, i) => { if (!l?.trim()) add(errs, `${k}-l${i}`, `${LABEL[k]}: la línea ${i + 1} del titular está vacía.`); });
  }
  if (!H.inversa?.text?.trim()) add(errs, 'inversa-text', 'Entrada inversa: falta el texto.');
  if (!H.school?.text?.trim()) add(errs, 'school-text', 'Escuela: falta el texto.');
  if (!H.school?.cta?.trim()) add(errs, 'school-cta', 'Escuela: falta el texto del botón.');
  if (!H.youtube?.cta?.trim()) add(errs, 'youtube-cta', 'YouTube: falta el texto del botón.');
  if ((H.sequence?.photos || []).length < SEQ.min) add(errs, 'sequence-photos', `Secuencia: hacen falta al menos ${SEQ.min} fotos.`);
  if ((H.gallery?.photos || []).length < GAL.min) add(errs, 'gallery-photos', `Galería: hacen falta al menos ${GAL.min} fotos.`);
  if (H.gallery?.link && !/^https:\/\//.test(H.gallery.link)) add(errs, 'gallery-link', 'Galería: el enlace debe empezar por https://');
  const feat = (H.rosterFeatured || []).filter(bySlug);
  if (feat.length < FEAT.min) add(errs, 'featured', `Luchadores destacados: hacen falta al menos ${FEAT.min}.`);
  if ((H.rosterFeatured || []).some((x) => !bySlug(x))) add(warns, 'featured', 'Luchadores destacados: hay alguno cuya ficha se ha borrado; no saldrá.');
  return { errs, warns };
}
export const homeChanged = () => !same(JSON.parse(S.publishedHome), S.home);
const LABEL = { sequence: 'Secuencia', inversa: 'Entrada inversa', youtube: 'YouTube', school: 'Escuela' };

export function homeEditor() {
  const H = S.home;
  const { errs } = checkHome();
  const errOf = (f) => (S.showErrors ? errs.find((e) => e.field === f) : null);
  return h('div', { class: 'ed hed' },
    h('div', { class: 'scr-head' },
      h('div', {}, h('h1', { class: 'scr-title' }, 'Portada'),
        h('p', { class: 'scr-sub' }, 'Los bloques fijos de la portada. El hero de arriba se cambia en cada show, en el paso «Portada».')),
      h('div', { class: 'hd-btns' }, previewBtn(''), h('a', { class: 'btn2 hd', href: '/', target: '_blank', rel: 'noopener' }, 'Ver la portada', icon('ext')))),
    h('nav', { class: 'jumps', 'aria-label': 'Bloques de la portada' },
      [['p-inversa', 'Entrada inversa'], ['p-sequence', 'Secuencia'], ['p-featured', 'Luchadores destacados'], ['p-gallery', 'Galería'], ['p-youtube', 'YouTube'], ['p-school', 'Escuela']].map(([id, l]) =>
        h('a', { href: `#${id}`, onclick: (e) => { e.preventDefault(); document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' }); } }, l))),
    h('p', { class: 'muted-s order-note' }, 'Los bloques están en el mismo orden en que salen en la portada.'),
    sec('p-inversa', 'Entrada inversa', 'El cartel de neón que explica cómo funciona la entrada en el Gimnasio Lucharama.',
      lines('inversa', 'Titular de neón', errOf),
      field('Texto', { area: true, value: H.inversa.text || '', max: 280, err: errOf('inversa-text'), attrs: { rows: 4, 'data-field': 'inversa-text' }, oninput: (v) => setLive(() => { H.inversa.text = v; }) }),
      field('Nota pequeña (opcional)', { value: H.inversa.note || '', max: 160, oninput: (v) => setLive(() => { if (v.trim()) H.inversa.note = v; else delete H.inversa.note; }) })),
    sec('p-sequence', 'Secuencia «fotograma a fotograma»', 'Fotos seguidas de un mismo momento: al bajar por la página van pasando como una animación. Funcionan mejor en ráfaga, con el mismo encuadre.',
      lines('sequence', 'Titular (la última línea va en color)', errOf),
      photoList(H.sequence, SEQ, 'sequence', errOf, false)),
    sec('p-featured', 'Luchadores destacados', `Los cromos del bloque «Roster». Entre ${FEAT.min} y ${FEAT.max}, solo luchadores con retrato.`,
      featured(errOf)),
    sec('p-gallery', 'Galería', `El mosaico de fotos. Entre ${GAL.min} y ${GAL.max}. Marca cada foto como normal, ancha o alta para que el mosaico encaje.`,
      h('div', { class: 'grid two tight' },
        field('Enlace de «ver más»', { type: 'url', value: H.gallery.link || '', err: errOf('gallery-link'), attrs: { placeholder: 'https://www.instagram.com/…', 'data-field': 'gallery-link' }, oninput: (v) => setLive(() => { H.gallery.link = v.trim(); }) }),
        field('Texto del enlace', { value: H.gallery.linkLabel || '', max: 30, attrs: { placeholder: '@wrestlingphotoshow' }, oninput: (v) => setLive(() => { H.gallery.linkLabel = v; }) })),
      photoList(H.gallery, GAL, 'gallery', errOf, true)),
    sec('p-youtube', 'YouTube', 'La pantalla de televisión que lleva al canal.',
      lines('youtube', 'Titular', errOf),
      field('Texto', { value: H.youtube.text || '', max: 140, oninput: (v) => setLive(() => { H.youtube.text = v; }) }),
      field('Texto del botón', { value: H.youtube.cta || '', max: 24, err: errOf('youtube-cta'), attrs: { 'data-field': 'youtube-cta' }, oninput: (v) => setLive(() => { H.youtube.cta = v; }) })),
    sec('p-school', 'Escuela Lucharama', 'El cierre de la portada, que invita a apuntarse a la escuela.',
      lines('school', 'Titular', errOf),
      field('Texto', { area: true, value: H.school.text || '', max: 280, err: errOf('school-text'), attrs: { rows: 4, 'data-field': 'school-text' }, oninput: (v) => setLive(() => { H.school.text = v; }) }),
      field('Texto del botón', { value: H.school.cta || '', max: 24, err: errOf('school-cta'), attrs: { 'data-field': 'school-cta' }, oninput: (v) => setLive(() => { H.school.cta = v; }) })));
}

const sec = (id, title, intro, ...kids) => h('section', { class: 'pane wsec', id },
  h('h2', { class: 'pane-h' }, title), h('p', { class: 'pane-p' }, intro), h('div', { class: 'grid' }, kids));

// Titular de líneas fijas: ni se pueden añadir ni quitar líneas, y cada una tiene su límite.
function lines(key, label, errOf) {
  const b = BLOCKS[key];
  const arr = S.home[key].lines;
  const prev = h('p', { class: `hl-prev hl-${key}` });
  const paint = () => prev.replaceChildren(...Array.from({ length: b.lines }, (_, i) => arr[i] || '').map((l, i) => h('span', { class: key === 'sequence' && i === b.lines - 1 ? 'acc' : '' }, l || '…')));
  paint();
  return h('div', { class: 'fld hl' },
    h('label', {}, label, h('span', { class: 'req' }, ' obligatorio')),
    h('div', { class: 'hl-in' }, Array.from({ length: b.lines }, (_, i) => arr[i] || '').map((l, i) => {
      const e = errOf(`${key}-l${i}`);
      const counter = h('span', { class: 'count' }, `${l.length}/${b.max}`);
      return h('div', { class: `hl-row${e ? ' has-err' : ''}`, 'data-field': `${key}-l${i}` },
        h('span', { class: 'hl-n' }, i + 1),
        h('input', { type: 'text', value: l, maxlength: b.max, 'aria-label': `${label}, línea ${i + 1}`, onfocus: () => snapshot(),
          oninput: (ev) => { arr[i] = ev.target.value; counter.textContent = `${ev.target.value.length}/${b.max}`; paint(); setLive(() => {}); } }),
        counter);
    })),
    h('div', { class: 'fld-h' }, `Máximo ${b.max} letras por línea, para que quepa en el diseño también en el móvil.`),
    prev);
}

let dragFrom = null;
function photoList(obj, lim, key, errOf, shapes) {
  const photos = obj.photos;
  const room = lim.max - photos.length;
  const e = errOf(`${key}-photos`);
  const drop = dropZone({
    label: key === 'sequence' ? 'Sube las fotos de la secuencia' : 'Sube fotos para la galería',
    hint: `Arrastra aquí varias a la vez. Se reducen solas. Quedan ${room} de ${lim.max}.`,
    multiple: true,
    onfiles: async (files) => {
      const left = lim.max - obj.photos.length;
      if (left <= 0) { toast(`Ya hay ${lim.max} fotos, que es el máximo.`); return; }
      const added = [];
      for (const f of files.slice(0, left)) {
        try {
          const r = await shrink(f, 2000, 0.82, 1.2e6);
          const path = `/fotos/portada/${key}-${Date.now().toString(36)}${added.length}.jpg`;
          S.files.set(path, { blob: r.blob, url: r.url });
          added.push({ src: path, alt: key === 'sequence' && !obj.photos.length && !added.length ? 'Secuencia de un combate, fotograma a fotograma' : key === 'gallery' ? 'Foto de un show de la Triple W' : '', ...(shapes ? { shape: '' } : {}) });
        } catch { /* no era una imagen */ }
      }
      S.view.keepScroll = true;
      change(() => { obj.photos.push(...added); });
      const skipped = files.length - added.length;
      toast(`${added.length} fotos añadidas${skipped ? `. ${skipped} no caben o no son imágenes` : ''}`);
    },
  });
  return h('div', { class: 'fld', 'data-field': `${key}-photos` },
    h('label', {}, `Fotos (${photos.length} de ${lim.max}, mínimo ${lim.min})`),
    room > 0 ? drop : h('p', { class: 'muted-s' }, icon('lock'), `Ya hay ${lim.max}. Para subir otra, quita alguna.`),
    e ? h('p', { class: 'err' }, icon('alert'), e.msg) : null,
    h('p', { class: 'pane-p' }, key === 'sequence' ? 'Arrastra para cambiar el orden: es el orden en que pasan.' : 'Arrastra para cambiar el orden.'),
    h('ul', { class: `gal ${key === 'gallery' ? 'pgal' : ''}` }, photos.map((p, i) => h('li', {
      class: `gi${shapes && p.shape ? ` sh-${p.shape}` : ''}`, draggable: 'true',
      ondragstart: (ev) => { dragFrom = { key, i }; ev.dataTransfer.effectAllowed = 'move'; },
      ondragover: (ev) => { if (dragFrom?.key !== key) return; ev.preventDefault(); ev.currentTarget.classList.add('over'); },
      ondragleave: (ev) => ev.currentTarget.classList.remove('over'),
      ondrop: (ev) => { ev.preventDefault(); if (dragFrom?.key !== key || dragFrom.i === i) return; const from = dragFrom.i; dragFrom = null; S.view.keepScroll = true; change(() => { const [x] = obj.photos.splice(from, 1); obj.photos.splice(i, 0, x); }); },
    },
    h('img', { src: imgSrc(p.src), alt: '', loading: 'lazy' }),
    key === 'sequence' && h('span', { class: 'gi-badge' }, i + 1),
    h('div', { class: 'gi-tools' },
      h('button', { class: 'ib danger', type: 'button', title: 'Quitar foto', 'aria-label': 'Quitar foto', disabled: photos.length <= lim.min,
        onclick: () => { S.view.keepScroll = true; change(() => { obj.photos.splice(i, 1); }); toast('Foto quitada. Puedes deshacerlo.'); } }, icon('trash'))),
    shapes && h('div', { class: 'shape', role: 'radiogroup', 'aria-label': 'Forma en el mosaico' },
      [['', 'Normal'], ['wide', 'Ancha'], ['tall', 'Alta']].map(([v, l]) => h('button', { type: 'button', role: 'radio', 'aria-checked': (p.shape || '') === v ? 'true' : 'false', class: (p.shape || '') === v ? 'on' : '',
        onclick: () => { S.view.keepScroll = true; change(() => { p.shape = v; }); } }, l)))))),
    photos.length <= lim.min ? h('p', { class: 'muted-s' }, `Con ${lim.min} fotos no se puede quitar ninguna más: sube otra antes.`) : null);
}

function featured(errOf) {
  const list = S.home.rosterFeatured;
  const e = errOf('featured');
  const add = (name) => {
    const w = S.roster.find((x) => norm(x.name) === norm(name));
    if (!w) { toast(`«${name}» no tiene ficha. Créala antes en Luchadores.`); return; }
    if (!w.photo) { toast(`${w.name} no tiene retrato. Súbelo antes en su ficha.`); return; }
    if (list.includes(w.slug)) { toast(`${w.name} ya está destacado.`); return; }
    S.view.keepScroll = true;
    change(() => { list.push(w.slug); });
  };
  return h('div', { class: 'fld', 'data-field': 'featured' },
    e ? h('p', { class: 'err' }, icon('alert'), e.msg) : null,
    h('ol', { class: 'feat' }, list.map((slug, i) => {
      const w = bySlug(slug);
      return h('li', {},
        w?.photo ? h('img', { src: imgSrc(w.photo), alt: '', style: `object-position:${(w.photoPos || 'center 20%').split(' ')[0]} 10%` }) : h('span', { class: 'ac-ph' }, icon('user')),
        h('span', { class: 'feat-n' }, `${i + 1}. `, w?.name || 'Ficha borrada'),
        rowTools(list, i, 'luchador destacado'));
    })),
    list.length < FEAT.max
      ? nameInput('', () => {}, 'Añadir luchador destacado', 'individual', { onpick: add, exclude: list.map((x) => bySlug(x)?.name), placeholder: 'Escribe el nombre y elige de la lista' })
      : h('p', { class: 'muted-s' }, `Ya hay ${FEAT.max}, que es el máximo.`));
}
