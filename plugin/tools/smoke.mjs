#!/usr/bin/env node
/**
 * Offline smoke test for the cube-ui client bundle.
 *
 * The browser half is shipped as one `window.__ModuleLoader__.load({...})`
 * script. This harness evaluates it in node with a stub React and a recording
 * Cordis context, then asserts the two slot registrations the plugin depends
 * on. It catches top-level errors, mis-shaped registration options and broken
 * `apply()` wiring without touching the running Web GUI.
 *
 *   node tools/smoke.mjs
 */

import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(fileURLToPath(import.meta.url)) + '/..';
const source = await readFile(join(root, 'client.js'), 'utf8');

const stubReact = {
  createElement: (type, props, ...children) => ({ type, props, children }),
  useState: (initial) => [typeof initial === 'function' ? initial() : initial, () => {}],
  useEffect: () => {},
  useRef: (value) => ({ current: value }),
  useCallback: (fn) => fn,
  useMemo: (fn) => fn(),
  useSyncExternalStore: (_subscribe, getSnapshot) => getSnapshot(),
};

const registrations = [];
let loaded = null;

globalThis.window = {
  innerWidth: 1600,
  setTimeout: (fn, ms) => setTimeout(fn, ms),
  clearTimeout: (id) => clearTimeout(id),
  __ModuleLoader__: {
    load(definition) {
      loaded = definition;
    },
  },
};

globalThis.document = {
  querySelector: () => null,
  querySelectorAll: () => [],
  addEventListener() {},
  removeEventListener() {},
  createElement: () => ({ dataset: {}, set textContent(value) {}, remove() {} }),
  head: { appendChild() {} },
  body: {},
  activeElement: null,
  documentElement: {},
};

const fakeRequire = (name) => {
  if (name === 'react') return stubReact;
  throw new Error(`unexpected require('${name}')`);
};

// eslint-disable-next-line no-new-func
const run = new Function('require', source);
run(fakeRequire);

if (loaded === null) throw new Error('smoke: the bundle never called window.__ModuleLoader__.load');
if (loaded.id !== '@local/dsh-cube-ui') throw new Error(`smoke: unexpected bundle id ${loaded.id}`);

const plugin = loaded.factory(fakeRequire);
if (typeof plugin.apply !== 'function') throw new Error('smoke: factory did not return apply()');
if (!Array.isArray(plugin.inject)) throw new Error('smoke: factory did not return an inject list');

const effects = [];
const fakeCtx = {
  effect(fn, label) {
    effects.push(label ?? 'effect');
    const dispose = fn();
    return typeof dispose === 'function' ? dispose : () => {};
  },
  locale: { register: (ns, dicts) => {
    registrations.push({ kind: 'locale', ns, locales: Object.keys(dicts) });
    return () => {};
  } },
  slots: {
    inject(name, callback) {
      registrations.push({ kind: 'inject', name });
      callback();
    },
    register(options, component) {
      registrations.push({ kind: 'register', options, component });
      return () => {};
    },
  },
  layout: { toggleSidebar() {}, selectPanel() {} },
  uiWorkspace: { openSession() {}, startSession() {} },
  shortcuts: { catalog: { getSnapshot: () => [] } },
  get() {
    return undefined;
  },
};

plugin.apply(fakeCtx);

const main = registrations.find((entry) => entry.kind === 'register' && entry.options.name === 'main.conversation');
const overlay = undefined;
const locale = registrations.find((entry) => entry.kind === 'locale');

const problems = [];
if (main === undefined) problems.push('main.conversation was not registered');
else {
  if (main.options.priority !== -1) problems.push('main.conversation priority is not -1');
  if (main.options.locale !== 'cube-ui') problems.push('main.conversation locale is not cube-ui');
  // Declaring the shipped `conversation.header` child again throws at
  // registration time (the shipped entry already declares it), so the cube
  // registration must NOT declare children.
  if (main.options.children !== undefined) problems.push('main.conversation must not redeclare children');
  if (typeof main.component !== 'function') problems.push('main.conversation has no component');
  if (main.options.inject === undefined) problems.push('main.conversation has no inject');
}
// The chrome (diamond, dock, dialogs) is rendered inside the cube root so it
// paints above the frame overlay; only main.conversation is registered.
if (registrations.some((entry) => entry.kind === 'register' && entry.options.name === 'shell.overlay')) {
  problems.push('shell.overlay must not be registered anymore');
}
if (locale === undefined) problems.push('locale dictionaries were not registered');
else if (locale.locales.includes('ja') === false) problems.push('locale dictionaries miss ja');
if (plugin.inject.includes('slots') === false) problems.push('inject misses slots');
if (plugin.inject.includes('locale') === false) problems.push('inject misses locale');

// Exercise the injected props the renderer will supply: both components must be
// plain functions (rendered later by the host's React tree).
for (const entry of registrations) {
  if (entry.kind !== 'register') continue;
  const name = entry.options.name;
  if (typeof entry.component !== 'function') problems.push(`${name}: component is not a function`);
  const props = entry.options.inject?.() ?? {};
  if (name === 'main.conversation' && props.channel === undefined) problems.push('main.conversation inject misses channel');
}

if (problems.length > 0) {
  console.error('smoke: FAILED');
  for (const problem of problems) console.error('  -', problem);
  process.exitCode = 1;
} else {
  console.log('smoke: OK');
  console.log('  bundle id  :', loaded.id);
  console.log('  inject     :', plugin.inject.join(', '));
  console.log('  effects    :', effects.join(' | '));
  console.log('  registered :', registrations.filter((entry) => entry.kind === 'register').map((entry) => entry.options.name).join(', '));
  console.log('  locales    :', locale.locales.join(', '));
  console.log('  components :', registrations.filter((entry) => entry.kind === 'register').map((entry) => entry.options.id).join(', '));
}
