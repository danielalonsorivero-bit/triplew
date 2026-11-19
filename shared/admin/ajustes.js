// Sección «Ajustes»: cómo sale la web en Google y al compartir, si Google puede mostrarla,
// y la contraseña del panel. Datos: shared/data/paginas-triplew.json → seo (S.pages.seo).

import { S, h, icon, field, choice, change, setLive, imgSrc, dropZone, toast } from './app.js';
import * as store from './store.js';
import { cover } from './img.js';

const PAGES = [
  ['home', 'Portada'], ['shows', 'Shows'], ['roster', 'Roster'],
  ['campeonatos', 'Campeonatos'], ['historia', 'Historia'], ['salon', 'Salón de la Fama'],
];

export function checkSeo() {
  const o = S.pages.seo, errs = [], warns = [];
  const add = (list, f, msg) => list.push({ kind: 'page', view: 'ajustes', field: f, msg, show: 'Ajustes' });
  if (!o) return { errs, warns };
  if (!o.siteName?.trim()) add(errs, 'seo-name', 'Falta el nombre de la web.');
  if (!o.description?.trim()) add(errs, 'seo-desc', 'Falta la descripción general.');
  else if (o.description.trim().length < 70) add(warns, 'seo-desc', 'La descripción general es muy corta: Google suele mostrar entre 70 y 160 letras.');
  return { errs, warns };
}
const errOf = (f) => [...checkSeo().errs, ...checkSeo().warns].find((e) => e.field === f);

const sec = (id, title, intro, ...kids) => h('section', { class: 'pane wsec', id },
  h('h2', { class: 'pane-h' }, title), intro ? h('p', { class: 'pane-p' }, intro) : null, h('div', { class: 'grid' }, kids));

export function ajustesEditor() {
  if (!S.pages.seo) S.pages.seo = { siteName: 'Triple W · WhiteWolf Wrestling', description: '', image: '', index: false, pages: {} };
  const o = S.pages.seo;
  o.pages ||= {};
  const prev = h('div', { class: 'seo-prev' });
  const paint = () => prev.replaceChildren(
    h('div', { class: 'gg' }, h('p', { class: 'gg-h' }, 'Así sale en Google'),
      h('p', { class: 'gg-url' }, 'triplew.es'),
      h('p', { class: 'gg-t' }, o.siteName || 'Nombre de la web'),
      h('p', { class: 'gg-d' }, (o.description || 'Descripción general…').slice(0, 160))),
    h('div', { class: 'sh' }, h('p', { class: 'gg-h' }, 'Así sale al compartir un enlace'),
      h('div', { class: 'sh-card' },
        o.image ? h('img', { src: imgSrc(o.image), alt: '' }) : h('div', { class: 'sh-ph' }, 'Sin imagen propia: sale el cartel del próximo show'),
        h('div', { class: 'sh-txt' }, h('b', {}, o.siteName || 'Nombre de la web'), h('span', {}, o.description || '')))));
  paint();
  const live = (fn) => (v) => { setLive(() => fn(v)); paint(); };
  const e1 = errOf('seo-name'), e2 = errOf('seo-desc');

  return h('div', { class: 'ed hed' },
    h('div', { class: 'scr-head' }, h('div', {}, h('h1', { class: 'scr-title' }, 'Ajustes'),
      h('p', { class: 'scr-sub' }, 'Cosas de toda la web que se tocan muy poco.'))),

    sec('a-seo', 'En Google y al compartir', 'Es lo que ve la gente antes de entrar: en el buscador y en WhatsApp, Instagram o X cuando alguien pega un enlace.',
      h('div', { class: 'grid two seo-g' },
        h('div', { class: 'grid' },
          field('Nombre de la web', { value: o.siteName || '', max: 40, required: true, err: e1, attrs: { 'data-field': 'seo-name' }, oninput: live((v) => { o.siteName = v; }) }),
          field('Descripción general', { area: true, value: o.description || '', max: 160, required: true, err: e2, attrs: { rows: 3, 'data-field': 'seo-desc' },
            hint: 'Una o dos frases que digan qué es la Triple W. Google muestra entre 70 y 160 letras.', oninput: live((v) => { o.description = v; }) }),
          shareImage(o, paint)),
        prev)),

    sec('a-pages', 'Descripción de cada página', 'Opcional. Si la dejas vacía, se usa la descripción general. Los shows y las fichas de luchadores crean la suya solas, con su cartel o su retrato.',
      ...PAGES.map(([k, label]) => field(label, { area: true, value: o.pages[k] || '', max: 160, attrs: { rows: 2, placeholder: o.description || '' },
        oninput: (v) => setLive(() => { if (v.trim()) o.pages[k] = v; else delete o.pages[k]; }) }))),

    sec('a-index', '¿Puede Google mostrar la web?', null,
      choice('seo-index', [
        { value: 'no', label: 'Todavía no', note: 'Mientras la Triple W revisa y aprueba la web. Google no la muestra.' },
        { value: 'si', label: 'Sí', note: 'Para cuando la web esté aprobada y en su dominio. Google tarda unos días en empezar a mostrarla.' },
      ], o.index ? 'si' : 'no', (v) => { S.view.keepScroll = true; change(() => { o.index = v === 'si'; }); }),
      o.index ? h('p', { class: 'warn' }, icon('alert'), 'Si la web aún está en pruebas, vuelve a «Todavía no»: lo que Google ya ha guardado tarda semanas en desaparecer.') : null),

    sec('a-pass', 'Contraseña del panel', null,
      h('div', { class: 'howto' },
        h('p', {}, h('b', {}, 'Cambiarla. '), 'Por ahora se cambia fuera del panel, en Vercel (tarda dos minutos):'),
        h('ol', {},
          h('li', {}, 'Entra en vercel.com → proyecto ', h('b', {}, 'triplew-prototipo'), ' → Settings → Environment Variables.'),
          h('li', {}, 'En ', h('code', {}, 'ADMIN_PASSWORD'), ', pulsa los tres puntos → Edit, escribe la nueva y guarda.'),
          h('li', {}, 'Deployments → el último de Production → los tres puntos → Redeploy.'),
          h('li', {}, 'Al volver al panel te pedirá la contraseña nueva.')),
        h('p', {}, h('b', {}, 'Si nadie la recuerda. '), 'No se pierde nada: la web sigue igual y los cambios sin publicar siguen guardados en este ordenador. Quien tenga acceso a Vercel pone una nueva con los mismos pasos (Vercel no deja verla, solo cambiarla).'),
        h('p', { class: 'muted-s' }, 'Cuando la web pase al servidor de la Triple W, la contraseña se podrá cambiar aquí mismo y recuperar por correo.')),
      store.mode === 'real' ? h('button', { class: 'btn2', type: 'button', onclick: () => { store.clearKey(); location.reload(); } }, icon('lock'), 'Cerrar sesión en este ordenador') : null));
}

function shareImage(o, paint) {
  const box = h('div', { class: 'fld', 'data-field': 'seo-img' }, h('label', {}, 'Imagen al compartir (opcional)'));
  const body = o.image
    ? h('figure', { class: 'sh-fig' }, h('img', { src: imgSrc(o.image), alt: '' }),
      h('button', { class: 'lnk danger', type: 'button', onclick: () => { S.view.keepScroll = true; change(() => { o.image = ''; }); } }, icon('trash'), 'Quitar la imagen'))
    : dropZone({ label: 'Sube una foto', hint: 'Se recorta sola al formato de las redes (1200 × 630). Mejor una foto con la gente y el ring, sin textos pequeños.', multiple: false,
      onfiles: async ([f]) => {
        try {
          const r = await cover(f, 1200, 630, 0.82, 600e3);
          const path = `/fotos/compartir/web-${Date.now().toString(36)}.jpg`;
          S.files.set(path, { blob: r.blob, url: r.url });
          S.view.keepScroll = true; change(() => { o.image = path; });
        } catch { toast('Eso no parece una imagen. Prueba con un JPG o PNG.'); }
      } });
  box.append(body);
  return box;
}
