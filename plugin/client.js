// Cube UI — client half for the DeepSeek Harness Web GUI.
//
// The bundle turns the conversation surface into a cube of Workspaces:
//
//   * it shadows `main.conversation` (the shipped ConversationRoot) with a
//     stage that draws six Workspace faces on a rotatable 3D cube;
//   * dragging rotates the cube with inertia and a 90 degree snap; the front
//     face is the Workspace in focus;
//   * selecting a Session opens it "inside the cube": the shipped Conversation
//     content and composer are instantiated in the centre of the stage through
//     `renderFactorySlot('conversation.content', { variant: 'embedded' })`, so
//     messages, streaming, tool cards and the input bar stay the real ones;
//     only the header is ours, and it carries the Workspace name plus a
//     Session dropdown;
//   * `shell.overlay` carries the chrome that must float over the whole frame:
//     a diamond of four quadrants at the top right (new session, plugins,
//     schedules, more) and a collapsible dock at the bottom left (settings and
//     plugin surfaces).
//
// Everything visual reads the live `--dsw-*` theme tokens, so the cube follows
// whatever theme (built-in or third party) is active. No host surface is
// repainted here; only the conversation panel is replaced and the overlay
// seats are filled.
//
// Generated file: client.js is produced by build.mjs from
// src/client.template.js + src/styles.css + locale/*.json.
window.__ModuleLoader__.load({
  id: '@local/dsh-cube-ui',
  factory(require) {
    const React = require('react');
    const h = React.createElement;
    const { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } = React;

    // ---------------------------------------------------------------------
    // Identity
    // ---------------------------------------------------------------------

    const LOCALE_NS = 'cube-ui';
    const STYLE_ID = '@local/dsh-cube-ui/styles';
    const VERSION = "0.1.0";
    const STYLES = "/* ==========================================================================\n   DSH Cube UI — client-plugin stylesheet\n\n   Scope\n   -----\n   Every rule is namespaced under one of the two roots the client bundle\n   renders:\n     .cube-ui          the cube stage (position:absolute; inset:0, fills the\n                       main panel; carries data-mode=\"browse\" | \"inside\")\n     .cube-ui-overlay  floating chrome (rail, diamond, dock, modal, tip)\n   There are no html / body / :root / bare `*` selectors and no host hash\n   classes here, so nothing can leak into the standard DSH UI.\n\n   Theme\n   -----\n   The Phase 0 mock mirrored the DSH tokens in its own :root. That mirror is\n   intentionally gone: colors come from the live theme tokens (--dsw-*), and\n   cube-specific values are declared as --cube-* on the two roots. Every\n   surface/accent is derived with color-mix() from theme tokens, so the\n   stylesheet follows both the light and the dark theme without hard-coded\n   dark colors (only black/white alpha is used for masks and soft shadows).\n\n   Regression guard\n   ----------------\n   Firefox software compositing double-draws text when a 3D-transformed\n   element (.face) carries box-shadow or filter: drop-shadow. Do NOT add\n   either property to .face / .face-inner / .face-room. The floor glow is a\n   plain 2D element, so blur() there is fine.\n   ========================================================================== */\n\n/* --------------------------------------------------------------------------\n   1. Cube tokens, derived from the live theme\n   -------------------------------------------------------------------------- */\n\n.cube-ui,\n.cube-ui-overlay {\n  /* geometry */\n  --cube-radius: 16px;\n  --cube-ease: cubic-bezier(0.2, 0.9, 0.25, 1);\n\n  /* accent — follows the theme's blue business color */\n  --cube-accent: var(--dsw-alias-state-business-primary);\n  --cube-accent-2: var(--dsw-alias-state-done-primary);\n  --cube-accent-soft: color-mix(in oklab, var(--cube-accent) 16%, transparent);\n  --cube-accent-line: color-mix(in oklab, var(--cube-accent) 42%, transparent);\n\n  /* surfaces */\n  --cube-surface-raised: var(--dsw-menu-surface-fill, var(--dsw-alias-bg-layer-2));\n  --cube-surface-sunken: color-mix(in oklab, var(--dsw-alias-bg-base) 55%, transparent);\n  --cube-hover: var(--dsw-alias-interactive-bg-hover);\n  --cube-hover-active: var(--dsw-alias-interactive-bg-active);\n\n  /* borders */\n  --cube-border-soft: var(--dsw-alias-border-l1);\n  --cube-border: var(--dsw-alias-border-l2);\n  --cube-border-strong: var(--dsw-alias-border-l3);\n  --cube-border-accent: color-mix(in oklab, var(--cube-accent) 55%, transparent);\n\n  /* text */\n  --cube-text: var(--dsw-alias-label-primary);\n  --cube-text-dim: var(--dsw-alias-label-secondary);\n  --cube-text-faint: var(--dsw-alias-label-tertiary);\n  --cube-text-caption: var(--dsw-alias-label-caption);\n  --cube-text-on-accent: var(--dsw-alias-label-primary-foreground);\n\n  /* status */\n  --cube-ok: var(--dsw-alias-state-success-primary);\n  --cube-ok-soft: var(--dsw-alias-state-success-tertiary);\n\n  /* elevation / scrollbars */\n  --cube-shadow: var(--dsw-elevation-prominent, 0 0 0 0.5px var(--dsw-alias-border-l3));\n  --cube-shadow-soft: var(--dsw-elevation-panel, 0 0 0 0.5px var(--dsw-alias-border-l1));\n  --cube-scroll-thumb: var(--dsw-alias-scrollbar-bg-l1);\n  --cube-scroll-thumb-hover: var(--dsw-alias-scrollbar-hover-l1);\n\n  /* cube faces — mixed from layer + accent so both themes stay legible */\n  --cube-face-top: color-mix(in oklab, var(--dsw-alias-bg-layer-3) 88%, var(--cube-accent) 12%);\n  --cube-face-mid: color-mix(in oklab, var(--dsw-alias-bg-layer-2) 93%, var(--cube-accent) 7%);\n  --cube-face-bottom: color-mix(in oklab, var(--dsw-alias-bg-layer-1) 97%, var(--cube-accent) 3%);\n  --cube-face-front-top: color-mix(in oklab, var(--dsw-alias-bg-layer-3) 80%, var(--cube-accent) 20%);\n  --cube-face-front-bottom: color-mix(in oklab, var(--dsw-alias-bg-layer-2) 90%, var(--cube-accent) 10%);\n\n  /* inherited text/style baseline for the plugin subtree */\n  color: var(--cube-text);\n  font-family: var(--dsw-font-family);\n  -webkit-font-smoothing: antialiased;\n  -webkit-tap-highlight-color: transparent;\n}\n\n/* --------------------------------------------------------------------------\n   2. Root layout\n   -------------------------------------------------------------------------- */\n\n.cube-ui {\n  --cube-size: 520px; /* overridden by media/container queries on .cube-shell */\n\n  position: absolute;\n  inset: 0;\n  overflow: hidden;\n\n  /* sizes inside the cube follow the panel width, not the viewport (the\n     sidebar can be expanded while the window is wide) */\n  container-type: inline-size;\n  container-name: cube;\n}\n\n.cube-ui-overlay {\n  position: fixed;\n  inset: 0;\n  z-index: 40;\n  overflow: hidden;\n  pointer-events: none; /* additive layer: only explicit chrome is clickable */\n\n  container-type: inline-size;\n  container-name: cube;\n}\n\n.cube-ui-overlay .rail,\n.cube-ui-overlay .rail-panel,\n.cube-ui-overlay .diamond,\n.cube-ui-overlay .dock,\n.cube-ui-overlay .modal-backdrop {\n  pointer-events: auto;\n}\n\n/* --------------------------------------------------------------------------\n   3. Basics (scoped: no global resets)\n   -------------------------------------------------------------------------- */\n\n.cube-ui,\n.cube-ui *,\n.cube-ui *::before,\n.cube-ui *::after,\n.cube-ui-overlay,\n.cube-ui-overlay *,\n.cube-ui-overlay *::before,\n.cube-ui-overlay *::after {\n  box-sizing: border-box;\n}\n\n.cube-ui button,\n.cube-ui input,\n.cube-ui textarea,\n.cube-ui-overlay button,\n.cube-ui-overlay input,\n.cube-ui-overlay textarea {\n  font: inherit;\n}\n\n.cube-ui button:focus-visible,\n.cube-ui [role=\"button\"]:focus-visible,\n.cube-ui-overlay button:focus-visible {\n  outline: 2px solid var(--cube-accent);\n  outline-offset: 2px;\n}\n\n/* icons are inline SVG from the client bundle */\n.cube-ui .ico,\n.cube-ui-overlay .ico {\n  display: inline-flex;\n  align-items: center;\n  justify-content: center;\n}\n\n.cube-ui .ico svg,\n.cube-ui-overlay .ico svg {\n  display: block;\n  width: 17px;\n  height: 17px;\n}\n\n.cube-ui .ss-ico svg { width: 14px; height: 14px; }\n.cube-ui .icon-btn .ico svg { width: 15px; height: 15px; }\n.cube-ui .avatar svg { width: 10px; height: 10px; }\n\n.cube-ui-overlay .rail-btn .ico svg { width: 18px; height: 18px; }\n.cube-ui-overlay .rail-brand .ico svg { width: 19px; height: 19px; }\n.cube-ui-overlay .brand-mark .ico svg { width: 15px; height: 15px; }\n.cube-ui-overlay .di-ico svg { width: 15px; height: 15px; }\n.cube-ui-overlay .dock-ico svg { width: 15px; height: 15px; }\n.cube-ui-overlay .dock-caret svg { width: 13px; height: 13px; }\n.cube-ui-overlay .rp-ico svg { width: 15px; height: 15px; }\n.cube-ui-overlay .dq .ico svg { width: 19px; height: 19px; }\n\n/* --------------------------------------------------------------------------\n   4. Stage and cube\n   -------------------------------------------------------------------------- */\n\n.cube-ui .bg-glow {\n  position: absolute;\n  inset: 0;\n  z-index: 0;\n  pointer-events: none;\n  background:\n    radial-gradient(900px 620px at 50% 34%,\n      color-mix(in oklab, var(--cube-accent) 18%, transparent), transparent 62%),\n    radial-gradient(700px 520px at 82% 78%,\n      color-mix(in oklab, var(--cube-accent-2) 12%, transparent), transparent 65%),\n    radial-gradient(760px 540px at 12% 16%,\n      color-mix(in oklab, var(--cube-accent) 8%, transparent), transparent 60%),\n    color-mix(in oklab, var(--dsw-alias-bg-base) 62%, transparent);\n}\n\n.cube-ui .stage {\n  position: absolute;\n  inset: 0;\n  display: grid;\n  place-items: center;\n  perspective: 1700px;\n  perspective-origin: 50% 46%;\n  overflow: hidden;\n  cursor: default;\n  /* Drag-to-rotate only. touch-action is intersected along the ancestor chain,\n     so the conversation panel must be rendered OUTSIDE .stage (a sibling under\n     .cube-ui) for touch scrolling inside .conv to keep working. The .conv\n     rules below centre it with inset:0 + margin:auto, which is identical in\n     both nestings; this note only concerns touch behaviour. */\n  touch-action: none;\n  user-select: none;\n}\n\n/* Rotation is a cube gesture: only the cube surface advertises drag. */\n.cube-ui .cube-shell {\n  cursor: grab;\n}\n\n.cube-ui .stage.grabbing .cube-shell {\n  cursor: grabbing;\n}\n\n.cube-ui .cube-shell button {\n  cursor: pointer;\n}\n\n/* The stage disables selection for rotation, but the front-face conversation\n   is a reading surface: its text stays selectable while its chrome is not. */\n.cube-ui .face-conv {\n  cursor: default;\n  user-select: text;\n}\n\n.cube-ui .face-conv * {\n  user-select: text;\n}\n\n.cube-ui .face-conv .conv-head,\n.cube-ui .face-conv .conv-head *,\n.cube-ui .face-conv button {\n  user-select: none;\n}\n\n.cube-ui .floor-glow {\n  position: absolute;\n  left: 50%;\n  bottom: 6%;\n  z-index: 0;\n  width: min(820px, 72cqw);\n  height: 190px;\n  transform: translateX(-50%);\n  border-radius: 50%;\n  pointer-events: none;\n  /* 2D element, not a 3D face: blur is safe here */\n  filter: blur(22px);\n  background: radial-gradient(closest-side,\n    color-mix(in oklab, var(--cube-accent) 30%, transparent),\n    color-mix(in oklab, var(--cube-accent) 8%, transparent) 58%,\n    transparent 72%);\n  transition: opacity 0.5s;\n}\n\n.cube-ui .cube-shell {\n  position: relative;\n  z-index: 1;\n  width: var(--cube-size);\n  height: var(--cube-size);\n  --h: calc(var(--cube-size) / 2);\n  transform-style: preserve-3d;\n  transition: transform 0.75s var(--cube-ease), opacity 0.45s var(--cube-ease);\n}\n\n.cube-ui .cube-shell.flip {\n  transform: scale(0.84);\n  opacity: 0.25;\n}\n\n.cube-ui .cube {\n  position: absolute;\n  inset: 0;\n  transform-style: preserve-3d;\n}\n\n.cube-ui .cube.snap {\n  transition: transform 0.5s var(--cube-ease);\n}\n\n/* ---- faces (browse mode) ---- */\n\n.cube-ui .face {\n  position: absolute;\n  inset: 0;\n  display: flex;\n  flex-direction: column;\n  overflow: hidden;\n  border-radius: var(--cube-radius);\n  border: 1px solid var(--cube-border);\n  border-top-color: var(--cube-border-strong);\n  background: linear-gradient(155deg,\n    var(--cube-face-top) 0%,\n    var(--cube-face-mid) 58%,\n    var(--cube-face-bottom) 100%);\n  transition: background 0.5s, border-color 0.3s;\n  transform: translateZ(var(--h));\n  /* Firefox: never add box-shadow / filter here (text double-draw bug). */\n}\n\n.cube-ui .face[data-slot=\"1\"] { transform: rotateY(90deg) translateZ(var(--h)); }\n.cube-ui .face[data-slot=\"2\"] { transform: rotateY(180deg) translateZ(var(--h)); }\n.cube-ui .face[data-slot=\"3\"] { transform: rotateY(-90deg) translateZ(var(--h)); }\n.cube-ui .face[data-slot=\"4\"] { transform: rotateX(90deg) translateZ(var(--h)); }\n.cube-ui .face[data-slot=\"5\"] { transform: rotateX(-90deg) translateZ(var(--h)); }\n\n.cube-ui .face.front {\n  border-color: var(--cube-border-accent);\n  border-top-color: color-mix(in oklab, var(--cube-accent) 72%, transparent);\n  background: linear-gradient(155deg,\n    var(--cube-face-front-top) 0%,\n    var(--cube-face-front-bottom) 100%);\n}\n\n/* face content: workspace + session list */\n.cube-ui .face-inner {\n  position: absolute;\n  inset: 0;\n  display: flex;\n  flex-direction: column;\n  gap: 10px;\n  padding: 16px;\n  transition: opacity 0.3s;\n}\n\n.cube-ui .face-head {\n  display: flex;\n  align-items: baseline;\n  gap: 8px;\n}\n\n.cube-ui .face-idx {\n  font-size: 10px;\n  letter-spacing: 0.12em;\n  color: var(--cube-text-caption);\n}\n\n.cube-ui .face-title {\n  margin: 0;\n  font-size: 14.5px;\n  font-weight: 600;\n  letter-spacing: 0.01em;\n  white-space: nowrap;\n  overflow: hidden;\n  text-overflow: ellipsis;\n}\n\n.cube-ui .face-path {\n  margin: -4px 0 2px;\n  font-size: 10.5px;\n  color: var(--cube-text-caption);\n  white-space: nowrap;\n  overflow: hidden;\n  text-overflow: ellipsis;\n}\n\n.cube-ui .sessions {\n  list-style: none;\n  margin: 0;\n  padding: 0;\n  flex: 1;\n  overflow: auto;\n  display: flex;\n  flex-direction: column;\n  gap: 6px;\n}\n\n.cube-ui .session {\n  display: flex;\n  flex-direction: column;\n  gap: 3px;\n  padding: 8px 10px;\n  border: 1px solid var(--cube-border-soft);\n  border-radius: 10px;\n  background: var(--cube-hover);\n  cursor: pointer;\n  transition: background 0.15s, border-color 0.15s, transform 0.15s;\n}\n\n.cube-ui .session:hover {\n  background: var(--cube-accent-soft);\n  border-color: var(--cube-border-accent);\n  transform: translateX(1px);\n}\n\n.cube-ui .session .stitle {\n  font-size: 12.5px;\n  line-height: 1.35;\n  white-space: nowrap;\n  overflow: hidden;\n  text-overflow: ellipsis;\n}\n\n.cube-ui .session .smeta {\n  display: flex;\n  align-items: center;\n  gap: 7px;\n  font-size: 10.5px;\n  color: var(--cube-text-caption);\n}\n\n.cube-ui .session .dot {\n  width: 6px;\n  height: 6px;\n  border-radius: 50%;\n  background: var(--cube-ok);\n  box-shadow: 0 0 0 3px color-mix(in oklab, var(--cube-ok) 16%, transparent);\n  animation: cube-pulse 1.7s ease-in-out infinite;\n}\n\n.cube-ui .face-empty {\n  flex: 1;\n  display: grid;\n  place-items: center;\n  font-size: 11.5px;\n  color: var(--cube-text-caption);\n  border: 1px dashed var(--cube-border);\n  border-radius: 10px;\n}\n\n.cube-ui .face-foot {\n  display: flex;\n  align-items: center;\n  justify-content: space-between;\n  gap: 8px;\n}\n\n.cube-ui .face-count {\n  font-size: 10.5px;\n  color: var(--cube-text-caption);\n}\n\n/* ---- face \"inside the room\" labels ---- */\n\n.cube-ui .face-room {\n  position: absolute;\n  inset: 0;\n  display: flex;\n  flex-direction: column;\n  justify-content: space-between;\n  padding: 20px;\n  opacity: 0;\n  pointer-events: none;\n  transition: opacity 0.4s;\n}\n\n.cube-ui .room-idx {\n  font-size: 10px;\n  letter-spacing: 0.18em;\n  color: var(--cube-text-caption);\n}\n\n.cube-ui .room-foot {\n  display: flex;\n  align-items: flex-end;\n  justify-content: space-between;\n  gap: 10px;\n}\n\n.cube-ui .room-title {\n  font-size: 15px;\n  font-weight: 600;\n  color: var(--cube-text-dim);\n  cursor: pointer;\n}\n\n.cube-ui .room-title:hover {\n  color: var(--cube-text);\n}\n\n.cube-ui .room-count {\n  font-size: 10.5px;\n  color: var(--cube-text-caption);\n}\n\n.cube-ui .face.front .room-idx {\n  color: var(--cube-accent);\n}\n\n.cube-ui .face.front .room-title {\n  color: var(--cube-text);\n}\n\n/* --------------------------------------------------------------------------\n   5. \"Inside the cube\" mode — .stage.inside and [data-mode=\"inside\"]\n   -------------------------------------------------------------------------- */\n\n.cube-ui .stage.inside .floor-glow,\n.cube-ui[data-mode=\"inside\"] .floor-glow {\n  opacity: 0.35;\n}\n\n.cube-ui .stage.inside .cube-shell,\n.cube-ui[data-mode=\"inside\"] .cube-shell {\n  transform: scale(1.86);\n}\n\n/* the faces become translucent glass walls with a faint grid */\n.cube-ui .stage.inside .face,\n.cube-ui[data-mode=\"inside\"] .face {\n  background:\n    linear-gradient(color-mix(in oklab, var(--cube-accent) 9%, transparent) 1px,\n      transparent 1px) 0 0 / 52px 52px,\n    linear-gradient(90deg, color-mix(in oklab, var(--cube-accent) 9%, transparent) 1px,\n      transparent 1px) 0 0 / 52px 52px,\n    color-mix(in oklab, var(--dsw-alias-bg-base) 24%, transparent);\n  border-color: var(--dsw-alias-border-l1);\n  border-top-color: var(--dsw-alias-border-l1);\n}\n\n.cube-ui .stage.inside .face.front,\n.cube-ui[data-mode=\"inside\"] .face.front {\n  border-color: color-mix(in oklab, var(--cube-accent) 34%, transparent);\n  background: color-mix(in oklab, var(--cube-accent) 5%, transparent);\n}\n\n.cube-ui .stage.inside .face-inner,\n.cube-ui[data-mode=\"inside\"] .face-inner {\n  opacity: 0;\n  pointer-events: none;\n}\n\n.cube-ui .stage.inside .face-room,\n.cube-ui[data-mode=\"inside\"] .face-room {\n  opacity: 0;\n  pointer-events: none;\n}\n\n.cube-ui .stage.inside .face.front .face-room,\n.cube-ui[data-mode=\"inside\"] .face.front .face-room {\n  opacity: 1;\n  pointer-events: auto;\n}\n\n/* --------------------------------------------------------------------------\n   6. Conversation panel (inside mode only)\n   -------------------------------------------------------------------------- */\n\n.cube-ui .conv {\n  position: absolute;\n  inset: 0;\n  z-index: 3;\n  margin: auto; /* centres in .stage or directly in .cube-ui */\n  width: min(720px, 92cqw);\n  height: min(600px, 66%);\n  display: flex;\n  flex-direction: column;\n  overflow: hidden;\n  border: 1px solid var(--cube-border-strong);\n  border-radius: 20px;\n  background: linear-gradient(168deg,\n    color-mix(in oklab, var(--dsw-alias-bg-layer-2) 94%, transparent),\n    color-mix(in oklab, var(--dsw-alias-bg-base) 97%, transparent));\n  box-shadow: var(--cube-shadow),\n    0 18px 48px -20px color-mix(in srgb, #000 22%, transparent);\n  backdrop-filter: blur(20px);\n  -webkit-backdrop-filter: blur(20px);\n  opacity: 0;\n  pointer-events: none;\n  transform: scale(0.97) translateY(10px);\n  transition: opacity 0.35s var(--cube-ease), transform 0.35s var(--cube-ease);\n}\n\n.cube-ui .conv.show,\n.cube-ui[data-mode=\"inside\"] .conv {\n  opacity: 1;\n  pointer-events: auto;\n  transform: none;\n}\n\n.cube-ui[data-mode=\"browse\"] .conv {\n  display: none;\n}\n\n.cube-ui .conv-head {\n  position: relative;\n  z-index: 2;\n  padding: 12px 14px 10px;\n  border-bottom: 1px solid var(--cube-border-soft);\n  background: var(--cube-hover);\n  user-select: none;\n}\n\n.cube-ui .conv-topline {\n  display: flex;\n  align-items: center;\n  gap: 8px;\n}\n\n.cube-ui .conv-ws {\n  display: flex;\n  align-items: center;\n  gap: 8px;\n  min-width: 0;\n  font-size: 12px;\n  color: var(--cube-text-dim);\n}\n\n.cube-ui .conv-ws b {\n  color: var(--cube-text);\n  font-weight: 600;\n  white-space: nowrap;\n}\n\n.cube-ui .conv-ws .conv-path {\n  color: var(--cube-text-caption);\n  font-size: 10.5px;\n  white-space: nowrap;\n  overflow: hidden;\n  text-overflow: ellipsis;\n}\n\n.cube-ui .conv-ws .dot {\n  width: 6px;\n  height: 6px;\n  flex: none;\n  border-radius: 50%;\n  background: var(--cube-accent);\n  box-shadow: 0 0 0 3px var(--cube-accent-soft);\n}\n\n.cube-ui .icon-btn,\n.cube-ui-overlay .icon-btn {\n  margin-left: auto;\n  width: 28px;\n  height: 28px;\n  display: grid;\n  place-items: center;\n  border: 1px solid transparent;\n  border-radius: 8px;\n  background: transparent;\n  color: var(--cube-text-dim);\n  font-size: 13px;\n  cursor: pointer;\n}\n\n.cube-ui .icon-btn:hover,\n.cube-ui-overlay .icon-btn:hover {\n  background: var(--cube-hover-active);\n  color: var(--cube-text);\n}\n\n.cube-ui .conv-sessionline {\n  position: relative;\n  margin-top: 9px;\n}\n\n.cube-ui .session-select {\n  width: 100%;\n  display: flex;\n  align-items: center;\n  gap: 8px;\n  padding: 9px 12px;\n  border: 1px solid var(--cube-border);\n  border-radius: 11px;\n  background: var(--cube-hover);\n  color: var(--cube-text);\n  font-size: 12.5px;\n  text-align: left;\n  cursor: pointer;\n  transition: border-color 0.15s, background 0.15s;\n}\n\n.cube-ui .session-select:hover {\n  border-color: var(--cube-border-accent);\n  background: var(--cube-accent-soft);\n}\n\n.cube-ui .ss-ico {\n  color: var(--cube-text-dim);\n}\n\n.cube-ui .ss-label {\n  flex: 1;\n  min-width: 0;\n  white-space: nowrap;\n  overflow: hidden;\n  text-overflow: ellipsis;\n}\n\n.cube-ui .ss-status {\n  flex: none;\n  font-size: 10px;\n  padding: 2px 7px;\n  border-radius: 999px;\n  color: var(--cube-text-dim);\n  border: 1px solid var(--cube-border);\n}\n\n.cube-ui .ss-status.running {\n  color: var(--cube-ok);\n  border-color: color-mix(in oklab, var(--cube-ok) 38%, transparent);\n  background: var(--cube-ok-soft);\n}\n\n.cube-ui .ss-caret {\n  flex: none;\n  width: 0;\n  height: 0;\n  border-left: 4px solid transparent;\n  border-right: 4px solid transparent;\n  border-top: 5px solid var(--cube-text-dim);\n  transition: transform 0.2s;\n}\n\n.cube-ui .session-select[aria-expanded=\"true\"] .ss-caret {\n  transform: rotate(180deg);\n}\n\n.cube-ui .session-menu {\n  position: absolute;\n  left: 0;\n  right: 0;\n  top: calc(100% + 6px);\n  z-index: 10;\n  max-height: 258px;\n  overflow: auto;\n  padding: 6px;\n  border: 1px solid var(--cube-border-strong);\n  border-radius: 13px;\n  background: var(--cube-surface-raised);\n  box-shadow: var(--cube-shadow);\n  backdrop-filter: blur(20px);\n  -webkit-backdrop-filter: blur(20px);\n}\n\n.cube-ui .session-menu[hidden] {\n  display: none;\n}\n\n.cube-ui .session-menu button {\n  width: 100%;\n  display: flex;\n  align-items: center;\n  gap: 8px;\n  padding: 9px 10px;\n  border: none;\n  border-radius: 9px;\n  background: transparent;\n  color: var(--cube-text);\n  font-size: 12.5px;\n  text-align: left;\n  cursor: pointer;\n}\n\n.cube-ui .session-menu button:hover {\n  background: var(--cube-hover-active);\n}\n\n.cube-ui .session-menu button.current {\n  background: var(--cube-accent-soft);\n}\n\n.cube-ui .session-menu .mi-meta {\n  margin-left: auto;\n  font-size: 10.5px;\n  color: var(--cube-text-caption);\n}\n\n.cube-ui .session-menu .mi-new {\n  color: var(--cube-accent);\n}\n\n.cube-ui .conv-body {\n  flex: 1;\n  overflow: auto;\n  padding: 16px 16px 8px;\n  display: flex;\n  flex-direction: column;\n  gap: 12px;\n}\n\n.cube-ui .conv-empty {\n  margin: auto;\n  text-align: center;\n  color: var(--cube-text-caption);\n  font-size: 12.5px;\n  line-height: 1.8;\n}\n\n.cube-ui .conv-empty .ghost-btn {\n  margin-top: 12px;\n}\n\n.cube-ui .msg {\n  display: flex;\n  flex-direction: column;\n  gap: 4px;\n  max-width: 88%;\n}\n\n.cube-ui .msg .who {\n  display: flex;\n  align-items: center;\n  gap: 6px;\n  font-size: 10.5px;\n  color: var(--cube-text-caption);\n}\n\n.cube-ui .msg .bubble {\n  padding: 10px 12px;\n  border-radius: 13px;\n  font-size: 12.5px;\n  line-height: 1.7;\n  white-space: pre-wrap;\n  word-break: break-word;\n}\n\n.cube-ui .msg.user {\n  align-self: flex-end;\n  align-items: flex-end;\n}\n\n.cube-ui .msg.user .bubble {\n  background: linear-gradient(160deg,\n    color-mix(in oklab, var(--cube-accent) 26%, transparent),\n    color-mix(in oklab, var(--cube-accent) 14%, transparent));\n  border: 1px solid color-mix(in oklab, var(--cube-accent) 30%, transparent);\n  border-bottom-right-radius: 5px;\n}\n\n.cube-ui .msg.assistant .bubble {\n  border: 1px solid var(--cube-border-soft);\n  background: var(--cube-hover);\n  border-bottom-left-radius: 5px;\n}\n\n.cube-ui .msg .avatar {\n  width: 18px;\n  height: 18px;\n  display: grid;\n  place-items: center;\n  border-radius: 6px;\n  font-size: 9px;\n  color: var(--cube-accent);\n  background: var(--cube-accent-soft);\n  border: 1px solid var(--cube-accent-line);\n}\n\n.cube-ui .typing {\n  display: flex;\n  gap: 4px;\n  padding: 2px 4px 8px;\n}\n\n.cube-ui .typing i {\n  width: 5px;\n  height: 5px;\n  border-radius: 50%;\n  background: var(--cube-text-faint);\n  animation: cube-bounce 1.2s infinite;\n}\n\n.cube-ui .typing i:nth-child(2) { animation-delay: 0.15s; }\n.cube-ui .typing i:nth-child(3) { animation-delay: 0.3s; }\n\n.cube-ui .composer {\n  display: flex;\n  gap: 10px;\n  padding: 12px 14px 14px;\n  border-top: 1px solid var(--cube-border-soft);\n  background: var(--cube-hover);\n}\n\n.cube-ui .composer textarea {\n  flex: 1;\n  resize: none;\n  min-height: 42px;\n  max-height: 132px;\n  padding: 10px 12px;\n  border: 1px solid var(--cube-border);\n  border-radius: 12px;\n  background: var(--cube-surface-sunken);\n  color: var(--cube-text);\n  font-size: 12.5px;\n  line-height: 1.5;\n  transition: border-color 0.15s;\n}\n\n.cube-ui .composer textarea:focus {\n  border-color: color-mix(in oklab, var(--cube-accent) 60%, transparent);\n}\n\n.cube-ui .composer textarea::placeholder {\n  color: var(--cube-text-caption);\n}\n\n.cube-ui .send {\n  align-self: flex-end;\n  height: 42px;\n  padding: 0 18px;\n  border: 1px solid color-mix(in oklab, var(--cube-accent) 40%, transparent);\n  border-radius: 12px;\n  background: var(--dsw-alias-button-info-fill);\n  color: var(--cube-text-on-accent);\n  font-size: 12.5px;\n  font-weight: 600;\n  cursor: pointer;\n  transition: background 0.15s;\n}\n\n.cube-ui .send:hover {\n  background: var(--dsw-alias-button-info-hover);\n}\n\n/* conversation text stays selectable even though the stage disables it */\n.cube-ui .conv,\n.cube-ui .conv * {\n  user-select: text;\n}\n\n.cube-ui .conv-head,\n.cube-ui .conv-head * {\n  user-select: none;\n}\n\n/* --------------------------------------------------------------------------\n   7. HUD / pager\n   -------------------------------------------------------------------------- */\n\n.cube-ui .hud {\n  position: absolute;\n  left: 50%;\n  bottom: 16px;\n  transform: translateX(-50%);\n  z-index: 4;\n  display: flex;\n  flex-direction: column;\n  align-items: center;\n  gap: 7px;\n  pointer-events: none;\n}\n\n.cube-ui .hud > * {\n  pointer-events: auto;\n}\n\n.cube-ui .hud-front {\n  font-size: 10px;\n  letter-spacing: 0.16em;\n  text-transform: uppercase;\n  color: var(--cube-text-caption);\n}\n\n.cube-ui .hud-hint {\n  font-size: 10.5px;\n  color: var(--cube-text-caption);\n  opacity: 0.85;\n}\n\n.cube-ui .pager {\n  display: flex;\n  align-items: center;\n  gap: 4px;\n  padding: 4px 6px;\n  border: 1px solid var(--cube-border);\n  border-radius: 999px;\n  background: color-mix(in oklab, var(--dsw-alias-bg-layer-2) 84%, transparent);\n  backdrop-filter: blur(14px);\n  -webkit-backdrop-filter: blur(14px);\n}\n\n.cube-ui .pager button {\n  width: 26px;\n  height: 26px;\n  border: none;\n  border-radius: 50%;\n  background: transparent;\n  color: var(--cube-text-dim);\n  font-size: 13px;\n  cursor: pointer;\n}\n\n.cube-ui .pager button:hover {\n  background: var(--cube-hover-active);\n  color: var(--cube-text);\n}\n\n.cube-ui .pager > span {\n  padding: 0 6px;\n  font-size: 11px;\n  color: var(--cube-text-dim);\n  letter-spacing: 0.02em;\n}\n\n/* --------------------------------------------------------------------------\n   8. Shared small button\n   -------------------------------------------------------------------------- */\n\n.cube-ui .ghost-btn,\n.cube-ui-overlay .ghost-btn {\n  display: inline-flex;\n  align-items: center;\n  gap: 6px;\n  padding: 6px 10px;\n  border-radius: 9px;\n  border: 1px solid var(--cube-border);\n  background: var(--cube-hover);\n  color: var(--cube-text-dim);\n  font-size: 11.5px;\n  cursor: pointer;\n  transition: background 0.15s, color 0.15s, border-color 0.15s;\n}\n\n.cube-ui .ghost-btn:hover,\n.cube-ui-overlay .ghost-btn:hover {\n  background: var(--cube-accent-soft);\n  border-color: var(--cube-border-accent);\n  color: var(--cube-text);\n}\n\n/* --------------------------------------------------------------------------\n   9. Overlay: rail (standard-sidebar collapsed placeholder)\n   -------------------------------------------------------------------------- */\n\n.cube-ui-overlay .rail {\n  position: fixed;\n  left: 0;\n  top: 0;\n  bottom: 0;\n  width: 56px;\n  z-index: 1;\n  display: flex;\n  flex-direction: column;\n  align-items: center;\n  gap: 6px;\n  padding: 14px 0;\n  background: color-mix(in oklab, var(--dsw-alias-bg-base) 72%, transparent);\n  border-right: 1px solid var(--cube-border-soft);\n  backdrop-filter: blur(14px);\n  -webkit-backdrop-filter: blur(14px);\n}\n\n.cube-ui-overlay .rail-brand {\n  width: 34px;\n  height: 34px;\n  display: grid;\n  place-items: center;\n  margin-bottom: 10px;\n  border-radius: 10px;\n  color: var(--dsw-alias-brand-primary);\n  font-size: 17px;\n  background: linear-gradient(150deg,\n    var(--cube-accent-soft),\n    color-mix(in oklab, var(--cube-accent-2) 14%, transparent));\n  border: 1px solid var(--cube-accent-line);\n}\n\n.cube-ui-overlay .rail-btn {\n  width: 38px;\n  height: 38px;\n  display: grid;\n  place-items: center;\n  border: 1px solid transparent;\n  border-radius: 11px;\n  background: transparent;\n  color: var(--cube-text-dim);\n  font-size: 16px;\n  cursor: pointer;\n  transition: background 0.18s, color 0.18s, border-color 0.18s;\n}\n\n.cube-ui-overlay .rail-btn:hover {\n  background: var(--cube-hover);\n  color: var(--cube-text);\n}\n\n.cube-ui-overlay .rail-btn.active {\n  background: var(--cube-accent-soft);\n  color: var(--cube-text);\n  border-color: var(--cube-accent-line);\n}\n\n.cube-ui-overlay .rail-spacer {\n  flex: 1;\n}\n\n/* expanded placeholder panel */\n.cube-ui-overlay .rail-panel {\n  position: fixed;\n  left: 56px;\n  top: 0;\n  bottom: 0;\n  width: 300px;\n  z-index: 2;\n  padding: 22px 20px;\n  overflow: auto;\n  background: color-mix(in oklab, var(--dsw-alias-bg-layer-1) 94%, transparent);\n  border-right: 1px solid var(--cube-border);\n  backdrop-filter: blur(18px);\n  -webkit-backdrop-filter: blur(18px);\n  transform: translateX(-104%);\n  transition: transform 0.28s var(--cube-ease);\n}\n\n.cube-ui-overlay .rail-panel.open {\n  transform: translateX(0);\n}\n\n.cube-ui-overlay .rail-panel h3 {\n  margin: 0 0 4px;\n  font-size: 13px;\n  letter-spacing: 0.08em;\n  text-transform: uppercase;\n  color: var(--cube-text-dim);\n}\n\n.cube-ui-overlay .rail-panel .rp-sub {\n  margin: 0 0 16px;\n  font-size: 12px;\n  color: var(--cube-text-caption);\n  line-height: 1.6;\n}\n\n.cube-ui-overlay .rp-row {\n  display: flex;\n  align-items: center;\n  gap: 10px;\n  padding: 11px 12px;\n  margin-bottom: 8px;\n  border: 1px solid var(--cube-border-soft);\n  border-radius: 12px;\n  background: var(--cube-hover);\n  font-size: 12.5px;\n  color: var(--cube-text);\n}\n\n.cube-ui-overlay .rp-row .rp-ico {\n  color: var(--cube-text-dim);\n}\n\n.cube-ui-overlay .rp-row .rp-meta {\n  margin-left: auto;\n  font-size: 11px;\n  color: var(--cube-text-caption);\n}\n\n/* --------------------------------------------------------------------------\n   10. Overlay: brand mark\n   -------------------------------------------------------------------------- */\n\n.cube-ui-overlay .brand {\n  position: fixed;\n  top: 20px;\n  left: 74px;\n  z-index: 7;\n  display: flex;\n  align-items: center;\n  gap: 10px;\n  pointer-events: none;\n}\n\n.cube-ui-overlay .brand .brand-mark {\n  width: 26px;\n  height: 26px;\n  display: grid;\n  place-items: center;\n  border-radius: 8px;\n  font-size: 13px;\n  color: var(--dsw-alias-brand-primary);\n  background: linear-gradient(150deg,\n    var(--cube-accent-soft),\n    color-mix(in oklab, var(--cube-accent-2) 18%, transparent));\n  border: 1px solid var(--cube-accent-line);\n}\n\n.cube-ui-overlay .brand .brand-text {\n  display: flex;\n  flex-direction: column;\n  line-height: 1.25;\n}\n\n.cube-ui-overlay .brand .brand-title {\n  font-size: 12px;\n  letter-spacing: 0.14em;\n  color: var(--dsw-alias-brand-primary);\n}\n\n.cube-ui-overlay .brand .brand-sub {\n  font-size: 10.5px;\n  letter-spacing: 0.06em;\n  color: var(--cube-text-caption);\n}\n\n/* --------------------------------------------------------------------------\n   11. Overlay: diamond navigation (top-right)\n   -------------------------------------------------------------------------- */\n\n.cube-ui-overlay .diamond {\n  position: fixed;\n  top: 22px;\n  right: 22px;\n  width: 132px;\n  height: 132px;\n  z-index: 5;\n}\n\n.cube-ui-overlay .diamond-shape {\n  position: absolute;\n  inset: 0;\n  display: grid;\n  grid-template-columns: 1fr 1fr;\n  grid-template-rows: 1fr 1fr;\n  gap: 2px;\n  transform: rotate(45deg);\n  border-radius: 13px;\n  overflow: hidden;\n  border: 1px solid var(--cube-border-strong);\n  box-shadow: var(--cube-shadow),\n    0 14px 34px -18px color-mix(in srgb, #000 22%, transparent);\n  background: var(--cube-border);\n}\n\n.cube-ui-overlay .dq {\n  display: grid;\n  place-items: center;\n  border: none;\n  background: var(--dsw-alias-bg-layer-2);\n  color: var(--cube-text-dim);\n  font-size: 17px;\n  cursor: pointer;\n  transition: background 0.18s, color 0.18s;\n}\n\n.cube-ui-overlay .dq > span {\n  display: block;\n  transform: rotate(-45deg);\n  line-height: 1;\n}\n\n.cube-ui-overlay .dq:hover,\n.cube-ui-overlay .dq:focus-visible {\n  background: linear-gradient(150deg,\n    color-mix(in oklab, var(--cube-accent) 34%, transparent),\n    color-mix(in oklab, var(--cube-accent-2) 26%, transparent));\n  color: var(--cube-text);\n}\n\n/* --------------------------------------------------------------------------\n   12. Overlay: hover tip\n   -------------------------------------------------------------------------- */\n\n.cube-ui-overlay .tip {\n  position: fixed;\n  z-index: 20;\n  padding: 6px 10px;\n  border-radius: 8px;\n  border: 1px solid var(--cube-border-strong);\n  background: var(--dsw-alias-tooltip-bg);\n  color: var(--dsw-alias-toast-label);\n  font-size: 11.5px;\n  white-space: nowrap;\n  pointer-events: none;\n  opacity: 0;\n  transform: translate(-100%, -50%);\n  transition: opacity 0.15s;\n}\n\n.cube-ui-overlay .tip.show {\n  opacity: 1;\n}\n\n/* --------------------------------------------------------------------------\n   13. Overlay: dock (settings / plugin launcher, bottom-left)\n   -------------------------------------------------------------------------- */\n\n.cube-ui-overlay .dock {\n  position: fixed;\n  left: 72px;\n  bottom: 16px;\n  z-index: 6;\n  display: flex;\n  flex-direction: column;\n  gap: 10px;\n  align-items: flex-start;\n}\n\n.cube-ui-overlay .dock-panel {\n  width: 268px;\n  max-height: min(430px, 54vh);\n  overflow: auto;\n  padding: 12px;\n  border: 1px solid var(--cube-border-strong);\n  border-radius: 16px;\n  background: var(--cube-surface-raised);\n  box-shadow: var(--cube-shadow),\n    0 18px 48px -20px color-mix(in srgb, #000 22%, transparent);\n  backdrop-filter: blur(18px);\n  -webkit-backdrop-filter: blur(18px);\n  display: none;\n}\n\n.cube-ui-overlay .dock.open .dock-panel {\n  display: block;\n  animation: cube-dock-in 0.22s var(--cube-ease);\n}\n\n.cube-ui-overlay .dock-section + .dock-section {\n  margin-top: 12px;\n  padding-top: 12px;\n  border-top: 1px solid var(--cube-border-soft);\n}\n\n.cube-ui-overlay .dock-section h3 {\n  margin: 0 0 8px;\n  font-size: 10px;\n  letter-spacing: 0.14em;\n  text-transform: uppercase;\n  color: var(--cube-text-caption);\n}\n\n.cube-ui-overlay .dock-item {\n  width: 100%;\n  display: flex;\n  align-items: center;\n  gap: 9px;\n  padding: 9px 10px;\n  border: 1px solid transparent;\n  border-radius: 9px;\n  background: transparent;\n  color: var(--cube-text);\n  font-size: 12px;\n  text-align: left;\n  cursor: pointer;\n}\n\n.cube-ui-overlay .dock-item:hover {\n  background: var(--cube-hover);\n  border-color: var(--cube-border);\n}\n\n.cube-ui-overlay .dock-item .di-ico {\n  color: var(--cube-text-dim);\n  width: 16px;\n  text-align: center;\n}\n\n.cube-ui-overlay .dock-item .di-meta {\n  margin-left: auto;\n  font-size: 10.5px;\n  color: var(--cube-text-caption);\n}\n\n.cube-ui-overlay .dock-toggle {\n  display: flex;\n  align-items: center;\n  gap: 9px;\n  padding: 9px 14px 9px 11px;\n  border: 1px solid var(--cube-border-strong);\n  border-radius: 999px;\n  background: color-mix(in oklab, var(--dsw-alias-bg-layer-2) 88%, transparent);\n  color: var(--cube-text);\n  font-size: 12px;\n  cursor: pointer;\n  box-shadow: var(--cube-shadow-soft);\n  backdrop-filter: blur(14px);\n  -webkit-backdrop-filter: blur(14px);\n  transition: border-color 0.18s, background 0.18s;\n}\n\n.cube-ui-overlay .dock-toggle:hover {\n  border-color: var(--cube-border-accent);\n  background: color-mix(in oklab, var(--dsw-alias-bg-layer-2) 96%, transparent);\n}\n\n.cube-ui-overlay .dock-toggle .dock-caret {\n  color: var(--cube-text-caption);\n  transition: transform 0.25s;\n}\n\n.cube-ui-overlay .dock.open .dock-toggle .dock-caret {\n  transform: rotate(180deg);\n}\n\n/* --------------------------------------------------------------------------\n   14. Overlay: modal\n   -------------------------------------------------------------------------- */\n\n.cube-ui-overlay .modal-backdrop {\n  position: fixed;\n  inset: 0;\n  z-index: 8;\n  display: grid;\n  place-items: center;\n  padding: 24px;\n  background: var(--dsw-alias-bg-mask-1);\n  backdrop-filter: blur(5px);\n  -webkit-backdrop-filter: blur(5px);\n}\n\n.cube-ui-overlay .modal-backdrop[hidden] {\n  display: none;\n}\n\n.cube-ui-overlay .modal {\n  width: min(560px, 100%);\n  max-height: min(78vh, 720px);\n  overflow: auto;\n  border: 1px solid var(--cube-border-strong);\n  border-radius: 20px;\n  background: linear-gradient(168deg,\n    var(--dsw-alias-bg-layer-2),\n    var(--dsw-alias-bg-layer-1));\n  box-shadow: var(--cube-shadow),\n    0 22px 60px -24px color-mix(in srgb, #000 26%, transparent);\n  padding: 20px 22px 22px;\n  animation: cube-modal-in 0.22s var(--cube-ease);\n}\n\n.cube-ui-overlay .modal-head {\n  display: flex;\n  align-items: flex-start;\n  gap: 10px;\n  margin-bottom: 6px;\n}\n\n.cube-ui-overlay .modal-head h2 {\n  margin: 0;\n  font-size: 15.5px;\n  font-weight: 600;\n}\n\n.cube-ui-overlay .modal-sub {\n  margin: 0 0 16px;\n  font-size: 11.5px;\n  color: var(--cube-text-caption);\n  line-height: 1.7;\n}\n\n.cube-ui-overlay .modal-row {\n  display: flex;\n  align-items: center;\n  gap: 10px;\n  padding: 11px 12px;\n  margin-bottom: 8px;\n  border: 1px solid var(--cube-border-soft);\n  border-radius: 12px;\n  background: var(--cube-hover);\n  font-size: 12.5px;\n}\n\n.cube-ui-overlay .modal-row .mr-desc {\n  margin-left: auto;\n  font-size: 10.5px;\n  color: var(--cube-text-caption);\n}\n\n.cube-ui-overlay .modal-row .mr-note {\n  font-size: 10.5px;\n  color: var(--cube-text-caption);\n}\n\n.cube-ui-overlay .modal-note {\n  margin-top: 14px;\n  padding: 10px 12px;\n  border-left: 2px solid color-mix(in oklab, var(--cube-accent) 50%, transparent);\n  border-radius: 0 8px 8px 0;\n  background: color-mix(in oklab, var(--cube-accent) 6%, transparent);\n  font-size: 11px;\n  line-height: 1.7;\n  color: var(--cube-text-dim);\n}\n\n.cube-ui-overlay .toggle {\n  position: relative;\n  width: 34px;\n  height: 20px;\n  flex: none;\n  border-radius: 999px;\n  background: color-mix(in oklab, var(--cube-text-faint) 35%, transparent);\n  border: 1px solid var(--cube-border);\n}\n\n.cube-ui-overlay .toggle::after {\n  content: \"\";\n  position: absolute;\n  top: 2px;\n  left: 2px;\n  width: 14px;\n  height: 14px;\n  border-radius: 50%;\n  background: var(--dsw-alias-switch-thumb);\n  transition: transform 0.2s, background 0.2s;\n}\n\n.cube-ui-overlay .toggle.on {\n  background: color-mix(in oklab, var(--cube-ok) 30%, transparent);\n  border-color: color-mix(in oklab, var(--cube-ok) 40%, transparent);\n}\n\n.cube-ui-overlay .toggle.on::after {\n  transform: translateX(14px);\n  background: var(--cube-ok);\n}\n\n/* --------------------------------------------------------------------------\n   15. Scrollbars (theme-derived, thin)\n   -------------------------------------------------------------------------- */\n\n.cube-ui .sessions,\n.cube-ui .conv-body,\n.cube-ui .session-menu,\n.cube-ui-overlay .dock-panel,\n.cube-ui-overlay .rail-panel,\n.cube-ui-overlay .modal {\n  scrollbar-width: thin;\n  scrollbar-color: var(--cube-scroll-thumb) transparent;\n}\n\n.cube-ui .sessions::-webkit-scrollbar,\n.cube-ui .conv-body::-webkit-scrollbar,\n.cube-ui .session-menu::-webkit-scrollbar,\n.cube-ui-overlay .dock-panel::-webkit-scrollbar,\n.cube-ui-overlay .rail-panel::-webkit-scrollbar,\n.cube-ui-overlay .modal::-webkit-scrollbar {\n  width: 8px;\n  height: 8px;\n}\n\n.cube-ui .sessions::-webkit-scrollbar-track,\n.cube-ui .conv-body::-webkit-scrollbar-track,\n.cube-ui .session-menu::-webkit-scrollbar-track,\n.cube-ui-overlay .dock-panel::-webkit-scrollbar-track,\n.cube-ui-overlay .rail-panel::-webkit-scrollbar-track,\n.cube-ui-overlay .modal::-webkit-scrollbar-track {\n  background: transparent;\n}\n\n.cube-ui .sessions::-webkit-scrollbar-thumb,\n.cube-ui .conv-body::-webkit-scrollbar-thumb,\n.cube-ui .session-menu::-webkit-scrollbar-thumb,\n.cube-ui-overlay .dock-panel::-webkit-scrollbar-thumb,\n.cube-ui-overlay .rail-panel::-webkit-scrollbar-thumb,\n.cube-ui-overlay .modal::-webkit-scrollbar-thumb {\n  background: var(--cube-scroll-thumb);\n  border-radius: 999px;\n}\n\n.cube-ui .sessions::-webkit-scrollbar-thumb:hover,\n.cube-ui .conv-body::-webkit-scrollbar-thumb:hover,\n.cube-ui .session-menu::-webkit-scrollbar-thumb:hover,\n.cube-ui-overlay .dock-panel::-webkit-scrollbar-thumb:hover,\n.cube-ui-overlay .rail-panel::-webkit-scrollbar-thumb:hover,\n.cube-ui-overlay .modal::-webkit-scrollbar-thumb:hover {\n  background: var(--cube-scroll-thumb-hover);\n}\n\n/* --------------------------------------------------------------------------\n   16. Keyframes (prefixed: @keyframes are global by spec)\n   -------------------------------------------------------------------------- */\n\n@keyframes cube-pulse {\n  0%, 100% { opacity: 1; }\n  50% { opacity: 0.45; }\n}\n\n@keyframes cube-bounce {\n  0%, 60%, 100% { transform: translateY(0); opacity: 0.4; }\n  30% { transform: translateY(-3px); opacity: 1; }\n}\n\n@keyframes cube-dock-in {\n  from { opacity: 0; transform: translateY(6px); }\n  to { opacity: 1; transform: none; }\n}\n\n@keyframes cube-modal-in {\n  from { opacity: 0; transform: scale(0.98) translateY(8px); }\n  to { opacity: 1; transform: none; }\n}\n\n/* --------------------------------------------------------------------------\n   17. Container queries — keyed to the main panel, not the viewport\n   -------------------------------------------------------------------------- */\n\n@container cube (max-width: 760px) {\n  .cube-ui .cube-shell {\n    --cube-size: 420px;\n  }\n\n  .cube-ui .conv {\n    width: min(680px, 94cqw);\n    height: min(560px, 66%);\n    border-radius: 16px;\n  }\n\n  .cube-ui .hud {\n    gap: 5px;\n  }\n\n  .cube-ui .hud-hint {\n    font-size: 10px;\n  }\n\n  .cube-ui .pager button {\n    width: 24px;\n    height: 24px;\n  }\n\n  .cube-ui .hud-front {\n    font-size: 9.5px;\n    letter-spacing: 0.12em;\n  }\n\n  .cube-ui-overlay .diamond {\n    top: 16px;\n    right: 16px;\n    width: 104px;\n    height: 104px;\n  }\n\n  .cube-ui-overlay .dock {\n    left: 64px;\n  }\n\n  .cube-ui-overlay .dock-panel {\n    width: min(268px, 84cqw);\n  }\n}\n\n/* --------------------------------------------------------------------------\n   18. Viewport breakpoints (kept from the mock as a fallback)\n   -------------------------------------------------------------------------- */\n\n@media (max-width: 980px) {\n  .cube-ui .cube-shell {\n    --cube-size: 420px;\n  }\n\n  .cube-ui .conv {\n    width: min(720px, 78vw);\n  }\n\n  .cube-ui-overlay .brand-sub {\n    display: none;\n  }\n\n  .cube-ui-overlay .dock {\n    left: 64px;\n  }\n}\n\n@media (max-width: 640px) {\n  .cube-ui .cube-shell {\n    --cube-size: 340px;\n  }\n\n  .cube-ui .conv {\n    width: min(720px, 92vw);\n    height: min(600px, 68vh);\n  }\n\n  .cube-ui-overlay .diamond {\n    width: 104px;\n    height: 104px;\n  }\n\n  .cube-ui-overlay .rail-panel {\n    width: 82vw;\n  }\n}\n\n/* --------------------------------------------------------------------------\n   19. Motion preferences / screenshot helper\n   -------------------------------------------------------------------------- */\n\n@media (prefers-reduced-motion: reduce) {\n  .cube-ui *,\n  .cube-ui *::before,\n  .cube-ui *::after,\n  .cube-ui-overlay *,\n  .cube-ui-overlay *::before,\n  .cube-ui-overlay *::after {\n    transition-duration: 0.01ms !important;\n    animation-duration: 0.01ms !important;\n    animation-iteration-count: 1 !important;\n    scroll-behavior: auto !important;\n  }\n}\n\n/* Phase 0 screenshot helper — harmless in production, kept for parity */\n.cube-ui.no-anim *,\n.cube-ui.no-anim *::before,\n.cube-ui.no-anim *::after,\n.cube-ui-overlay.no-anim *,\n.cube-ui-overlay.no-anim *::before,\n.cube-ui-overlay.no-anim *::after {\n  transition: none !important;\n  animation: none !important;\n}\n\n/* --------------------------------------------------------------------------\n   15. Hosted conversation (client-plugin integration)\n\n   The cube does not rebuild chat: the shipped Conversation content and\n   composer are mounted through the official `conversation.content` factory in\n   its `embedded` variant. That subtree owns its own scrollport and composer\n   padding, so the seat must add neither a second scroll area nor padding.\n   -------------------------------------------------------------------------- */\n\n.cube-ui .conv-body.embedded {\n  flex: 1 1 auto;\n  min-height: 0;\n  overflow: hidden;\n  padding: 0;\n}\n\n.cube-ui .conv-body.embedded > [data-conversation-content] {\n  flex: 1 1 auto;\n  min-height: 0;\n  height: 100%;\n}\n\n/* The cube reads its panel box, not the viewport: the host wrapper is a flex\n   child of the frame's main panel and must not collapse. */\n.cube-ui-host {\n  min-height: 0;\n}\n\n/* --------------------------------------------------------------------------\n   16. Front-face conversation — the cube face IS the session surface\n\n   Rotating the cube carries the conversation out of view with its Workspace;\n   the next face brings its own Session surface in. The face is a cube wall, so\n   inside mode keeps it upright (rx = 0 in the client) and nearly flat.\n   -------------------------------------------------------------------------- */\n\n.cube-ui .face-summary { display: none; }\n\n.cube-ui .face.hosting,\n.cube-ui .stage.inside .face.hosting,\n.cube-ui[data-mode=\"inside\"] .face.hosting {\n  background: linear-gradient(168deg,\n    color-mix(in oklab, var(--dsw-alias-bg-layer-2) 97%, transparent),\n    color-mix(in oklab, var(--dsw-alias-bg-base) 98%, transparent));\n  border-color: var(--cube-border-strong);\n  border-top-color: var(--cube-border-accent);\n}\n\n.cube-ui .face.hosting .face-inner,\n.cube-ui .face.hosting .face-room {\n  opacity: 0;\n  pointer-events: none;\n}\n\n.cube-ui .face-conv {\n  position: absolute;\n  /* Slack around the surface: the conversation is inset from the cube wall so\n     the face keeps a visible frame, and gestures have room to land. */\n  inset: 18px;\n  z-index: 2;\n  display: flex;\n  flex-direction: column;\n  padding: 0;\n  gap: 0;\n  border-radius: 16px;\n  /* The stage disables touch gestures for rotation; the conversation opts back\n     into vertical panning so touch/momentum scrolling keeps working. */\n  touch-action: pan-y;\n  overscroll-behavior: contain;\n}\n\n.cube-ui .face-conv .conv-head {\n  flex: none;\n  padding: 8px 10px;\n  border: 1px solid var(--cube-border-strong);\n  border-bottom: 0;\n  border-radius: 12px 12px 0 0;\n  background: color-mix(in oklab, var(--dsw-alias-bg-layer-2) 92%, transparent);\n}\n\n.cube-ui .face-conv .conv-body {\n  flex: 1 1 auto;\n  min-height: 0;\n  padding: 10px;\n  border: 1px solid var(--cube-border-strong);\n  border-top: 0;\n  border-radius: 0 0 12px 12px;\n  background: color-mix(in oklab, var(--dsw-alias-bg-base) 94%, transparent);\n}\n\n.cube-ui .face-conv .conv-body.embedded {\n  padding: 0 2px 2px;\n}\n\n.cube-ui .stage.inside,\n.cube-ui[data-mode=\"inside\"] .stage { perspective: 4200px; }\n\n.cube-ui .stage.inside .cube-shell,\n.cube-ui[data-mode=\"inside\"] .cube-shell { transform: none; }\n\n/* --------------------------------------------------------------------------\n   17. Workspace identity at the top-left (replaces the old bottom label)\n   -------------------------------------------------------------------------- */\n\n.cube-ui .stage-title {\n  position: absolute;\n  top: 14px;\n  left: 18px;\n  z-index: 5;\n  display: flex;\n  align-items: baseline;\n  gap: 8px;\n  max-width: 46cqw;\n  pointer-events: none;\n}\n\n.cube-ui .st-name {\n  overflow: hidden;\n  text-overflow: ellipsis;\n  white-space: nowrap;\n  font-size: 12.5px;\n  font-weight: 600;\n  letter-spacing: 0.01em;\n  color: var(--cube-text);\n}\n\n.cube-ui .st-meta {\n  flex: none;\n  font-size: 10px;\n  color: var(--cube-text-caption);\n}\n\n/* --------------------------------------------------------------------------\n   18. Rotating: faces drop to identity detail\n\n   While the cube is dragged or snapping, every face shows only what is needed\n   to recognize the Workspace (title + session count); lists, paths and the\n   embedded conversation return when the cube settles.\n   -------------------------------------------------------------------------- */\n\n.cube-ui[data-rotating=\"true\"] .face .face-path,\n.cube-ui[data-rotating=\"true\"] .face .sessions,\n.cube-ui[data-rotating=\"true\"] .face .face-foot,\n.cube-ui[data-rotating=\"true\"] .face .face-room,\n.cube-ui[data-rotating=\"true\"] .face .face-conv {\n  display: none;\n}\n\n.cube-ui[data-rotating=\"true\"] .face .face-inner {\n  justify-content: center;\n  align-items: center;\n  gap: 4px;\n  padding: 12px;\n  text-align: center;\n  opacity: 1;\n  pointer-events: none;\n}\n\n.cube-ui[data-rotating=\"true\"] .face .face-head {\n  flex-direction: column;\n  align-items: center;\n  gap: 2px;\n}\n\n.cube-ui[data-rotating=\"true\"] .face .face-idx { display: none; }\n.cube-ui[data-rotating=\"true\"] .face .face-title {\n  font-size: 15px;\n  white-space: normal;\n  overflow: visible;\n}\n.cube-ui[data-rotating=\"true\"] .face .face-summary {\n  display: block;\n  font-size: 10.5px;\n  color: var(--cube-text-caption);\n}\n\n/* --------------------------------------------------------------------------\n   19. Cube size pill (overlay, bottom-right) + title/hud adjustments\n\n   The pill scales the fitted cube between 60% and 160%; the conversation is\n   embedded in the front face, so it follows the same size. The choice is\n   remembered per browser.\n   -------------------------------------------------------------------------- */\n\n.cube-ui .stage-title {\n  flex-direction: column;\n  align-items: flex-start;\n  gap: 2px;\n}\n\n.cube-ui .st-line {\n  display: flex;\n  align-items: baseline;\n  gap: 8px;\n  max-width: 100%;\n  min-width: 0;\n}\n\n.cube-ui .st-hint {\n  font-size: 10px;\n  color: var(--cube-text-caption);\n  opacity: 0.85;\n}\n\n/* Inside the cube the conversation owns the bottom of the surface. */\n.cube-ui[data-mode=\"inside\"] .hud,\n.cube-ui .stage.inside ~ .hud {\n  display: none;\n}\n\n.cube-ui-overlay .size-pill {\n  position: fixed;\n  /* Kept clear of the overlay pet plugin (whale-chan-pet,\n     https://github.com/Phrixos-git/dsh-whale-chan-pet): its sprite is 210px\n     wide with a 28px right margin, and its summon button sits at the very\n     bottom-right corner. */\n  right: calc(210px + 28px + 6px);\n  bottom: 18px;\n  z-index: 6;\n  display: flex;\n  align-items: center;\n  gap: 2px;\n  padding: 3px 5px;\n  border: 1px solid var(--cube-border-strong);\n  border-radius: 999px;\n  background: var(--cube-surface-raised);\n  backdrop-filter: blur(18px);\n  -webkit-backdrop-filter: blur(18px);\n}\n\n.cube-ui-overlay .size-pill button {\n  display: grid;\n  place-items: center;\n  width: 24px;\n  height: 24px;\n  border: none;\n  border-radius: 50%;\n  background: transparent;\n  color: var(--cube-text-dim);\n  cursor: pointer;\n}\n\n.cube-ui-overlay .size-pill button:hover {\n  background: var(--cube-hover-active);\n  color: var(--cube-text);\n}\n\n.cube-ui-overlay .size-pill .ico svg { width: 13px; height: 13px; }\n\n.cube-ui-overlay .size-pill > span {\n  min-width: 3.1em;\n  text-align: center;\n  font-size: 10.5px;\n  letter-spacing: 0.02em;\n  color: var(--cube-text-dim);\n}\n\n/* The cube rests face-on; a longer perspective keeps the front face close to\n   its designed size instead of magnifying it with translateZ. */\n.cube-ui .stage { perspective: 3400px; }\n\n/* Touch devices: the stage keeps horizontal drag for rotation, while vertical\n   gestures are left to the conversation's scrollport (the earlier\n   touch-action:none on .stage blocked touch scrolling inside the face). */\n.cube-ui .stage { touch-action: pan-y; }\n\n/* --------------------------------------------------------------------------\n   20. Above the frame overlay + opaque conversation surfaces\n\n   The cube is raised above the frame's overlay layer (example-plugin's atmosphere\n   and similar frame art live there and were painting over the conversation).\n   The conversation surfaces themselves become opaque so text always reads.\n   -------------------------------------------------------------------------- */\n\n.cube-ui {\n  z-index: 21;\n}\n\n.cube-ui .face.hosting,\n.cube-ui .stage.inside .face.hosting,\n.cube-ui[data-mode=\"inside\"] .face.hosting {\n  background: linear-gradient(168deg,\n    var(--dsw-alias-bg-layer-2),\n    var(--dsw-alias-bg-base));\n}\n\n.cube-ui .face-conv .conv-head {\n  background: var(--dsw-alias-bg-layer-2);\n}\n\n.cube-ui .face-conv .conv-body,\n.cube-ui .face-conv .conv-body.embedded {\n  background: var(--dsw-alias-bg-base);\n}\n";
    const LOCALE_DICTS = {"ja":{"nav.title":"クイック操作","nav.session":"新規セッション","nav.plugins":"プラグイン","nav.schedules":"自動化タスク","nav.more":"その他","hint.browse":"ドラッグで回転 ・ 面のセッションをクリックで会話 ・ 右上のひし形から操作","hint.inside":"ドラッグで回転してワークスペースを切り替え ・ 会話は前面の面に表示 ・ Esc で立方体に戻る","workspace.none":"ワークスペースなし","workspace.count":"セッション","workspace.total":"ワークスペース","workspace.emptySlot":"空きスロット","workspace.emptyPath":"この面に割り当てられたワークスペースはありません","workspace.label":"ワークスペース","sessions.empty":"セッションなし","sessions.new":"新規セッション","sessions.running":"実行中","sessions.idle":"待機中","conv.title":"会話","conv.close":"立方体に戻る (Esc)","conv.empty":"このワークスペースにはまだセッションがありません。","page.prev":"前のワークスペースセット","page.next":"次のワークスペースセット","page.label":"{from}–{to} / {total}","dock.title":"設定・プラグイン","dock.settingsSection":"設定","dock.settings":"設定を開く","dock.settingsMeta":"標準の設定モーダル","dock.panels":"プラグイン UI","dock.plugins":"プラグイン管理","dock.pluginsMeta":"標準パネル","dock.schedules":"自動化タスク","dock.schedulesMeta":"標準パネル","dock.note":"プラグイン固有の設定 UI は、それぞれの標準画面から開きます。","more.title":"その他","more.close":"閉じる","more.sub":"残りのユーティリティへの入口です。","more.settings":"設定","more.settingsMeta":"DSH 標準設定","more.plugins":"プラグイン管理","more.pluginsMeta":"DSH 標準パネル","more.schedules":"自動化タスク","more.schedulesMeta":"DSH 標準パネル","more.open":"開く","more.about":"Cube UI","size.title":"立方体のサイズ","size.smaller":"立方体を小さく","size.larger":"立方体を大きく","hint.insideShort":"ドラッグで回転 ・ Esc で戻る","more.diagnostics":"診断情報","more.diagnosticsMeta":"スクロール不調時の確認用"},"en":{"nav.title":"Quick actions","nav.session":"New session","nav.plugins":"Plugins","nav.schedules":"Scheduled tasks","nav.more":"More","hint.browse":"Drag to rotate ・ click a session on a face to open it ・ use the diamond at the top right","hint.inside":"Drag to rotate between workspaces ・ the conversation lives on the front face ・ Esc returns to the cube","workspace.none":"No workspaces","workspace.count":"sessions","workspace.total":"workspaces","workspace.emptySlot":"Empty slot","workspace.emptyPath":"No workspace is assigned to this face","workspace.label":"Workspace","sessions.empty":"No sessions","sessions.new":"New session","sessions.running":"Running","sessions.idle":"Idle","conv.title":"Conversation","conv.close":"Back to the cube (Esc)","conv.empty":"This workspace has no sessions yet.","page.prev":"Previous workspace set","page.next":"Next workspace set","page.label":"{from}–{to} / {total}","dock.title":"Settings & plugins","dock.settingsSection":"Settings","dock.settings":"Open settings","dock.settingsMeta":"Standard settings dialog","dock.panels":"Plugin surfaces","dock.plugins":"Plugin manager","dock.pluginsMeta":"Standard panel","dock.schedules":"Scheduled tasks","dock.schedulesMeta":"Standard panel","dock.note":"Plugin-specific settings open from their own standard screens.","more.title":"More","more.close":"Close","more.sub":"Entrances to the remaining utilities.","more.settings":"Settings","more.settingsMeta":"Standard DSH settings","more.plugins":"Plugin manager","more.pluginsMeta":"Standard DSH panel","more.schedules":"Scheduled tasks","more.schedulesMeta":"Standard DSH panel","more.open":"Open","more.about":"Cube UI","size.title":"Cube size","size.smaller":"Shrink the cube","size.larger":"Enlarge the cube","hint.insideShort":"Drag to rotate ・ Esc to go back","more.diagnostics":"Diagnostics","more.diagnosticsMeta":"For scroll troubleshooting"},"zh":{"nav.title":"快捷操作","nav.session":"新建会话","nav.plugins":"插件","nav.schedules":"计划任务","nav.more":"更多","hint.browse":"拖动旋转 ・ 点击面上的会话即可打开 ・ 右上角菱形提供操作","hint.inside":"拖动旋转以切换工作区 ・ 会话显示在正面的面上 ・ Esc 返回立方体","workspace.none":"没有工作区","workspace.count":"个会话","workspace.total":"个工作区","workspace.emptySlot":"空槽位","workspace.emptyPath":"此面尚未分配工作区","workspace.label":"工作区","sessions.empty":"没有会话","sessions.new":"新建会话","sessions.running":"运行中","sessions.idle":"空闲","conv.title":"会话","conv.close":"返回立方体 (Esc)","conv.empty":"此工作区还没有会话。","page.prev":"上一组工作区","page.next":"下一组工作区","page.label":"{from}–{to} / {total}","dock.title":"设置与插件","dock.settingsSection":"设置","dock.settings":"打开设置","dock.settingsMeta":"标准设置对话框","dock.panels":"插件界面","dock.plugins":"插件管理","dock.pluginsMeta":"标准面板","dock.schedules":"计划任务","dock.schedulesMeta":"标准面板","dock.note":"插件专属设置请从其标准界面打开。","more.title":"更多","more.close":"关闭","more.sub":"通往其余工具的入口。","more.settings":"设置","more.settingsMeta":"DSH 标准设置","more.plugins":"插件管理","more.pluginsMeta":"DSH 标准面板","more.schedules":"计划任务","more.schedulesMeta":"DSH 标准面板","more.open":"打开","more.about":"Cube UI","size.title":"立方体大小","size.smaller":"缩小立方体","size.larger":"放大立方体","hint.insideShort":"拖动旋转 ・ Esc 返回","more.diagnostics":"诊断信息","more.diagnosticsMeta":"用于排查滚动问题"}};

    /** The cube rests face-on: the front face is parallel to the screen. */
    const INITIAL_RX = 0;
    const INITIAL_RY = 0;
    /** Snap animation length; must stay in sync with `.cube.snap` in styles. */
    const SNAP_MS = 460;
    /** Drag sensitivity (degrees per pixel). */
    const DRAG_YAW = 0.34;
    const DRAG_PITCH = 0.24;
    /** Drag may pass the top/bottom faces; release snaps back onto a face. */
    const PITCH_LIMIT = 100;
    /** Past this pitch the cube settles on its top or bottom face. */
    const PITCH_COMMIT = 55;
    /** Repeat of a face rotation while we are still settling. */
    const FACES = 6;

    /** User-tunable cube scale, persisted per browser. */
    const SCALE_KEY = 'dsh.cube-ui.scale';
    const SCALE_MIN = 0.6;
    const SCALE_MAX = 1.6;

    function readScale() {
      try {
        const value = Number(window.localStorage.getItem(SCALE_KEY));
        return Number.isFinite(value) && value > 0 ? clamp(value, SCALE_MIN, SCALE_MAX) : 1;
      } catch (error) {
        return 1;
      }
    }

    function writeScale(scale) {
      try {
        window.localStorage.setItem(SCALE_KEY, String(scale));
      } catch (error) {
        // Storage may be unavailable in private windows; the cube still resizes.
      }
    }

    /**
     * The slot seat is a flex child of the frame's main panel, which is not a
     * positioning context. This wrapper gives the absolutely framed cube a
     * box of its own: the panel width, and the full remaining height.
     */
    const HOST_STYLE = {
      position: 'relative',
      flex: '1 1 auto',
      minHeight: 0,
      width: '100%',
      overflow: 'hidden',
    };

    const DRAG_IGNORE = [
      'button',
      'a',
      'input',
      'textarea',
      'select',
      '[role="button"]',
      '[role="menuitem"]',
      '.diamond',
      '.dock',
      '.hud',
      '.session-menu',
      '.modal',
      '.cube-ui-chrome',
    ].join(',');

    // ---------------------------------------------------------------------
    // Icons
    //
    // Drawn inline because the shell runs without a guaranteed icon font; a
    // missing glyph would surface as a LastResort box in some environments.
    // ---------------------------------------------------------------------

    const ICONS = {
      close: '<path d="M6 6l12 12M18 6L6 18"/>',
      plus: '<path d="M12 5v14M5 12h14"/>',
      minus: '<path d="M5 12h14"/>',
      grid: '<rect x="4" y="4" width="7" height="7" rx="1.5"/><rect x="13" y="4" width="7" height="7" rx="1.5"/><rect x="4" y="13" width="7" height="7" rx="1.5"/><rect x="13" y="13" width="7" height="7" rx="1.5"/>',
      clock: '<circle cx="12" cy="12" r="8"/><path d="M12 7.5V12l3 2"/>',
      dots: '<circle cx="6" cy="12" r="1.5" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r="1.5" fill="currentColor" stroke="none"/><circle cx="18" cy="12" r="1.5" fill="currentColor" stroke="none"/>',
      gear: '<circle cx="12" cy="12" r="3.2"/><path d="M12 3.5v2.2M12 18.3v2.2M3.5 12h2.2M18.3 12h2.2M5.9 5.9l1.6 1.6M16.5 16.5l1.6 1.6M18.1 5.9l-1.6 1.6M7.5 16.5l-1.6 1.6"/>',
      theme: '<circle cx="12" cy="12" r="8"/><path d="M12 4a8 8 0 0 1 0 16z" fill="currentColor" stroke="none"/>',
      cube: '<path d="M12 3l7.5 4.3v9.4L12 21l-7.5-4.3V7.3z"/><path d="M12 3v18M4.5 7.3L12 12l7.5-4.7"/>',
      list: '<path d="M5 7h14M5 12h14M5 17h9"/>',
      chevronUp: '<path d="M6 14l6-6 6 6"/>',
      chevronLeft: '<path d="M14 6l-6 6 6 6"/>',
      chevronRight: '<path d="M10 6l6 6-6 6"/>',
      external: '<path d="M14 4h6v6M20 4l-8 8M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/>',
    };

    const ICON_SVG_OPEN =
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" ' +
      'stroke-linecap="round" stroke-linejoin="round" focusable="false" aria-hidden="true">';

    function iconMarkup(name) {
      const body = ICONS[name];
      return body === undefined ? '' : ICON_SVG_OPEN + body + '</svg>';
    }

    function Icon({ name, className }) {
      return h('span', {
        className: className === undefined ? 'ico' : 'ico ' + className,
        'aria-hidden': 'true',
        dangerouslySetInnerHTML: { __html: iconMarkup(name) },
      });
    }

    // ---------------------------------------------------------------------
    // Small shared store
    //
    // The stage lives in `main.conversation`; the diamond and the dock live in
    // `shell.overlay`. They are separate slot trees, so the two halves share
    // the view state through this module-local store instead of React context.
    // ---------------------------------------------------------------------

    function createChannel(initial) {
      let state = { ...initial };
      const listeners = new Set();
      return {
        getSnapshot: () => state,
        subscribe(listener) {
          listeners.add(listener);
          return () => {
            listeners.delete(listener);
          };
        },
        update(patch) {
          let changed = false;
          for (const key of Object.keys(patch)) {
            if (state[key] !== patch[key]) {
              changed = true;
              break;
            }
          }
          if (!changed) return;
          state = { ...state, ...patch };
          for (const listener of [...listeners]) {
            try {
              listener();
            } catch (error) {
              console.error('[cube-ui] channel subscriber failed:', error);
            }
          }
        },
      };
    }

    function useChannel(channel) {
      return useSyncExternalStore(channel.subscribe, channel.getSnapshot, channel.getSnapshot);
    }

    // ---------------------------------------------------------------------
    // Formatting helpers
    // ---------------------------------------------------------------------

    function pad2(value) {
      return String(value).padStart(2, '0');
    }

    // Building an Intl.DateTimeFormat resolves locale data and is by far the
    // most expensive thing this file does per call. A face formats one
    // timestamp per Session, on every render, so keep one formatter per shape
    // and memoise the rendered strings. The memo is keyed by timestamp and
    // cleared when the calendar day rolls over, so "today" never leaks into
    // "yesterday".
    let timeFormatter = null;
    let dateFormatter = null;
    let memoDayKey = '';
    const shortTimeMemo = new Map();
    const SHORT_TIME_MEMO_MAX = 400;

    function dayKeyOf(date) {
      return date.getFullYear() + '-' + date.getMonth() + '-' + date.getDate();
    }

    /** Compact, locale-neutral session age: time today, date otherwise. */
    function shortTime(timestamp) {
      if (typeof timestamp !== 'number' || !Number.isFinite(timestamp)) return '';
      const todayKey = dayKeyOf(new Date());
      if (todayKey !== memoDayKey) {
        memoDayKey = todayKey;
        shortTimeMemo.clear();
      }
      const memo = shortTimeMemo.get(timestamp);
      if (memo !== undefined) return memo;
      const date = new Date(timestamp);
      if (!Number.isFinite(date.getTime())) return '';
      const sameDay = dayKeyOf(date) === todayKey;
      let text;
      try {
        if (sameDay) {
          if (timeFormatter === null) {
            timeFormatter = new Intl.DateTimeFormat(undefined, { hour: '2-digit', minute: '2-digit' });
          }
          text = timeFormatter.format(date);
        } else {
          if (dateFormatter === null) {
            dateFormatter = new Intl.DateTimeFormat(undefined, { month: 'numeric', day: 'numeric' });
          }
          text = dateFormatter.format(date);
        }
      } catch (error) {
        text = sameDay
          ? pad2(date.getHours()) + ':' + pad2(date.getMinutes())
          : pad2(date.getMonth() + 1) + '/' + pad2(date.getDate());
      }
      if (shortTimeMemo.size >= SHORT_TIME_MEMO_MAX) shortTimeMemo.clear();
      shortTimeMemo.set(timestamp, text);
      return text;
    }

    function clamp(value, low, high) {
      return value < low ? low : value > high ? high : value;
    }

    /**
     * Which face is square to the viewer. The four side faces follow the yaw;
     * the top and bottom faces are reached by pitching the cube onto them.
     */
    function frontSlotOf(rx, ry) {
      const pitch = Math.round(rx / 90) * 90;
      if (pitch === -90) return 4;
      if (pitch === 90) return 5;
      const turns = Math.round(-ry / 90);
      return ((turns % 4) + 4) % 4;
    }

    /** Snap a loose drag attitude onto the nearest face. */
    function snapAttitude(rx, ry) {
      const pitched = Math.abs(rx) > PITCH_COMMIT;
      return {
        rx: pitched ? (rx < 0 ? -90 : 90) : 0,
        ry: Math.round(ry / 90) * 90,
      };
    }

    /** Nearest yaw that puts `slot` on the front without a long spin. */
    function yawForSlot(slot, currentYaw) {
      let target = -90 * slot;
      while (target - currentYaw > 180) target -= 360;
      while (target - currentYaw < -180) target += 360;
      return target;
    }

    /** Resolve a workspace id to its session list, newest first as stored. */
    function sessionsOf(workspace, sessions) {
      if (workspace === undefined || sessions === undefined) return [];
      const rows = [];
      for (const id of workspace.sessionIds ?? []) {
        const row = sessions.byId?.[id];
        if (row !== undefined) rows.push(row);
      }
      return rows;
    }

    // ---------------------------------------------------------------------
    // Stage: cube of Workspaces plus the embedded conversation
    // ---------------------------------------------------------------------

    function CubeStage(props) {
      const {
        sessionId,
        useSession,
        useConversation,
        useSessions,
        useWorkspaces,
        useSessionStatus,
        usePanelInfo,
        renderFactorySlot,
        channel,
        actions,
        t,
      } = props;

      const workspaceState = useWorkspaces((state) => state);
      const sessionState = useSessions((state) => state);
      const sessionStatus = useSessionStatus((state) => state);
      const sessionSnapshot = useSession((state) => state);
      const ui = useChannel(channel);

      const items = workspaceState?.items ?? [];
      const pageCount = Math.max(1, Math.ceil(items.length / FACES));
      const page = clamp(ui.page, 0, pageCount - 1);
      const sessionRow = sessionId === undefined ? undefined : sessionState?.byId?.[sessionId];
      const sessionWorkspace =
        sessionId === undefined ? undefined : items.find((item) => (item.sessionIds ?? []).includes(sessionId));
      const activeWorkspace =
        sessionWorkspace ??
        (ui.workspaceId === undefined ? undefined : items.find((item) => item.workspaceId === ui.workspaceId));
      // Rows are derived from the Workspace list, not from conversation
      // updates: memoise so a streaming Session never re-filters them.
      const activeSessions = useMemo(
        () => sessionsOf(activeWorkspace, sessionState),
        [activeWorkspace, sessionState],
      );
      const mode = ui.mode;
      const inside = mode === 'inside';
      const running = sessionRow?.running === true || sessionStatus?.get?.(sessionId)?.running === true;

      const pageWorkspaces = useMemo(() => {
        const slice = [];
        for (let slot = 0; slot < FACES; slot += 1) {
          const abs = page * FACES + slot;
          slice.push({ slot, abs, workspace: items[abs] });
        }
        return slice;
      }, [items, page]);

      // -- Shared state kept fresh for the animation callbacks --------------

      const latest = useRef({});
      latest.current = {
        items,
        page,
        pageCount,
        mode,
        sessionId,
        activeWorkspace,
        channel,
        actions,
      };

      // -- Rotation -------------------------------------------------------

      const hostRef = useRef(null);
      const rootRef = useRef(null);
      const stageRef = useRef(null);
      const cubeRef = useRef(null);
      const rotation = useRef({ rx: INITIAL_RX, ry: INITIAL_RY });
      const snapTimer = useRef(0);
      const drag = useRef(null);
      /** Pending pointer sample + the frame that will consume it. Polling
       *  mice emit several pointermove events per display frame; writing the
       *  transform once per frame keeps the layout/paint work bounded. */
      const dragFrame = useRef(0);
      const dragSample = useRef(null);
      const [front, setFront] = useState(frontSlotOf(INITIAL_RX, INITIAL_RY));
      /** True while the cube is being dragged or snapping: faces drop to
       *  identity detail so a workspace stays recognizable without painting
       *  the session lists on every rotating face. */
      const [rotating, setRotating] = useState(false);

      const applyRotation = useCallback(() => {
        const cube = cubeRef.current;
        if (cube === null) return;
        const { rx, ry } = rotation.current;
        cube.style.transform = 'rotateX(' + rx + 'deg) rotateY(' + ry + 'deg)';
      }, []);

      useEffect(() => {
        applyRotation();
        return () => {
          window.clearTimeout(snapTimer.current);
          if (dragFrame.current !== 0) window.cancelAnimationFrame(dragFrame.current);
          dragFrame.current = 0;
        };
      }, [applyRotation]);

      // The CSS default is a 520px cube, which overflows short panels. Size the
      // cube from the panel box itself so a collapsed/expanded sidebar or a
      // laptop-height window both keep the whole cube on screen.
      useEffect(() => {
        const host = hostRef.current;
        const root = rootRef.current;
        if (host === null || root === null) return undefined;
        const fit = () => {
          const width = host.clientWidth;
          const height = host.clientHeight;
          if (width === 0 || height === 0) return;
          const base =
            latest.current.mode === 'inside'
              ? Math.min(600, width * 0.56, height * 0.8)
              : Math.min(520, width * 0.46, height * 0.55);
          const size = Math.round(clamp(base * ui.scale, 220, Math.min(width * 0.88, height * 0.86)));
          root.style.setProperty('--cube-size', size + 'px');
        };
        fit();
        if (typeof ResizeObserver !== 'function') {
          window.addEventListener('resize', fit);
          return () => window.removeEventListener('resize', fit);
        }
        const observer = new ResizeObserver(fit);
        observer.observe(host);
        return () => observer.disconnect();
      }, [mode, ui.scale]);

      const snap = useCallback(
        (targetRx, targetRy, options) => {
          const cube = cubeRef.current;
          const silent = options?.silent === true;
          rotation.current.rx = targetRx;
          rotation.current.ry = targetRy;
          if (cube !== null) {
            cube.classList.add('snap');
          }
          applyRotation();
          window.clearTimeout(snapTimer.current);
          snapTimer.current = window.setTimeout(() => {
            if (cubeRef.current !== null) cubeRef.current.classList.remove('snap');
            const slot = frontSlotOf(rotation.current.rx, rotation.current.ry);
            setFront(slot);
            setRotating(false);
            if (silent) return;
            const state = latest.current;
            if (state.mode !== 'inside') return;
            const workspace = state.items[state.page * FACES + slot];
            if (workspace === undefined) return;
            const insideCurrent =
              state.sessionId !== undefined && (workspace.sessionIds ?? []).includes(state.sessionId);
            if (insideCurrent) return;
            const last = state.channel.getSnapshot().lastSession;
            const remembered = last[workspace.workspaceId];
            const rememberedOk =
              remembered !== undefined && (workspace.sessionIds ?? []).includes(remembered);
            const target = rememberedOk ? remembered : (workspace.sessionIds ?? [])[0];
            state.channel.update({ workspaceId: workspace.workspaceId });
            if (target !== undefined) state.actions.openSession(target);
          }, SNAP_MS);
        },
        [applyRotation],
      );

      const rotateToFace = useCallback(
        (slot, options) => {
          setRotating(true);
          if (slot === 4) {
            snap(-90, Math.round(rotation.current.ry / 90) * 90, options);
            return;
          }
          if (slot === 5) {
            snap(90, Math.round(rotation.current.ry / 90) * 90, options);
            return;
          }
          snap(0, yawForSlot(slot, rotation.current.ry), options);
        },
        [snap],
      );

      // -- Drag -----------------------------------------------------------

      const onPointerDown = useCallback(
        (event) => {
          if (event.button !== 0 && event.pointerType !== 'touch') return;
          const target = event.target;
          if (!(target instanceof Element)) return;
          if (target.closest(DRAG_IGNORE) !== null) return;
          // Rotation is a cube gesture only: pressing the panel background
          // around the cube must not turn it. The conversation occupies the
          // front face and owns text selection and scrolling, so it never
          // starts a rotation (not even from its header).
          if (target.closest('.cube') === null) return;
          if (target.closest('.face-conv') !== null) return;
          window.clearTimeout(snapTimer.current);
          if (dragFrame.current !== 0) window.cancelAnimationFrame(dragFrame.current);
          dragFrame.current = 0;
          dragSample.current = null;
          if (cubeRef.current !== null) cubeRef.current.classList.remove('snap');
          channel.update({ menuOpen: false });
          setRotating(true);
          if (stageRef.current !== null) stageRef.current.classList.add('grabbing');
          drag.current = {
            pointerId: event.pointerId,
            originX: event.clientX,
            originY: event.clientY,
            rx: rotation.current.rx,
            ry: rotation.current.ry,
          };
          try {
            stageRef.current?.setPointerCapture(event.pointerId);
          } catch (error) {
            // Older engines refuse capture on non-primary pointers; dragging
            // still works while the pointer stays over the stage.
          }
        },
        [],
      );

      // Write the rotation at most once per display frame. Mouse drivers that
      // poll at 500-1000 Hz otherwise re-style and re-paint the cube several
      // times for a frame the user never sees.
      const flushDragSample = useCallback(() => {
        dragFrame.current = 0;
        const sample = dragSample.current;
        dragSample.current = null;
        const state = drag.current;
        if (sample === null || state === null || state.pointerId !== sample.pointerId) return;
        const dx = sample.clientX - state.originX;
        const dy = sample.clientY - state.originY;
        rotation.current.ry = state.ry + dx * DRAG_YAW;
        rotation.current.rx = clamp(state.rx - dy * DRAG_PITCH, -PITCH_LIMIT, PITCH_LIMIT);
        applyRotation();
      }, [applyRotation]);

      const onPointerMove = useCallback(
        (event) => {
          const state = drag.current;
          if (state === null || state.pointerId !== event.pointerId) return;
          dragSample.current = { pointerId: event.pointerId, clientX: event.clientX, clientY: event.clientY };
          if (dragFrame.current !== 0) return;
          dragFrame.current = window.requestAnimationFrame(flushDragSample);
        },
        [flushDragSample],
      );

      const onPointerUp = useCallback(
        (event) => {
          const state = drag.current;
          if (state === null || (event.pointerId !== undefined && state.pointerId !== event.pointerId)) return;
          // Consume the last sample before the snap attitude is read, so the
          // cube settles on the rotation the pointer actually reached.
          if (dragFrame.current !== 0) {
            window.cancelAnimationFrame(dragFrame.current);
            dragFrame.current = 0;
          }
          if (dragSample.current !== null) flushDragSample();
          drag.current = null;
          if (stageRef.current !== null) stageRef.current.classList.remove('grabbing');
          try {
            stageRef.current?.releasePointerCapture(state.pointerId);
          } catch (error) {
            // Capture may already be gone.
          }
          const attitude = snapAttitude(rotation.current.rx, rotation.current.ry);
          snap(attitude.rx, attitude.ry);
        },
        [snap, flushDragSample],
      );

      // -- Synchronise the cube with the selected Session ------------------

      // Selecting another Session (dropdown, sidebar, host navigation) updates
      // the face content in place. The cube only turns when the user drags it
      // or picks a Session on another face, never as a side effect of selection.

      useEffect(() => {
        if (sessionWorkspace !== undefined) channel.update({ workspaceId: sessionWorkspace.workspaceId });
      }, [sessionWorkspace?.workspaceId]);

      // -- Follow the selected Session into the cube -----------------------

      useEffect(() => {
        const state = channel.getSnapshot();
        if (sessionId !== undefined) {
          if (!state.closed && state.mode !== 'inside') channel.update({ mode: 'inside' });
          return;
        }
        if (state.mode !== 'browse' || state.closed) channel.update({ mode: 'browse', closed: false });
      }, [sessionId, channel]);

      // -- Actions --------------------------------------------------------

      const enterWorkspace = useCallback(
        (workspace, slot) => {
          if (workspace === undefined) return;
          channel.update({ mode: 'inside', closed: false, workspaceId: workspace.workspaceId });
          rotateToFace(slot);
        },
        [channel, rotateToFace],
      );

      const openFromFace = useCallback(
        (workspace, slot, targetSessionId) => {
          if (workspace === undefined) return;
          const last = channel.getSnapshot().lastSession;
          channel.update({
            mode: 'inside',
            closed: false,
            workspaceId: workspace.workspaceId,
            lastSession: { ...last, [workspace.workspaceId]: targetSessionId },
          });
          actions.openSession(targetSessionId);
          rotateToFace(slot);
        },
        [actions, channel, rotateToFace],
      );

      const newSession = useCallback(
        (workspace) => {
          const target = workspace ?? activeWorkspace;
          if (target === undefined) {
            actions.startSession();
            return;
          }
          channel.update({ mode: 'inside', closed: false, workspaceId: target.workspaceId });
          actions.startSession(target.workspaceId);
          const abs = items.indexOf(target);
          if (abs >= 0) rotateToFace(abs % FACES);
        },
        [actions, activeWorkspace, channel, items, rotateToFace],
      );

      const selectSession = useCallback(
        (nextId) => {
          const workspace = items.find((item) => (item.sessionIds ?? []).includes(nextId));
          const last = channel.getSnapshot().lastSession;
          channel.update({
            closed: false,
            mode: 'inside',
            ...(workspace === undefined
              ? {}
              : {
                  workspaceId: workspace.workspaceId,
                  lastSession: { ...last, [workspace.workspaceId]: nextId },
                }),
          });
          actions.openSession(nextId);
        },
        [actions, channel, items],
      );

      const closeConversation = useCallback(() => {
        channel.update({ mode: 'browse', closed: true, menuOpen: false });
      }, [channel]);

      // -- Header menu ----------------------------------------------------

      const menuRef = useRef(null);
      useEffect(() => {
        if (!ui.menuOpen) return undefined;
        const onDocumentPointerDown = (event) => {
          const target = event.target;
          if (target instanceof Element && target.closest('.conv-sessionline') !== null) return;
          channel.update({ menuOpen: false });
        };
        const onKeyDown = (event) => {
          if (event.key === 'Escape') channel.update({ menuOpen: false });
        };
        document.addEventListener('pointerdown', onDocumentPointerDown, true);
        document.addEventListener('keydown', onKeyDown, true);
        return () => {
          document.removeEventListener('pointerdown', onDocumentPointerDown, true);
          document.removeEventListener('keydown', onKeyDown, true);
        };
      }, [ui.menuOpen, channel]);

      // Escape leaves the cube once no menu is open.
      useEffect(() => {
        const onKeyDown = (event) => {
          if (event.key !== 'Escape') return;
          const state = channel.getSnapshot();
          if (state.menuOpen || state.dockOpen) return;
          if (state.mode === 'inside') channel.update({ mode: 'browse', closed: true });
        };
        window.addEventListener('keydown', onKeyDown);
        return () => {
          window.removeEventListener('keydown', onKeyDown);
        };
      }, [channel]);

      // -- Derived copy ---------------------------------------------------

      const pageStart = page * FACES + 1;
      const pageEnd = Math.min(items.length, page * FACES + FACES);
      const hint = inside ? t('hint.inside') : t('hint.browse');
      const frontWorkspace = items[page * FACES + front];
      const titleWorkspace = inside ? activeWorkspace ?? frontWorkspace : frontWorkspace;
      const emptyWorkspace =
        mode === 'inside' && sessionId === undefined ? activeWorkspace : undefined;

      // -- Render ---------------------------------------------------------

      const conversationBody = useMemo(
        () =>
          emptyWorkspace === undefined
            ? sessionId === undefined
              ? null
              : renderFactorySlot('conversation.content', { variant: 'embedded', phase: 'active', hero: false })
            : h(
                'div',
                { className: 'conv-empty' },
                h('p', {}, t('conv.empty')),
                h(
                  'button',
                  {
                    type: 'button',
                    className: 'ghost-btn',
                    onClick: () => {
                      actions.startSession(emptyWorkspace.workspaceId);
                    },
                  },
                  h(Icon, { name: 'plus' }),
                  t('sessions.new'),
                ),
              ),
        [emptyWorkspace, sessionId, t, actions, renderFactorySlot],
      );

      // Scrolling inside the embedded conversation must not depend on which
      // element the wheel happens to target: on GPU-composited 3D faces the
      // hit test can resolve to a sibling or the stage itself. Watch the whole
      // document in the capture phase, and when the pointer is over the cube
      // surface in inside mode, drive the conversation scrollport directly.
      // Inner vertical scrollers and zoom gestures keep their own behavior.
      useEffect(() => {
        if (typeof document === 'undefined') return undefined;
        const onWheel = (event) => {
          if (event.defaultPrevented || event.ctrlKey || event.metaKey) return;
          const root = rootRef.current;
          if (root === null || channel.getSnapshot().mode !== 'inside') return;
          const target = event.target instanceof Element ? event.target : null;
          // Floating chrome (dock, dialog, diamond) owns its own wheel input.
          if (target !== null && target.closest('.cube-ui-overlay') !== null) return;
          const stage = stageRef.current;
          if (stage !== null) {
            const rect = stage.getBoundingClientRect();
            if (
              event.clientX < rect.left ||
              event.clientX > rect.right ||
              event.clientY < rect.top ||
              event.clientY > rect.bottom
            ) {
              return;
            }
          }
          const scroller = root.querySelector('.face-conv [data-conversation-scroll]');
          if (scroller === null) return;
          const delta =
            event.deltaMode === 1
              ? event.deltaY * 16
              : event.deltaMode === 2
                ? event.deltaY * scroller.clientHeight
                : event.deltaY;
          if (delta === 0) return;
          let node = target;
          while (node !== null && node !== scroller) {
            const overflowY = window.getComputedStyle(node).overflowY;
            if ((overflowY === 'auto' || overflowY === 'scroll') && node.scrollHeight > node.clientHeight + 1) {
              const canMove = delta > 0
                ? node.scrollTop + node.clientHeight < node.scrollHeight - 1
                : node.scrollTop > 1;
              if (canMove) return;
            }
            node = node.parentElement;
          }
          const max = scroller.scrollHeight - scroller.clientHeight;
          const next = Math.max(0, Math.min(scroller.scrollTop + delta, max));
          if (next === scroller.scrollTop) return;
          scroller.scrollTop = next;
          event.preventDefault();
        };
        document.addEventListener('wheel', onWheel, { passive: false, capture: true });
        return () => document.removeEventListener('wheel', onWheel, { capture: true });
      }, [channel]);

      // The conversation is not a floating panel: it is the front face of the
      // cube. Rotating carries it out of view with that Workspace and the next
      // face brings its own Session surface in.
      const conversationPanel = useMemo(() => h(
        'div',
        { className: 'face-conv', 'data-cube-conversation': '', 'aria-label': t('conv.title') },
        h(
          'header',
          { className: 'conv-head' },
          h(
            'div',
            { className: 'conv-topline' },
            h(
              'span',
              { className: 'conv-ws' },
              h('i', { className: 'dot', 'aria-hidden': 'true' }),
              h('span', { className: 'conv-path' }, activeWorkspace?.path ?? ''),
            ),
            h(
              'button',
              {
                type: 'button',
                className: 'icon-btn',
                title: t('conv.close'),
                'aria-label': t('conv.close'),
                onClick: closeConversation,
              },
              h(Icon, { name: 'close' }),
            ),
          ),
          h(
            'div',
            { className: 'conv-sessionline', ref: menuRef },
            h(
              'button',
              {
                type: 'button',
                className: 'session-select',
                'aria-haspopup': 'listbox',
                'aria-expanded': ui.menuOpen ? 'true' : 'false',
                onClick: () => channel.update({ menuOpen: !ui.menuOpen }),
              },
              h(Icon, { name: 'list', className: 'ss-ico' }),
              h('span', { className: 'ss-label' }, sessionRow?.displayTitle ?? t('sessions.empty')),
              h(
                'span',
                { className: 'ss-status' + (running ? ' running' : '') },
                running ? t('sessions.running') : t('sessions.idle'),
              ),
              h('span', { className: 'ss-caret', 'aria-hidden': 'true' }),
            ),
            ui.menuOpen
              ? h(
                  'div',
                  { className: 'session-menu', role: 'listbox' },
                  activeSessions.map((row) =>
                    h(
                      'button',
                      {
                        key: row.id,
                        type: 'button',
                        role: 'option',
                        'aria-selected': row.id === sessionId ? 'true' : 'false',
                        className: row.id === sessionId ? 'current' : undefined,
                        onClick: () => {
                          channel.update({ menuOpen: false });
                          selectSession(row.id);
                        },
                      },
                      h('span', {}, row.displayTitle),
                      h(
                        'span',
                        { className: 'mi-meta' },
                        row.running ? t('sessions.running') : shortTime(row.updatedAt),
                      ),
                    ),
                  ),
                  h(
                    'button',
                    {
                      type: 'button',
                      className: 'mi-new',
                      onClick: () => {
                        channel.update({ menuOpen: false });
                        newSession(activeWorkspace);
                      },
                    },
                    h(Icon, { name: 'plus' }),
                    t('sessions.new'),
                  ),
                )
              : null,
          ),
        ),
        h(
          'div',
          {
            className: 'conv-body' + (sessionId === undefined ? '' : ' embedded'),
            'data-cube-conversation-body': '',
          },
          conversationBody,
        ),
      ), [
        t,
        activeWorkspace,
        closeConversation,
        ui.menuOpen,
        sessionRow,
        running,
        activeSessions,
        sessionId,
        selectSession,
        newSession,
        conversationBody,
        channel,
      ]);

      const faces = useMemo(() => pageWorkspaces.map(({ slot, abs, workspace }) => {
        const rows = sessionsOf(workspace, sessionState);
        const isFront = slot === front;
        const hosting = inside && isFront && workspace !== undefined;
        const selectedWorkspace = workspace !== undefined && workspace.workspaceId === activeWorkspace?.workspaceId;
        return h(
          'div',
          {
            key: slot,
            className:
              'face' +
              (isFront ? ' front' : '') +
              (hosting ? ' hosting' : '') +
              (selectedWorkspace ? ' selected' : ''),
            'data-slot': String(slot),
            'data-abs': String(abs),
          },
          h(
            'div',
            { className: 'face-inner' },
            h(
              'div',
              { className: 'face-head' },
              h('span', { className: 'face-idx' }, pad2(abs + 1)),
              h('h2', { className: 'face-title' }, workspace === undefined ? t('workspace.emptySlot') : workspace.title),
              h(
                'span',
                { className: 'face-summary' },
                workspace === undefined ? '' : rows.length + ' ' + t('workspace.count'),
              ),
            ),
            h(
              'div',
              { className: 'face-path' },
              workspace === undefined ? t('workspace.emptyPath') : workspace.path,
            ),
            h(
              'ul',
              { className: 'sessions' },
              workspace === undefined
                ? h('li', { className: 'face-empty' }, '—')
                : rows.length === 0
                  ? h('li', { className: 'face-empty' }, t('sessions.empty'))
                  : rows.map((row) =>
                      h(
                        'li',
                        {
                          key: row.id,
                          className: 'session' + (row.id === sessionId ? ' current' : ''),
                          role: 'button',
                          tabIndex: 0,
                          'data-sid': row.id,
                          onClick: () => openFromFace(workspace, slot, row.id),
                          onKeyDown: (event) => {
                            if (event.key === 'Enter' || event.key === ' ') {
                              event.preventDefault();
                              openFromFace(workspace, slot, row.id);
                            }
                          },
                        },
                        h('span', { className: 'stitle' }, row.displayTitle),
                        h(
                          'span',
                          { className: 'smeta' },
                          row.running ? h('i', { className: 'dot', 'aria-hidden': 'true' }) : null,
                          h('span', {}, shortTime(row.updatedAt)),
                        ),
                      ),
                    ),
            ),
            h(
              'div',
              { className: 'face-foot' },
              workspace === undefined
                ? null
                : h(
                    'button',
                    {
                      type: 'button',
                      className: 'ghost-btn',
                      onClick: () => {
                        channel.update({ mode: 'inside', closed: false, workspaceId: workspace.workspaceId });
                        rotateToFace(slot);
                        actions.startSession(workspace.workspaceId);
                      },
                    },
                    h(Icon, { name: 'plus' }),
                    t('sessions.new'),
                  ),
              h(
                'span',
                { className: 'face-count' },
                workspace === undefined ? '' : rows.length + ' ' + t('workspace.count'),
              ),
            ),
          ),
          h(
            'div',
            { className: 'face-room' },
            h('div', { className: 'room-idx' }, t('workspace.label') + ' ' + pad2(abs + 1)),
            h(
              'div',
              { className: 'room-foot' },
              h(
                'span',
                {
                  className: 'room-title',
                  role: 'button',
                  tabIndex: 0,
                  onClick: () => rotateToFace(slot),
                  onKeyDown: (event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault();
                      rotateToFace(slot);
                    }
                  },
                },
                workspace === undefined ? '' : workspace.title,
              ),
              h(
                'span',
                { className: 'room-count' },
                workspace === undefined ? '' : rows.length + ' ' + t('workspace.count'),
              ),
            ),
          ),
          hosting ? conversationPanel : null,
        );
      }), [
        pageWorkspaces,
        sessionState,
        sessionId,
        front,
        inside,
        activeWorkspace,
        t,
        conversationPanel,
        openFromFace,
        rotateToFace,
        channel,
        actions,
      ]);

      return h(
        'div',
        { className: 'cube-ui-host', style: HOST_STYLE, ref: hostRef },
        h(
          'div',
          {
            className: 'cube-ui',
            'data-mode': mode,
            'data-front': String(front),
            'data-rotating': rotating ? 'true' : undefined,
            ref: rootRef,
          },
          h(
            'main',
            {
            className: 'stage' + (inside ? ' inside' : ''),
            'data-mode': mode,
            ref: stageRef,
            onPointerDown,
            onPointerMove,
            onPointerUp,
            onPointerCancel: onPointerUp,
            onLostPointerCapture: onPointerUp,
          },
          h('div', { className: 'floor-glow', 'aria-hidden': 'true' }),
          h(
            'div',
            {
              className: 'cube-shell' + (pageCount > 1 ? ' paged' : ''),
              'aria-hidden': inside ? 'true' : undefined,
            },
            h('div', { className: 'cube', ref: cubeRef }, faces),
          ),
          ),
          h(
            'div',
            { className: 'stage-title' },
            h(
              'div',
              { className: 'st-line' },
              h('span', { className: 'st-name' }, titleWorkspace?.title ?? t('workspace.none')),
              h(
                'span',
                { className: 'st-meta' },
                titleWorkspace === undefined
                  ? ''
                  : sessionsOf(titleWorkspace, sessionState).length + ' ' + t('workspace.count'),
              ),
            ),
            inside ? h('span', { className: 'st-hint' }, t('hint.insideShort')) : null,
          ),
          h(
            'div',
            { className: 'hud' },
            pageCount > 1
              ? h(
                  'div',
                  { className: 'pager' },
                  h(
                    'button',
                    {
                      type: 'button',
                      'aria-label': t('page.prev'),
                      title: t('page.prev'),
                      onClick: () => channel.update({ page: (page - 1 + pageCount) % pageCount }),
                    },
                    h(Icon, { name: 'chevronLeft' }),
                  ),
                  h('span', {}, t('page.label', { from: pageStart, to: pageEnd, total: items.length })),
                  h(
                    'button',
                    {
                      type: 'button',
                      'aria-label': t('page.next'),
                      title: t('page.next'),
                      onClick: () => channel.update({ page: (page + 1) % pageCount }),
                    },
                    h(Icon, { name: 'chevronRight' }),
                  ),
                )
              : h('div', { className: 'pager' }, items.length > 0 ? items.length + ' ' + t('workspace.total') : ''),
            h('div', { className: 'hud-hint' }, hint),
          ),
          h(CubeChrome, { usePanelInfo, useWorkspaces, channel, actions, t }),
        ),
      );
    }

    // ---------------------------------------------------------------------
    // Overlay chrome: diamond navigation and the dock
    // ---------------------------------------------------------------------

    function CubeChrome(props) {
      const { usePanelInfo, useWorkspaces, channel, actions, t } = props;
      const panelInfo = usePanelInfo((state) => state);
      const workspaceState = useWorkspaces((state) => state);
      const ui = useChannel(channel);
      const [moreOpen, setMoreOpen] = useState(false);
      const [tip, setTip] = useState(null);
      const [diag, setDiag] = useState(null);

      // The chrome belongs to the cube surface; global panels keep their own.
      const cubeVisible = panelInfo?.activePanelId === null || panelInfo?.activePanelId === undefined;

      useEffect(() => {
        if (!moreOpen) return undefined;
        const onKeyDown = (event) => {
          if (event.key === 'Escape') setMoreOpen(false);
        };
        window.addEventListener('keydown', onKeyDown);
        return () => {
          window.removeEventListener('keydown', onKeyDown);
        };
      }, [moreOpen]);

      if (!cubeVisible) return null;

      const items = workspaceState?.items ?? [];
      const targetWorkspaceId =
        ui.workspaceId ??
        (ui.sessionId !== undefined
          ? items.find((item) => (item.sessionIds ?? []).includes(ui.sessionId))?.workspaceId
          : undefined);

      const startSession = () => {
        setMoreOpen(false);
        channel.update({
          mode: 'inside',
          closed: false,
          ...(targetWorkspaceId === undefined ? {} : { workspaceId: targetWorkspaceId }),
        });
        actions.startSession(targetWorkspaceId);
      };

      const openPanel = (panelId) => {
        setMoreOpen(false);
        actions.selectPanel(panelId);
      };

      const openDock = () => channel.update({ dockOpen: !ui.dockOpen });

      const showTip = (event, label) => {
        const rect = event.currentTarget.getBoundingClientRect();
        setTip({ label, x: rect.left - 14, y: rect.top + rect.height / 2 });
      };
      const hideTip = () => setTip(null);

      const quadrants = [
        { id: 'session', icon: 'plus', label: t('nav.session'), run: startSession },
        { id: 'plugins', icon: 'grid', label: t('nav.plugins'), run: () => openPanel('plugins') },
        { id: 'schedules', icon: 'clock', label: t('nav.schedules'), run: () => openPanel('schedules') },
        { id: 'more', icon: 'dots', label: t('nav.more'), run: () => setMoreOpen((open) => !open) },
      ];

      const setScale = (next) => {
        const value = clamp(Math.round(next * 10) / 10, SCALE_MIN, SCALE_MAX);
        writeScale(value);
        channel.update({ scale: value });
      };
      // Read the live value: repeated clicks must each build on the last one.
      const stepScale = (delta) => setScale(channel.getSnapshot().scale + delta);

      return h(
        'div',
        { className: 'cube-ui-overlay', 'data-cube-chrome': '' },
        h(
          'nav',
          { className: 'diamond', 'aria-label': t('nav.title') },
          h(
            'div',
            { className: 'diamond-shape' },
            quadrants.map((quadrant) =>
              h(
                'button',
                {
                  key: quadrant.id,
                  type: 'button',
                  className: 'dq',
                  'data-action': quadrant.id,
                  title: quadrant.label,
                  'aria-label': quadrant.label,
                  'aria-expanded': quadrant.id === 'more' ? (moreOpen ? 'true' : 'false') : undefined,
                  onClick: quadrant.run,
                  onPointerEnter: (event) => showTip(event, quadrant.label),
                  onPointerLeave: hideTip,
                  onFocus: (event) => showTip(event, quadrant.label),
                  onBlur: hideTip,
                },
                h('span', {}, h(Icon, { name: quadrant.icon })),
              ),
            ),
          ),
        ),
        tip === null
          ? null
          : h('div', { className: 'tip show', style: { left: tip.x + 'px', top: tip.y + 'px' } }, tip.label),
        moreOpen
          ? h(
              'div',
              {
                className: 'modal-backdrop',
                onClick: (event) => {
                  if (event.target === event.currentTarget) setMoreOpen(false);
                },
              },
              h(
                'div',
                { className: 'modal', role: 'dialog', 'aria-modal': 'true', 'aria-label': t('more.title') },
                h(
                  'div',
                  { className: 'modal-head' },
                  h('h2', {}, t('more.title')),
                  h(
                    'button',
                    {
                      type: 'button',
                      className: 'icon-btn',
                      'aria-label': t('more.close'),
                      title: t('more.close'),
                      onClick: () => setMoreOpen(false),
                    },
                    h(Icon, { name: 'close' }),
                  ),
                ),
                h('p', { className: 'modal-sub' }, t('more.sub')),
                h(
                  'div',
                  { className: 'modal-row' },
                  h('span', {}, t('more.settings')),
                  h('span', { className: 'mr-note' }, t('more.settingsMeta')),
                  h(
                    'button',
                    {
                      type: 'button',
                      className: 'ghost-btn',
                      onClick: () => {
                        setMoreOpen(false);
                        actions.openSettings();
                      },
                    },
                    t('more.open'),
                  ),
                ),
                h(
                  'div',
                  { className: 'modal-row' },
                  h('span', {}, t('more.plugins')),
                  h('span', { className: 'mr-note' }, t('more.pluginsMeta')),
                  h(
                    'button',
                    { type: 'button', className: 'ghost-btn', onClick: () => openPanel('plugins') },
                    t('more.open'),
                  ),
                ),
                h(
                  'div',
                  { className: 'modal-row' },
                  h('span', {}, t('more.schedules')),
                  h('span', { className: 'mr-note' }, t('more.schedulesMeta')),
                  h(
                    'button',
                    { type: 'button', className: 'ghost-btn', onClick: () => openPanel('schedules') },
                    t('more.open'),
                  ),
                ),
                h(
                  'div',
                  { className: 'modal-row' },
                  h('span', {}, t('more.diagnostics')),
                  h('span', { className: 'mr-note' }, t('more.diagnosticsMeta')),
                  h(
                    'button',
                    {
                      type: 'button',
                      className: 'ghost-btn',
                      onClick: () => {
                        try {
                          const panel = document.querySelector('.face-conv');
                          const rect = panel === null ? null : panel.getBoundingClientRect();
                          const scroller = document.querySelector('.face-conv [data-conversation-scroll]');
                          setDiag({
                            viewport: window.innerWidth + ' x ' + window.innerHeight + ' @' + window.devicePixelRatio,
                            mode: document.querySelector('.cube-ui')?.getAttribute('data-mode') ?? '?',
                            panel: rect === null ? 'なし' : Math.round(rect.width) + ' x ' + Math.round(rect.height),
                            scroller: scroller === null ? 'なし' : scroller.clientHeight + ' / ' + scroller.scrollHeight,
                            scrollTop: scroller === null ? 'なし' : Math.round(scroller.scrollTop),
                            agent: navigator.userAgent,
                          });
                        } catch (error) {
                          setDiag({ error: String(error && error.message) });
                        }
                      },
                    },
                    t('more.open'),
                  ),
                ),
                diag === null
                  ? null
                  : h(
                      'pre',
                      { className: 'modal-note', style: { whiteSpace: 'pre-wrap', wordBreak: 'break-all' } },
                      Object.entries(diag).map(([key, value]) => key + ': ' + value).join('\n'),
                    ),
                h('p', { className: 'modal-note' }, t('more.about') + ' ・ v' + VERSION),
              ),
            )
          : null,
        h(
          'div',
          { className: 'dock' + (ui.dockOpen ? ' open' : ''), 'data-cube-dock': '' },
          h(
            'div',
            {
              className: 'dock-panel',
              id: 'cube-ui-dock-panel',
              role: 'region',
              'aria-label': t('dock.title'),
            },
            h(
              'div',
              { className: 'dock-section' },
              h('h3', {}, t('dock.settingsSection')),
              h(
                'button',
                {
                  type: 'button',
                  className: 'dock-item',
                  onClick: () => {
                    channel.update({ dockOpen: false });
                    actions.openSettings();
                  },
                },
                h(Icon, { name: 'gear', className: 'di-ico' }),
                t('dock.settings'),
                h('span', { className: 'di-meta' }, t('dock.settingsMeta')),
              ),
            ),
            h(
              'div',
              { className: 'dock-section' },
              h('h3', {}, t('dock.panels')),
              h(
                'button',
                {
                  type: 'button',
                  className: 'dock-item',
                  onClick: () => {
                    channel.update({ dockOpen: false });
                    openPanel('plugins');
                  },
                },
                h(Icon, { name: 'grid', className: 'di-ico' }),
                t('dock.plugins'),
                h('span', { className: 'di-meta' }, t('dock.pluginsMeta')),
              ),
              h(
                'button',
                {
                  type: 'button',
                  className: 'dock-item',
                  onClick: () => {
                    channel.update({ dockOpen: false });
                    openPanel('schedules');
                  },
                },
                h(Icon, { name: 'clock', className: 'di-ico' }),
                t('dock.schedules'),
                h('span', { className: 'di-meta' }, t('dock.schedulesMeta')),
              ),
              h('p', { className: 'modal-note' }, t('dock.note')),
            ),
          ),
          h(
            'div',
            { className: 'size-pill', role: 'group', 'aria-label': t('size.title') },
            h(
              'button',
              {
                type: 'button',
                'aria-label': t('size.smaller'),
                title: t('size.smaller'),
                onClick: () => stepScale(-0.1),
              },
              h(Icon, { name: 'minus' }),
            ),
            h('span', { title: t('size.title') }, Math.round(ui.scale * 100) + '%'),
            h(
              'button',
              {
                type: 'button',
                'aria-label': t('size.larger'),
                title: t('size.larger'),
                onClick: () => stepScale(0.1),
              },
              h(Icon, { name: 'plus' }),
            ),
          ),
          h(
            'button',
            {
              type: 'button',
              className: 'dock-toggle',
              'aria-expanded': ui.dockOpen ? 'true' : 'false',
              'aria-controls': 'cube-ui-dock-panel',
              title: t('dock.title'),
              onClick: openDock,
            },
            h(Icon, { name: 'gear', className: 'dock-ico' }),
            h('span', { className: 'dock-label' }, t('dock.title')),
            h(Icon, { name: 'chevronUp', className: 'dock-caret' }),
          ),
        ),
      );
    }

    // ---------------------------------------------------------------------
    // Host integration
    // ---------------------------------------------------------------------

    function installStyles() {
      if (typeof document === 'undefined') return;
      if (document.querySelector('style[data-plugin-css="' + STYLE_ID + '"]') !== null) return;
      const style = document.createElement('style');
      style.dataset.plugin = '@local/dsh-cube-ui';
      style.dataset.pluginCss = STYLE_ID;
      style.textContent = STYLES;
      document.head.appendChild(style);
    }

    /** Services this plugin needs before it may apply. */
    const inject = ['slots', 'locale', 'layout', 'uiWorkspace', 'shortcuts'];

    /**
     * Open the shipped Settings modal.
     *
     * The modal is owned by the sidebar's settings store and has no public
     * opener, so the Web build is driven through its own keyboard command:
     * the effective binding is read from the shortcuts catalog and a
     * cancellable keydown is dispatched at the focused element. Desktop
     * routes keys through the native bridge and ignores synthetic events, so
     * there the dock falls back to the sidebar trigger (the collapsed rail
     * keeps it one click away).
     */
    function openSettings(ctx) {
      let code = 'Comma';
      const modifiers = new Set(['control', 'alt']);
      try {
        const rows = ctx.shortcuts?.catalog?.getSnapshot?.() ?? [];
        const row = rows.find((candidate) => candidate?.id === 'settings.open');
        const binding = row?.binding;
        if (binding !== null && binding !== undefined) {
          if (typeof binding.code === 'string') code = binding.code;
          if (Array.isArray(binding.modifiers) && binding.modifiers.length > 0) {
            modifiers.clear();
            for (const modifier of binding.modifiers) modifiers.add(modifier);
          }
        }
      } catch (error) {
        console.warn('[cube-ui] settings binding unavailable:', error);
      }
      const meta = modifiers.has('meta') || modifiers.has('primary') && /Mac|iPhone|iPad/.test(navigator.platform);
      const control = modifiers.has('control') || modifiers.has('primary') && !meta;
      const key = code === 'Comma' ? ',' : code.length === 4 && code.startsWith('Key') ? code.slice(3).toLowerCase() : code;
      let event;
      try {
        event = new KeyboardEvent('keydown', {
          code,
          key,
          ctrlKey: control,
          altKey: modifiers.has('alt'),
          shiftKey: modifiers.has('shift'),
          metaKey: meta,
          bubbles: true,
          cancelable: true,
          composed: true,
        });
      } catch (error) {
        console.warn('[cube-ui] settings shortcut could not be synthesized:', error);
        return;
      }
      const target = document.activeElement ?? document.body;
      target.dispatchEvent(event);
    }

    function apply(ctx) {
      if (typeof ctx.effect === 'function') {
        ctx.effect(() => {
          installStyles();
          return () => {
            const style = document.querySelector('style[data-plugin-css="' + STYLE_ID + '"]');
            style?.remove();
          };
        }, 'cube-ui: styles');
      } else {
        installStyles();
      }

      ctx.effect(
        () => ctx.locale.register(LOCALE_NS, LOCALE_DICTS),
        'cube-ui: dictionaries',
      );

      const channel = createChannel({
        scale: readScale(),
        mode: 'browse',
        closed: false,
        page: 0,
        workspaceId: undefined,
        sessionId: undefined,
        menuOpen: false,
        dockOpen: false,
        lastSession: {},
      });

      const actions = {
        openSession(sessionId) {
          try {
            ctx.uiWorkspace.openSession(sessionId);
          } catch (error) {
            console.warn('[cube-ui] openSession failed:', error);
          }
        },
        startSession(workspaceId) {
          try {
            ctx.uiWorkspace.startSession(workspaceId);
          } catch (error) {
            console.warn('[cube-ui] startSession failed:', error);
          }
        },
        selectPanel(panelId) {
          try {
            ctx.layout.selectPanel(panelId);
          } catch (error) {
            console.warn('[cube-ui] selectPanel failed:', error);
          }
        },
        openSettings() {
          try {
            openSettings(ctx);
          } catch (error) {
            console.warn('[cube-ui] openSettings failed:', error);
          }
        },
      };

      // The cube replaces the shipped conversation panel. The registration is
      // a later entry than the shipped one, which already shadows it; `-1`
      // states the intent explicitly. The children declaration mirrors the
      // shipped entry so the header seat stays declared for other plugins.
      ctx.slots.inject('main.conversation', () =>
        ctx.slots.register(
          {
            name: 'main.conversation',
            id: 'cube-ui-stage',
            priority: -1,
            locale: LOCALE_NS,
            inject: () => ({ channel, actions }),
          },
          CubeStage,
        ),
      );

      // The dock is opened from the diamond or by the user; mirror the session
      // the stage is showing so "new session" lands in the right Workspace.
      ctx.slots.inject('main.conversation', () =>
        ctx.effect(() => {
          const off = subscribeStageSessions(ctx, channel);
          return off;
        }, 'cube-ui: stage session mirror'),
      );

      // Default view: the left sidebar collapsed. Only the API can move it,
      // and only after the frame has mounted, so retry briefly and then act
      // once. Narrow windows use the drawer, where the same call would open it
      // — leave those alone.
      ctx.effect(() => {
        if (typeof window === 'undefined' || typeof document === 'undefined' || window.innerWidth < 1024) return;
        let tries = 0;
        let timer = 0;
        let done = false;
        const collapse = () => {
          if (done) return;
          const frame = document.querySelector('[data-sidebar-collapsed], [data-sidebar-drawer]');
          if (document.querySelector('[data-sidebar-collapsed]') !== null) {
            done = true;
            return;
          }
          if (frame === null && tries < 20) {
            tries += 1;
            timer = window.setTimeout(collapse, 100);
            return;
          }
          done = true;
          try {
            if (document.querySelector('[data-sidebar-collapsed]') === null) ctx.layout.toggleSidebar();
          } catch (error) {
            console.warn('[cube-ui] sidebar collapse failed:', error);
          }
        };
        timer = window.setTimeout(collapse, 250);
        return () => {
          window.clearTimeout(timer);
        };
      }, 'cube-ui: collapsed sidebar default');
    }

    /**
     * Mirror the host's selected Session into the shared channel so the
     * diamond's "new session" targets the same Workspace. This is a plain
     * subscription rather than a render path because the channel is consumed
     * outside this slot tree.
     */
    function subscribeStageSessions(ctx, channel) {
      const sessions = ctx.get?.('sessions');
      if (sessions?.list?.subscribe === undefined) return () => {};
      const sync = () => {
        try {
          const snapshot = sessions.list.getSnapshot();
          const observed = ctx.uiWorkspace?.selection?.getSnapshot?.() ?? {};
          const sessionId = observed?.sessionId;
          if (sessionId !== undefined && channel.getSnapshot().sessionId !== sessionId) {
            channel.update({ sessionId });
          }
        } catch (error) {
          // A service may be tearing down; nothing to mirror.
        }
      };
      const off = sessions.list.subscribe(sync);
      sync();
      return off;
    }

    return {
      inject,
      apply,
    };
  },
});
