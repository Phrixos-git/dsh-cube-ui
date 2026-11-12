// Cube UI — client half for the DeepSeek Harness Web GUI.
//
// The bundle turns the conversation surface into a cube of Workspaces:
//
//   * it shadows `main.conversation` (the shipped ConversationRoot) with a
//     stage that draws six Workspace faces on a rotatable 3D cube;
//   * dragging (or the arrow keys / the face buttons) rotates the cube with
//     a 90 degree snap; the front face is the Workspace in focus;
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
    const STYLES = "/* ==========================================================================\n   DSH Cube UI — client-plugin stylesheet\n\n   Scope\n   -----\n   Every rule is namespaced under one of the two roots the client bundle\n   renders:\n     .cube-ui          the cube stage (position:absolute; inset:0, fills the\n                       main panel; carries data-mode=\"browse\" | \"inside\")\n     .cube-ui-overlay  floating chrome (diamond, dock, size pill, dialog, tip),\n                       rendered inside .cube-ui so it shares its layer\n   There are no html / body / :root / bare `*` selectors and no host hash\n   classes here, so nothing can leak into the standard DSH UI.\n\n   Theme\n   -----\n   Colors come from the live theme tokens (--dsw-*); cube-specific values are\n   declared as --cube-* on the two roots and derived with color-mix(), so the\n   stylesheet follows both the light and the dark theme without hard-coded\n   colors (only black alpha is used for soft shadows and face shading).\n\n   Text roles\n   ----------\n   --cube-text       primary copy\n   --cube-text-dim   secondary copy and idle controls\n   --cube-text-meta  functional metadata (paths, times, counts, hints): the\n                     theme's *secondary* label, never the caption tone, and\n                     never below --cube-font-meta (12px)\n   --cube-text-caption  decorative only (face numbers); nothing a user needs\n\n   Regression guard\n   ----------------\n   Firefox software compositing double-draws text when a 3D-transformed\n   element (.face) carries box-shadow or filter: drop-shadow. Do NOT add\n   either property to .face / .face-inner / .face-room. Depth on faces comes\n   from gradients (.face::after). The floor glow is a plain 2D element, so\n   blur() there is fine.\n   ========================================================================== */\n\n/* --------------------------------------------------------------------------\n   1. Tokens\n   -------------------------------------------------------------------------- */\n\n.cube-ui,\n.cube-ui-overlay {\n  /* type scale: five steps */\n  --cube-font-caption: 11px;\n  --cube-font-meta: 12px;\n  --cube-font-body: 13px;\n  --cube-font-title: 15px;\n  --cube-font-display: 18px;\n\n  /* space (4/8px rhythm) */\n  --cube-space-1: 4px;\n  --cube-space-2: 8px;\n  --cube-space-3: 12px;\n  --cube-space-4: 16px;\n  --cube-space-5: 24px;\n\n  /* shape / motion */\n  --cube-radius-sm: 8px;\n  --cube-radius-md: 12px;\n  --cube-radius-lg: 16px;\n  --cube-radius-pill: 999px;\n  --cube-dur-fast: 120ms;\n  --cube-dur-base: 200ms;\n  --cube-dur-slow: 400ms;\n  --cube-ease: cubic-bezier(0.2, 0.9, 0.25, 1);\n\n  /* accent — follows the theme's blue business color. Accent is for fills,\n     rules and icons; text in accent misses 4.5:1 on the light theme. */\n  --cube-accent: var(--dsw-alias-state-business-primary);\n  --cube-accent-2: var(--dsw-alias-state-done-primary);\n  --cube-accent-soft: color-mix(in oklab, var(--cube-accent) 16%, transparent);\n  --cube-accent-line: color-mix(in oklab, var(--cube-accent) 42%, transparent);\n  --cube-focus: var(--dsw-focus-ring-color, var(--cube-accent));\n\n  /* surfaces */\n  --cube-surface-raised: var(--dsw-menu-surface-fill, var(--dsw-alias-bg-layer-2));\n  --cube-hover: var(--dsw-alias-interactive-bg-hover);\n  --cube-hover-active: var(--dsw-alias-interactive-bg-active);\n\n  /* borders */\n  --cube-border-soft: var(--dsw-alias-border-l1);\n  --cube-border: var(--dsw-alias-border-l2);\n  --cube-border-strong: var(--dsw-alias-border-l3);\n  --cube-border-accent: color-mix(in oklab, var(--cube-accent) 55%, transparent);\n\n  /* text */\n  --cube-text: var(--dsw-alias-label-primary);\n  --cube-text-dim: var(--dsw-alias-label-secondary);\n  --cube-text-meta: var(--dsw-alias-label-secondary);\n  --cube-text-faint: var(--dsw-alias-label-tertiary);\n  --cube-text-caption: var(--dsw-alias-label-caption);\n  --cube-text-on-accent: var(--dsw-alias-label-primary-foreground);\n\n  /* status */\n  --cube-ok: var(--dsw-alias-state-success-primary);\n  --cube-ok-soft: var(--dsw-alias-state-success-tertiary);\n\n  /* elevation / scrollbars */\n  --cube-shadow: var(--dsw-elevation-prominent, 0 0 0 0.5px var(--dsw-alias-border-l3));\n  --cube-shadow-soft: var(--dsw-elevation-panel, 0 0 0 0.5px var(--dsw-alias-border-l1));\n  --cube-scroll-thumb: var(--dsw-alias-scrollbar-bg-l1);\n  --cube-scroll-thumb-hover: var(--dsw-alias-scrollbar-hover-l1);\n\n  /* cube faces: theme layers with only a light accent tint, so the label\n     tokens keep (close to) the contrast the theme designed them for */\n  --cube-face-top: color-mix(in oklab, var(--dsw-alias-bg-layer-3) 94%, var(--cube-accent) 6%);\n  --cube-face-mid: color-mix(in oklab, var(--dsw-alias-bg-layer-2) 97%, var(--cube-accent) 3%);\n  --cube-face-bottom: var(--dsw-alias-bg-layer-1);\n  --cube-face-front-top: color-mix(in oklab, var(--dsw-alias-bg-layer-3) 90%, var(--cube-accent) 10%);\n  --cube-face-front-bottom: color-mix(in oklab, var(--dsw-alias-bg-layer-2) 96%, var(--cube-accent) 4%);\n\n  /* overlay geometry */\n  --cube-diamond-size: 124px;\n  /* Kept clear of overlay pet plugins that sit in the bottom-right corner\n     (e.g. a 210px sprite with a 28px margin). Override if yours differs. */\n  --cube-pill-right: calc(210px + 28px + 6px);\n\n  /* inherited text/style baseline for the plugin subtree */\n  color: var(--cube-text);\n  font-family: var(--dsw-font-family);\n  -webkit-font-smoothing: antialiased;\n  -webkit-tap-highlight-color: transparent;\n}\n\n/* --------------------------------------------------------------------------\n   2. Root layout\n   -------------------------------------------------------------------------- */\n\n.cube-ui {\n  /* Initial value only: the client measures the panel and sets --cube-size\n     on this element. Nothing below may redeclare it. */\n  --cube-size: 520px;\n\n  position: absolute;\n  inset: 0;\n  z-index: 21; /* above the frame overlay layer (20) so frame art never covers text */\n  overflow: hidden;\n  container-type: inline-size;\n  container-name: cube;\n}\n\n.cube-ui-host {\n  min-height: 0;\n}\n\n.cube-ui-overlay {\n  position: fixed;\n  inset: 0;\n  z-index: 40;\n  overflow: hidden;\n  pointer-events: none; /* additive layer: only explicit chrome is clickable */\n  container-type: inline-size;\n  container-name: cube;\n}\n\n.cube-ui-overlay .diamond,\n.cube-ui-overlay .dock,\n.cube-ui-overlay .modal-backdrop {\n  pointer-events: auto;\n}\n\n/* --------------------------------------------------------------------------\n   3. Basics (scoped: no global resets)\n   -------------------------------------------------------------------------- */\n\n.cube-ui,\n.cube-ui *,\n.cube-ui *::before,\n.cube-ui *::after,\n.cube-ui-overlay,\n.cube-ui-overlay *,\n.cube-ui-overlay *::before,\n.cube-ui-overlay *::after {\n  box-sizing: border-box;\n}\n\n/* :where() keeps this at element specificity, so the host's own controls in\n   the embedded conversation keep their typography. */\n:where(.cube-ui, .cube-ui-overlay) :where(button, input, textarea) {\n  font: inherit;\n}\n\n.cube-ui button:focus-visible,\n.cube-ui-overlay button:focus-visible {\n  outline: 2px solid var(--cube-focus);\n  outline-offset: 2px;\n}\n\n.cube-ui button:disabled,\n.cube-ui-overlay button:disabled {\n  cursor: default;\n}\n\n/* Pressed feedback for the cube's own controls. */\n.cube-ui :is(.ghost-btn, .primary-btn, .icon-btn, .session, .room-title, .session-select,\n  .hint-close, .face-nav button, .pager button),\n.cube-ui-overlay :is(.ghost-btn, .icon-btn, .dq, .dock-item, .dock-toggle,\n  .size-pill button, .size-inline button) {\n  transition-property: background, color, border-color, opacity, transform;\n  transition-duration: var(--cube-dur-fast);\n}\n\n.cube-ui :is(.ghost-btn, .primary-btn, .icon-btn, .session, .room-title, .session-select,\n  .hint-close, .face-nav button, .pager button):active:not(:disabled),\n.cube-ui-overlay :is(.ghost-btn, .icon-btn, .dq, .dock-item, .dock-toggle,\n  .size-pill button, .size-inline button):active:not(:disabled) {\n  opacity: 0.85;\n  transform: scale(0.97);\n}\n\n/* announced, not shown */\n.cube-ui .cube-sr-only {\n  position: absolute;\n  width: 1px;\n  height: 1px;\n  margin: -1px;\n  padding: 0;\n  overflow: hidden;\n  clip: rect(0 0 0 0);\n  clip-path: inset(50%);\n  white-space: nowrap;\n  border: 0;\n}\n\n/* icons are inline SVG from the client bundle: sm 14 / md 16 / lg 18 */\n.cube-ui .ico,\n.cube-ui-overlay .ico {\n  display: inline-flex;\n  align-items: center;\n  justify-content: center;\n  flex: none;\n}\n\n.cube-ui .ico svg,\n.cube-ui-overlay .ico svg {\n  display: block;\n  width: 16px;\n  height: 16px;\n}\n\n.cube-ui :is(.ss-ico, .pager, .face-nav, .hint-close, .ghost-btn, .primary-btn) .ico svg,\n.cube-ui .ss-ico svg,\n.cube-ui-overlay :is(.dock-caret, .size-pill, .size-inline) .ico svg,\n.cube-ui-overlay .dock-caret svg {\n  width: 14px;\n  height: 14px;\n}\n\n.cube-ui-overlay .dq .ico svg {\n  width: 18px;\n  height: 18px;\n}\n\n/* --------------------------------------------------------------------------\n   4. Stage and cube\n   -------------------------------------------------------------------------- */\n\n.cube-ui .stage {\n  position: absolute;\n  inset: 0;\n  display: grid;\n  place-items: center;\n  /* One perspective for browse. Short enough that the cube converges and\n     reads as a solid; the client sizes the cube to leave room for it. */\n  perspective: 2000px;\n  perspective-origin: 50% 44%;\n  overflow: hidden;\n  cursor: default;\n  /* Horizontal drag rotates; vertical gestures stay with the conversation's\n     scrollport on touch devices. The face buttons and arrow keys reach the\n     top/bottom faces. */\n  touch-action: pan-y;\n  user-select: none;\n}\n\n/* Rotation is a cube gesture: only the cube surface advertises drag. */\n.cube-ui .cube-shell {\n  position: relative;\n  z-index: 1;\n  width: var(--cube-size);\n  height: var(--cube-size);\n  --h: calc(var(--cube-size) / 2);\n  transform-style: preserve-3d;\n  /* Idle tilt: at rest in browse the cube shows a sliver of its top and\n     side faces, so it reads as a cube rather than a flat card. */\n  transform: rotateX(-6deg) rotateY(8deg);\n  transition: transform 0.75s var(--cube-ease);\n  border-radius: var(--cube-radius-lg);\n  cursor: grab;\n}\n\n.cube-ui .cube-shell:focus-visible {\n  outline: 2px solid var(--cube-focus);\n  outline-offset: 10px;\n}\n\n.cube-ui .stage.grabbing .cube-shell {\n  cursor: grabbing;\n}\n\n.cube-ui .cube-shell button {\n  cursor: pointer;\n}\n\n.cube-ui .floor-glow {\n  position: absolute;\n  left: 50%;\n  bottom: 6%;\n  z-index: 0;\n  width: min(820px, 72cqw);\n  height: 190px;\n  transform: translateX(-50%);\n  border-radius: 50%;\n  pointer-events: none;\n  /* 2D element, not a 3D face: blur is safe here */\n  filter: blur(22px);\n  background: radial-gradient(closest-side,\n    color-mix(in oklab, var(--cube-accent) 30%, transparent),\n    color-mix(in oklab, var(--cube-accent) 8%, transparent) 58%,\n    transparent 72%);\n  transition: opacity 0.5s;\n}\n\n.cube-ui .cube {\n  position: absolute;\n  inset: 0;\n  transform-style: preserve-3d;\n}\n\n/* keep in sync with SNAP_MS in the client */\n.cube-ui .cube.snap {\n  transition: transform 0.46s var(--cube-ease);\n}\n\n/* ---- faces ---- */\n\n.cube-ui .face {\n  position: absolute;\n  inset: 0;\n  display: flex;\n  flex-direction: column;\n  overflow: hidden;\n  border-radius: var(--cube-radius-lg);\n  border: 1px solid var(--cube-border);\n  border-top-color: var(--cube-border-strong);\n  background: linear-gradient(155deg,\n    var(--cube-face-top) 0%,\n    var(--cube-face-mid) 58%,\n    var(--cube-face-bottom) 100%);\n  transition: background 0.5s, border-color 0.3s;\n  transform: translateZ(var(--h));\n  /* Firefox: never add box-shadow / filter here (text double-draw bug). */\n}\n\n.cube-ui .face[data-slot=\"1\"] { transform: rotateY(90deg) translateZ(var(--h)); }\n.cube-ui .face[data-slot=\"2\"] { transform: rotateY(180deg) translateZ(var(--h)); }\n.cube-ui .face[data-slot=\"3\"] { transform: rotateY(-90deg) translateZ(var(--h)); }\n.cube-ui .face[data-slot=\"4\"] { transform: rotateX(90deg) translateZ(var(--h)); }\n.cube-ui .face[data-slot=\"5\"] { transform: rotateX(-90deg) translateZ(var(--h)); }\n\n/* Shading: faces turned away from the viewer are darker, so the edges of the\n   cube read even when two faces hold similar content. A gradient, not a\n   shadow (see the regression guard). */\n.cube-ui .face::after {\n  content: \"\";\n  position: absolute;\n  inset: 0;\n  z-index: 3;\n  border-radius: inherit;\n  pointer-events: none;\n  background: linear-gradient(180deg,\n    color-mix(in srgb, #000 10%, transparent),\n    color-mix(in srgb, #000 22%, transparent));\n  transition: opacity var(--cube-dur-slow);\n}\n\n.cube-ui .face.front::after {\n  opacity: 0;\n}\n\n/* the front face: accent rim and a lighter fill */\n.cube-ui .face.front {\n  border-color: var(--cube-border-accent);\n  border-top-color: color-mix(in oklab, var(--cube-accent) 80%, transparent);\n  background: linear-gradient(155deg,\n    var(--cube-face-front-top) 0%,\n    var(--cube-face-front-bottom) 100%);\n}\n\n/* --------------------------------------------------------------------------\n   5. Face content: Workspace + Session list\n   -------------------------------------------------------------------------- */\n\n.cube-ui .face-inner {\n  position: absolute;\n  inset: 0;\n  display: flex;\n  flex-direction: column;\n  gap: var(--cube-space-2);\n  padding: var(--cube-space-4);\n  transition: opacity 0.3s, visibility 0.3s;\n}\n\n.cube-ui .face-head {\n  display: flex;\n  align-items: baseline;\n  gap: var(--cube-space-2);\n  min-width: 0;\n}\n\n/* the active Workspace (the one the conversation belongs to) */\n.cube-ui .face.selected .face-head::before {\n  content: \"\";\n  align-self: stretch;\n  width: 3px;\n  flex: none;\n  border-radius: 2px;\n  background: var(--cube-accent);\n}\n\n.cube-ui .face-idx {\n  font-size: var(--cube-font-caption);\n  letter-spacing: 0.12em;\n  color: var(--cube-text-caption); /* decorative: aria-hidden */\n  font-variant-numeric: tabular-nums;\n}\n\n.cube-ui .face-title {\n  margin: 0;\n  min-width: 0;\n  font-size: var(--cube-font-title);\n  font-weight: 600;\n  letter-spacing: 0.01em;\n  white-space: nowrap;\n  overflow: hidden;\n  text-overflow: ellipsis;\n}\n\n.cube-ui .face-summary {\n  display: none; /* shown only while rotating */\n}\n\n.cube-ui .face-path {\n  margin: -2px 0 2px;\n  font-size: var(--cube-font-meta);\n  color: var(--cube-text-meta);\n  white-space: nowrap;\n  overflow: hidden;\n  text-overflow: ellipsis;\n}\n\n.cube-ui .sessions {\n  list-style: none;\n  margin: 0;\n  padding: 0;\n  flex: 1;\n  overflow: auto;\n  display: flex;\n  flex-direction: column;\n  gap: 6px;\n}\n\n.cube-ui .session-item {\n  display: block;\n}\n\n.cube-ui .session {\n  width: 100%;\n  display: flex;\n  flex-direction: column;\n  align-items: stretch;\n  gap: 3px;\n  padding: var(--cube-space-2) 10px;\n  border: 1px solid var(--cube-border-strong);\n  border-radius: 10px;\n  background: var(--cube-hover);\n  color: var(--cube-text);\n  text-align: left;\n  cursor: pointer;\n}\n\n.cube-ui .session:hover {\n  background: var(--cube-accent-soft);\n  border-color: var(--cube-border-accent);\n}\n\n/* the Session shown in the conversation */\n.cube-ui .session[aria-current=\"true\"] {\n  border-color: var(--cube-border-accent);\n  border-left: 3px solid var(--cube-accent);\n  padding-left: 8px;\n  background: var(--cube-accent-soft);\n}\n\n.cube-ui .session .stitle {\n  font-size: var(--cube-font-body);\n  line-height: 1.35;\n  white-space: nowrap;\n  overflow: hidden;\n  text-overflow: ellipsis;\n}\n\n.cube-ui .session[aria-current=\"true\"] .stitle {\n  font-weight: 600;\n}\n\n.cube-ui .session .smeta {\n  display: flex;\n  align-items: center;\n  gap: var(--cube-space-2);\n  font-size: var(--cube-font-meta);\n  color: var(--cube-text-meta);\n  font-variant-numeric: tabular-nums;\n}\n\n/* Running: a labelled badge, not a color alone. */\n.cube-ui .run-badge {\n  display: inline-flex;\n  align-items: center;\n  gap: 5px;\n  color: var(--cube-text);\n  font-weight: 500;\n}\n\n.cube-ui .dot {\n  display: inline-block;\n  flex: none;\n  width: 7px;\n  height: 7px;\n  border-radius: 50%;\n}\n\n.cube-ui .run-badge .dot {\n  background: var(--cube-ok);\n  /* a darker ring keeps the dot at 3:1 against light faces */\n  border: 1px solid color-mix(in oklab, var(--cube-ok) 55%, var(--cube-text));\n  animation: cube-pulse 1.7s ease-in-out infinite;\n}\n\n.cube-ui .face-empty {\n  flex: 1;\n  display: grid;\n  place-items: center;\n  padding: var(--cube-space-3);\n  font-size: var(--cube-font-body);\n  line-height: 1.6;\n  text-align: center;\n  color: var(--cube-text-meta);\n  border: 1px dashed var(--cube-border-strong);\n  border-radius: 10px;\n}\n\n.cube-ui .face.loading .face-title,\n.cube-ui .face.loading .face-empty {\n  color: var(--cube-text-meta);\n  animation: cube-pulse 1.6s ease-in-out infinite;\n}\n\n.cube-ui .face-foot {\n  display: flex;\n  align-items: center;\n  justify-content: space-between;\n  gap: var(--cube-space-2);\n}\n\n.cube-ui .face-count {\n  font-size: var(--cube-font-meta);\n  color: var(--cube-text-meta);\n}\n\n/* ---- face \"inside the room\" labels (inside mode, empty front face) ---- */\n\n.cube-ui .face-room {\n  position: absolute;\n  inset: 0;\n  display: flex;\n  flex-direction: column;\n  justify-content: space-between;\n  padding: 20px;\n  opacity: 0;\n  visibility: hidden;\n  transition: opacity var(--cube-dur-slow), visibility var(--cube-dur-slow);\n}\n\n.cube-ui .room-idx {\n  font-size: var(--cube-font-meta);\n  letter-spacing: 0.16em;\n  color: var(--cube-text-meta);\n}\n\n.cube-ui .room-foot {\n  display: flex;\n  align-items: flex-end;\n  justify-content: space-between;\n  gap: 10px;\n}\n\n.cube-ui .room-title {\n  padding: 0;\n  border: none;\n  background: transparent;\n  font-size: var(--cube-font-title);\n  font-weight: 600;\n  color: var(--cube-text);\n  text-align: left;\n}\n\n.cube-ui button.room-title {\n  cursor: pointer;\n}\n\n.cube-ui .room-count {\n  font-size: var(--cube-font-meta);\n  color: var(--cube-text-meta);\n}\n\n/* --------------------------------------------------------------------------\n   6. \"Inside the cube\" mode\n   -------------------------------------------------------------------------- */\n\n.cube-ui[data-mode=\"inside\"] .floor-glow {\n  opacity: 0.35;\n}\n\n/* inside rests face-on, under a long perspective that keeps the hosted\n   conversation close to its designed size */\n.cube-ui[data-mode=\"inside\"] .stage {\n  perspective: 4200px;\n}\n\n.cube-ui[data-mode=\"inside\"] .cube-shell {\n  transform: none;\n}\n\n/* the walls become glass frames with a faint grid */\n.cube-ui[data-mode=\"inside\"] .face {\n  background:\n    linear-gradient(color-mix(in oklab, var(--cube-accent) 9%, transparent) 1px,\n      transparent 1px) 0 0 / 52px 52px,\n    linear-gradient(90deg, color-mix(in oklab, var(--cube-accent) 9%, transparent) 1px,\n      transparent 1px) 0 0 / 52px 52px,\n    color-mix(in oklab, var(--dsw-alias-bg-base) 24%, transparent);\n  border-color: var(--cube-border-soft);\n  border-top-color: var(--cube-border-soft);\n}\n\n.cube-ui[data-mode=\"inside\"] .face.front {\n  border-color: color-mix(in oklab, var(--cube-accent) 34%, transparent);\n  background: color-mix(in oklab, var(--cube-accent) 5%, transparent);\n}\n\n.cube-ui[data-mode=\"inside\"] .face-inner {\n  opacity: 0;\n  visibility: hidden;\n}\n\n.cube-ui[data-mode=\"inside\"] .face.front:not(.hosting) .face-room {\n  opacity: 1;\n  visibility: visible;\n}\n\n/* --------------------------------------------------------------------------\n   7. Hosted conversation — the front face IS the Session surface\n\n   The shipped Conversation content and composer are mounted through the\n   official `conversation.content` factory in its `embedded` variant. That\n   subtree owns its scrollport and composer padding, so the seat adds neither\n   a second scroll area nor padding. Surfaces are opaque theme tokens so text\n   always reads.\n   -------------------------------------------------------------------------- */\n\n.cube-ui .face.hosting,\n.cube-ui[data-mode=\"inside\"] .face.hosting {\n  background: linear-gradient(168deg,\n    var(--dsw-alias-bg-layer-2),\n    var(--dsw-alias-bg-base));\n  border-color: var(--cube-border-strong);\n  border-top-color: var(--cube-border-accent);\n}\n\n.cube-ui .face.hosting .face-inner,\n.cube-ui .face.hosting .face-room {\n  opacity: 0;\n  visibility: hidden;\n}\n\n.cube-ui .face-conv {\n  position: absolute;\n  /* Slack around the surface: the conversation is inset from the cube wall so\n     the face keeps a visible frame. */\n  inset: 18px;\n  z-index: 2;\n  display: flex;\n  flex-direction: column;\n  border-radius: var(--cube-radius-lg);\n  cursor: default;\n  /* The conversation opts into vertical panning so touch/momentum scrolling\n     keeps working. */\n  touch-action: pan-y;\n  overscroll-behavior: contain;\n}\n\n/* The stage disables selection for rotation, but the conversation is a\n   reading surface: its text stays selectable while its chrome is not. */\n.cube-ui .face-conv,\n.cube-ui .face-conv * {\n  user-select: text;\n}\n\n.cube-ui .face-conv .conv-head,\n.cube-ui .face-conv .conv-head *,\n.cube-ui .face-conv button {\n  user-select: none;\n}\n\n.cube-ui .conv-head {\n  position: relative;\n  z-index: 2;\n  flex: none;\n  padding: var(--cube-space-2) 10px;\n  border: 1px solid var(--cube-border-strong);\n  border-bottom: 0;\n  border-radius: var(--cube-radius-md) var(--cube-radius-md) 0 0;\n  background: var(--dsw-alias-bg-layer-2);\n}\n\n.cube-ui .conv-topline {\n  display: flex;\n  align-items: center;\n  gap: var(--cube-space-2);\n  min-width: 0;\n}\n\n.cube-ui .conv-ws {\n  flex: 1 1 auto;\n  display: flex;\n  align-items: center;\n  gap: var(--cube-space-2);\n  min-width: 0;\n}\n\n.cube-ui .conv-ws .conv-path {\n  min-width: 0;\n  color: var(--cube-text-meta);\n  font-size: var(--cube-font-meta);\n  white-space: nowrap;\n  overflow: hidden;\n  text-overflow: ellipsis;\n}\n\n.cube-ui .conv-ws .dot {\n  width: 6px;\n  height: 6px;\n  background: var(--cube-accent);\n}\n\n.cube-ui .conv-nav {\n  flex: none;\n  display: flex;\n  align-items: center;\n  gap: 2px;\n}\n\n.cube-ui .icon-btn,\n.cube-ui-overlay .icon-btn {\n  flex: none;\n  width: 28px;\n  height: 28px;\n  display: grid;\n  place-items: center;\n  padding: 0;\n  border: 1px solid transparent;\n  border-radius: var(--cube-radius-sm);\n  background: transparent;\n  color: var(--cube-text-dim);\n  cursor: pointer;\n}\n\n.cube-ui .icon-btn:hover,\n.cube-ui-overlay .icon-btn:hover {\n  background: var(--cube-hover-active);\n  color: var(--cube-text);\n}\n\n.cube-ui .conv-sessionline {\n  position: relative;\n  margin-top: var(--cube-space-2);\n}\n\n.cube-ui .session-select {\n  width: 100%;\n  display: flex;\n  align-items: center;\n  gap: var(--cube-space-2);\n  padding: var(--cube-space-2) var(--cube-space-3);\n  border: 1px solid var(--cube-border-strong);\n  border-radius: 11px;\n  background: var(--cube-hover);\n  color: var(--cube-text);\n  font-size: var(--cube-font-body);\n  text-align: left;\n  cursor: pointer;\n}\n\n.cube-ui .session-select:hover {\n  border-color: var(--cube-border-accent);\n  background: var(--cube-accent-soft);\n}\n\n.cube-ui .ss-ico {\n  color: var(--cube-text-dim);\n}\n\n.cube-ui .ss-label {\n  flex: 1;\n  min-width: 0;\n  white-space: nowrap;\n  overflow: hidden;\n  text-overflow: ellipsis;\n}\n\n.cube-ui .ss-status {\n  flex: none;\n  display: inline-flex;\n  align-items: center;\n  gap: 5px;\n  padding: 2px var(--cube-space-2);\n  border: 1px solid var(--cube-border-strong);\n  border-radius: var(--cube-radius-pill);\n  color: var(--cube-text-dim);\n  font-size: var(--cube-font-meta);\n}\n\n.cube-ui .ss-status.running {\n  color: var(--cube-text);\n  border-color: color-mix(in oklab, var(--cube-ok) 65%, transparent);\n  background: var(--cube-ok-soft);\n}\n\n.cube-ui .ss-status.running::before {\n  content: \"\";\n  width: 7px;\n  height: 7px;\n  border-radius: 50%;\n  background: var(--cube-ok);\n  border: 1px solid color-mix(in oklab, var(--cube-ok) 55%, var(--cube-text));\n}\n\n.cube-ui .ss-caret {\n  flex: none;\n  width: 0;\n  height: 0;\n  border-left: 4px solid transparent;\n  border-right: 4px solid transparent;\n  border-top: 5px solid var(--cube-text-dim);\n  transition: transform var(--cube-dur-base);\n}\n\n.cube-ui .session-select[aria-expanded=\"true\"] .ss-caret {\n  transform: rotate(180deg);\n}\n\n/* The client clamps max-height to the room left inside the face, and flips\n   the menu upward (.up) when there is more room above. */\n.cube-ui .session-menu {\n  position: absolute;\n  left: 0;\n  right: 0;\n  top: calc(100% + 6px);\n  z-index: 10;\n  max-height: 258px;\n  overflow: auto;\n  padding: 6px;\n  border: 1px solid var(--cube-border-strong);\n  border-radius: 13px;\n  background: var(--cube-surface-raised);\n  box-shadow: var(--cube-shadow);\n  backdrop-filter: blur(20px);\n  -webkit-backdrop-filter: blur(20px);\n}\n\n.cube-ui .session-menu.up {\n  top: auto;\n  bottom: calc(100% + 6px);\n}\n\n.cube-ui .session-menu button {\n  width: 100%;\n  display: flex;\n  align-items: center;\n  gap: var(--cube-space-2);\n  padding: var(--cube-space-2) 10px;\n  border: 1px solid transparent;\n  border-radius: 9px;\n  background: transparent;\n  color: var(--cube-text);\n  font-size: var(--cube-font-body);\n  text-align: left;\n  cursor: pointer;\n}\n\n.cube-ui .session-menu button:hover,\n.cube-ui .session-menu button:focus-visible {\n  background: var(--cube-hover-active);\n}\n\n.cube-ui .session-menu button.current {\n  background: var(--cube-accent-soft);\n  border-color: var(--cube-border-accent);\n  font-weight: 600;\n}\n\n.cube-ui .session-menu .mi-title {\n  min-width: 0;\n  overflow: hidden;\n  text-overflow: ellipsis;\n  white-space: nowrap;\n}\n\n.cube-ui .session-menu .mi-meta {\n  margin-left: auto;\n  flex: none;\n  font-size: var(--cube-font-meta);\n  font-weight: 400;\n  color: var(--cube-text-meta);\n}\n\n.cube-ui .session-menu .mi-meta.running {\n  color: var(--cube-text);\n}\n\n.cube-ui .session-menu .mi-new {\n  margin-top: var(--cube-space-1);\n  border-top-color: var(--cube-border-soft);\n  border-radius: 0 0 9px 9px;\n  color: var(--cube-text);\n  font-weight: 600;\n}\n\n.cube-ui .session-menu .mi-new .ico {\n  color: var(--cube-accent);\n}\n\n.cube-ui .conv-body {\n  flex: 1 1 auto;\n  min-height: 0;\n  overflow: auto;\n  display: flex;\n  flex-direction: column;\n  padding: 10px;\n  border: 1px solid var(--cube-border-strong);\n  border-top: 0;\n  border-radius: 0 0 var(--cube-radius-md) var(--cube-radius-md);\n  background: var(--dsw-alias-bg-base);\n}\n\n.cube-ui .conv-body.embedded {\n  overflow: hidden;\n  padding: 0 2px 2px;\n}\n\n.cube-ui .conv-body.embedded > [data-conversation-content] {\n  flex: 1 1 auto;\n  min-height: 0;\n  height: 100%;\n}\n\n.cube-ui .conv-empty {\n  margin: auto;\n  text-align: center;\n  color: var(--cube-text-dim);\n  font-size: var(--cube-font-body);\n  line-height: 1.8;\n}\n\n.cube-ui .conv-empty p {\n  margin: 0 0 var(--cube-space-3);\n}\n\n/* --------------------------------------------------------------------------\n   8. Workspace identity (top-left)\n   -------------------------------------------------------------------------- */\n\n.cube-ui .stage-title {\n  position: absolute;\n  top: 14px;\n  left: 18px;\n  z-index: 5;\n  display: flex;\n  flex-direction: column;\n  align-items: flex-start;\n  gap: 2px;\n  max-width: 46cqw;\n  pointer-events: none;\n}\n\n.cube-ui .st-line {\n  display: flex;\n  align-items: baseline;\n  gap: var(--cube-space-2);\n  max-width: 100%;\n  min-width: 0;\n}\n\n.cube-ui .st-name {\n  overflow: hidden;\n  text-overflow: ellipsis;\n  white-space: nowrap;\n  font-size: var(--cube-font-body);\n  font-weight: 600;\n  letter-spacing: 0.01em;\n  color: var(--cube-text);\n}\n\n.cube-ui .st-meta,\n.cube-ui .st-hint {\n  flex: none;\n  font-size: var(--cube-font-meta);\n  color: var(--cube-text-meta);\n}\n\n/* --------------------------------------------------------------------------\n   9. HUD: face buttons, pager, hint\n   -------------------------------------------------------------------------- */\n\n.cube-ui .hud {\n  position: absolute;\n  left: 50%;\n  bottom: 16px;\n  transform: translateX(-50%);\n  z-index: 4;\n  display: flex;\n  flex-direction: column;\n  align-items: center;\n  gap: var(--cube-space-2);\n  width: max-content;\n  max-width: calc(100% - 32px);\n  pointer-events: none;\n}\n\n.cube-ui .hud > *,\n.cube-ui .hud-row > * {\n  pointer-events: auto;\n}\n\n/* Inside the cube the conversation owns the bottom of the surface; its\n   header carries the face buttons and the pager instead. */\n.cube-ui[data-mode=\"inside\"] .hud {\n  display: none;\n}\n\n.cube-ui .hud-row {\n  display: flex;\n  flex-wrap: wrap;\n  justify-content: center;\n  align-items: center;\n  gap: var(--cube-space-2);\n}\n\n/* pill surfaces sit on a scrim so they read over any frame art */\n.cube-ui .face-nav,\n.cube-ui .pager,\n.cube-ui .hud-hint {\n  display: flex;\n  align-items: center;\n  gap: 2px;\n  padding: 3px 5px;\n  border: 1px solid var(--cube-border-strong);\n  border-radius: var(--cube-radius-pill);\n  background: color-mix(in oklab, var(--dsw-alias-bg-layer-2) 88%, transparent);\n  backdrop-filter: blur(14px);\n  -webkit-backdrop-filter: blur(14px);\n}\n\n.cube-ui .face-nav button,\n.cube-ui .pager button,\n.cube-ui .hint-close {\n  width: 28px;\n  height: 28px;\n  display: grid;\n  place-items: center;\n  padding: 0;\n  border: none;\n  border-radius: 50%;\n  background: transparent;\n  color: var(--cube-text-dim);\n  cursor: pointer;\n}\n\n.cube-ui .face-nav button:hover,\n.cube-ui .pager button:hover:not(:disabled),\n.cube-ui .hint-close:hover {\n  background: var(--cube-hover-active);\n  color: var(--cube-text);\n}\n\n.cube-ui .pager button:disabled {\n  opacity: 0.4;\n}\n\n.cube-ui .face-nav-label,\n.cube-ui .pager > span {\n  padding: 0 6px;\n  font-size: var(--cube-font-meta);\n  color: var(--cube-text-dim);\n  letter-spacing: 0.02em;\n  font-variant-numeric: tabular-nums;\n  white-space: nowrap;\n}\n\n/* the compact pager in the conversation header */\n.cube-ui .pager.compact {\n  padding: 0 2px;\n  border-color: var(--cube-border);\n  background: transparent;\n  backdrop-filter: none;\n  -webkit-backdrop-filter: none;\n}\n\n.cube-ui .pager.compact button {\n  width: 24px;\n  height: 24px;\n}\n\n.cube-ui .hud-hint {\n  gap: 6px;\n  padding: 3px 4px 3px 14px;\n  font-size: var(--cube-font-body);\n  color: var(--cube-text-meta);\n  text-align: center;\n}\n\n.cube-ui .hint-close {\n  width: 24px;\n  height: 24px;\n}\n\n/* --------------------------------------------------------------------------\n   10. First-run guide, toast, load error\n   -------------------------------------------------------------------------- */\n\n.cube-ui .coach {\n  position: absolute;\n  top: 14px;\n  left: 50%;\n  z-index: 6;\n  width: min(360px, calc(100% - 32px));\n  transform: translateX(-50%);\n  padding: var(--cube-space-4);\n  border: 1px solid var(--cube-border-accent);\n  border-top: 3px solid var(--cube-accent);\n  border-radius: var(--cube-radius-lg);\n  background: var(--cube-surface-raised);\n  box-shadow: var(--cube-shadow),\n    0 18px 48px -20px color-mix(in srgb, #000 22%, transparent);\n  animation: cube-coach-in 0.24s var(--cube-ease);\n}\n\n.cube-ui .coach-step {\n  margin: 0 0 var(--cube-space-1);\n  font-size: var(--cube-font-meta);\n  color: var(--cube-text-meta);\n}\n\n.cube-ui .coach h2 {\n  margin: 0 0 6px;\n  font-size: var(--cube-font-title);\n  font-weight: 600;\n}\n\n.cube-ui .coach-body {\n  margin: 0 0 var(--cube-space-3);\n  font-size: var(--cube-font-body);\n  line-height: 1.65;\n  color: var(--cube-text-dim);\n}\n\n.cube-ui .coach-actions {\n  display: flex;\n  justify-content: flex-end;\n  gap: var(--cube-space-2);\n}\n\n.cube-ui .cube-toast {\n  position: absolute;\n  left: 50%;\n  top: 56px;\n  z-index: 7;\n  max-width: calc(100% - 32px);\n  transform: translateX(-50%);\n  padding: var(--cube-space-2) var(--cube-space-4);\n  border: 1px solid var(--cube-border-strong);\n  border-radius: var(--cube-radius-pill);\n  background: var(--dsw-alias-tooltip-bg);\n  color: var(--dsw-alias-toast-label);\n  font-size: var(--cube-font-body);\n  animation: cube-dock-in 0.2s var(--cube-ease);\n}\n\n.cube-ui .stage-error {\n  position: absolute;\n  z-index: 3;\n  display: flex;\n  flex-direction: column;\n  align-items: center;\n  gap: var(--cube-space-3);\n  padding: var(--cube-space-5);\n  border: 1px solid var(--cube-border-strong);\n  border-radius: var(--cube-radius-lg);\n  background: var(--cube-surface-raised);\n  font-size: var(--cube-font-body);\n  text-align: center;\n}\n\n.cube-ui .stage-error p {\n  margin: 0;\n  color: var(--dsw-alias-state-error-primary, var(--cube-text));\n}\n\n/* --------------------------------------------------------------------------\n   11. Buttons\n   -------------------------------------------------------------------------- */\n\n.cube-ui .ghost-btn,\n.cube-ui-overlay .ghost-btn,\n.cube-ui .primary-btn {\n  display: inline-flex;\n  align-items: center;\n  gap: 6px;\n  min-height: 30px;\n  padding: 6px var(--cube-space-3);\n  border-radius: 9px;\n  font-size: var(--cube-font-body);\n  cursor: pointer;\n}\n\n.cube-ui .ghost-btn,\n.cube-ui-overlay .ghost-btn {\n  border: 1px solid var(--cube-border-strong);\n  background: var(--cube-hover);\n  color: var(--cube-text);\n}\n\n.cube-ui .ghost-btn:hover:not(:disabled),\n.cube-ui-overlay .ghost-btn:hover:not(:disabled) {\n  background: var(--cube-accent-soft);\n  border-color: var(--cube-border-accent);\n}\n\n.cube-ui-overlay .ghost-btn:disabled {\n  opacity: 0.5;\n}\n\n/* the one strong action per surface: \"+ new session\" */\n.cube-ui .primary-btn {\n  border: 1px solid var(--cube-accent);\n  background: var(--dsw-alias-button-info-fill, var(--cube-accent));\n  color: var(--cube-text-on-accent);\n  font-weight: 600;\n}\n\n.cube-ui .primary-btn:hover {\n  background: var(--dsw-alias-button-info-hover, var(--cube-accent));\n}\n\n/* --------------------------------------------------------------------------\n   12. Rotating: faces drop to identity detail\n\n   While the cube is dragged or snapping, every face shows only what is needed\n   to recognize the Workspace (title + session count); lists, paths and the\n   embedded conversation return when the cube settles. The face number stays\n   in its corner so nothing jumps when the cube stops.\n   -------------------------------------------------------------------------- */\n\n.cube-ui[data-rotating=\"true\"] .face .face-path,\n.cube-ui[data-rotating=\"true\"] .face .sessions,\n.cube-ui[data-rotating=\"true\"] .face .face-foot,\n.cube-ui[data-rotating=\"true\"] .face .face-room,\n.cube-ui[data-rotating=\"true\"] .face .face-conv {\n  display: none;\n}\n\n.cube-ui[data-rotating=\"true\"] .face .face-inner {\n  justify-content: center;\n  align-items: center;\n  gap: var(--cube-space-1);\n  text-align: center;\n  opacity: 1;\n  visibility: visible;\n  pointer-events: none;\n}\n\n.cube-ui[data-rotating=\"true\"] .face .face-head {\n  flex-direction: column;\n  align-items: center;\n  gap: 2px;\n}\n\n.cube-ui[data-rotating=\"true\"] .face .face-idx {\n  position: absolute;\n  top: var(--cube-space-4);\n  left: var(--cube-space-4);\n}\n\n.cube-ui[data-rotating=\"true\"] .face .face-title {\n  font-size: var(--cube-font-display);\n  white-space: normal;\n  overflow: visible;\n}\n\n.cube-ui[data-rotating=\"true\"] .face .face-summary {\n  display: block;\n  font-size: var(--cube-font-meta);\n  color: var(--cube-text-meta);\n}\n\n/* --------------------------------------------------------------------------\n   13. Overlay: diamond navigation (top-right)\n\n   The square is turned 45deg, so its bounding box is size * sqrt(2). The\n   offset keeps the corners (size * 0.2071 past each edge) inside the frame.\n   -------------------------------------------------------------------------- */\n\n.cube-ui-overlay .diamond {\n  position: fixed;\n  top: calc(var(--cube-diamond-size) * 0.2071 + 14px);\n  right: calc(var(--cube-diamond-size) * 0.2071 + 14px);\n  width: var(--cube-diamond-size);\n  height: var(--cube-diamond-size);\n  z-index: 5;\n}\n\n.cube-ui-overlay .diamond-shape {\n  position: absolute;\n  inset: 0;\n  display: grid;\n  grid-template-columns: 1fr 1fr;\n  grid-template-rows: 1fr 1fr;\n  gap: 2px;\n  transform: rotate(45deg);\n  border-radius: 13px;\n  overflow: hidden;\n  border: 1px solid var(--cube-border-strong);\n  box-shadow: var(--cube-shadow),\n    0 14px 34px -18px color-mix(in srgb, #000 22%, transparent);\n  background: var(--cube-border);\n}\n\n.cube-ui-overlay .dq {\n  display: grid;\n  place-items: center;\n  padding: 0;\n  border: none;\n  background: var(--dsw-alias-bg-layer-2);\n  color: var(--cube-text-dim);\n  cursor: pointer;\n}\n\n/* primary quadrant: new session */\n.cube-ui-overlay .dq[data-action=\"session\"] {\n  background: color-mix(in oklab, var(--cube-accent) 20%, var(--dsw-alias-bg-layer-2));\n  color: var(--cube-text);\n}\n\n.cube-ui-overlay .dq > span {\n  display: block;\n  transform: rotate(-45deg);\n  line-height: 1;\n}\n\n.cube-ui-overlay .dq:hover,\n.cube-ui-overlay .dq:focus-visible {\n  background: linear-gradient(150deg,\n    color-mix(in oklab, var(--cube-accent) 34%, transparent),\n    color-mix(in oklab, var(--cube-accent-2) 26%, transparent));\n  color: var(--cube-text);\n}\n\n.cube-ui-overlay .dq:focus-visible {\n  outline-offset: -4px;\n}\n\n.cube-ui-overlay .tip {\n  position: fixed;\n  z-index: 20;\n  padding: 6px 10px;\n  border-radius: var(--cube-radius-sm);\n  border: 1px solid var(--cube-border-strong);\n  background: var(--dsw-alias-tooltip-bg);\n  color: var(--dsw-alias-toast-label);\n  font-size: var(--cube-font-meta);\n  white-space: nowrap;\n  pointer-events: none;\n  opacity: 0;\n  transform: translate(-100%, -50%);\n  transition: opacity 0.15s;\n}\n\n.cube-ui-overlay .tip.show {\n  opacity: 1;\n}\n\n/* --------------------------------------------------------------------------\n   14. Overlay: dock (settings / plugin launcher, bottom-left) + size pill\n   -------------------------------------------------------------------------- */\n\n.cube-ui-overlay .dock {\n  position: fixed;\n  left: 72px; /* clear of the collapsed standard sidebar rail */\n  bottom: 16px;\n  z-index: 6;\n  display: flex;\n  flex-direction: column;\n  gap: 10px;\n  align-items: flex-start;\n}\n\n.cube-ui-overlay .dock-panel {\n  width: 268px;\n  max-height: min(430px, 54vh);\n  overflow: auto;\n  padding: var(--cube-space-3);\n  border: 1px solid var(--cube-border-strong);\n  border-radius: var(--cube-radius-lg);\n  background: var(--cube-surface-raised);\n  box-shadow: var(--cube-shadow),\n    0 18px 48px -20px color-mix(in srgb, #000 22%, transparent);\n  backdrop-filter: blur(18px);\n  -webkit-backdrop-filter: blur(18px);\n  display: none;\n}\n\n.cube-ui-overlay .dock.open .dock-panel {\n  display: block;\n  animation: cube-dock-in 0.22s var(--cube-ease);\n}\n\n.cube-ui-overlay .dock-section + .dock-section {\n  margin-top: var(--cube-space-3);\n  padding-top: var(--cube-space-3);\n  border-top: 1px solid var(--cube-border-soft);\n}\n\n.cube-ui-overlay .dock-section h3 {\n  margin: 0 0 var(--cube-space-2);\n  font-size: var(--cube-font-caption);\n  font-weight: 600;\n  letter-spacing: 0.12em;\n  text-transform: uppercase;\n  color: var(--cube-text-meta);\n}\n\n.cube-ui-overlay .dock-item {\n  width: 100%;\n  display: flex;\n  align-items: center;\n  gap: 9px;\n  padding: 9px 10px;\n  border: 1px solid transparent;\n  border-radius: 9px;\n  background: transparent;\n  color: var(--cube-text);\n  font-size: var(--cube-font-body);\n  text-align: left;\n  cursor: pointer;\n}\n\n.cube-ui-overlay .dock-item:hover:not(:disabled) {\n  background: var(--cube-hover);\n  border-color: var(--cube-border);\n}\n\n.cube-ui-overlay .dock-item:disabled {\n  color: var(--cube-text-dim);\n}\n\n.cube-ui-overlay .dock-item .di-ico {\n  color: var(--cube-text-dim);\n}\n\n.cube-ui-overlay .dock-item .di-meta {\n  margin-left: auto;\n  font-size: var(--cube-font-meta);\n  color: var(--cube-text-meta);\n  text-align: right;\n}\n\n.cube-ui-overlay .dock-toggle {\n  display: flex;\n  align-items: center;\n  gap: 9px;\n  min-height: 36px;\n  padding: var(--cube-space-2) 14px var(--cube-space-2) 11px;\n  border: 1px solid var(--cube-border-strong);\n  border-radius: var(--cube-radius-pill);\n  background: color-mix(in oklab, var(--dsw-alias-bg-layer-2) 88%, transparent);\n  color: var(--cube-text);\n  font-size: var(--cube-font-body);\n  cursor: pointer;\n  box-shadow: var(--cube-shadow-soft);\n  backdrop-filter: blur(14px);\n  -webkit-backdrop-filter: blur(14px);\n}\n\n.cube-ui-overlay .dock-toggle:hover {\n  border-color: var(--cube-border-accent);\n  background: color-mix(in oklab, var(--dsw-alias-bg-layer-2) 96%, transparent);\n}\n\n.cube-ui-overlay .dock-toggle .dock-caret {\n  color: var(--cube-text-dim);\n  transition: transform 0.25s;\n}\n\n.cube-ui-overlay .dock.open .dock-toggle .dock-caret {\n  transform: rotate(180deg);\n}\n\n.cube-ui-overlay .size-pill,\n.cube-ui-overlay .size-inline {\n  display: flex;\n  align-items: center;\n  gap: 2px;\n  padding: 3px 5px;\n  border: 1px solid var(--cube-border-strong);\n  border-radius: var(--cube-radius-pill);\n  background: var(--cube-surface-raised);\n}\n\n.cube-ui-overlay .size-pill {\n  position: fixed;\n  right: var(--cube-pill-right);\n  bottom: 18px;\n  z-index: 6;\n  backdrop-filter: blur(18px);\n  -webkit-backdrop-filter: blur(18px);\n}\n\n.cube-ui-overlay .size-inline {\n  flex: none;\n}\n\n.cube-ui-overlay .size-pill button,\n.cube-ui-overlay .size-inline button {\n  display: grid;\n  place-items: center;\n  min-width: 28px;\n  height: 28px;\n  padding: 0;\n  border: none;\n  border-radius: var(--cube-radius-pill);\n  background: transparent;\n  color: var(--cube-text-dim);\n  cursor: pointer;\n}\n\n.cube-ui-overlay .size-pill button:hover:not(:disabled),\n.cube-ui-overlay .size-inline button:hover:not(:disabled) {\n  background: var(--cube-hover-active);\n  color: var(--cube-text);\n}\n\n.cube-ui-overlay .size-pill button:disabled,\n.cube-ui-overlay .size-inline button:disabled {\n  opacity: 0.4;\n}\n\n.cube-ui-overlay :is(.size-pill, .size-inline) .size-value {\n  min-width: 3.6em;\n  padding: 0 6px;\n  font-size: var(--cube-font-meta);\n  letter-spacing: 0.02em;\n  font-variant-numeric: tabular-nums;\n}\n\n/* --------------------------------------------------------------------------\n   15. Overlay: dialog (\"more\")\n   -------------------------------------------------------------------------- */\n\n.cube-ui-overlay .modal-backdrop {\n  position: fixed;\n  inset: 0;\n  z-index: 8;\n  display: grid;\n  place-items: center;\n  padding: var(--cube-space-5);\n  background: var(--dsw-alias-bg-mask-1);\n  backdrop-filter: blur(5px);\n  -webkit-backdrop-filter: blur(5px);\n}\n\n.cube-ui-overlay .modal {\n  width: min(560px, 100%);\n  max-height: min(84vh, 760px);\n  overflow: auto;\n  border: 1px solid var(--cube-border-strong);\n  border-radius: 20px;\n  background: linear-gradient(168deg,\n    var(--dsw-alias-bg-layer-2),\n    var(--dsw-alias-bg-layer-1));\n  box-shadow: var(--cube-shadow),\n    0 22px 60px -24px color-mix(in srgb, #000 26%, transparent);\n  padding: 20px 22px 22px;\n  animation: cube-modal-in 0.22s var(--cube-ease);\n}\n\n.cube-ui-overlay .modal-head {\n  display: flex;\n  align-items: flex-start;\n  gap: 10px;\n  margin-bottom: 6px;\n}\n\n.cube-ui-overlay .modal-head h2 {\n  margin: 0;\n  flex: 1;\n  font-size: var(--cube-font-title);\n  font-weight: 600;\n}\n\n.cube-ui-overlay .modal-sub {\n  margin: 0 0 var(--cube-space-4);\n  font-size: var(--cube-font-body);\n  color: var(--cube-text-meta);\n  line-height: 1.7;\n}\n\n.cube-ui-overlay .modal-row {\n  display: flex;\n  align-items: center;\n  gap: var(--cube-space-3);\n  padding: 10px var(--cube-space-3);\n  margin-bottom: var(--cube-space-2);\n  border: 1px solid var(--cube-border);\n  border-radius: var(--cube-radius-md);\n  background: var(--cube-hover);\n}\n\n.cube-ui-overlay .mr-text {\n  flex: 1;\n  min-width: 0;\n  display: flex;\n  flex-direction: column;\n  gap: 2px;\n}\n\n.cube-ui-overlay .mr-name {\n  font-size: var(--cube-font-body);\n  font-weight: 500;\n}\n\n.cube-ui-overlay .mr-note {\n  font-size: var(--cube-font-meta);\n  color: var(--cube-text-meta);\n}\n\n.cube-ui-overlay .modal-note {\n  margin: var(--cube-space-3) 0 0;\n  padding: 10px var(--cube-space-3);\n  border-left: 2px solid color-mix(in oklab, var(--cube-accent) 50%, transparent);\n  border-radius: 0 var(--cube-radius-sm) var(--cube-radius-sm) 0;\n  background: color-mix(in oklab, var(--cube-accent) 6%, transparent);\n  font-size: var(--cube-font-meta);\n  line-height: 1.7;\n  color: var(--cube-text-dim);\n}\n\n.cube-ui-overlay .modal-note.diag {\n  white-space: pre-wrap;\n  word-break: break-all;\n  font-family: var(--dsw-font-family-mono, ui-monospace, monospace);\n}\n\n/* --------------------------------------------------------------------------\n   16. Composer: agent-preset (mode) control\n\n   The shipped UI offers the agent preset only on the New Session screen, which\n   the cube never shows (\"new session\" opens the conversation directly). This\n   entry sits in the composer tool row immediately to the right of the\n   permission control. A Session keeps its preset once its first turn has run,\n   so the trigger is disabled after that and its tooltip says why.\n   -------------------------------------------------------------------------- */\n\n.cube-ui .cube-mode {\n  position: relative;\n  display: inline-flex;\n  min-width: 0;\n}\n\n.cube-ui .cube-mode-trigger {\n  display: inline-flex;\n  align-items: center;\n  gap: 5px;\n  max-width: 198px;\n  height: 28px;\n  padding: 0 6px;\n  border: none;\n  border-radius: var(--cube-radius-sm);\n  background: transparent;\n  color: var(--cube-text-dim);\n  font: inherit;\n  font-size: var(--cube-font-body);\n  line-height: 20px;\n  white-space: nowrap;\n  cursor: pointer;\n}\n\n.cube-ui .cube-mode-trigger:hover:not(:disabled),\n.cube-ui .cube-mode.open .cube-mode-trigger {\n  background: var(--cube-hover);\n  color: var(--cube-text);\n}\n\n.cube-ui .cube-mode-trigger:disabled {\n  color: var(--cube-text-faint);\n}\n\n.cube-ui .cube-mode-trigger .ico svg,\n.cube-ui .cube-mode-caret svg,\n.cube-ui .cube-mode-check svg {\n  width: 14px;\n  height: 14px;\n}\n\n.cube-ui .cube-mode-caret { color: var(--cube-text-dim); }\n\n.cube-ui .cube-mode-text {\n  min-width: 0;\n  overflow: hidden;\n  text-overflow: ellipsis;\n}\n\n/* The menu opens upward inside the face: the composer sits at its bottom\n   edge. The client clamps width/left/max-height to the face. */\n.cube-ui .cube-mode-menu {\n  position: absolute;\n  bottom: calc(100% + 6px);\n  left: 0;\n  z-index: 12;\n  width: 252px;\n  max-height: 232px;\n  overflow: auto;\n  padding: 6px;\n  border: 1px solid var(--cube-border-strong);\n  border-radius: var(--cube-radius-md);\n  background: var(--cube-surface-raised);\n  box-shadow: var(--cube-shadow);\n  scrollbar-width: thin;\n  scrollbar-color: var(--cube-scroll-thumb) transparent;\n}\n\n.cube-ui .cube-mode-item {\n  display: block;\n  width: 100%;\n  padding: 7px 9px;\n  border: 1px solid transparent;\n  border-radius: var(--cube-radius-sm);\n  background: transparent;\n  color: var(--cube-text);\n  font: inherit;\n  font-size: var(--cube-font-body);\n  line-height: 18px;\n  text-align: left;\n  cursor: pointer;\n}\n\n.cube-ui .cube-mode-item:hover:not(:disabled),\n.cube-ui .cube-mode-item:focus-visible {\n  background: var(--cube-hover-active);\n}\n\n.cube-ui .cube-mode-item.current {\n  background: var(--cube-accent-soft);\n  border-color: var(--cube-border-accent);\n}\n\n.cube-ui .cube-mode-item:disabled { opacity: 0.55; }\n\n.cube-ui .cube-mode-item-name {\n  display: flex;\n  align-items: center;\n  gap: 6px;\n  font-weight: 500;\n}\n\n.cube-ui .cube-mode-check { margin-left: auto; color: var(--cube-accent); }\n\n.cube-ui .cube-mode-item-desc {\n  display: block;\n  margin-top: 2px;\n  color: var(--cube-text-meta);\n  font-size: var(--cube-font-meta);\n  line-height: 16px;\n  white-space: normal;\n}\n\n.cube-ui .cube-mode-error {\n  margin-top: var(--cube-space-1);\n  padding: var(--cube-space-1) 7px;\n  color: var(--dsw-alias-state-error-primary);\n  font-size: var(--cube-font-meta);\n  line-height: 16px;\n}\n\n/* --------------------------------------------------------------------------\n   17. Scrollbars (theme-derived, thin)\n   -------------------------------------------------------------------------- */\n\n.cube-ui .sessions,\n.cube-ui .conv-body,\n.cube-ui .session-menu,\n.cube-ui-overlay .dock-panel,\n.cube-ui-overlay .modal {\n  scrollbar-width: thin;\n  scrollbar-color: var(--cube-scroll-thumb) transparent;\n}\n\n.cube-ui .sessions::-webkit-scrollbar,\n.cube-ui .conv-body::-webkit-scrollbar,\n.cube-ui .session-menu::-webkit-scrollbar,\n.cube-ui-overlay .dock-panel::-webkit-scrollbar,\n.cube-ui-overlay .modal::-webkit-scrollbar {\n  width: 8px;\n  height: 8px;\n}\n\n.cube-ui .sessions::-webkit-scrollbar-track,\n.cube-ui .conv-body::-webkit-scrollbar-track,\n.cube-ui .session-menu::-webkit-scrollbar-track,\n.cube-ui-overlay .dock-panel::-webkit-scrollbar-track,\n.cube-ui-overlay .modal::-webkit-scrollbar-track {\n  background: transparent;\n}\n\n.cube-ui .sessions::-webkit-scrollbar-thumb,\n.cube-ui .conv-body::-webkit-scrollbar-thumb,\n.cube-ui .session-menu::-webkit-scrollbar-thumb,\n.cube-ui-overlay .dock-panel::-webkit-scrollbar-thumb,\n.cube-ui-overlay .modal::-webkit-scrollbar-thumb {\n  background: var(--cube-scroll-thumb);\n  border-radius: var(--cube-radius-pill);\n}\n\n.cube-ui .sessions::-webkit-scrollbar-thumb:hover,\n.cube-ui .conv-body::-webkit-scrollbar-thumb:hover,\n.cube-ui .session-menu::-webkit-scrollbar-thumb:hover,\n.cube-ui-overlay .dock-panel::-webkit-scrollbar-thumb:hover,\n.cube-ui-overlay .modal::-webkit-scrollbar-thumb:hover {\n  background: var(--cube-scroll-thumb-hover);\n}\n\n/* --------------------------------------------------------------------------\n   18. Keyframes (prefixed: @keyframes are global by spec)\n   -------------------------------------------------------------------------- */\n\n@keyframes cube-pulse {\n  0%, 100% { opacity: 1; }\n  50% { opacity: 0.45; }\n}\n\n@keyframes cube-dock-in {\n  from { opacity: 0; transform: translateY(6px); }\n  to { opacity: 1; transform: none; }\n}\n\n@keyframes cube-modal-in {\n  from { opacity: 0; transform: scale(0.98) translateY(8px); }\n  to { opacity: 1; transform: none; }\n}\n\n@keyframes cube-coach-in {\n  from { opacity: 0; transform: translate(-50%, -6px); }\n  to { opacity: 1; transform: translate(-50%, 0); }\n}\n\n/* --------------------------------------------------------------------------\n   19. Narrow and short frames\n   -------------------------------------------------------------------------- */\n\n@container cube (max-width: 760px) {\n  .cube-ui-overlay .diamond {\n    --cube-diamond-size: 100px;\n  }\n\n  .cube-ui-overlay .dock-panel {\n    width: min(268px, 84cqw);\n  }\n\n  .cube-ui .stage-title {\n    max-width: 40cqw;\n  }\n}\n\n/* The sidebar becomes a drawer: no rail to clear on the left. */\n@media (max-width: 767px) {\n  .cube-ui-overlay .dock {\n    left: 16px;\n  }\n}\n\n/* Phone width: the dock collapses to its icon and the size control moves\n   into \"More\", so the bottom corners never collide. */\n@media (max-width: 640px) {\n  .cube-ui-overlay .dock-label,\n  .cube-ui-overlay .dock-toggle .dock-caret {\n    display: none;\n  }\n\n  .cube-ui-overlay .dock-toggle {\n    padding: var(--cube-space-2);\n  }\n\n  .cube-ui-overlay .size-pill {\n    display: none;\n  }\n\n  .cube-ui .hud-hint {\n    display: none;\n  }\n}\n\n@media (max-height: 520px) {\n  .cube-ui .hud-hint {\n    display: none;\n  }\n}\n\n/* --------------------------------------------------------------------------\n   20. User preferences: motion, contrast, forced colors\n   -------------------------------------------------------------------------- */\n\n@media (prefers-reduced-motion: reduce) {\n  .cube-ui *,\n  .cube-ui *::before,\n  .cube-ui *::after,\n  .cube-ui-overlay *,\n  .cube-ui-overlay *::before,\n  .cube-ui-overlay *::after {\n    transition-duration: 0.01ms !important;\n    animation-duration: 0.01ms !important;\n    animation-iteration-count: 1 !important;\n    scroll-behavior: auto !important;\n  }\n}\n\n@media (prefers-contrast: more) {\n  .cube-ui,\n  .cube-ui-overlay {\n    --cube-text-meta: var(--dsw-alias-label-primary);\n    --cube-text-dim: var(--dsw-alias-label-primary);\n    --cube-border-soft: var(--dsw-alias-border-l2);\n    --cube-border: var(--dsw-alias-border-l3);\n  }\n}\n\n@media (forced-colors: active) {\n  .cube-ui .face {\n    border-color: CanvasText;\n  }\n\n  .cube-ui .face.front {\n    border: 2px solid Highlight;\n  }\n\n  .cube-ui .face::after {\n    display: none;\n  }\n\n  .cube-ui .session[aria-current=\"true\"],\n  .cube-ui .session-menu [aria-current=\"true\"],\n  .cube-ui .cube-mode-item[aria-current=\"true\"],\n  .cube-ui .face.selected .face-head::before {\n    border-color: Highlight;\n    background: Highlight;\n    color: HighlightText;\n  }\n\n  .cube-ui .dot,\n  .cube-ui .ss-status.running::before {\n    forced-color-adjust: none;\n    background: CanvasText;\n  }\n}\n";
    const LOCALE_DICTS = {"ja":{"nav.title":"クイック操作","nav.session":"新規セッション","nav.plugins":"プラグイン","nav.schedules":"自動化タスク","nav.more":"その他","hint.browse":"ドラッグまたは矢印キーで回転 ・ 面のセッションをクリックで会話 ・ 右上のひし形から操作","workspace.none":"ワークスペースなし","workspace.emptySlot":"空きスロット","workspace.emptyPath":"この面に割り当てられたワークスペースはありません","workspace.label":"ワークスペース","sessions.empty":"セッションなし","sessions.new":"新規セッション","sessions.running":"実行中","sessions.idle":"待機中","conv.title":"会話","conv.close":"立方体に戻る (Esc)","conv.empty":"このワークスペースにはまだセッションがありません。","page.prev":"前のワークスペースセット","page.next":"次のワークスペースセット","page.label":"{from}–{to} / {total}","dock.title":"設定・プラグイン","dock.settingsSection":"設定","dock.settings":"設定を開く","dock.settingsMeta":"標準の設定モーダル","dock.panels":"プラグイン UI","dock.plugins":"プラグイン管理","dock.pluginsMeta":"標準パネル","dock.schedules":"自動化タスク","dock.schedulesMeta":"標準パネル","dock.note":"プラグイン固有の設定 UI は、それぞれの標準画面から開きます。","more.title":"その他","more.close":"閉じる","more.sub":"残りのユーティリティへの入口です。","more.settings":"設定","more.settingsMeta":"DSH 標準設定","more.plugins":"プラグイン管理","more.pluginsMeta":"DSH 標準パネル","more.schedules":"自動化タスク","more.schedulesMeta":"DSH 標準パネル","more.open":"開く","size.title":"立方体のサイズ","size.smaller":"立方体を小さく","size.larger":"立方体を大きく","hint.insideShort":"ドラッグで回転 ・ Esc で戻る","more.diagnostics":"診断情報","more.diagnosticsMeta":"スクロール不調時の確認用","mode.label":"エージェントモード","mode.hint":"エージェントのツール構成を選択","mode.locked":"会話が始まるとモードを変更できません","mode.error":"モードを切り替えられませんでした","mode.standard":"標準モード","mode.creator":"クリエイターモード","mode.ptc":"PTC モード","mode.minimal":"最小モード","hint.dismiss":"ヒントを閉じる","a11y.cube":"ワークスペースの立方体","a11y.cubeRole":"立方体","a11y.face":"面 {index}/{total}: {name}","a11y.cubeKeys":"左右の矢印キーで隣の面、上下の矢印キーで上下の面へ回転します。Enter で前面のワークスペースを開き、Home で最初の面に戻ります。","a11y.running":"{name} を実行中","a11y.idle":"{name} が待機中になりました","face.nav":"面の切り替え","face.left":"左の面へ","face.right":"右の面へ","face.up":"上の面へ","face.down":"下の面へ","face.label":"面 {index}/{total}","count.sessions":"{count} セッション","count.sessionOne":"{count} セッション","count.workspaces":"{count} ワークスペース","count.workspaceOne":"{count} ワークスペース","workspace.loading":"読み込み中…","workspace.error":"ワークスペースを読み込めませんでした。","workspace.retry":"再読み込み","workspace.emptyHint":"ワークスペースは標準のサイドバーから追加できます","workspace.addCta":"サイドバーを開く","sessions.list":"セッション","sessions.menu":"セッションの切り替え","page.title":"ワークスペースのページ","tour.label":"操作ガイド","tour.step":"{index} / {total}","tour.next":"次へ","tour.done":"はじめる","tour.skip":"スキップ","tour.rotateTitle":"立方体を回す","tour.rotateBody":"6 つの面がそれぞれワークスペースです。ドラッグ、下の ‹ › ボタン、または立方体にフォーカスして矢印キーで回転します。","tour.openTitle":"面から会話に入る","tour.openBody":"面のセッションをクリックすると、その面の上で会話が開きます。「+ 新規セッション」で新しい会話を始められます。","tour.backTitle":"立方体に戻る","tour.backBody":"Esc キー、または会話右上の × で立方体ビューに戻ります。このガイドは「その他」からいつでも再表示できます。","more.openNamed":"{name}を開く","more.show":"表示","more.size":"立方体のサイズ","more.guide":"操作ガイド","more.guideMeta":"最初の案内と操作ヒントをもう一度表示","more.version":"Cube UI v{version}","size.reset":"サイズを 100% に戻す","dock.settingsDesktop":"デスクトップ版ではサイドバーの設定から開きます","diag.none":"なし","error.openSession":"セッションを開けませんでした","error.startSession":"セッションを作成できませんでした","error.selectPanel":"パネルを開けませんでした","error.openSettings":"設定を開けませんでした","error.sidebar":"サイドバーを開けませんでした"},"en":{"nav.title":"Quick actions","nav.session":"New session","nav.plugins":"Plugins","nav.schedules":"Scheduled tasks","nav.more":"More","hint.browse":"Drag or use the arrow keys to rotate · Click a session on a face to open it · More actions in the diamond, top right","workspace.none":"No workspaces","workspace.emptySlot":"Empty slot","workspace.emptyPath":"No workspace is assigned to this face","workspace.label":"Workspace","sessions.empty":"No sessions","sessions.new":"New session","sessions.running":"Running","sessions.idle":"Idle","conv.title":"Conversation","conv.close":"Back to the cube (Esc)","conv.empty":"This workspace has no sessions yet.","page.prev":"Previous workspace set","page.next":"Next workspace set","page.label":"{from}–{to} / {total}","dock.title":"Settings & plugins","dock.settingsSection":"Settings","dock.settings":"Open settings","dock.settingsMeta":"Standard settings dialog","dock.panels":"Plugin surfaces","dock.plugins":"Plugin manager","dock.pluginsMeta":"Standard panel","dock.schedules":"Scheduled tasks","dock.schedulesMeta":"Standard panel","dock.note":"Plugin-specific settings open from their own standard screens.","more.title":"More","more.close":"Close","more.sub":"Entrances to the remaining utilities.","more.settings":"Settings","more.settingsMeta":"Standard DSH settings","more.plugins":"Plugin manager","more.pluginsMeta":"Standard DSH panel","more.schedules":"Scheduled tasks","more.schedulesMeta":"Standard DSH panel","more.open":"Open","size.title":"Cube size","size.smaller":"Shrink the cube","size.larger":"Enlarge the cube","hint.insideShort":"Drag to rotate ・ Esc to go back","more.diagnostics":"Diagnostics","more.diagnosticsMeta":"For scroll troubleshooting","mode.label":"Agent mode","mode.hint":"Choose the agent's tools","mode.locked":"The mode cannot change once the conversation starts","mode.error":"Could not change the mode","mode.standard":"Standard mode","mode.creator":"Creator mode","mode.ptc":"PTC mode","mode.minimal":"Minimal mode","hint.dismiss":"Dismiss hint","a11y.cube":"Workspace cube","a11y.cubeRole":"cube","a11y.face":"Face {index} of {total}: {name}","a11y.cubeKeys":"Left and Right arrow keys turn to the neighbouring face, Up and Down tip to the top and bottom faces. Enter opens the front Workspace, Home returns to the first face.","a11y.running":"{name} is running","a11y.idle":"{name} is now idle","face.nav":"Switch face","face.left":"Face to the left","face.right":"Face to the right","face.up":"Face above","face.down":"Face below","face.label":"Face {index}/{total}","count.sessions":"{count} sessions","count.sessionOne":"{count} session","count.workspaces":"{count} workspaces","count.workspaceOne":"{count} workspace","workspace.loading":"Loading…","workspace.error":"Workspaces could not be loaded.","workspace.retry":"Reload","workspace.emptyHint":"Add workspaces from the standard sidebar","workspace.addCta":"Open sidebar","sessions.list":"Sessions","sessions.menu":"Switch session","page.title":"Workspace pages","tour.label":"Guide","tour.step":"{index} / {total}","tour.next":"Next","tour.done":"Get started","tour.skip":"Skip","tour.rotateTitle":"Turn the cube","tour.rotateBody":"Each of the six faces is a workspace. Drag the cube, use the ‹ › buttons below, or focus the cube and press the arrow keys.","tour.openTitle":"Open a conversation from a face","tour.openBody":"Click a session on a face to open its conversation right on that face. \"+ New session\" starts a new one.","tour.backTitle":"Back to the cube","tour.backBody":"Press Esc or the × at the top right of the conversation to return to the cube. Reopen this guide any time from \"More\".","more.openNamed":"Open {name}","more.show":"Show","more.size":"Cube size","more.guide":"Guide","more.guideMeta":"Show the first-run guide and hints again","more.version":"Cube UI v{version}","size.reset":"Reset size to 100%","dock.settingsDesktop":"On desktop, open it from the sidebar","diag.none":"none","error.openSession":"Could not open the session","error.startSession":"Could not create a session","error.selectPanel":"Could not open the panel","error.openSettings":"Could not open settings","error.sidebar":"Could not open the sidebar"},"zh":{"nav.title":"快捷操作","nav.session":"新建会话","nav.plugins":"插件","nav.schedules":"计划任务","nav.more":"更多","hint.browse":"拖动或使用方向键旋转 · 点击面上的会话进入对话 · 右上角菱形中有更多操作","workspace.none":"没有工作区","workspace.emptySlot":"空槽位","workspace.emptyPath":"此面尚未分配工作区","workspace.label":"工作区","sessions.empty":"没有会话","sessions.new":"新建会话","sessions.running":"运行中","sessions.idle":"空闲","conv.title":"会话","conv.close":"返回立方体 (Esc)","conv.empty":"此工作区还没有会话。","page.prev":"上一组工作区","page.next":"下一组工作区","page.label":"{from}–{to} / {total}","dock.title":"设置与插件","dock.settingsSection":"设置","dock.settings":"打开设置","dock.settingsMeta":"标准设置对话框","dock.panels":"插件界面","dock.plugins":"插件管理","dock.pluginsMeta":"标准面板","dock.schedules":"计划任务","dock.schedulesMeta":"标准面板","dock.note":"插件专属设置请从其标准界面打开。","more.title":"更多","more.close":"关闭","more.sub":"通往其余工具的入口。","more.settings":"设置","more.settingsMeta":"DSH 标准设置","more.plugins":"插件管理","more.pluginsMeta":"DSH 标准面板","more.schedules":"计划任务","more.schedulesMeta":"DSH 标准面板","more.open":"打开","size.title":"立方体大小","size.smaller":"缩小立方体","size.larger":"放大立方体","hint.insideShort":"拖动旋转 ・ Esc 返回","more.diagnostics":"诊断信息","more.diagnosticsMeta":"用于排查滚动问题","mode.label":"Agent 模式","mode.hint":"选择 Agent 的工具配置","mode.locked":"会话开始后无法更改模式","mode.error":"无法切换模式","mode.standard":"标准模式","mode.creator":"创造模式","mode.ptc":"PTC 模式","mode.minimal":"极简模式","hint.dismiss":"关闭提示","a11y.cube":"工作区立方体","a11y.cubeRole":"立方体","a11y.face":"第 {index}/{total} 面：{name}","a11y.cubeKeys":"左右方向键转到相邻的面，上下方向键转到顶面和底面。Enter 打开正面的工作区，Home 回到第一个面。","a11y.running":"{name} 正在运行","a11y.idle":"{name} 已空闲","face.nav":"切换面","face.left":"转到左侧的面","face.right":"转到右侧的面","face.up":"转到上方的面","face.down":"转到下方的面","face.label":"面 {index}/{total}","count.sessions":"{count} 个会话","count.sessionOne":"{count} 个会话","count.workspaces":"{count} 个工作区","count.workspaceOne":"{count} 个工作区","workspace.loading":"加载中…","workspace.error":"无法加载工作区。","workspace.retry":"重新加载","workspace.emptyHint":"可在标准侧边栏中添加工作区","workspace.addCta":"打开侧边栏","sessions.list":"会话","sessions.menu":"切换会话","page.title":"工作区页","tour.label":"操作指南","tour.step":"{index} / {total}","tour.next":"下一步","tour.done":"开始使用","tour.skip":"跳过","tour.rotateTitle":"旋转立方体","tour.rotateBody":"六个面各是一个工作区。拖动立方体、使用下方的 ‹ › 按钮，或聚焦立方体后按方向键即可旋转。","tour.openTitle":"从面进入对话","tour.openBody":"点击面上的会话，即可在该面上打开对话。点击“+ 新建会话”开始新的对话。","tour.backTitle":"回到立方体","tour.backBody":"按 Esc 或对话右上角的 × 返回立方体视图。随时可从“更多”中再次打开本指南。","more.openNamed":"打开{name}","more.show":"显示","more.size":"立方体大小","more.guide":"操作指南","more.guideMeta":"再次显示首次使用指南和提示","more.version":"Cube UI v{version}","size.reset":"将大小恢复为 100%","dock.settingsDesktop":"桌面版请从侧边栏打开","diag.none":"无","error.openSession":"无法打开会话","error.startSession":"无法创建会话","error.selectPanel":"无法打开面板","error.openSettings":"无法打开设置","error.sidebar":"无法打开侧边栏"}};

    /** Cube attitude at rest. Browse mode adds a slight idle tilt in CSS so
     *  the cube reads as a cube; inside mode rests face-on. */
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
    /** Faces per page: one Workspace per face. */
    const FACES = 6;
    /** A press must travel this far (px) before it turns the cube. */
    const DRAG_SLOP = 5;

    /** User-tunable cube scale, persisted per browser. */
    const SCALE_KEY = 'dsh.cube-ui.scale';
    const SCALE_MIN = 0.6;
    const SCALE_MAX = 1.6;
    /** First-run guide, dismissed hint, one-time sidebar default. */
    const ONBOARD_KEY = 'dsh.cube-ui.onboarded';
    const HINT_KEY = 'dsh.cube-ui.hintDismissed';
    const SIDEBAR_KEY = 'dsh.cube-ui.sidebarDefaulted';

    // Storage may be unavailable (private windows, blocked site data); every
    // caller treats a missing value as "first visit" and keeps working.
    function readStored(key) {
      try {
        return window.localStorage.getItem(key);
      } catch (error) {
        return null;
      }
    }

    function writeStored(key, value) {
      try {
        if (value === null) window.localStorage.removeItem(key);
        else window.localStorage.setItem(key, value);
      } catch (error) {
        // Not persisted; the in-memory state still applies for this load.
      }
    }

    function readScale() {
      const value = Number(readStored(SCALE_KEY));
      return Number.isFinite(value) && value > 0 ? clamp(value, SCALE_MIN, SCALE_MAX) : 1;
    }

    function writeScale(scale) {
      writeStored(SCALE_KEY, String(scale));
    }

    function reducedMotion() {
      try {
        return window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches === true;
      } catch (error) {
        return false;
      }
    }

    /** CSS drops the snap transition under reduced motion; follow it. */
    function snapDuration() {
      return reducedMotion() ? 40 : SNAP_MS;
    }

    /** "{count} sessions" with a singular form where the language has one. */
    function countLabel(t, count, oneKey, manyKey) {
      return t(count === 1 ? oneKey : manyKey, { count });
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
      chevronDown: '<path d="M6 10l6 6 6-6"/>',
      chevronLeft: '<path d="M14 6l-6 6 6 6"/>',
      chevronRight: '<path d="M10 6l6 6-6 6"/>',
      check: '<path d="M5 12.5l4.5 4.5L19 7"/>',
      layers: '<path d="M12 3.5l8.5 4.6L12 12.7 3.5 8.1 12 3.5z"/><path d="M3.5 12.4l8.5 4.6 8.5-4.6"/>',
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
    // Focus and menu helpers
    // ---------------------------------------------------------------------

    /** Visually hidden but announced (status region, key help). */
    const SR_ONLY = 'cube-sr-only';

    /**
     * Focus the first match of `selectors` under `getRoot()`, retrying for a
     * few frames: embedded conversation content and freshly opened menus
     * mount after the state change that asked for the focus.
     */
    function focusWhenReady(getRoot, selectors, frames) {
      let left = frames ?? 20;
      const attempt = () => {
        const root = getRoot();
        if (root !== null && root !== undefined) {
          for (const selector of selectors) {
            const node = root.querySelector(selector);
            if (node !== null && typeof node.focus === 'function' && node.getClientRects().length > 0) {
              node.focus({ preventScroll: true });
              return;
            }
          }
        }
        left -= 1;
        if (left > 0) window.requestAnimationFrame(attempt);
      };
      window.requestAnimationFrame(attempt);
    }

    /** Arrow/Home/End movement between the buttons of a small menu. */
    function onMenuKeyDown(event) {
      const key = event.key;
      if (key !== 'ArrowDown' && key !== 'ArrowUp' && key !== 'Home' && key !== 'End') return;
      const nodes = [...event.currentTarget.querySelectorAll('button:not(:disabled)')];
      if (nodes.length === 0) return;
      event.preventDefault();
      const index = nodes.indexOf(document.activeElement);
      let next;
      if (key === 'Home') next = 0;
      else if (key === 'End') next = nodes.length - 1;
      else if (key === 'ArrowDown') next = index < 0 ? 0 : (index + 1) % nodes.length;
      else next = index < 0 ? nodes.length - 1 : (index - 1 + nodes.length) % nodes.length;
      nodes[next].focus();
    }

    /** Keep Tab inside a dialog. */
    function trapTab(event) {
      if (event.key !== 'Tab') return;
      const nodes = [
        ...event.currentTarget.querySelectorAll(
          'button:not(:disabled), [href], input:not(:disabled), select, textarea, [tabindex]:not([tabindex="-1"])',
        ),
      ];
      if (nodes.length === 0) return;
      const first = nodes[0];
      const last = nodes[nodes.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    /**
     * Screen geometry of `element` against the cube face that clips it. The
     * face is perspective-projected, so screen rects are scaled against its
     * CSS width; callers convert back with `scale`.
     */
    function measureInFace(element) {
      if (element === null || element === undefined) return null;
      const face = element.closest('.face');
      if (face === null || face.offsetWidth === 0) return null;
      const faceRect = face.getBoundingClientRect();
      return { scale: faceRect.width / face.offsetWidth, faceRect, rect: element.getBoundingClientRect() };
    }

    function isRunning(row, sessionStatus) {
      return row?.running === true || sessionStatus?.get?.(row?.id)?.running === true;
    }

    // ---------------------------------------------------------------------
    // Stage: cube of Workspaces plus the embedded conversation
    // ---------------------------------------------------------------------

    function CubeStage(props) {
      const {
        sessionId,
        useSession,
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
      // Subscribed so the stage follows the bound Session (title, running).
      useSession((state) => state);
      const ui = useChannel(channel);

      const items = workspaceState?.items ?? [];
      // Not yet fetched and genuinely empty must not look the same.
      const loading =
        items.length === 0 &&
        (workspaceState === undefined ||
          workspaceState === null ||
          workspaceState.phase === 'pending' ||
          workspaceState.state === 'loading');
      const failed = items.length === 0 && !loading && workspaceState?.state === 'error';
      const pageCount = Math.max(1, Math.ceil(items.length / FACES));
      const page = clamp(ui.page, 0, pageCount - 1);
      const mode = ui.mode;
      const inside = mode === 'inside';
      const sessionRow = sessionId === undefined ? undefined : sessionState?.byId?.[sessionId];
      const sessionWorkspace =
        sessionId === undefined ? undefined : items.find((item) => (item.sessionIds ?? []).includes(sessionId));
      const channelWorkspace =
        ui.workspaceId === undefined ? undefined : items.find((item) => item.workspaceId === ui.workspaceId);
      // Inside the cube the face decides the Workspace: turning onto a
      // Workspace without Sessions must not keep showing the previous one.
      const activeWorkspace = inside
        ? channelWorkspace ?? sessionWorkspace
        : sessionWorkspace ?? channelWorkspace;
      // The host Session belongs on this face only when it is this face's
      // Workspace. A Session not listed yet (a fresh blank one) is shown.
      const showConversation =
        sessionId !== undefined &&
        (sessionWorkspace === undefined ||
          activeWorkspace === undefined ||
          sessionWorkspace.workspaceId === activeWorkspace.workspaceId);
      // Rows are derived from the Workspace list, not from conversation
      // updates: memoise so a streaming Session never re-filters them.
      const activeSessions = useMemo(
        () => sessionsOf(activeWorkspace, sessionState),
        [activeWorkspace, sessionState],
      );
      const running = showConversation && isRunning(sessionRow ?? { id: sessionId }, sessionStatus);

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
      const shellRef = useRef(null);
      const cubeRef = useRef(null);
      const rotation = useRef({ rx: INITIAL_RX, ry: INITIAL_RY });
      const snapTimer = useRef(0);
      const drag = useRef(null);
      /** Pending pointer sample + the frame that will consume it. Polling
       *  mice emit several pointermove events per display frame; writing the
       *  transform once per frame keeps the layout/paint work bounded. */
      const dragFrame = useRef(0);
      const dragSample = useRef(null);
      /** Where focus should land once the cube settles ('conv' | 'cube'). */
      const pendingFocus = useRef(null);
      const [front, setFront] = useState(frontSlotOf(INITIAL_RX, INITIAL_RY));
      /** True while the cube is being dragged or snapping: faces drop to
       *  identity detail so a workspace stays recognizable without painting
       *  the session lists on every rotating face. */
      const [rotating, setRotating] = useState(false);
      const [announcement, setAnnouncement] = useState('');
      const [menuBox, setMenuBox] = useState(null);

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

      // The cube is sized from the panel box itself (this is the only place
      // that decides --cube-size), so a collapsed/expanded sidebar or a
      // laptop-height window both keep the whole cube on screen.
      useEffect(() => {
        const host = hostRef.current;
        const root = rootRef.current;
        if (host === null || root === null) return undefined;
        const fit = () => {
          const width = host.clientWidth;
          const height = host.clientHeight;
          if (width === 0 || height === 0) return;
          const insideNow = latest.current.mode === 'inside';
          const base = insideNow
            ? Math.min(600, width * 0.56, height * 0.8)
            : Math.min(520, width * 0.46, height * 0.55);
          // Browse rests tilted under a shorter perspective, which magnifies
          // the near edge; leave it more room than the face-on inside view.
          const upper = insideNow
            ? Math.min(width * 0.88, height * 0.86)
            : Math.min(width * 0.8, height * 0.72);
          const lower = Math.min(220, width * 0.8, height * 0.8);
          const size = Math.round(clamp(base * ui.scale, Math.min(lower, upper), upper));
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

      /**
       * Inside the cube, the Workspace on the front face becomes the active
       * one: open its remembered (or newest) Session, or show its empty state.
       */
      const settleInside = useCallback((slot, pageOverride) => {
        const state = latest.current;
        if (state.mode !== 'inside') return;
        const workspace = state.items[(pageOverride ?? state.page) * FACES + slot];
        if (workspace === undefined) return;
        state.channel.update({ workspaceId: workspace.workspaceId });
        const ids = workspace.sessionIds ?? [];
        if (state.sessionId !== undefined && ids.includes(state.sessionId)) return;
        const remembered = state.channel.getSnapshot().lastSession[workspace.workspaceId];
        const target = remembered !== undefined && ids.includes(remembered) ? remembered : ids[0];
        if (target !== undefined) state.actions.openSession(target);
      }, []);

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
          // Reduced motion: CSS drops the transition, so settle right away
          // instead of leaving the state 460ms behind the picture.
          snapTimer.current = window.setTimeout(() => {
            if (cubeRef.current !== null) cubeRef.current.classList.remove('snap');
            const slot = frontSlotOf(rotation.current.rx, rotation.current.ry);
            setFront(slot);
            setRotating(false);
            if (!silent) settleInside(slot);
          }, snapDuration());
        },
        [applyRotation, settleInside],
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

      /**
       * One face step: dx turns to the face on the right (+1) or left (-1),
       * dy tips the cube to show the face above (-1) or below (+1).
       */
      const stepFace = useCallback(
        (dx, dy) => {
          const { rx, ry } = snapAttitude(rotation.current.rx, rotation.current.ry);
          let nextRx = rx;
          let nextRy = ry;
          if (dx !== 0) {
            nextRx = 0;
            nextRy = ry - 90 * dx;
          }
          if (dy !== 0) nextRx = clamp(rx + 90 * dy, -90, 90);
          if (nextRx === rx && nextRy === ry) return;
          setRotating(true);
          snap(nextRx, nextRy);
        },
        [snap],
      );

      // -- Drag -----------------------------------------------------------
      //
      // A press only arms a drag. The cube starts turning once the pointer
      // has travelled DRAG_SLOP pixels, so a plain click on a face (or the
      // frame around the conversation) never snaps the cube or blanks the
      // conversation for the length of a snap.

      const beginRotation = useCallback((state) => {
        state.moved = true;
        window.clearTimeout(snapTimer.current);
        if (cubeRef.current !== null) cubeRef.current.classList.remove('snap');
        channel.update({ menuOpen: false });
        setRotating(true);
        if (stageRef.current !== null) stageRef.current.classList.add('grabbing');
        try {
          stageRef.current?.setPointerCapture(state.pointerId);
        } catch (error) {
          // Older engines refuse capture on non-primary pointers; dragging
          // still works while the pointer stays over the stage.
        }
      }, [channel]);

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
          if (dragFrame.current !== 0) window.cancelAnimationFrame(dragFrame.current);
          dragFrame.current = 0;
          dragSample.current = null;
          drag.current = {
            pointerId: event.pointerId,
            originX: event.clientX,
            originY: event.clientY,
            rx: rotation.current.rx,
            ry: rotation.current.ry,
            moved: false,
          };
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
        if (sample === null || state === null || !state.moved || state.pointerId !== sample.pointerId) return;
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
          if (!state.moved) {
            const travel = Math.hypot(event.clientX - state.originX, event.clientY - state.originY);
            if (travel < DRAG_SLOP) return;
            beginRotation(state);
          }
          dragSample.current = { pointerId: event.pointerId, clientX: event.clientX, clientY: event.clientY };
          if (dragFrame.current !== 0) return;
          dragFrame.current = window.requestAnimationFrame(flushDragSample);
        },
        [flushDragSample, beginRotation],
      );

      const onPointerUp = useCallback(
        (event) => {
          const state = drag.current;
          if (state === null || (event.pointerId !== undefined && state.pointerId !== event.pointerId)) return;
          drag.current = null;
          // Below the slop the press was a click: leave the cube alone.
          if (!state.moved) return;
          // Consume the last sample before the snap attitude is read, so the
          // cube settles on the rotation the pointer actually reached.
          if (dragFrame.current !== 0) {
            window.cancelAnimationFrame(dragFrame.current);
            dragFrame.current = 0;
          }
          if (dragSample.current !== null) {
            drag.current = state;
            flushDragSample();
            drag.current = null;
          }
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

      // Selecting a Session in another Workspace (sidebar, host navigation)
      // turns that Workspace's face to the front, so the face, the header and
      // the conversation always name the same Workspace. Switching Sessions
      // within the front Workspace (the dropdown) never turns the cube.
      useEffect(() => {
        if (sessionWorkspace === undefined) return;
        channel.update({ workspaceId: sessionWorkspace.workspaceId });
        if (drag.current !== null) return;
        const abs = items.indexOf(sessionWorkspace);
        if (abs < 0) return;
        const targetPage = Math.floor(abs / FACES);
        const slot = abs % FACES;
        if (targetPage !== latest.current.page) channel.update({ page: targetPage });
        if (frontSlotOf(rotation.current.rx, rotation.current.ry) !== slot) rotateToFace(slot, { silent: true });
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
          pendingFocus.current = 'conv';
          channel.update({ mode: 'inside', closed: false, workspaceId: workspace.workspaceId });
          rotateToFace(slot);
        },
        [channel, rotateToFace],
      );

      const openFromFace = useCallback(
        (workspace, slot, targetSessionId) => {
          if (workspace === undefined) return;
          const last = channel.getSnapshot().lastSession;
          pendingFocus.current = 'conv';
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
          pendingFocus.current = 'conv';
          if (target === undefined) {
            actions.startSession();
            return;
          }
          channel.update({ mode: 'inside', closed: false, workspaceId: target.workspaceId });
          actions.startSession(target.workspaceId);
          const abs = items.indexOf(target);
          if (abs >= 0) rotateToFace(abs % FACES, { silent: true });
        },
        [actions, activeWorkspace, channel, items, rotateToFace],
      );

      const selectSession = useCallback(
        (nextId) => {
          const workspace = items.find((item) => (item.sessionIds ?? []).includes(nextId));
          const last = channel.getSnapshot().lastSession;
          pendingFocus.current = 'conv';
          channel.update({
            closed: false,
            mode: 'inside',
            menuOpen: false,
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
        pendingFocus.current = 'cube';
        channel.update({ mode: 'browse', closed: true, menuOpen: false });
      }, [channel]);

      const goPage = useCallback(
        (next) => {
          const state = latest.current;
          const target = clamp(next, 0, state.pageCount - 1);
          if (target === state.page) return;
          channel.update({ page: target, menuOpen: false });
          settleInside(frontSlotOf(rotation.current.rx, rotation.current.ry), target);
        },
        [channel, settleInside],
      );

      // -- Focus follows the view ------------------------------------------
      //
      // Opening a conversation moves focus into it once the cube has settled
      // (the face hides its content while turning, which would otherwise drop
      // focus on <body>); leaving the conversation returns focus to the cube.

      useEffect(() => {
        if (rotating || pendingFocus.current === null) return;
        const intent = pendingFocus.current;
        if (intent === 'conv' && !inside) return;
        pendingFocus.current = null;
        if (intent === 'conv') {
          focusWhenReady(() => rootRef.current, [
            '.face-conv textarea',
            '.face-conv [contenteditable="true"]',
            '.face-conv .session-select',
          ]);
        } else {
          focusWhenReady(() => rootRef.current, ['.cube-shell'], 4);
        }
      });

      // -- Non-front faces leave the tab order ------------------------------
      //
      // Faces turned away from the viewer are hidden from assistive tech
      // (aria-hidden on the face) and their controls are made inert, so Tab
      // never lands on an invisible or mirrored control. Only the content
      // layers go inert: the face itself still takes a drag.
      useEffect(() => {
        const cube = cubeRef.current;
        if (cube === null) return;
        for (const face of cube.children) {
          const away = face.getAttribute('data-slot') !== String(front);
          for (const layer of face.children) {
            if (layer.classList.contains('face-conv')) continue;
            if ('inert' in layer && layer.inert !== away) layer.inert = away;
          }
        }
      });

      // -- Announcements ----------------------------------------------------

      const announce = useCallback((text) => {
        // Clear first so the same text is announced again when it repeats.
        setAnnouncement('');
        window.requestAnimationFrame(() => setAnnouncement(text));
      }, []);

      const frontWorkspace = items[page * FACES + front];
      const faceName = (workspace) =>
        workspace === undefined ? (loading ? t('workspace.loading') : t('workspace.emptySlot')) : workspace.title;
      const faceText = t('a11y.face', { index: front + 1, total: FACES, name: faceName(frontWorkspace) });

      const announcedFace = useRef(null);
      useEffect(() => {
        const key = page + ':' + front;
        if (announcedFace.current === null) {
          announcedFace.current = key;
          return;
        }
        if (announcedFace.current === key) return;
        announcedFace.current = key;
        announce(faceText);
      }, [page, front, faceText, announce]);

      const lastRunning = useRef({ id: sessionId, running });
      useEffect(() => {
        const previous = lastRunning.current;
        lastRunning.current = { id: sessionId, running };
        if (previous.id !== sessionId || previous.running === running || sessionRow === undefined) return;
        announce(t(running ? 'a11y.running' : 'a11y.idle', { name: sessionRow.displayTitle }));
      }, [sessionId, running]);

      // Failures from host calls surface as a short toast instead of only a
      // console warning.
      useEffect(() => {
        if (ui.notice === null) return undefined;
        const timer = window.setTimeout(() => channel.update({ notice: null }), 5000);
        return () => window.clearTimeout(timer);
      }, [ui.notice, channel]);

      // -- Header menu ----------------------------------------------------

      const toggleMenu = useCallback(() => {
        if (channel.getSnapshot().menuOpen) {
          channel.update({ menuOpen: false });
          return;
        }
        // The face clips the menu: measure the room under the trigger and
        // open upward or shorten the list when the cube is small.
        const box = measureInFace(rootRef.current?.querySelector('.face-conv .session-select'));
        if (box === null) {
          setMenuBox(null);
        } else {
          const margin = 12;
          const below = (box.faceRect.bottom - box.rect.bottom) / box.scale - margin;
          const above = (box.rect.top - box.faceRect.top) / box.scale - margin;
          const up = below < 160 && above > below;
          setMenuBox({ up, maxHeight: Math.max(96, Math.min(258, Math.floor(up ? above : below))) });
        }
        channel.update({ menuOpen: true });
        focusWhenReady(
          () => rootRef.current,
          ['.session-menu [aria-current="true"]', '.session-menu button'],
          4,
        );
      }, [channel]);

      useEffect(() => {
        if (!ui.menuOpen) return undefined;
        const onDocumentPointerDown = (event) => {
          const target = event.target;
          if (target instanceof Element && target.closest('.conv-sessionline') !== null) return;
          channel.update({ menuOpen: false });
        };
        document.addEventListener('pointerdown', onDocumentPointerDown, true);
        return () => {
          document.removeEventListener('pointerdown', onDocumentPointerDown, true);
        };
      }, [ui.menuOpen, channel]);

      // -- Escape: one layer per press ---------------------------------------
      //
      // Session menu, then the "more" dialog, the guide, the dock, and only
      // then the conversation. (The composer's mode menu stops the event
      // itself.) IME composition keeps Escape for itself.
      useEffect(() => {
        const onKeyDown = (event) => {
          if (event.key !== 'Escape' || event.isComposing || event.keyCode === 229) return;
          const state = channel.getSnapshot();
          const root = rootRef.current;
          if (state.menuOpen) {
            channel.update({ menuOpen: false });
            focusWhenReady(() => root, ['.face-conv .session-select'], 2);
          } else if (state.moreOpen) {
            channel.update({ moreOpen: false });
          } else if (state.tour !== null && state.mode !== 'inside') {
            channel.update({ tour: null });
            writeStored(ONBOARD_KEY, '1');
          } else if (state.dockOpen) {
            channel.update({ dockOpen: false });
            focusWhenReady(() => root, ['.dock-toggle'], 2);
          } else if (state.mode === 'inside') {
            pendingFocus.current = 'cube';
            channel.update({ mode: 'browse', closed: true });
          } else {
            return;
          }
          event.preventDefault();
        };
        window.addEventListener('keydown', onKeyDown);
        return () => {
          window.removeEventListener('keydown', onKeyDown);
        };
      }, [channel]);

      // -- Keyboard rotation ------------------------------------------------

      const onCubeKeyDown = useCallback(
        (event) => {
          if (event.target !== event.currentTarget) return;
          switch (event.key) {
            case 'ArrowLeft':
              stepFace(-1, 0);
              break;
            case 'ArrowRight':
              stepFace(1, 0);
              break;
            case 'ArrowUp':
              stepFace(0, -1);
              break;
            case 'ArrowDown':
              stepFace(0, 1);
              break;
            case 'Home':
              rotateToFace(0);
              break;
            case 'Enter':
            case ' ': {
              const state = latest.current;
              const slot = frontSlotOf(rotation.current.rx, rotation.current.ry);
              const workspace = state.items[state.page * FACES + slot];
              if (workspace === undefined || state.mode === 'inside') return;
              enterWorkspace(workspace, slot);
              break;
            }
            default:
              return;
          }
          event.preventDefault();
        },
        [stepFace, rotateToFace, enterWorkspace],
      );

      // -- Derived copy ---------------------------------------------------

      const sessionCount = (workspace) =>
        countLabel(t, sessionsOf(workspace, sessionState).length, 'count.sessionOne', 'count.sessions');
      const titleWorkspace = inside ? activeWorkspace ?? frontWorkspace : frontWorkspace;
      const emptyWorkspace = inside && !showConversation ? activeWorkspace : undefined;
      const conversationTitle = showConversation ? sessionRow?.displayTitle : undefined;

      const pager = (compact) =>
        pageCount > 1
          ? h(
              'div',
              { className: 'pager' + (compact ? ' compact' : ''), role: 'group', 'aria-label': t('page.title') },
              h(
                'button',
                {
                  type: 'button',
                  'aria-label': t('page.prev'),
                  title: t('page.prev'),
                  disabled: page === 0,
                  onClick: () => goPage(page - 1),
                },
                h(Icon, { name: 'chevronLeft' }),
              ),
              h(
                'span',
                {},
                t('page.label', {
                  from: page * FACES + 1,
                  to: Math.min(items.length, page * FACES + FACES),
                  total: items.length,
                }),
              ),
              h(
                'button',
                {
                  type: 'button',
                  'aria-label': t('page.next'),
                  title: t('page.next'),
                  disabled: page >= pageCount - 1,
                  onClick: () => goPage(page + 1),
                },
                h(Icon, { name: 'chevronRight' }),
              ),
            )
          : null;

      const stepButton = (icon, label, dx, dy, className) =>
        h(
          'button',
          {
            type: 'button',
            className,
            'aria-label': label,
            title: label,
            onClick: () => stepFace(dx, dy),
          },
          h(Icon, { name: icon }),
        );

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
                    className: 'primary-btn',
                    onClick: () => newSession(emptyWorkspace),
                  },
                  h(Icon, { name: 'plus' }),
                  t('sessions.new'),
                ),
              ),
        [emptyWorkspace, sessionId, t, newSession, renderFactorySlot],
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
        'section',
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
              'div',
              { className: 'conv-nav' },
              stepButton('chevronLeft', t('face.left'), -1, 0, 'icon-btn'),
              stepButton('chevronRight', t('face.right'), 1, 0, 'icon-btn'),
              pager(true),
            ),
            h(
              'button',
              {
                type: 'button',
                className: 'icon-btn conv-close',
                title: t('conv.close'),
                'aria-label': t('conv.close'),
                onClick: closeConversation,
              },
              h(Icon, { name: 'close' }),
            ),
          ),
          h(
            'div',
            { className: 'conv-sessionline' },
            h(
              'button',
              {
                type: 'button',
                className: 'session-select',
                'aria-expanded': ui.menuOpen ? 'true' : 'false',
                'aria-controls': 'cube-ui-session-menu',
                onClick: toggleMenu,
              },
              h(Icon, { name: 'list', className: 'ss-ico' }),
              h('span', { className: 'ss-label' }, conversationTitle ?? t('sessions.empty')),
              conversationTitle === undefined
                ? null
                : h(
                    'span',
                    { className: 'ss-status' + (running ? ' running' : '') },
                    running ? t('sessions.running') : t('sessions.idle'),
                  ),
              h('span', { className: 'ss-caret', 'aria-hidden': 'true' }),
            ),
            ui.menuOpen
              ? h(
                  'div',
                  {
                    className: 'session-menu' + (menuBox?.up ? ' up' : ''),
                    id: 'cube-ui-session-menu',
                    role: 'group',
                    'aria-label': t('sessions.menu'),
                    style: menuBox === null ? undefined : { maxHeight: menuBox.maxHeight + 'px' },
                    onKeyDown: onMenuKeyDown,
                  },
                  activeSessions.map((row) => {
                    const rowRunning = isRunning(row, sessionStatus);
                    const current = showConversation && row.id === sessionId;
                    return h(
                      'button',
                      {
                        key: row.id,
                        type: 'button',
                        'aria-current': current ? 'true' : undefined,
                        className: current ? 'current' : undefined,
                        onClick: () => selectSession(row.id),
                      },
                      h('span', { className: 'mi-title' }, row.displayTitle),
                      h(
                        'span',
                        { className: 'mi-meta' + (rowRunning ? ' running' : '') },
                        rowRunning ? t('sessions.running') : shortTime(row.updatedAt),
                      ),
                    );
                  }),
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
            className: 'conv-body' + (emptyWorkspace === undefined && sessionId !== undefined ? ' embedded' : ''),
            'data-cube-conversation-body': '',
          },
          conversationBody,
        ),
      ), [
        t,
        activeWorkspace,
        closeConversation,
        ui.menuOpen,
        menuBox,
        conversationTitle,
        running,
        activeSessions,
        sessionStatus,
        sessionId,
        showConversation,
        emptyWorkspace,
        selectSession,
        newSession,
        toggleMenu,
        conversationBody,
        channel,
        page,
        pageCount,
        items.length,
        goPage,
        stepFace,
      ]);

      const faces = useMemo(() => pageWorkspaces.map(({ slot, abs, workspace }) => {
        const rows = sessionsOf(workspace, sessionState);
        const isFront = slot === front;
        const hosting = inside && isFront && workspace !== undefined;
        const selectedWorkspace = workspace !== undefined && workspace.workspaceId === activeWorkspace?.workspaceId;
        const count = workspace === undefined ? '' : countLabel(t, rows.length, 'count.sessionOne', 'count.sessions');
        return h(
          'div',
          {
            key: slot,
            className:
              'face' +
              (isFront ? ' front' : '') +
              (hosting ? ' hosting' : '') +
              (selectedWorkspace ? ' selected' : '') +
              (workspace === undefined ? (loading ? ' loading' : ' vacant') : ''),
            'data-slot': String(slot),
            'data-abs': String(abs),
            'aria-hidden': isFront ? undefined : 'true',
          },
          h(
            'div',
            { className: 'face-inner' },
            h(
              'div',
              { className: 'face-head' },
              h('span', { className: 'face-idx', 'aria-hidden': 'true' }, pad2(abs + 1)),
              h('h2', { className: 'face-title' }, faceName(workspace)),
              h('span', { className: 'face-summary' }, count),
            ),
            h(
              'div',
              { className: 'face-path' },
              workspace === undefined ? (loading ? '' : t('workspace.emptyPath')) : workspace.path,
            ),
            h(
              'ul',
              { className: 'sessions', 'aria-label': workspace === undefined ? undefined : t('sessions.list') },
              workspace === undefined
                ? h('li', { className: 'face-empty' }, loading ? t('workspace.loading') : t('workspace.emptyHint'))
                : rows.length === 0
                  ? h('li', { className: 'face-empty' }, t('sessions.empty'))
                  : rows.map((row) => {
                      const rowRunning = isRunning(row, sessionStatus);
                      return h(
                        'li',
                        { key: row.id, className: 'session-item' },
                        h(
                          'button',
                          {
                            type: 'button',
                            className: 'session',
                            'aria-current': row.id === sessionId ? 'true' : undefined,
                            'data-sid': row.id,
                            onClick: () => openFromFace(workspace, slot, row.id),
                          },
                          h('span', { className: 'stitle' }, row.displayTitle),
                          h(
                            'span',
                            { className: 'smeta' },
                            rowRunning
                              ? h(
                                  'span',
                                  { className: 'run-badge' },
                                  h('i', { className: 'dot', 'aria-hidden': 'true' }),
                                  t('sessions.running'),
                                )
                              : null,
                            h('span', {}, shortTime(row.updatedAt)),
                          ),
                        ),
                      );
                    }),
            ),
            h(
              'div',
              { className: 'face-foot' },
              workspace === undefined
                ? loading
                  ? null
                  : h(
                      'button',
                      { type: 'button', className: 'ghost-btn', onClick: () => actions.openSidebar() },
                      h(Icon, { name: 'layers' }),
                      t('workspace.addCta'),
                    )
                : h(
                    'button',
                    {
                      type: 'button',
                      className: 'primary-btn',
                      onClick: () => {
                        pendingFocus.current = 'conv';
                        channel.update({ mode: 'inside', closed: false, workspaceId: workspace.workspaceId });
                        rotateToFace(slot, { silent: true });
                        actions.startSession(workspace.workspaceId);
                      },
                    },
                    h(Icon, { name: 'plus' }),
                    t('sessions.new'),
                  ),
              h('span', { className: 'face-count' }, count),
            ),
          ),
          h(
            'div',
            { className: 'face-room' },
            h('div', { className: 'room-idx' }, t('workspace.label') + ' ' + pad2(abs + 1)),
            h(
              'div',
              { className: 'room-foot' },
              workspace === undefined
                ? h('span', { className: 'room-title' }, t('workspace.emptySlot'))
                : h(
                    'button',
                    { type: 'button', className: 'room-title', onClick: () => rotateToFace(slot) },
                    workspace.title,
                  ),
              h('span', { className: 'room-count' }, count),
            ),
          ),
          hosting ? conversationPanel : null,
        );
      }), [
        pageWorkspaces,
        sessionState,
        sessionStatus,
        sessionId,
        front,
        inside,
        loading,
        activeWorkspace,
        t,
        conversationPanel,
        openFromFace,
        rotateToFace,
        channel,
        actions,
      ]);

      const tourSteps = [
        { title: t('tour.rotateTitle'), body: t('tour.rotateBody') },
        { title: t('tour.openTitle'), body: t('tour.openBody') },
        { title: t('tour.backTitle'), body: t('tour.backBody') },
      ];
      const tourStep = !inside && !loading && !failed && ui.tour !== null ? tourSteps[ui.tour] : undefined;
      const finishTour = () => {
        writeStored(ONBOARD_KEY, '1');
        channel.update({ tour: null });
      };

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
            'div',
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
                className: 'cube-shell',
                ref: shellRef,
                tabIndex: 0,
                role: 'group',
                'aria-roledescription': t('a11y.cubeRole'),
                'aria-label': t('a11y.cube') + ' — ' + faceText,
                'aria-describedby': 'cube-ui-keys',
                'aria-busy': loading ? 'true' : undefined,
                onKeyDown: onCubeKeyDown,
              },
              h('div', { className: 'cube', ref: cubeRef }, faces),
            ),
            failed
              ? h(
                  'div',
                  { className: 'stage-error', role: 'alert' },
                  h('p', {}, t('workspace.error')),
                  h(
                    'button',
                    { type: 'button', className: 'primary-btn', onClick: () => window.location.reload() },
                    t('workspace.retry'),
                  ),
                )
              : null,
          ),
          h('p', { id: 'cube-ui-keys', className: SR_ONLY }, t('a11y.cubeKeys')),
          h('div', { className: SR_ONLY, role: 'status', 'aria-live': 'polite', 'aria-atomic': 'true' }, announcement),
          h(
            'div',
            { className: 'stage-title' },
            h(
              'div',
              { className: 'st-line' },
              h(
                'span',
                { className: 'st-name' },
                titleWorkspace?.title ??
                  (loading ? t('workspace.loading') : items.length === 0 ? t('workspace.none') : t('workspace.emptySlot')),
              ),
              h('span', { className: 'st-meta' }, titleWorkspace === undefined ? '' : sessionCount(titleWorkspace)),
            ),
            inside ? h('span', { className: 'st-hint' }, t('hint.insideShort')) : null,
          ),
          h(
            'div',
            { className: 'hud' },
            h(
              'div',
              { className: 'hud-row' },
              h(
                'div',
                { className: 'face-nav', role: 'group', 'aria-label': t('face.nav') },
                stepButton('chevronLeft', t('face.left'), -1, 0),
                stepButton('chevronUp', t('face.up'), 0, -1),
                h('span', { className: 'face-nav-label' }, t('face.label', { index: front + 1, total: FACES })),
                stepButton('chevronDown', t('face.down'), 0, 1),
                stepButton('chevronRight', t('face.right'), 1, 0),
              ),
              pageCount > 1
                ? pager(false)
                : items.length > 0
                  ? h(
                      'div',
                      { className: 'pager' },
                      h('span', {}, countLabel(t, items.length, 'count.workspaceOne', 'count.workspaces')),
                    )
                  : null,
            ),
            ui.hintHidden
              ? null
              : h(
                  'div',
                  { className: 'hud-hint' },
                  h('span', {}, t('hint.browse')),
                  h(
                    'button',
                    {
                      type: 'button',
                      className: 'hint-close',
                      'aria-label': t('hint.dismiss'),
                      title: t('hint.dismiss'),
                      onClick: () => {
                        writeStored(HINT_KEY, '1');
                        channel.update({ hintHidden: true });
                      },
                    },
                    h(Icon, { name: 'close' }),
                  ),
                ),
          ),
          tourStep === undefined
            ? null
            : h(
                'section',
                { className: 'coach', 'aria-labelledby': 'cube-ui-coach-title' },
                h(
                  'p',
                  { className: 'coach-step' },
                  t('tour.label') + ' · ' + t('tour.step', { index: ui.tour + 1, total: tourSteps.length }),
                ),
                h('h2', { id: 'cube-ui-coach-title' }, tourStep.title),
                h('p', { className: 'coach-body' }, tourStep.body),
                h(
                  'div',
                  { className: 'coach-actions' },
                  h('button', { type: 'button', className: 'ghost-btn', onClick: finishTour }, t('tour.skip')),
                  h(
                    'button',
                    {
                      type: 'button',
                      className: 'primary-btn',
                      onClick: () => {
                        if (ui.tour + 1 >= tourSteps.length) finishTour();
                        else channel.update({ tour: ui.tour + 1 });
                      },
                    },
                    ui.tour + 1 >= tourSteps.length ? t('tour.done') : t('tour.next'),
                  ),
                ),
              ),
          ui.notice === null
            ? null
            : h('div', { className: 'cube-toast', role: 'status' }, t(ui.notice.key)),
          h(CubeChrome, { usePanelInfo, useWorkspaces, channel, actions, t }),
        ),
      );
    }

    // ---------------------------------------------------------------------
    // Overlay chrome: diamond navigation and the dock
    // ---------------------------------------------------------------------

    /** Electron routes keys through a native bridge; synthetic shortcuts fail. */
    const IS_DESKTOP = typeof navigator !== 'undefined' && /Electron/i.test(navigator.userAgent ?? '');

    function CubeChrome(props) {
      const { usePanelInfo, useWorkspaces, channel, actions, t } = props;
      const panelInfo = usePanelInfo((state) => state);
      const workspaceState = useWorkspaces((state) => state);
      const ui = useChannel(channel);
      const moreOpen = ui.moreOpen;
      const [tip, setTip] = useState(null);
      const [diag, setDiag] = useState(null);
      const overlayRef = useRef(null);
      const returnFocus = useRef(null);

      // The chrome belongs to the cube surface; global panels keep their own.
      const cubeVisible = panelInfo?.activePanelId === null || panelInfo?.activePanelId === undefined;

      // The dialog is modal: everything behind it goes inert, focus starts on
      // its first control and returns to the opener when it closes.
      useEffect(() => {
        if (!moreOpen) return undefined;
        const overlay = overlayRef.current;
        const root = overlay === null ? null : overlay.parentElement;
        const fenced = [];
        if (root !== null) for (const node of root.children) if (node !== overlay) fenced.push(node);
        if (overlay !== null) {
          for (const node of overlay.children) if (!node.classList.contains('modal-backdrop')) fenced.push(node);
        }
        for (const node of fenced) if ('inert' in node) node.inert = true;
        focusWhenReady(() => overlayRef.current, ['.modal button'], 4);
        return () => {
          for (const node of fenced) if ('inert' in node) node.inert = false;
          const back = returnFocus.current;
          returnFocus.current = null;
          if (back !== null && back.isConnected && typeof back.focus === 'function') back.focus({ preventScroll: true });
        };
      }, [moreOpen]);

      if (!cubeVisible) return null;

      const items = workspaceState?.items ?? [];
      const targetWorkspaceId =
        ui.workspaceId ??
        (ui.sessionId !== undefined
          ? items.find((item) => (item.sessionIds ?? []).includes(ui.sessionId))?.workspaceId
          : undefined);

      const closeMore = () => channel.update({ moreOpen: false });

      const startSession = () => {
        channel.update({
          moreOpen: false,
          mode: 'inside',
          closed: false,
          ...(targetWorkspaceId === undefined ? {} : { workspaceId: targetWorkspaceId }),
        });
        actions.startSession(targetWorkspaceId);
      };

      const openPanel = (panelId) => {
        closeMore();
        actions.selectPanel(panelId);
      };

      const openMore = () => {
        if (moreOpen) {
          closeMore();
          return;
        }
        returnFocus.current = document.activeElement;
        channel.update({ moreOpen: true, dockOpen: false });
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
        { id: 'more', icon: 'dots', label: t('nav.more'), run: openMore },
      ];

      const setScale = (next) => {
        const value = clamp(Math.round(next * 10) / 10, SCALE_MIN, SCALE_MAX);
        writeScale(value);
        channel.update({ scale: value });
      };
      // Read the live value: repeated clicks must each build on the last one.
      const stepScale = (delta) => setScale(channel.getSnapshot().scale + delta);
      const percent = Math.round(ui.scale * 100) + '%';

      const sizeControls = (className) =>
        h(
          'div',
          { className, role: 'group', 'aria-label': t('size.title') },
          h(
            'button',
            {
              type: 'button',
              'aria-label': t('size.smaller'),
              title: t('size.smaller'),
              disabled: ui.scale <= SCALE_MIN,
              onClick: () => stepScale(-0.1),
            },
            h(Icon, { name: 'minus' }),
          ),
          h(
            'button',
            {
              type: 'button',
              className: 'size-value',
              'aria-label': t('size.reset') + ' (' + percent + ')',
              title: t('size.reset'),
              onClick: () => setScale(1),
            },
            percent,
          ),
          h(
            'button',
            {
              type: 'button',
              'aria-label': t('size.larger'),
              title: t('size.larger'),
              disabled: ui.scale >= SCALE_MAX,
              onClick: () => stepScale(0.1),
            },
            h(Icon, { name: 'plus' }),
          ),
        );

      const moreRow = (name, note, control) =>
        h(
          'div',
          { className: 'modal-row' },
          h(
            'div',
            { className: 'mr-text' },
            h('span', { className: 'mr-name' }, name),
            note === undefined ? null : h('span', { className: 'mr-note' }, note),
          ),
          control,
        );

      const openButton = (name, run, disabled) =>
        h(
          'button',
          {
            type: 'button',
            className: 'ghost-btn',
            'aria-label': t('more.openNamed', { name }),
            disabled: disabled === true,
            onClick: run,
          },
          t('more.open'),
        );

      const showDiagnostics = () => {
        const none = t('diag.none');
        try {
          const panel = document.querySelector('.face-conv');
          const rect = panel === null ? null : panel.getBoundingClientRect();
          const scroller = document.querySelector('.face-conv [data-conversation-scroll]');
          setDiag({
            viewport: window.innerWidth + ' x ' + window.innerHeight + ' @' + window.devicePixelRatio,
            mode: document.querySelector('.cube-ui')?.getAttribute('data-mode') ?? '?',
            panel: rect === null ? none : Math.round(rect.width) + ' x ' + Math.round(rect.height),
            scroller: scroller === null ? none : scroller.clientHeight + ' / ' + scroller.scrollHeight,
            scrollTop: scroller === null ? none : Math.round(scroller.scrollTop),
            agent: navigator.userAgent,
          });
        } catch (error) {
          setDiag({ error: String(error && error.message) });
        }
      };

      return h(
        'div',
        { className: 'cube-ui-overlay', 'data-cube-chrome': '', ref: overlayRef },
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
                  'aria-haspopup': quadrant.id === 'more' ? 'dialog' : undefined,
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
                  if (event.target === event.currentTarget) closeMore();
                },
              },
              h(
                'div',
                {
                  className: 'modal',
                  role: 'dialog',
                  'aria-modal': 'true',
                  'aria-labelledby': 'cube-ui-more-title',
                  onKeyDown: trapTab,
                },
                h(
                  'div',
                  { className: 'modal-head' },
                  h('h2', { id: 'cube-ui-more-title' }, t('more.title')),
                  h(
                    'button',
                    {
                      type: 'button',
                      className: 'icon-btn',
                      'aria-label': t('more.close'),
                      title: t('more.close'),
                      onClick: closeMore,
                    },
                    h(Icon, { name: 'close' }),
                  ),
                ),
                h('p', { className: 'modal-sub' }, t('more.sub')),
                moreRow(
                  t('more.settings'),
                  IS_DESKTOP ? t('dock.settingsDesktop') : t('more.settingsMeta'),
                  openButton(
                    t('more.settings'),
                    () => {
                      closeMore();
                      actions.openSettings();
                    },
                    IS_DESKTOP,
                  ),
                ),
                moreRow(t('more.plugins'), t('more.pluginsMeta'), openButton(t('more.plugins'), () => openPanel('plugins'))),
                moreRow(
                  t('more.schedules'),
                  t('more.schedulesMeta'),
                  openButton(t('more.schedules'), () => openPanel('schedules')),
                ),
                moreRow(t('more.size'), undefined, sizeControls('size-inline')),
                moreRow(
                  t('more.guide'),
                  t('more.guideMeta'),
                  h(
                    'button',
                    {
                      type: 'button',
                      className: 'ghost-btn',
                      'aria-label': t('more.openNamed', { name: t('more.guide') }),
                      onClick: () => {
                        writeStored(ONBOARD_KEY, null);
                        writeStored(HINT_KEY, null);
                        channel.update({ moreOpen: false, tour: 0, hintHidden: false, mode: 'browse', closed: true });
                      },
                    },
                    t('more.show'),
                  ),
                ),
                moreRow(
                  t('more.diagnostics'),
                  t('more.diagnosticsMeta'),
                  openButton(t('more.diagnostics'), showDiagnostics),
                ),
                diag === null
                  ? null
                  : h(
                      'pre',
                      { className: 'modal-note diag' },
                      Object.entries(diag).map(([key, value]) => key + ': ' + value).join('\n'),
                    ),
                h('p', { className: 'modal-note' }, t('more.version', { version: VERSION })),
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
              hidden: !ui.dockOpen,
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
                  disabled: IS_DESKTOP,
                  onClick: () => {
                    channel.update({ dockOpen: false });
                    actions.openSettings();
                  },
                },
                h(Icon, { name: 'gear', className: 'di-ico' }),
                t('dock.settings'),
                h('span', { className: 'di-meta' }, IS_DESKTOP ? t('dock.settingsDesktop') : t('dock.settingsMeta')),
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
          sizeControls('size-pill'),
          h(
            'button',
            {
              type: 'button',
              className: 'dock-toggle',
              'aria-expanded': ui.dockOpen ? 'true' : 'false',
              'aria-controls': 'cube-ui-dock-panel',
              'aria-label': t('dock.title'),
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
    const inject = [
      'slots',
      'locale',
      'layout',
      'uiWorkspace',
      'shortcuts',
      'remote',
    ];

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

    // ---------------------------------------------------------------------
    // Agent preset (mode) control in the composer tool row
    //
    // The host lets a Session's agent preset change only before its first
    // turn, and the standard UI offers the choice on the New Session screen
    // only — a screen the cube never shows, because "new session" drops
    // straight into the conversation. This entry restores the choice inside
    // the conversation: it sits to the right of the permission control, lists
    // the host roster, applies the pick through the agentPresets Remote, and
    // reports the lock once the conversation has started.
    // ---------------------------------------------------------------------

    const AGENT_MODE_KEYS = {
      standard: 'mode.standard',
      cordis: 'mode.creator',
      ptc: 'mode.ptc',
      minimal: 'mode.minimal',
    };

    // The roster is deployment-wide: read it once and share it across every
    // mounted composer (the entry remounts on each Session switch).
    let agentModeRoster = null;

    function agentModeName(option, t) {
      const key = AGENT_MODE_KEYS[option.id];
      if (key !== undefined) return t(key);
      return option.name ?? option.id;
    }

    function AgentModeSelect(props) {
      const { sessionId, useSessions, t, modes } = props;
      const presetId = useSessions((state) => {
        const value =
          sessionId === undefined ? undefined : state?.byId?.[sessionId]?.projectionValues?.agentPreset;
        return typeof value === 'string' ? value : undefined;
      });
      const blank = useSessions(
        (state) => sessionId !== undefined && state?.byId?.[sessionId]?.blank === true,
      );
      const [roster, setRoster] = useState(agentModeRoster);
      const [open, setOpen] = useState(false);
      const [menuBox, setMenuBox] = useState(null);
      const [busy, setBusy] = useState(false);
      const [failure, setFailure] = useState(null);
      const rootRef = useRef(null);

      // A refusal leaves the control out of the row rather than offering a
      // menu the deployment cannot fill.
      useEffect(() => {
        if (agentModeRoster !== null || modes === undefined) return undefined;
        let alive = true;
        Promise.resolve()
          .then(() => modes.load())
          .then((result) => {
            if (!alive || result?.ok !== true) return;
            agentModeRoster = result.value;
            setRoster(result.value);
          })
          .catch((error) => {
            console.warn('[cube-ui] agent preset roster unavailable:', error);
          });
        return () => {
          alive = false;
        };
      }, [modes]);

      // The composer row sits inside the rotated face, so the menu is a plain
      // child anchored above the trigger instead of a body portal.
      useEffect(() => {
        if (!open) return undefined;
        const onPointerDown = (event) => {
          const root = rootRef.current;
          if (root !== null && !root.contains(event.target)) setOpen(false);
        };
        const onKeyDown = (event) => {
          if (event.key !== 'Escape' || event.isComposing) return;
          setOpen(false);
          // Keep the cube's own Escape (leave the inside view) out of it.
          event.stopPropagation();
          rootRef.current?.querySelector('.cube-mode-trigger')?.focus({ preventScroll: true });
        };
        document.addEventListener('pointerdown', onPointerDown, true);
        document.addEventListener('keydown', onKeyDown, true);
        return () => {
          document.removeEventListener('pointerdown', onPointerDown, true);
          document.removeEventListener('keydown', onKeyDown, true);
        };
      }, [open]);

      const options = (roster?.presets ?? []).filter((option) => option.broken === undefined);
      if (modes === undefined || sessionId === undefined || options.length < 2) return null;

      const locked = !blank;
      const currentId = presetId ?? options.find((option) => option.isDefault === true)?.id;
      const current = options.find((option) => option.id === currentId);
      const label = current === undefined ? t('mode.label') : agentModeName(current, t);

      // The face clips its children, so measure it before opening and keep the
      // menu inside it: narrow cubes (size pill below 100%) would otherwise
      // cut the menu's right edge off. Shares measureInFace() with the
      // session menu in the conversation header.
      const openMenu = () => {
        const root = rootRef.current;
        const box = measureInFace(root === null ? null : root.querySelector('.cube-mode-trigger'));
        if (box !== null) {
          const { scale, faceRect, rect } = box;
          const margin = 8;
          const faceWidth = faceRect.width / scale;
          const width = Math.max(180, Math.min(252, Math.round(faceWidth - margin * 2)));
          let left = Math.round((faceRect.right - margin * scale - width * scale - rect.left) / scale);
          if (left > 0) left = 0;
          const floor = Math.round((faceRect.left + margin * scale - rect.left) / scale);
          if (left < floor) left = floor;
          const above = Math.floor((rect.top - faceRect.top) / scale - margin - 6);
          setMenuBox({ left, width, maxHeight: Math.max(96, Math.min(232, above)) });
        } else {
          setMenuBox(null);
        }
        setOpen(true);
        focusWhenReady(() => rootRef.current, ['.cube-mode-item[aria-current="true"]', '.cube-mode-item'], 4);
      };

      const pick = (option) => {
        if (locked || busy) return;
        setBusy(true);
        setFailure(null);
        Promise.resolve()
          .then(() => modes.select(sessionId, option.id))
          .then((result) => {
            if (result?.ok === true) {
              setOpen(false);
              return;
            }
            const code = result?.error?.code;
            setFailure(
              code === 'agent-preset/locked'
                ? t('mode.locked')
                : result?.error?.message ?? t('mode.error'),
            );
          })
          .catch((error) => {
            setFailure(error instanceof Error ? error.message : String(error));
          })
          .then(() => setBusy(false));
      };

      return h(
        'span',
        { className: 'cube-mode' + (open ? ' open' : ''), ref: rootRef },
        h(
          'button',
          {
            type: 'button',
            className: 'cube-mode-trigger',
            disabled: locked || busy,
            title: locked ? t('mode.locked') : t('mode.hint'),
            'aria-label': t('mode.label') + ': ' + label,
            'aria-expanded': open ? 'true' : 'false',
            'aria-controls': open ? 'cube-ui-mode-menu' : undefined,
            onClick: () => {
              if (locked || busy) return;
              if (open) {
                setOpen(false);
                return;
              }
              openMenu();
            },
          },
          h(Icon, { name: 'layers', className: 'cube-mode-glyph' }),
          h('span', { className: 'cube-mode-text' }, label),
          h(Icon, { name: 'chevronDown', className: 'cube-mode-caret' }),
        ),
        open
          ? h(
              'div',
              {
                className: 'cube-mode-menu',
                id: 'cube-ui-mode-menu',
                role: 'group',
                'aria-label': t('mode.label'),
                onKeyDown: onMenuKeyDown,
                style:
                  menuBox === null
                    ? undefined
                    : { left: menuBox.left + 'px', width: menuBox.width + 'px', maxHeight: menuBox.maxHeight + 'px' },
              },
              options.map((option) =>
                h(
                  'button',
                  {
                    key: option.id,
                    type: 'button',
                    className: 'cube-mode-item' + (option.id === currentId ? ' current' : ''),
                    'aria-current': option.id === currentId ? 'true' : undefined,
                    disabled: busy,
                    title: option.description ?? undefined,
                    onClick: () => pick(option),
                  },
                  h(
                    'span',
                    { className: 'cube-mode-item-name' },
                    h('span', {}, agentModeName(option, t)),
                    option.id === currentId
                      ? h(Icon, { name: 'check', className: 'cube-mode-check' })
                      : null,
                  ),
                  option.description === undefined
                    ? null
                    : h('span', { className: 'cube-mode-item-desc' }, option.description),
                ),
              ),
              failure === null
                ? null
                : h('div', { className: 'cube-mode-error', role: 'alert' }, failure),
            )
          : null,
      );
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
        moreOpen: false,
        dockOpen: false,
        lastSession: {},
        /** Step of the first-run guide, or null once it was seen. */
        tour: readStored(ONBOARD_KEY) === null ? 0 : null,
        hintHidden: readStored(HINT_KEY) !== null,
        /** Last failed host call, shown as a toast: { key, at }. */
        notice: null,
      });

      // Host calls may throw or reject; either way the user sees a toast and
      // the console keeps the detail.
      const guarded = (name, noticeKey, run) => {
        const fail = (error) => {
          console.warn('[cube-ui] ' + name + ' failed:', error);
          channel.update({ notice: { key: noticeKey, at: Date.now() } });
        };
        try {
          const result = run();
          if (result !== null && typeof result === 'object' && typeof result.then === 'function') {
            result.then(
              (value) => {
                if (value !== null && typeof value === 'object' && value.ok === false) fail(value.error);
              },
              fail,
            );
          }
        } catch (error) {
          fail(error);
        }
      };

      const actions = {
        openSession(sessionId) {
          guarded('openSession', 'error.openSession', () => ctx.uiWorkspace.openSession(sessionId));
        },
        startSession(workspaceId) {
          guarded('startSession', 'error.startSession', () => ctx.uiWorkspace.startSession(workspaceId));
        },
        selectPanel(panelId) {
          guarded('selectPanel', 'error.selectPanel', () => ctx.layout.selectPanel(panelId));
        },
        openSettings() {
          guarded('openSettings', 'error.openSettings', () => openSettings(ctx));
        },
        /** Show the standard sidebar (where Workspaces are added). */
        openSidebar() {
          guarded('openSidebar', 'error.sidebar', () => {
            const frame = sidebarFrame();
            const collapsed =
              frame === null
                ? document.querySelector('[data-sidebar-collapsed]') !== null
                : frame.hasAttribute('data-sidebar-collapsed');
            // Expanded already: toggling would hide it.
            if (frame !== null && !collapsed) return;
            ctx.layout.toggleSidebar();
          });
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

      // The preset (mode) picker the shipped New Session screen would offer.
      // The cube never shows that screen — "new session" opens the
      // conversation directly — so the choice is restored in the composer's
      // tool row, immediately right of the permission control. A Session
      // keeps its preset once its first turn has run; the control reports
      // that instead of promising a late switch.
      // Read the namespace through the service table instead of declaring
      // `remote.agentPresets` as an injection: the cube must keep working when
      // a deployment composes no agent presets (the control then stays hidden).
      const presetNamespace = () =>
        ctx.get?.('remote.agentPresets') ?? ctx.get?.('remote')?.agentPresets;

      const agentModes = {
        load: () => presetNamespace().list(),
        select: (sessionId, presetId) => presetNamespace().select(sessionId, presetId),
      };

      ctx.slots.inject('conversation.input.left', () =>
        ctx.slots.register(
          {
            name: 'conversation.input.left',
            id: 'cube-ui-agent-mode',
            order: 0,
            locale: LOCALE_NS,
            inject: () => ({ modes: agentModes }),
          },
          AgentModeSelect,
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

      // Default view: the left sidebar collapsed — on the first visit only.
      // Afterwards the sidebar is the user's: a reload never re-collapses a
      // sidebar they opened. Only the API can move it, and only after the
      // frame has mounted, so retry briefly; when the frame (and so the
      // sidebar's state) cannot be read, do nothing rather than toggle blind.
      // Narrow windows use the drawer, where the same call would open it —
      // leave those alone.
      ctx.effect(() => {
        if (typeof window === 'undefined' || typeof document === 'undefined' || window.innerWidth < 1024) return;
        if (readStored(SIDEBAR_KEY) !== null) return;
        let tries = 0;
        let timer = 0;
        let done = false;
        const collapse = () => {
          if (done) return;
          const frame = sidebarFrame();
          if (frame === null) {
            if (tries < 20) {
              tries += 1;
              timer = window.setTimeout(collapse, 100);
            }
            return;
          }
          done = true;
          writeStored(SIDEBAR_KEY, '1');
          if (frame.hasAttribute('data-sidebar-collapsed') || frame.hasAttribute('data-sidebar-drawer')) return;
          try {
            ctx.layout.toggleSidebar();
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
     * The app frame carries the sidebar state as data attributes. The right
     * bar column is always rendered, so its parent is the frame.
     */
    function sidebarFrame() {
      if (typeof document === 'undefined') return null;
      return document.querySelector('[data-rightbar-col]')?.parentElement ?? null;
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
