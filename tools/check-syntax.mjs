import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

let checked = 0;
let failed = false;
for (const directory of ['.', 'milkyway']) {
  for (const file of readdirSync(directory, { withFileTypes: true })) {
    if (!file.isFile() || !/\.(html|js)$/.test(file.name)) continue;
    const path = join(directory, file.name);
    const source = readFileSync(path, 'utf8');
    const scripts = file.name.endsWith('.js') ? [{ source, label: path, module: true }] :
      [...source.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script\s*>/gi)]
        .filter(match => !/\bsrc\s*=/i.test(match[1]) && (!/\btype\s*=/i.test(match[1]) || /\btype\s*=\s*["']?(module|text\/javascript|application\/javascript)["']?(?:\s|$)/i.test(match[1])))
        .map((match, index) => ({ source: match[2], label: `${path}:script-${index + 1}`, module: /\btype\s*=\s*["']?module/i.test(match[1]) }));
    for (const script of scripts) {
      const result = spawnSync(process.execPath, ['--check', `--input-type=${script.module ? 'module' : 'commonjs'}`], { input: script.source, encoding: 'utf8' });
      checked++;
      if (result.status !== 0) { failed = true;console.error(`Syntax check failed: ${script.label}`); }
    }
  }
}
console.log(`${checked} JavaScript and inline-script syntax checks ${failed ? 'failed' : 'passed'}.`);
process.exitCode = failed ? 1 : 0;
