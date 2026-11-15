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

export const ticketLabel = (show) =>
  show.ticket?.type === 'venta' ? 'Compra tu entrada' : show.ticket?.type === 'inversa' ? 'Entrada inversa' : null;

// Direcciones de cada web, usadas en los enlaces de una a otra.
// Ahora apuntan al prototipo en Vercel. Al publicar en los servidores de la asociación,
// cambiarlas por https://www.triplew.es y https://www.lucharama.com.
export const urls = {
  triplew: process.env.PUBLIC_TRIPLEW_URL || 'https://triplew-prototipo.vercel.app',
  lucharama: process.env.PUBLIC_LUCHARAMA_URL || 'https://lucharama-prototipo.vercel.app',
};
