#!/usr/bin/env node
/**
 * Render check for the cube-ui client bundle (optional, needs dev modules).
 *
 * Mounts the real CubeStage under jsdom + React 19 with a fake host (eight
 * Workspaces, three Sessions) and drives it the way a keyboard / pointer
 * user would: arrow-key rotation, Enter into a Workspace, the session menu,
 * the "More" dialog, Escape layering, loading / error / empty states.
 *
 * The plugin itself has no dependencies, so the test modules are borrowed:
 *
 *   npm i --no-save --prefix /tmp/cube-ui-test jsdom react@19 react-dom@19
 *   CUBE_UI_TEST_MODULES=/tmp/cube-ui-test/node_modules node tools/render-check.cjs
 */
const { createRequire } = require('module');
const path = require('path');
const fs = require('fs');
const modules = process.env.CUBE_UI_TEST_MODULES ?? path.join(process.cwd(), 'node_modules');
const req = createRequire(path.join(path.resolve(modules), 'noop.js'));
const { JSDOM } = req('jsdom');

const bundlePath = path.resolve(process.argv[2] ?? path.join(__dirname, '..', 'client.js'));
const dom = new JSDOM('<!doctype html><html><body><div id="frame"><div data-rightbar-col></div></div><div id="app"></div></body></html>', {
  pretendToBeVisual: true,
  url: 'http://localhost/',
});
const { window } = dom;
global.window = window;
global.document = window.document;
global.navigator = window.navigator;
global.Element = window.Element;
global.HTMLElement = window.HTMLElement;
global.KeyboardEvent = window.KeyboardEvent;
global.requestAnimationFrame = window.requestAnimationFrame.bind(window);
global.cancelAnimationFrame = window.cancelAnimationFrame.bind(window);
global.IS_REACT_ACT_ENVIRONMENT = true;
window.Element.prototype.getClientRects = function () { return [{ width: 1, height: 1 }]; };

const React = req('react');
const ReactDOMClient = req('react-dom/client');
const { act } = React;

let definition = null;
window.__ModuleLoader__ = { load(def) { definition = def; } };
new Function('window', 'document', 'navigator', fs.readFileSync(bundlePath, 'utf8'))(window, window.document, window.navigator);
const plugin = definition.factory((name) => {
  if (name === 'react') return React;
  throw new Error('require ' + name);
});

const ja = JSON.parse(fs.readFileSync(path.join(path.dirname(bundlePath), 'locale/ja.json'), 'utf8'));
const missing = new Set();
const t = (key, params) => {
  let text = ja[key];
  if (text === undefined) { missing.add(key); return key; }
  for (const [k, v] of Object.entries(params ?? {})) text = text.split('{' + k + '}').join(String(v));
  return text;
};

// --- fake host state ---------------------------------------------------
const sessions = { byId: {} };
const mkSession = (id, title, extra) => { sessions.byId[id] = { id, displayTitle: title, running: false, updatedAt: Date.now(), blank: false, ...extra }; };
mkSession('s1', 'Alpha one'); mkSession('s2', 'Alpha two', { running: true }); mkSession('s3', 'Beta one');
const wsItems = [
  { workspaceId: 'w0', title: 'Alpha', path: '/p/alpha', sessionIds: ['s1', 's2'] },
  { workspaceId: 'w1', title: 'Beta', path: '/p/beta', sessionIds: ['s3'] },
  { workspaceId: 'w2', title: 'Gamma (empty)', path: '/p/gamma', sessionIds: [] },
];
for (let i = 3; i < 8; i += 1) wsItems.push({ workspaceId: 'w' + i, title: 'WS' + i, path: '/p/' + i, sessionIds: [] });
let workspaceState = { items: wsItems, state: 'idle', phase: 'ready', error: null };
let hostSession;
const calls = [];

const registrations = [];
const ctx = {
  effect(fn) { const d = fn(); return typeof d === 'function' ? d : () => {}; },
  locale: { register: () => () => {} },
  slots: { inject(_n, cb) { cb(); }, register(options, component) { registrations.push({ options, component }); return () => {}; } },
  layout: { toggleSidebar() { calls.push('toggleSidebar'); }, selectPanel(id) { calls.push('selectPanel:' + id); } },
  uiWorkspace: {
    openSession(id) { calls.push('open:' + id); hostSession = id; queueMicrotask(rerender); },
    startSession(ws) { calls.push('start:' + ws); },
  },
  shortcuts: { catalog: { getSnapshot: () => [] } },
  get: () => undefined,
};
plugin.apply(ctx);
const stageReg = registrations.find((r) => r.options.name === 'main.conversation');
const injected = stageReg.options.inject();

const hook = (get) => (selector) => selector(get());
const props = () => ({
  sessionId: hostSession,
  useSession: hook(() => ({})),
  useSessions: hook(() => sessions),
  useWorkspaces: hook(() => workspaceState),
  useSessionStatus: hook(() => new Map()),
  usePanelInfo: hook(() => ({ activePanelId: null })),
  renderFactorySlot: () => React.createElement('div', { 'data-conversation-content': '' },
    React.createElement('div', { 'data-conversation-scroll': '' }, 'messages'),
    React.createElement('textarea', { 'aria-label': 'composer' })),
  t,
  ...injected,
});

const root = ReactDOMClient.createRoot(document.getElementById('app'));
function rerender() { act(() => root.render(React.createElement(stageReg.component, props()))); }

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const settle = async (ms = 520) => { await act(async () => { await sleep(ms); }); };
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => [...document.querySelectorAll(sel)];
const key = async (target, k, extra) => {
  await act(async () => { target.dispatchEvent(new window.KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true, ...extra })); });
};
const click = async (el) => { await act(async () => { el.click(); }); };
const results = [];
const check = (name, ok, detail) => { results.push({ name, ok: !!ok, detail }); };
const front = () => $('.cube-ui').getAttribute('data-front');
const mode = () => $('.cube-ui').getAttribute('data-mode');
const status = () => $('[role="status"].cube-sr-only').textContent;

(async () => {
  rerender();
  await settle(50);

  // P0-1 / P1-4
  check('shell not aria-hidden', !$('.cube-shell').hasAttribute('aria-hidden'));
  check('shell focusable group', $('.cube-shell').tabIndex === 0 && $('.cube-shell').getAttribute('role') === 'group');
  const faces = $$('.face');
  check('only front face exposed', faces.filter((f) => !f.hasAttribute('aria-hidden')).length === 1 && !faces[0].hasAttribute('aria-hidden'));
  // jsdom has no `inert`; browsers do. Only assert it where it exists.
  if ('inert' in faces[1].firstChild) check('away faces inert', faces[1].firstChild.inert === true);
  check('session rows are buttons inside li', $('.face.front li.session-item > button.session') !== null);
  check('running badge has text', ($('.face.front .run-badge')?.textContent ?? '').includes('実行中'));
  check('primary new session', $('.face.front .primary-btn') !== null);
  check('hud count wrapped in span', $('.hud .pager > span') !== null);
  check('tour visible first run', $('.coach') !== null);
  check('stage-title not "なし" while workspaces exist', !$('.st-name').textContent.includes('ワークスペースなし'));

  // Esc closes the tour only
  await key(window, 'Escape');
  check('Esc closes tour', $('.coach') === null && mode() === 'browse');

  // P0-2 keyboard rotation
  const shell = $('.cube-shell');
  shell.focus();
  await key(shell, 'ArrowRight');
  await settle();
  check('ArrowRight -> face 1', front() === '1', 'front=' + front());
  await settle(80);
  check('announced face', status().includes('Beta'), JSON.stringify(status()));
  await key(shell, 'ArrowUp');
  await settle();
  check('ArrowUp -> top face 4', front() === '4', 'front=' + front());
  await key(shell, 'Home');
  await settle();
  check('Home -> face 0', front() === '0', 'front=' + front());

  // HUD face buttons
  await click($('.face-nav button[aria-label="右の面へ"]'));
  await settle();
  check('face-nav right button', front() === '1');
  await key(shell, 'ArrowLeft');
  await settle();

  // P1-8 click without movement does not rotate
  const faceEl = $('.face.front .face-inner');
  await act(async () => {
    const PE = window.PointerEvent ?? window.MouseEvent;
    faceEl.dispatchEvent(new PE('pointerdown', { bubbles: true, button: 0, pointerId: 1, clientX: 10, clientY: 10 }));
  });
  await act(async () => { $('.stage').dispatchEvent(new (window.PointerEvent ?? window.MouseEvent)('pointerup', { bubbles: true, pointerId: 1 })); });
  check('click does not set rotating', $('.cube-ui').getAttribute('data-rotating') === null);

  // Enter opens the front workspace
  shell.focus();
  await key(shell, 'Enter');
  await settle();
  await settle(100);
  check('Enter -> inside', mode() === 'inside');
  check('opened remembered/first session', calls.includes('open:s1'), calls.join(','));
  check('conversation on hosting face', $('.face.hosting .face-conv') !== null);
  check('conversation not under aria-hidden', $('.face-conv')?.closest('[aria-hidden="true"]') === null);
  check('focus moved into conversation', document.activeElement?.tagName === 'TEXTAREA', document.activeElement?.className + ' ' + document.activeElement?.tagName);

  // Session menu: no listbox; Esc closes only it
  await click($('.session-select'));
  await settle(50);
  check('menu open, no listbox role', $('.session-menu') !== null && $('[role="listbox"]') === null);
  check('menu focus on current', document.activeElement?.getAttribute('aria-current') === 'true', document.activeElement?.textContent);
  await key(document.activeElement, 'ArrowDown');
  check('ArrowDown moves in menu', document.activeElement?.textContent.includes('Alpha two'), document.activeElement?.textContent);
  await key(document.activeElement, 'Escape');
  check('Esc closes menu only', $('.session-menu') === null && mode() === 'inside');

  // P1-12 rotate inside to an empty workspace -> its empty state, not the old conversation
  await click($('.conv-nav button[aria-label="右の面へ"]'));
  await settle();
  await click($('.conv-nav button[aria-label="右の面へ"]'));
  await settle();
  await settle(50);
  check('inside on Gamma face', front() === '2', 'front=' + front());
  check('empty workspace shows conv-empty', $('.face.hosting .conv-empty') !== null && $('.face.hosting [data-conversation-content]') === null);
  check('header names Gamma', $('.conv-path')?.textContent === '/p/gamma', $('.conv-path')?.textContent);
  check('st-name Gamma', $('.st-name').textContent.includes('Gamma'), $('.st-name').textContent);

  // P1-13 pager reachable inside
  check('inside pager present', $('.face-conv .pager.compact') !== null);
  await click($('.face-conv .pager button[aria-label="次のワークスペースセット"]'));
  await settle(50);
  check('inside pager turns the page', $('.face.front').getAttribute('data-abs') === '8', $('.face.front').getAttribute('data-abs'));
  await click($('.face-conv .pager button[aria-label="前のワークスペースセット"]') ?? $('.pager button'));
  await settle(50);

  // Modal: Esc closes only the modal and restores focus
  const more = $('.dq[data-action="more"]');
  more.focus();
  await click(more);
  await settle(50);
  check('modal open', $('.modal[role="dialog"]') !== null);
  check('focus in modal', $('.modal').contains(document.activeElement), document.activeElement?.outerHTML?.slice(0, 80));
  check('open buttons distinct names', new Set($$('.modal .ghost-btn').map((b) => b.getAttribute('aria-label'))).size === $$('.modal .ghost-btn').length);
  await key(document.activeElement, 'Escape');
  await settle(50);
  check('Esc closes modal only', $('.modal') === null && mode() === 'inside');
  check('focus restored to more', document.activeElement === more, document.activeElement?.outerHTML?.slice(0, 60));

  // Esc leaves the conversation and focuses the cube
  await key(window, 'Escape');
  await settle(100);
  check('Esc -> browse', mode() === 'browse');
  check('focus back on cube', document.activeElement?.classList.contains('cube-shell'), document.activeElement?.className);

  // Hint dismiss
  await click($('.hint-close'));
  check('hint dismissed', $('.hud-hint') === null && window.localStorage.getItem('dsh.cube-ui.hintDismissed') === '1');

  // Failure toast
  ctx.uiWorkspace.startSession = () => { throw new Error('boom'); };
  await click($('.face.front .primary-btn'));
  await settle(50);
  check('failure toast', ($('.cube-toast')?.textContent ?? '').length > 0, $('.cube-toast')?.textContent);

  // Loading / error states
  workspaceState = { items: [], state: 'loading', phase: 'pending', error: null };
  hostSession = undefined;
  rerender();
  await settle(50);
  check('loading busy', $('.cube-shell').getAttribute('aria-busy') === 'true' && $$('.face.loading').length === 6);
  workspaceState = { items: [], state: 'error', phase: 'ready', error: { message: 'x' } };
  rerender();
  await settle(50);
  check('error alert', $('.stage-error[role="alert"]') !== null);
  workspaceState = { items: [], state: 'idle', phase: 'ready', error: null };
  rerender();
  await settle(50);
  check('zero workspaces -> "なし" + CTA', $('.st-name').textContent.includes('ワークスペースなし') && $('.face.front .ghost-btn') !== null);
  await click($('.face.front .ghost-btn'));

  check('no missing locale keys', missing.size === 0, [...missing].join(','));

  let failed = 0;
  for (const r of results) {
    if (!r.ok) failed += 1;
    console.log((r.ok ? 'PASS ' : 'FAIL ') + r.name + (r.detail !== undefined && !r.ok ? '  -- ' + r.detail : ''));
  }
  console.log(failed === 0 ? 'ALL PASS' : failed + ' FAILED');
  process.exit(failed === 0 ? 0 : 1);
})().catch((e) => { console.error(e); process.exit(2); });
