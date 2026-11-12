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
    const VERSION = __PACKAGE_VERSION__;
    const STYLES = __STYLES_JSON__;
    const LOCALE_DICTS = __LOCALE_JSON__;

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
