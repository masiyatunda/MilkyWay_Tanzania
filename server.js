import express from 'express';
import { existsSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = dirname(fileURLToPath(import.meta.url));
const app = express();
app.disable('x-powered-by');
app.set('trust proxy', true);
// LIVE needs the microphone and camera on this origin; other powerful features stay off.
app.use((_request, response, next) => {
  response.setHeader('Permissions-Policy', 'camera=(self), microphone=(self), autoplay=(self), fullscreen=(self), geolocation=()');
  response.setHeader('X-Content-Type-Options', 'nosniff');
  response.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  next();
});

app.get('/healthz', (_request, response) => response.type('text/plain').send('ok'));

// Each file in api/ exports a (request, response) handler and is served at /api/<file name>.
const apiRoot = join(root, 'api');
const handlers = new Map();
if (existsSync(apiRoot)) {
  for (const file of readdirSync(apiRoot).filter(name => name.endsWith('.js'))) {
    handlers.set(file.slice(0, -3), (await import(pathToFileURL(join(apiRoot, file)))).default);
  }
}
app.use('/api', express.json({ limit: '16kb' }));
app.all('/api/:name', async (request, response) => {
  const handler = handlers.get(request.params.name);
  if (!handler) return response.status(404).json({ error: 'Not found.' });
  try { await handler(request, response); }
  catch { if (!response.headersSent) response.status(500).json({ error: 'Service unavailable.' }); }
});
// Body-parser failures (bad JSON, oversize) must stay JSON so the client never receives an HTML error page.
app.use('/api', (error, _request, response, next) => {
  if (response.headersSent) return next(error);
  const status = Number.isInteger(error?.status) && error.status >= 400 && error.status < 500 ? error.status : 500;
  response.status(status).json({ error: status === 413 ? 'Request too large.' : status === 500 ? 'Service unavailable.' : 'Invalid request body.' });
});
app.use('/api', (_request, response) => response.status(404).json({ error: 'Not found.' }));

// Only public web assets are exposed; sources, SQL, notes and tooling are never served.
const blocked = /\.(sql|bak|md|txt|map|gradle|java)$/i;
app.use((request, response, next) => blocked.test(request.path) ? response.sendStatus(404) : next());

const noCache = (response, path) => { if (/(^|[\\/])sw(-cache)?\.js$|\.webmanifest$|\.html$/.test(path)) response.setHeader('Cache-Control', 'no-cache'); };
const options = { index: false, dotfiles: 'ignore', setHeaders: noCache, maxAge: '1h' };
for (const file of ['sw.js', 'sw-cache.js', 'manifest.webmanifest', 'placeholder.svg', 'careers.html', 'media.html', 'sanaa.html', 'admin.html']) {
  app.get(`/${file}`, (_request, response) => response.sendFile(join(root, file), { headers: /\.(js|webmanifest|html)$/.test(file) ? { 'Cache-Control': 'no-cache' } : {} }));
}
for (const folder of ['img', 'slides']) app.use(`/${folder}`, express.static(join(root, folder), options));
app.use('/milkyway', express.static(join(root, 'milkyway'), { ...options, index: 'index.html' }));
app.get('/', (_request, response) => response.sendFile(join(root, 'index.html'), { headers: { 'Cache-Control': 'no-cache' } }));

app.use((_request, response) => response.status(404).type('text/plain').send('Not found'));

const port = Number(process.env.PORT) || 3000;
// Surface misconfiguration at boot; GET /api/milkyway-health runs the full live check.
const configured = (...names) => names.map(name => (process.env[name] || '').trim()).find(Boolean) || '';
const startupUrl = configured('SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_URL');
if (startupUrl && !/^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/i.test(startupUrl)) console.warn('SUPABASE_URL is not a valid https://<project>.supabase.co address.');
if (!configured('SUPABASE_ANON_KEY', 'SUPABASE_PUBLISHABLE_KEY', 'NEXT_PUBLIC_SUPABASE_ANON_KEY', 'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY')) console.warn('SUPABASE_ANON_KEY is not set; server API routes rely on the key sent by the browser.');
if (/^sb_secret_/.test(configured('SUPABASE_ANON_KEY')) || /service_role/i.test(configured('SUPABASE_ANON_KEY'))) console.warn('SUPABASE_ANON_KEY looks like a secret key. Use the publishable key only.');
app.listen(port, '0.0.0.0', () => console.log(`MilkyWay is listening on port ${port}`));
