// Proxy para el estado de máquinas de Lavando.
// La URL real de la API (la que consume la tele del local) se configura por
// variable de entorno en Netlify, una por sede:
//   LAVANDO_API_ZEBALLOS   = https://...
//   LAVANDO_API_MONTEVIDEO = https://...
// Opcional: LAVANDO_API_HEADERS = '{"Authorization":"Bearer ..."}'
// Así la URL no queda expuesta en el front y se evita el bloqueo por CORS.

const SEDES = {
  zeballos: 'LAVANDO_API_ZEBALLOS',
  montevideo: 'LAVANDO_API_MONTEVIDEO',
};

let cache = {}; // { sede: { at, body } } — dura mientras la función esté "caliente"
const TTL_MS = 15000;

exports.handler = async (event) => {
  const sede = (event.queryStringParameters?.sede || '').toLowerCase();
  const envKey = SEDES[sede];
  const json = (statusCode, body) => ({
    statusCode,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });

  if (!envKey) return json(400, { error: 'sede inválida' });
  const upstream = process.env[envKey];
  if (!upstream) return json(501, { error: `falta configurar ${envKey}` });

  const hit = cache[sede];
  if (hit && Date.now() - hit.at < TTL_MS) return json(200, hit.body);

  let headers = { Accept: 'application/json' };
  try { Object.assign(headers, JSON.parse(process.env.LAVANDO_API_HEADERS || '{}')); } catch {}

  try {
    const ctrl = new AbortController();
    const to = setTimeout(() => ctrl.abort(), 7000);
    const r = await fetch(upstream, { headers, signal: ctrl.signal });
    clearTimeout(to);
    if (!r.ok) return json(502, { error: `upstream HTTP ${r.status}` });
    const body = await r.text();
    JSON.parse(body); // valida que sea JSON
    cache[sede] = { at: Date.now(), body };
    return json(200, body);
  } catch (e) {
    return json(502, { error: 'upstream: ' + (e.name === 'AbortError' ? 'timeout' : e.message) });
  }
};
