// Builds the static site for Cloudflare Pages into dist/. Mirrors what server.js exposes: only public web assets,
// never SQL, notes, sources or tooling. The /api routes are served by functions/api/[name].js.
import { cpSync, existsSync, mkdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const out = join(root, 'dist');
const blocked = /\.(sql|bak|md|txt|map|gradle|java|ts)$/i;
const maxBytes = 25 * 1024 * 1024; // Cloudflare Pages per-file limit

rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });

const filter = source => {
  if (blocked.test(source)) return false;
  const info = statSync(source);
  if (info.isFile() && info.size > maxBytes) { console.warn(`Skipped ${source} (over 25 MB).`); return false; }
  return true;
};

for (const file of ['index.html', 'sw.js', 'sw-cache.js', 'manifest.webmanifest', 'placeholder.svg', 'careers.html', 'media.html', 'sanaa.html', 'admin.html']) {
  if (existsSync(join(root, file))) cpSync(join(root, file), join(out, file));
}
for (const folder of ['img', 'slides', 'milkyway']) {
  if (existsSync(join(root, folder))) cpSync(join(root, folder), join(out, folder), { recursive: true, filter });
}

// Same response headers server.js sets. LIVE needs the camera and microphone on this origin.
writeFileSync(join(out, '_headers'), `/*
  Permissions-Policy: camera=(self), microphone=(self), autoplay=(self), fullscreen=(self), geolocation=()
  X-Content-Type-Options: nosniff
  Referrer-Policy: strict-origin-when-cross-origin
/*.html
  Cache-Control: no-cache
/sw.js
  Cache-Control: no-cache
/sw-cache.js
  Cache-Control: no-cache
/*.webmanifest
  Cache-Control: no-cache
`);
console.log('Cloudflare Pages build written to dist/.');
