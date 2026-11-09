import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const root = process.cwd();
const issues = [];
const warnings = [];
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');

// Confirm syntax checks and locale-loading tests pass before packaging.
for (const [label, args] of [
  ['JavaScript syntax', ['tools/check-syntax.mjs']],
  ['locale loading tests', ['--test', 'tools/phase3-locale-loading.test.mjs']],
]) {
  const result = spawnSync(process.execPath, args, { cwd: root, encoding: 'utf8' });
  if (result.status !== 0) issues.push(`${label} failed:\n${result.stdout}\n${result.stderr}`);
  else console.log(`PASS: ${label}`);
}

// Public client code must never embed a Supabase service-role key or private key.
const scanRoots = ['index.html', 'admin.html', 'media.html', 'sanaa.html', 'careers.html', 'lib', 'milkyway'];
const secretPatterns = [/service_role/i, /SUPABASE_SERVICE_ROLE_KEY/i, /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/];
function walk(p) {
  if (!fs.existsSync(path.join(root, p))) return [];
  const abs = path.join(root, p);
  const stat = fs.statSync(abs);
  if (stat.isFile()) return [p];
  return fs.readdirSync(abs, { withFileTypes: true }).flatMap(e => {
    const child = path.join(p, e.name);
    if (e.isDirectory() && ['node_modules', '.git', 'dist'].includes(e.name)) return [];
    return walk(child);
  });
}
for (const file of [...new Set(scanRoots.flatMap(walk))]) {
  if (!/\.(?:html|js|mjs|ts|json)$/i.test(file)) continue;
  const body = read(file);
  for (const pattern of secretPatterns) {
    if (pattern.test(body)) issues.push(`Potential sensitive key/identifier pattern in client-facing source: ${file} (${pattern})`);
  }
}
if (!issues.some(x => x.includes('Potential sensitive'))) console.log('PASS: no obvious service-role/private-key marker in scanned client source');

const cap = JSON.parse(read('capacitor.config.json'));
if (cap.server?.url) warnings.push(`Capacitor uses remote server.url (${cap.server.url}); bundled Android app depends on network for its web UI and cannot be assumed to boot offline from local assets.`);
const splash = path.join(root, 'android/capacitor/app/src/main/res/raw/milkyway_splash.mp4');
if (!fs.existsSync(splash)) issues.push('Android splash video is missing.');
else {
  const bytes = fs.readFileSync(splash);
  if (bytes.length < 12 || bytes.toString('ascii', 4, 8) !== 'ftyp') issues.push('Android splash file does not have a recognizable MP4 header.');
  else console.log(`PASS: Android splash file is a recognizable MP4 (${bytes.length} bytes)`);
}

for (const warning of warnings) console.warn(`WARN: ${warning}`);
if (issues.length) {
  for (const issue of issues) console.error(`FAIL: ${issue}`);
  process.exitCode = 1;
} else {
  console.log('PASS: release readiness checks completed; warnings still require review before Production.');
}
