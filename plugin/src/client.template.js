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
    const VERSION = __PACKAGE_VERSION__;
    const STYLES = __STYLES_JSON__;
    const LOCALE_DICTS = __LOCALE_JSON__;

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
          if (event.key !== 'Escape') return;
          setOpen(false);
          // Keep the cube's own Escape (leave the inside view) out of it.
          event.stopPropagation();
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
      // cut the menu's right edge off. The face is perspective-projected, so
      // screen rects are scaled against its CSS width and converted back.
      const openMenu = () => {
        const root = rootRef.current;
        const trigger = root === null ? null : root.querySelector('.cube-mode-trigger');
        const face = root === null ? null : root.closest('.face');
        if (trigger !== null && face !== null && face.offsetWidth > 0) {
          const triggerRect = trigger.getBoundingClientRect();
          const faceRect = face.getBoundingClientRect();
          const scale = faceRect.width / face.offsetWidth;
          const margin = 8;
          const width = Math.max(180, Math.min(252, Math.round(face.offsetWidth - margin * 2)));
          let left = Math.round((faceRect.right - margin * scale - width * scale - triggerRect.left) / scale);
          if (left > 0) left = 0;
          const floor = Math.round((faceRect.left + margin * scale - triggerRect.left) / scale);
          if (left < floor) left = floor;
          setMenuBox({ left, width });
        } else {
          setMenuBox(null);
        }
        setOpen(true);
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
            'aria-haspopup': 'listbox',
            'aria-expanded': open ? 'true' : 'false',
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
                role: 'listbox',
                'aria-label': t('mode.label'),
                style: menuBox === null ? undefined : { left: menuBox.left + 'px', width: menuBox.width + 'px' },
              },
              options.map((option) =>
                h(
                  'button',
                  {
                    key: option.id,
                    type: 'button',
                    role: 'option',
                    className: 'cube-mode-item' + (option.id === currentId ? ' current' : ''),
                    'aria-selected': option.id === currentId ? 'true' : 'false',
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
