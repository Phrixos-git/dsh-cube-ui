#!/usr/bin/env node
/**
 * Cube UI — bundle build step.
 *
 * The Web GUI loads a client bundle as one self-contained script in the
 * `window.__ModuleLoader__.load({ id, factory(require) { ... } })` shape, so
 * the browser half cannot import sibling files at runtime. This script folds
 * the authored sources into that single artifact:
 *
 *   src/client.template.js  ->  client.js
 *     - `const STYLES = __STYLES_JSON__;`      <- src/styles.css
 *     - `const LOCALE_DICTS = __LOCALE_JSON__;`<- locale/{ja,en,zh}.json
 *     - `__PACKAGE_VERSION__`                  <- package.json version
 *
 * No dependencies: plain node >= 18. Run `node build.mjs` from the package
 * root. The generated client.js is committed so installing the bundle needs
 * no build step.
 */

import { readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(fileURLToPath(import.meta.url));
const read = (rel) => readFile(join(root, rel), 'utf8');

const template = await read('src/client.template.js');
const styles = await read('src/styles.css');
const pkg = JSON.parse(await read('package.json'));

const locales = {};
for (const lang of ['ja', 'en', 'zh']) {
  locales[lang] = JSON.parse(await read(`locale/${lang}.json`));
}

const fill = (text, token, value) => {
  const parts = text.split(token);
  if (parts.length < 2) throw new Error(`build: placeholder ${token} is missing from src/client.template.js`);
  return parts.join(value);
};

let out = template;
out = fill(out, '__STYLES_JSON__', JSON.stringify(styles));
out = fill(out, '__LOCALE_JSON__', JSON.stringify(locales));
out = fill(out, '__PACKAGE_VERSION__', JSON.stringify(pkg.version));

await writeFile(join(root, 'client.js'), out, 'utf8');

const bytes = Buffer.byteLength(out, 'utf8');
console.log(
  `cube-ui: built client.js (${out.split('\n').length} lines, ${(bytes / 1024).toFixed(1)} kB) ` +
    `from ${(styles.split('\n').length).toString()} lines of CSS and ${Object.keys(locales).length} locales`,
);
