import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');

test('app shell loads locale loader instead of all locale catalogs', () => {
  const html = read('milkyway/index.html');
  assert.match(html, /locale-loader\.js\?v=1/);
  assert.doesNotMatch(html, /src=["'][^"']*locale-catalogs\.js/);
  assert.doesNotMatch(html, /src=["'][^"']*german-locale\.js/);
});

test('service worker does not precache the all-language catalogs', () => {
  const sw = read('milkyway/sw.js');
  assert.match(sw, /locale-loader\.js\?v=1/);
  assert.doesNotMatch(sw, /ASSETS\.push\([^;]*locale-catalogs\.js/s);
  assert.doesNotMatch(sw, /ASSETS\.push\([^;]*german-locale\.js/s);
  assert.match(sw, /mw-locale-catalogs-v1/);
});

test('supported catalogs are split and dynamically loadable', () => {
  const loader = read('milkyway/locale-loader.js');
  for (const locale of ['ar', 'pt', 'hi', 'de']) {
    assert.ok(fs.existsSync(path.join(root, `milkyway/locales/${locale}.js`)));
    assert.ok(fs.existsSync(path.join(root, `milkyway/locales/${locale}-extra.js`)));
    assert.match(loader, new RegExp(`'${locale}'`));
  }
  assert.match(loader, /MilkyWayLocaleLoader/);
  assert.match(loader, /document\.write/);
  assert.match(read('milkyway/translations.js'), /MilkyWayLocaleLoader\?\.load\(locale\)/);
});

test('default languages avoid downloading supplemental locale catalogs at startup', () => {
  const html = read('milkyway/index.html');
  const loader = read('milkyway/locale-loader.js');
  assert.ok(!html.includes('locale-catalogs.js'));
  assert.ok(!html.includes('german-locale.js'));
  assert.match(loader, /selected = localStorage\.getItem\('mw_lang'\)/);
});
