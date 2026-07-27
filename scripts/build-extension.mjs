// Assembles dist/extension/ — the folder you load unpacked in Chrome. The popup shares its
// stylesheet and converters with the web UI, so both are copied from source rather than
// kept as a second copy in src/extension/.
import { copyFileSync, mkdirSync, existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CLIENT = path.join(ROOT, 'dist', 'client');
const OUT = path.join(ROOT, 'dist', 'extension');

const STATIC_FILES = [
  ['src/extension/popup.html', 'popup.html'],
  ['src/extension/manifest.json', 'manifest.json'],
  ['public/app.css', 'app.css'],
];

/**
 * Walks popup.js's imports so the bundle always matches what the code actually needs.
 * A hardcoded list silently ships a broken popup the moment a new module is imported.
 *
 * @param {string} entry
 * @returns {string[]}
 */
function collectModules(entry) {
  /** @type {Set<string>} */
  const found = new Set();
  /** @type {string[]} */
  const queue = [entry];

  for (;;) {
    const name = queue.pop();
    if (name === undefined) break;
    if (found.has(name)) continue;

    const file = path.join(CLIENT, name);
    if (!existsSync(file)) {
      console.error(`build-extension: ${name} is missing. Run "npm run build:client" first.`);
      process.exit(1);
    }
    found.add(name);

    const source = readFileSync(file, 'utf8');
    for (const match of source.matchAll(/\bfrom\s+['"]\.\/([^'"]+)['"]/g)) {
      queue.push(match[1]);
    }
  }

  return [...found];
}

mkdirSync(OUT, { recursive: true });

for (const [from, to] of STATIC_FILES) {
  const source = path.join(ROOT, from);
  if (!existsSync(source)) {
    console.error(`build-extension: missing ${from}.`);
    process.exit(1);
  }
  copyFileSync(source, path.join(OUT, to));
}

const modules = collectModules('popup.js');
for (const name of modules) {
  copyFileSync(path.join(CLIENT, name), path.join(OUT, name));
}

console.log(
  `Extension built at ${path.relative(ROOT, OUT)} ` +
    `(${modules.length} modules: ${modules.join(', ')}) — load it unpacked in Chrome.`
);
