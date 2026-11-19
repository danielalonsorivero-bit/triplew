// Secciones «Historia y Salón de la Fama» y «Redes y contacto».
// Datos: shared/data/paginas-triplew.json (S.pages) y shared/data/salon-fama-triplew.json (S.hof).
// Prevención: los hitos se ordenan solos por año; las redes se eligen de una lista y su enlace se comprueba;
// un miembro del Salón de la Fama no se puede añadir sin foto.

import { S, h, icon, previewBtn, field, change, setLive, toast, imgSrc, same, rowTools, dropZone, snapshot } from './app.js';
import { shrink } from './img.js';

const isUrl = (v) => /^https:\/\/\S+\.\S+/.test(v || '');
// Si escriben «instagram.com/x» o «http://…», se completa solo a https:// (evita el error en vez de avisarlo).
const fixUrl = (v) => { const t = (v || '').trim(); if (!t) return t; if (/^http:\/\//i.test(t)) return t.replace(/^http:/i, 'https:'); if (!/^https:\/\//i.test(t) && /^[\w-]+(\.[\w-]+)+/.test(t)) return `https://${t.replace(/^\/+/, '')}`; return t; };
const isMail = (v) => /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(v || '');
const NETS = ['Instagram', 'YouTube', 'TikTok', 'X / Twitter', 'Facebook', 'Twitch'];

export function checkPages() {
  const P = S.pages, errs = [], warns = [];
  const add = (list, field, msg, view) => list.push({ kind: 'page', view, field, msg, show: view === 'sitio' ? 'Redes y contacto' : 'Historia' });
  (P.historia.hitos || []).forEach((x, i) => {
    if (!/^\d{4}$/.test(x.year || '')) add(errs, `hito-${i}`, `Hito ${i + 1}: el año debe tener 4 cifras.`, 'historia');
    if (!x.title?.trim()) add(errs, `hito-${i}`, `Hito ${i + 1}: falta el título.`, 'historia');
  });
  (P.sitio.redes || []).forEach((r, i) => { if (!isUrl(r.url)) add(errs, `red-${i}`, `${r.label || `Red ${i + 1}`}: el enlace debe empezar por https://`, 'sitio'); });
  if (!isMail(P.sitio.email)) add(errs, 'email', 'El correo de contacto no es válido.', 'sitio');
  if (!isUrl(P.sitio.youtube)) add(errs, 'youtube', 'El enlace del canal de YouTube debe empezar por https://', 'sitio');
  (P.sitio.creditos || []).forEach((c, i) => {
    if (!c.label?.trim() || !c.handle?.trim()) add(errs, `cred-${i}`, `Crédito ${i + 1}: falta qué hizo o quién.`, 'sitio');
    if (c.url && !isUrl(c.url)) add(errs, `cred-${i}`, `Crédito ${i + 1}: el enlace debe empezar por https://`, 'sitio');
  });
  return { errs, warns };
}
export function checkHof() {
  const errs = [];
  (S.hof.members || []).forEach((m, i) => { if (!m.name?.trim()) errs.push({ kind: 'page', view: 'historia', field: `hof-${i}`, msg: `Salón de la Fama: al miembro ${i + 1} le falta el nombre.`, show: 'Salón de la Fama' }); });
  return { errs, warns: [] };
}
export const pagesChanged = () => !same(JSON.parse(S.publishedPages), S.pages);
export const hofChanged = () => !same(JSON.parse(S.publishedHof), S.hof);

const sec = (id, title, intro, ...kids) => h('section', { class: 'pane wsec', id },
  h('h2', { class: 'pane-h' }, title), intro ? h('p', { class: 'pane-p' }, intro) : null, h('div', { class: 'grid' }, kids));
const jumps = (list) => h('nav', { class: 'jumps' }, list.map(([id, l]) =>
  h('a', { href: `#${id}`, onclick: (e) => { e.preventDefault(); document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' }); } }, l)));
const errOf = (f) => [...checkPages().errs, ...checkHof().errs].find((e) => e.field === f);

// ---------- Historia y Salón de la Fama ----------
export function historiaEditor() {
  const P = S.pages;
  return h('div', { class: 'ed hed' },
    h('div', { class: 'scr-head' },
      h('div', {}, h('h1', { class: 'scr-title' }, 'Historia y Salón de la Fama'),
        h('p', { class: 'scr-sub' }, 'Se tocan poco: un hito nuevo de vez en cuando y quien entre en el Salón de la Fama.')),
      h('div', { class: 'hd-btns' }, previewBtn('historia', 'Vista previa: Historia'), previewBtn('salon-de-la-fama', 'Vista previa: Salón'), h('a', { class: 'btn2 hd', href: '/historia/', target: '_blank', rel: 'noopener' }, 'Ver la historia', icon('ext')))),
    jumps([['h-hitos', 'Hitos'], ['h-hof', 'Salón de la Fama'], ['h-textos', 'Textos de las páginas']]),
    sec('h-hitos', 'Hitos de la historia', 'Se ordenan solos por año al escribirlo. La foto es opcional: sin foto, el hito sale como rótulo.',
      h('ol', { class: 'hist' }, (P.historia.hitos || []).map((x, i) => hitoItem(x, i))),
      h('button', { class: 'btn2 add', type: 'button', onclick: () => { S.view.keepScroll = true; change(() => { P.historia.hitos.push({ year: String(new Date().getFullYear()), title: '', text: '' }); }); } }, icon('plus'), 'Añadir un hito')),
    sec('h-hof', 'Salón de la Fama', 'Cada miembro necesita una foto. Arrastra para cambiar el orden.',
      field('Texto de presentación', { area: true, value: S.hof.intro || '', max: 220, attrs: { rows: 3 }, oninput: (v) => setLive(() => { S.hof.intro = v; }) }),
      hofList(),
      newMember()),
    sec('h-textos', 'Textos de las páginas', null,
      field('Historia · entradilla', { area: true, value: P.historia.intro || '', max: 260, attrs: { rows: 3 }, oninput: (v) => setLive(() => { P.historia.intro = v; }) }),
      field('Historia · título del cierre', { value: P.historia.cierre?.title || '', max: 30, oninput: (v) => setLive(() => { P.historia.cierre.title = v; }) }),
      field('Historia · texto del cierre', { area: true, value: P.historia.cierre?.text || '', max: 220, attrs: { rows: 3 }, oninput: (v) => setLive(() => { P.historia.cierre.text = v; }) }),
      field('Campeonatos · entradilla', { value: P.campeonatos.intro || '', max: 120, oninput: (v) => setLive(() => { P.campeonatos.intro = v; }) }),
      field('Campeonatos · texto del Salón de la Fama', { value: P.campeonatos.hallOfFame?.text || '', max: 100, oninput: (v) => setLive(() => { P.campeonatos.hallOfFame.text = v; }) })));
}

// Ordena por año sin desordenar los del mismo año.
const sortHitos = () => { S.pages.historia.hitos = S.pages.historia.hitos.map((x, i) => [x, i]).sort((a, b) => (a[0].year || '').localeCompare(b[0].year || '') || a[1] - b[1]).map(([x]) => x); };

function hitoItem(x, i) {
  const e = errOf(`hito-${i}`);
  const photoBox = h('div', { class: 'hito-ph' });
  const paintPhoto = () => photoBox.replaceChildren(x.photo
    ? h('figure', {}, h('img', { src: imgSrc(x.photo), alt: '' }), h('button', { class: 'lnk danger', type: 'button', onclick: () => { S.view.keepScroll = true; change(() => { delete x.photo; delete x.photoPos; }); } }, icon('trash'), 'Quitar la foto'))
    : dropZone({ label: 'Foto (opcional)', hint: 'Arrastra o pulsa. Se reduce sola.', multiple: false, onfiles: async ([f]) => {
      const r = await shrink(f, 1800, 0.82, 1e6);
      const path = `/historia/${x.year || 'hito'}-${Date.now().toString(36)}.jpg`;
      S.files.set(path, { blob: r.blob, url: r.url });
      S.view.keepScroll = true; change(() => { x.photo = path; });
    } }));
  paintPhoto();
  return h('li', { class: `hist-i${e ? ' has-err' : ''}`, 'data-field': `hito-${i}` },
    h('div', { class: 'hist-top' }, h('span', { class: 'match-n' }, x.year || '····'), rowTools(S.pages.historia.hitos, i, 'hito')),
    h('div', { class: 'hito-g' },
      h('div', { class: 'grid' },
        h('div', { class: 'fld yr' }, h('label', {}, 'Año'),
          h('input', { type: 'text', inputmode: 'numeric', maxlength: 4, value: x.year || '', onfocus: () => snapshot(),
            oninput: (ev) => { ev.target.value = ev.target.value.replace(/\D/g, ''); x.year = ev.target.value; setLive(() => {}); },
            onchange: () => { if (/^\d{4}$/.test(x.year)) { S.view.keepScroll = true; sortHitos(); change(() => {}); } } })),
        field('Título', { value: x.title || '', max: 50, oninput: (v) => setLive(() => { x.title = v; }) }),
        field('Texto', { area: true, value: x.text || '', max: 320, attrs: { rows: 3 }, oninput: (v) => setLive(() => { x.text = v; }) })),
      photoBox),
    e ? h('p', { class: 'err' }, icon('alert'), e.msg) : null);
}

let dragFrom = null;
function hofList() {
  const list = S.hof.members;
  return h('ul', { class: 'gal hofg' }, list.map((m, i) => h('li', {
    class: 'gi hof-i', draggable: 'true', 'data-field': `hof-${i}`,
    ondragstart: (e) => { dragFrom = i; e.dataTransfer.effectAllowed = 'move'; },
    ondragover: (e) => { e.preventDefault(); e.currentTarget.classList.add('over'); },
    ondragleave: (e) => e.currentTarget.classList.remove('over'),
    ondrop: (e) => { e.preventDefault(); if (dragFrom == null || dragFrom === i) return; const from = dragFrom; dragFrom = null; S.view.keepScroll = true; change(() => { const [x] = list.splice(from, 1); list.splice(i, 0, x); }); },
  },
  h('img', { src: imgSrc(m.photo), alt: '', style: `object-position:${m.photoPos || 'center 20%'}` }),
  h('div', { class: 'hof-f' },
    h('input', { type: 'text', value: m.name || '', maxlength: 40, 'aria-label': 'Nombre', placeholder: 'Nombre', onfocus: () => snapshot(), oninput: (e) => setLive(() => { m.name = e.target.value; }) }),
    h('input', { type: 'text', value: m.years || '', maxlength: 20, 'aria-label': 'Años en la Triple W', placeholder: 'Años (2012–2018)', onfocus: () => snapshot(), oninput: (e) => setLive(() => { if (e.target.value.trim()) m.years = e.target.value; else delete m.years; }) }),
    h('label', { class: 'tick' }, h('input', { type: 'checkbox', checked: !!m.provisional, onchange: (e) => change(() => { if (e.target.checked) m.provisional = true; else delete m.provisional; }, { rerender: false }) }), 'Por confirmar')),
  h('div', { class: 'gi-tools on' },
    h('button', { class: 'ib danger', type: 'button', title: 'Quitar del Salón de la Fama', 'aria-label': `Quitar a ${m.name}`, onclick: () => { S.view.keepScroll = true; change(() => { list.splice(i, 1); }); toast(`${m.name} quitado del Salón de la Fama. Puedes deshacerlo.`); } }, icon('trash'))))));
}

// Alta en el Salón de la Fama: la foto primero, porque sin foto no se puede publicar.
function newMember() {
  const wrap = h('div', { class: 'vt' });
  const idle = () => wrap.replaceChildren(h('button', { class: 'btn2', type: 'button', onclick: form }, icon('plus'), 'Añadir al Salón de la Fama'));
  const form = () => {
    const d = { name: '', years: '', photo: null };
    const err = h('div', { class: 'fld-h' });
    const ph = h('div', {});
    const paint = () => ph.replaceChildren(d.photo ? h('img', { class: 'hof-new', src: imgSrc(d.photo), alt: '' })
      : dropZone({ label: 'Su foto', hint: 'Vertical, de cintura para arriba. Se reduce sola.', multiple: false, onfiles: async ([f]) => {
        const r = await shrink(f, 1400, 0.82, 800e3);
        d.photo = `/fotos/salon-fama/nuevo-${Date.now().toString(36)}.jpg`;
        S.files.set(d.photo, { blob: r.blob, url: r.url }); paint();
      } }));
    paint();
    wrap.replaceChildren(h('div', { class: 'sub-form' },
      h('p', { class: 'pane-h' }, 'Nuevo miembro del Salón de la Fama'), ph,
      field('Nombre', { required: true, max: 40, oninput: (v) => { d.name = v; } }),
      field('Años en la Triple W (opcional)', { max: 20, attrs: { placeholder: '2012–2018' }, oninput: (v) => { d.years = v; } }),
      err,
      h('div', { class: 'btns' },
        h('button', { class: 'btn2', type: 'button', onclick: idle }, 'Cancelar'),
        h('button', { class: 'btn1', type: 'button', onclick: () => {
          if (!d.photo) { err.replaceChildren(h('span', { class: 'err' }, icon('alert'), 'Falta la foto.')); return; }
          if (d.name.trim().length < 2) { err.replaceChildren(h('span', { class: 'err' }, icon('alert'), 'Falta el nombre.')); return; }
          S.view.keepScroll = true;
          change(() => { S.hof.members.push({ name: d.name.trim(), photo: d.photo, photoPos: 'center 20%', ...(d.years.trim() ? { years: d.years.trim() } : {}) }); });
          toast(`${d.name.trim()} entra en el Salón de la Fama`);
        } }, 'Añadir'))));
  };
  idle();
  return wrap;
}

// ---------- Redes y contacto ----------
export function sitioEditor() {
  const T = S.pages.sitio;
  const urlErr = (f) => { const e = errOf(f); return e ? { msg: e.msg } : null; };
  const used = T.redes.map((r) => r.label);
  return h('div', { class: 'ed hed' },
    h('div', { class: 'scr-head' },
      h('div', {}, h('h1', { class: 'scr-title' }, 'Redes y contacto'),
        h('p', { class: 'scr-sub' }, 'Salen en el pie de todas las páginas.'))),
    sec('s-redes', 'Redes de la Triple W', 'En el orden en que salen en el pie.',
      h('ol', { class: 'feat redes' }, T.redes.map((r, i) => h('li', { 'data-field': `red-${i}` },
        h('b', { class: 'red-l' }, r.label),
        h('input', { type: 'url', value: r.url || '', placeholder: 'https://…', 'aria-label': `Enlace de ${r.label}`, class: errOf(`red-${i}`) ? 'bad' : '', onfocus: () => snapshot(),
          oninput: (e) => setLive(() => { r.url = e.target.value.trim(); }), onchange: () => { S.view.keepScroll = true; change(() => { r.url = fixUrl(r.url); }); } }),
        rowTools(T.redes, i, 'red')))),
      NETS.some((n) => !used.includes(n))
        ? h('div', { class: 'add-red' }, h('span', { class: 'muted-s' }, 'Añadir:'), NETS.filter((n) => !used.includes(n)).map((n) =>
          h('button', { class: 'fchip', type: 'button', onclick: () => { S.view.keepScroll = true; change(() => { T.redes.push({ label: n, url: '' }); }); } }, icon('plus'), n)))
        : null,
      ...T.redes.map((r, i) => errOf(`red-${i}`) ? h('p', { class: 'err' }, icon('alert'), errOf(`red-${i}`).msg) : null)),
    sec('s-contacto', 'Contacto', null,
      field('Correo de contacto', { type: 'email', value: T.email || '', err: urlErr('email'), attrs: { 'data-field': 'email' }, hint: 'Sale en el pie y en el botón «Contactar» de cada luchador.',
        oninput: (v) => setLive(() => { T.email = v.trim(); }), onchange: () => { S.view.keepScroll = true; change(() => {}); } }),
      field('Canal de YouTube', { type: 'url', value: T.youtube || '', err: urlErr('youtube'), attrs: { 'data-field': 'youtube' }, hint: 'Al que llevan el bloque de YouTube de la portada y los shows.',
        oninput: (v) => setLive(() => { T.youtube = v.trim(); }), onchange: () => { S.view.keepScroll = true; change(() => { T.youtube = fixUrl(T.youtube); }); } })),
    sec('s-creditos', 'Créditos', 'La línea pequeña del final de cada página.',
      h('ol', { class: 'hist' }, T.creditos.map((c, i) => h('li', { class: 'hist-i', 'data-field': `cred-${i}` },
        h('div', { class: 'hist-top' }, h('span', { class: 'match-n' }, i + 1), rowTools(T.creditos, i, 'crédito')),
        h('div', { class: 'grid two tight' },
          field('Qué hizo', { value: c.label || '', max: 30, attrs: { placeholder: 'Fotografía' }, oninput: (v) => setLive(() => { c.label = v; }) }),
          field('Quién', { value: c.handle || '', max: 40, attrs: { placeholder: '@usuario' }, oninput: (v) => setLive(() => { c.handle = v; }) }),
          field('Enlace (opcional)', { type: 'url', value: c.url || '', attrs: { placeholder: 'https://…' }, oninput: (v) => setLive(() => { c.url = v.trim(); }), onchange: () => { S.view.keepScroll = true; change(() => { c.url = fixUrl(c.url); }); } })),
        errOf(`cred-${i}`) ? h('p', { class: 'err' }, icon('alert'), errOf(`cred-${i}`).msg) : null))),
      h('button', { class: 'btn2 add', type: 'button', onclick: () => { S.view.keepScroll = true; change(() => { T.creditos.push({ label: '', handle: '', url: '' }); }); } }, icon('plus'), 'Añadir un crédito')));
}
