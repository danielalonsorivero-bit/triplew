// Utilidades compartidas por las dos webs.
import showsData from './data/shows.json';
import rosterData from './data/roster.json';
import titlesData from './data/titles.json';

export const venues = showsData.venues;
export const roster = rosterData.wrestlers;
export const divisions = rosterData.divisions;
export const titles = titlesData.titles;

// "Hoy" se calcula al construir la web. Vercel reconstruye en cada cambio;
// si un show pasa sin que haya cambios, sigue saliendo como próximo hasta la siguiente publicación.
const today = new Date(new Date().toISOString().slice(0, 10));

export const allShows = [...showsData.shows].sort((a, b) => a.date.localeCompare(b.date));
export const upcomingShows = allShows.filter((s) => new Date(s.date) >= today);
export const pastShows = allShows.filter((s) => new Date(s.date) < today).reverse();
export const nextShow = upcomingShows[0] ?? allShows[allShows.length - 1];

const fmt = new Intl.DateTimeFormat('es-ES', { weekday: 'short', day: 'numeric', month: 'long', timeZone: 'UTC' });
const fmtShort = new Intl.DateTimeFormat('es-ES', { day: '2-digit', month: 'short', timeZone: 'UTC' });
const fmtYear = new Intl.DateTimeFormat('es-ES', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });

export const dateLong = (d) => fmt.format(new Date(d));
export const dateShort = (d) => fmtShort.format(new Date(d)).replace('.', '');
export const dateYear = (d) => fmtYear.format(new Date(d));
export const dayNum = (d) => String(new Date(d).getUTCDate()).padStart(2, '0');
export const monthShort = (d) => new Intl.DateTimeFormat('es-ES', { month: 'short', timeZone: 'UTC' }).format(new Date(d)).replace('.', '').toUpperCase();

export const wrestler = (slug) => roster.find((w) => w.slug === slug);
export const findByName = (name) => roster.find((w) => w.name === name);
export const titleOf = (slug) => titles.find((t) => t.slug === slug);
export const initials = (name) => name.replace(/[^\p{L} ]/gu, '').split(' ').filter(Boolean).slice(0, 2).map((p) => p[0]).join('').toUpperCase();

// Tipos de entrada. label: listas de shows · line: bajo la sala en la portada · board: ficha del show.
// Solo 'venta' con enlace pone el botón de compra.
export const TICKETS = {
  venta: { label: 'Compra tu entrada', line: 'Entradas a la venta', board: 'Anticipada' },
  inversa: { label: 'Entrada inversa', line: 'Entra gratis, paga al salir', board: 'Gratis, pagas al salir' },
  gratis: { label: 'Entrada gratuita', line: 'Entrada gratuita', board: 'Gratuita' },
  taquilla: { label: 'Entrada en taquilla', line: 'Entradas en taquilla el mismo día', board: 'En taquilla, el mismo día' },
  agotado: { label: 'Entradas agotadas', line: 'Entradas agotadas', board: 'Agotadas' },
};
export const ticketInfo = (show) => TICKETS[show.ticket?.type] || TICKETS.inversa;
export const ticketLabel = (show) => TICKETS[show.ticket?.type]?.label ?? null;

// Direcciones de cada web, usadas en los enlaces de una a otra.
// Ahora apuntan al prototipo en Vercel. Al publicar en los servidores de la asociación,
// cambiarlas por https://www.triplew.es y https://www.lucharama.com.
export const urls = {
  triplew: process.env.PUBLIC_TRIPLEW_URL || 'https://triplew-prototipo.vercel.app',
  lucharama: process.env.PUBLIC_LUCHARAMA_URL || 'https://lucharama-prototipo.vercel.app',
};

// Diapositivas de la portada ("la entrada"): una por luchador del próximo show que tenga foto.
// Se sacan solas de la cartelera del show. Si el show trae "hero" (lista de
// { wrestler: slug, text?, photo? }), se usa esa lista en ese orden y manda sobre lo automático.
export function heroSlides(show) {
  const card = show?.card ?? [];
  const slides = [];
  if (show?.hero?.length) {
    for (const h of show.hero) {
      const w = wrestler(h.wrestler);
      if (!w || !(h.photo || w.photo)) continue;
      const m = card.find((c) => c.sides?.includes(w.name));
      const opp = m?.sides?.filter((s) => s !== w.name) ?? [];
      slides.push({ w, photo: h.photo || w.photo, pos: h.photoPos || w.photoPos, match: m?.title, opponents: opp, text: h.text ?? m?.note });
    }
  } else {
    for (const m of card) {
      for (const name of m.sides ?? []) {
        const w = findByName(name);
        if (!w?.photo || slides.some((s) => s.w.slug === w.slug)) continue;
        slides.push({ w, photo: w.photo, pos: w.photoPos, match: m.title, opponents: m.sides.filter((s) => s !== name), text: m.note, provisional: m.provisional });
      }
    }
  }
  // Sin cartelera con fotos: luchadores con retrato de la división del show
  // (Level One o Triple W), primero los campeones.
  if (!slides.length) {
    const div = show?.brand === 'levelone' ? 'levelone' : 'absoluto';
    const pool = roster.filter((x) => x.photo && x.division === div).sort((a, b) => (b.titles?.length ?? 0) - (a.titles?.length ?? 0));
    for (const w of pool.slice(0, 5)) {
      const t = w.titles?.length ? titleOf(w.titles[0]) : null;
      slides.push({ w, photo: w.photo, pos: w.photoPos, match: t ? `Campeón ${t.name.replace(/^Campeonatos? /, '')}` : undefined, text: w.nickname });
    }
  }
  return slides;
}

// Redes sociales de un luchador. En roster.json, campo opcional "social":
// { "instagram": "usuario", "x": "usuario", "facebook": "usuario o enlace", "tiktok": "usuario", "youtube": "enlace", "web": "enlace" }
// Vale poner el nombre de usuario (con o sin @) o el enlace completo. Solo se muestran las que existan.
const socialBase = {
  instagram: ['Instagram', 'https://www.instagram.com/'],
  x: ['X', 'https://x.com/'],
  facebook: ['Facebook', 'https://www.facebook.com/'],
  tiktok: ['TikTok', 'https://www.tiktok.com/@'],
  youtube: ['YouTube', 'https://www.youtube.com/@'],
  twitch: ['Twitch', 'https://www.twitch.tv/'],
  web: ['Web', ''],
};
export function socialLinks(w) {
  const s = { ...(w.instagram ? { instagram: w.instagram } : {}), ...(w.social || {}) };
  return Object.entries(socialBase)
    .filter(([k]) => s[k])
    .map(([k, [label, base]]) => {
      const v = String(s[k]).trim();
      const url = /^https?:\/\//.test(v) ? v : base + v.replace(/^@/, '');
      return { label, url, handle: /^https?:\/\//.test(v) ? null : '@' + v.replace(/^@/, '') };
    });
}

// Crónica de un show: la lógica vive en cronica.js (el panel de administración la reutiliza).
import { cronicaBlocksFor } from './cronica.js';
export const cronicaBlocks = (text) => cronicaBlocksFor(text, roster);
