// Una sola base de código, dos webs.
// SITE_ID decide cuál se construye: "triplew" (por defecto) o "lucharama".
import { defineConfig } from 'astro/config';
import vercel from '@astrojs/vercel';

const SITE_ID = process.env.SITE_ID === 'lucharama' ? 'lucharama' : 'triplew';

export default defineConfig({
  srcDir: `./sites/${SITE_ID}`,
  publicDir: `./public/${SITE_ID}`,
  // En Vercel cada proyecto construye una sola web en dist/. En local, cada web va a su carpeta.
  outDir: process.env.VERCEL ? './dist' : `./dist/${SITE_ID}`,
  // Mientras la web vive en Vercel, los enlaces absolutos (imagen al compartir, canonical) apuntan a Vercel.
  site: process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
    : SITE_ID === 'lucharama' ? 'https://www.lucharama.com' : 'https://www.triplew.es',
  build: { format: 'directory' },
  // Casi todo se genera como páginas estáticas. Solo /api/admin y /vista-previa se ejecutan en el
  // servidor (funciones de Vercel). Sin el adaptador no se podrían construir.
  adapter: vercel(),
});
