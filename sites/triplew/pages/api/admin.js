// Endpoint del panel: se ejecuta en el servidor (función de Vercel), no se genera como página.
import { handleGet, handlePost } from '../../../../shared/server/admin.js';
export const prerender = false;
export const GET = () => handleGet();
export const POST = ({ request }) => handlePost(request);
