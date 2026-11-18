// Crónica de un show: módulo sin dependencias para poder usarlo también en el panel de administración.
// Crónica de un show (campo "cronica" en shows.json): texto pegado tal cual de Instagram.
// Los párrafos van separados por una línea en blanco. Una línea corta en mayúsculas
// (como "MAIN EVENT") se convierte en subtítulo. Las letras "negrita" de Instagram (𝗠𝗔𝗜𝗡)
// se pasan a letras normales. La primera vez que aparece el nombre de alguien del roster,
// se enlaza a su ficha.
const esc = (t) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
export function cronicaBlocksFor(text, roster) {
  if (!text) return [];
  const linked = new Set();
  const names = [...roster].sort((a, b) => b.name.length - a.name.length);
  const link = (t) => {
    let h = esc(t);
    for (const w of names) {
      if (linked.has(w.slug)) continue;
      const i = h.indexOf(esc(w.name));
      if (i === -1 || /[\p{L}]/u.test(h[i - 1] ?? '') || /[\p{L}]/u.test(h[i + esc(w.name).length] ?? '')) continue;
      h = h.slice(0, i) + `<a href="/roster/${w.slug}/">${esc(w.name)}</a>` + h.slice(i + esc(w.name).length);
      linked.add(w.slug);
    }
    return h;
  };
  // Limpieza para que encaje con la web: fuera emojis y banderas, comillas rectas a «», espacios sobrantes.
  const clean = (t) => t
    .replace(/[\p{Extended_Pictographic}\p{Regional_Indicator}\u{FE0F}\u{200D}\u{20E3}\u{1F3FB}-\u{1F3FF}]/gu, '')
    .replace(/"([^"]+)"/g, '«$1»')
    .replace(/\s+([,.;:)])/g, '$1').replace(/\s{2,}/g, ' ').trim();
  const RES = /(v[ií]a (pin|sumisi[oó]n|rendici[oó]n|cuenta)|descalificaci[oó]n|se impus(o|ieron)|venci[oó]|se llev[oó] la victoria|retener su)/i;
  const blocks = text.normalize('NFKC').replace(/\r/g, '').split(/\n\s*\n/).flatMap((para) => {
    const lines = para.split('\n').map(clean).filter(Boolean);
    const out = [];
    if (lines.length && lines[0].length < 40 && lines[0] === lines[0].toUpperCase() && /\p{Lu}/u.test(lines[0])) {
      out.push({ kind: 'h', html: esc(lines.shift()) });
    }
    if (lines.length) {
      const t = lines.join(' ');
      out.push({ kind: RES.test(t) ? 'res' : 'p', html: link(t) });
    }
    return out;
  });
  // Primer párrafo = entrada destacada; último, si es una exclamación de cierre, = frase final.
  const firstP = blocks.find((b) => b.kind === 'p');
  if (firstP) firstP.kind = 'lead';
  const last = blocks[blocks.length - 1];
  if (last && last.kind === 'p' && /^¡/.test(last.html)) last.kind = 'close';
  return blocks;
}
