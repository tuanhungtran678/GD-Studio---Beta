import React, { useEffect, useRef, useCallback, useState } from 'react';
import {
  EditorTool,
  GDLevel,
  GDObject,
  GamemodeId,
  PlaytestStats,
  SpeedId,
} from '../types/gd';
import {
  GAMEMODE_NAMES,
  SPEED_UNITS_PER_SEC,
  getObjectDef,
  nextUid,
} from '../data/gdCatalog';
import {
  drawBackgroundPattern,
  drawGDObject,
  drawGroundPattern,
  drawPlayerIcon,
} from '../utils/gdRenderer';
import { gdAudio } from '../utils/gdAudio';
import { hexToRgb } from '../utils/gdCodec';
import { BotReplayPlan, planBotReplay } from '../utils/gdLevelTester';
import { Bot, CheckCircle2, Play, RotateCcw, ShieldAlert, Square, Volume2, VolumeX } from 'lucide-react';

interface LevelCanvasProps {
  level: GDLevel;
  activeObjectId: number;
  tool: EditorTool;
  snapToGrid: boolean;
  selectedUids: string[];
  isPlaytesting: boolean;
  aiBotActive?: boolean;
  onAiBotResult?: (
    result: 'possible' | 'impossible',
    info: { crashX: number; attempts: number }
  ) => void;
  zoom: number;
  onZoomChange: (nextZoom: number) => void;
  onSelectUids: (uids: string[]) => void;
  onChangeObjects: (updater: (prev: GDObject[]) => GDObject[], recordHistory?: boolean) => void;
  onStopPlaytest: () => void;
  cameraResetKey?: number;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  color: string;
  size: number;
}

interface TrailPoint {
  x: number;
  y: number;
}

interface ActiveColorTween {
  targetId: number; // 1000 BG, 1001 Ground, 1002 Line
  from: { r: number; g: number; b: number };
  to: { r: number; g: number; b: number };
  elapsed: number;
  duration: number;
}

interface ActiveMoveTween {
  groupId: number;
  dx: number;
  dy: number;
  elapsed: number;
  duration: number;
  appliedDx: number;
  appliedDy: number;
}

interface ActiveAlphaTween {
  groupId: number;
  from: number;
  to: number;
  elapsed: number;
  duration: number;
}

export const LevelCanvas: React.FC<LevelCanvasProps> = ({
  level,
  activeObjectId,
  tool,
  snapToGrid,
  selectedUids,
  isPlaytesting,
  aiBotActive = false,
  onAiBotResult,
  zoom,
  onZoomChange,
  onSelectUids,
  onChangeObjects,
  onStopPlaytest,
  cameraResetKey = 0,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  // Camera state in GD units
  const camRef = useRef({ x: -120, y: -45 });

  useEffect(() => {
    if (cameraResetKey > 0) {
      camRef.current = { x: -120, y: -45 };
    }
  }, [cameraResetKey]);
  const spaceHeldRef = useRef(false);
  const [cursorCoords, setCursorCoords] = useState<{ x: number; y: number } | null>(null);
  const [muted, setMuted] = useState(false);

  // Live AI Bot playtest state
  const MAX_BOT_ATTEMPTS = 3;
  const [botSpeed, setBotSpeed] = useState<1 | 1.5 | 2>(1.5);
  const botSpeedRef = useRef<number>(1.5);
  useEffect(() => {
    botSpeedRef.current = botSpeed;
  }, [botSpeed]);

  const [botVerdict, setBotVerdict] = useState<'testing' | 'possible' | 'impossible'>('testing');
  const botVerdictRef = useRef<'testing' | 'possible' | 'impossible'>('testing');
  const botPlanRef = useRef<BotReplayPlan | null>(null);
  const botTickRef = useRef<number>(0);
  const botCrashXRef = useRef<number>(0);
  const botResultTimerRef = useRef<number | null>(null);
  const botResultSentRef = useRef<boolean>(false);
  const onAiBotResultRef = useRef(onAiBotResult);
  useEffect(() => {
    onAiBotResultRef.current = onAiBotResult;
  }, [onAiBotResult]);

  // Interaction state
  const dragRef = useRef<{
    type: 'none' | 'pan' | 'marquee' | 'move' | 'swipe' | 'erase';
    startScreenX: number;
    startScreenY: number;
    startCamX: number;
    startCamY: number;
    curScreenX: number;
    curScreenY: number;
    moveStartWorldX: number;
    moveStartWorldY: number;
    initialPositions: Map<string, { x: number; y: number }>;
    paintedCells: Set<string>;
  }>({
    type: 'none',
    startScreenX: 0,
    startScreenY: 0,
    startCamX: 0,
    startCamY: 0,
    curScreenX: 0,
    curScreenY: 0,
    moveStartWorldX: 0,
    moveStartWorldY: 0,
    initialPositions: new Map(),
    paintedCells: new Set(),
  });

  // Playtest Engine Ref
  const [playStats, setPlayStats] = useState<PlaytestStats>({
    running: false,
    progress: 0,
    attempt: 1,
    gamemode: level.meta.startMode,
    speed: level.meta.startSpeed,
    gravityInverted: level.meta.flipGravity,
    coinsCollected: 0,
    totalCoins: 0,
    dead: false,
    completed: false,
  });

  const playRef = useRef<{
    x: number;
    y: number;
    vy: number;
    angle: number;
    mode: GamemodeId;
    speed: SpeedId;
    gravity: number; // 1 = normal, -1 = inverted
    onGround: boolean;
    inputHeld: boolean;
    inputBufferTimer: number;
    dead: boolean;
    deadTimer: number;
    completed: boolean;
    attempt: number;
    triggeredUids: Set<string>;
    collectedCoins: Set<string>;
    particles: Particle[];
    trail: TrailPoint[];
    bgRgb: { r: number; g: number; b: number };
    groundRgb: { r: number; g: number; b: number };
    lineRgb: { r: number; g: number; b: number };
    colorTweens: ActiveColorTween[];
    moveTweens: ActiveMoveTween[];
    alphaTweens: ActiveAlphaTween[];
    groupOffsets: Map<number, { x: number; y: number }>;
    groupAlpha: Map<number, number>;
    endX: number;
    robotHoldTimer: number;
  }>({
    x: 0,
    y: 15,
    vy: 0,
    angle: 0,
    mode: 0,
    speed: 0,
    gravity: 1,
    onGround: true,
    inputHeld: false,
    inputBufferTimer: 0,
    dead: false,
    deadTimer: 0,
    completed: false,
    attempt: 1,
    triggeredUids: new Set(),
    collectedCoins: new Set(),
    particles: [],
    trail: [],
    bgRgb: hexToRgb(level.meta.bgColor),
    groundRgb: hexToRgb(level.meta.groundColor),
    lineRgb: hexToRgb(level.meta.lineColor),
    colorTweens: [],
    moveTweens: [],
    alphaTweens: [],
    groupOffsets: new Map(),
    groupAlpha: new Map(),
    endX: 3000,
    robotHoldTimer: 0,
  });

  const resetPlaytest = useCallback(
    (incrementAttempt = false) => {
      const maxObjX =
        level.objects.length > 0
          ? Math.max(...level.objects.map((o) => o.x)) + 300
          : 1500;
      const totalCoins = level.objects.filter((o) => o.id === 1329).length;
      const nextAttempt = incrementAttempt ? playRef.current.attempt + 1 : 1;

      playRef.current = {
        x: 0,
        y: level.meta.flipGravity ? 345 : 15,
        vy: 0,
        angle: 0,
        mode: level.meta.startMode,
        speed: level.meta.startSpeed,
        gravity: level.meta.flipGravity ? -1 : 1,
        onGround: true,
        inputHeld: false,
        inputBufferTimer: 0,
        dead: false,
        deadTimer: 0,
        completed: false,
        attempt: nextAttempt,
        triggeredUids: new Set(),
        collectedCoins: new Set(),
        particles: [],
        trail: [],
        bgRgb: hexToRgb(level.meta.bgColor),
        groundRgb: hexToRgb(level.meta.groundColor),
        lineRgb: hexToRgb(level.meta.lineColor),
        colorTweens: [],
        moveTweens: [],
        alphaTweens: [],
        groupOffsets: new Map(),
        groupAlpha: new Map(),
        endX: Math.max(900, maxObjX),
        robotHoldTimer: 0,
      };

      botTickRef.current = 0;

      camRef.current.x = -160;
      camRef.current.y = -35;

      setPlayStats({
        running: true,
        progress: 0,
        attempt: nextAttempt,
        gamemode: level.meta.startMode,
        speed: level.meta.startSpeed,
        gravityInverted: level.meta.flipGravity,
        coinsCollected: 0,
        totalCoins,
        dead: false,
        completed: false,
      });
    },
    [level]
  );

  // Start/reset playtest when mode toggles
  useEffect(() => {
    if (botResultTimerRef.current !== null) {
      window.clearTimeout(botResultTimerRef.current);
      botResultTimerRef.current = null;
    }

    if (isPlaytesting) {
      if (aiBotActive) {
        botPlanRef.current = planBotReplay(level);
        botCrashXRef.current = 0;
        botResultSentRef.current = false;
        botVerdictRef.current = 'testing';
        setBotVerdict('testing');
      } else {
        botPlanRef.current = null;
      }
      resetPlaytest(false);
    } else {
      playRef.current.inputHeld = false;
      playRef.current.inputBufferTimer = 0;
      botPlanRef.current = null;
      botVerdictRef.current = 'testing';
      setBotVerdict('testing');
    }

    return () => {
      if (botResultTimerRef.current !== null) {
        window.clearTimeout(botResultTimerRef.current);
        botResultTimerRef.current = null;
      }
    };
  }, [isPlaytesting, aiBotActive, level, resetPlaytest]);

  // Coordinate conversions
  const screenToWorld = useCallback(
    (sx: number, sy: number, canvasHeight: number) => {
      const groundScreenY = canvasHeight * 0.74;
      const wx = sx / zoom + camRef.current.x;
      const wy = (groundScreenY - sy) / zoom + camRef.current.y;
      return { wx, wy };
    },
    [zoom]
  );

  const worldToScreen = useCallback(
    (wx: number, wy: number, canvasHeight: number) => {
      const groundScreenY = canvasHeight * 0.74;
      const sx = (wx - camRef.current.x) * zoom;
      const sy = groundScreenY - (wy - camRef.current.y) * zoom;
      return { sx, sy };
    },
    [zoom]
  );

  const snapCoord = useCallback(
    (wx: number, wy: number) => {
      if (!snapToGrid) {
        return { x: Math.round(wx), y: Math.max(15, Math.round(wy)) };
      }
      const gx = Math.floor(wx / 30) * 30 + 15;
      const gy = Math.max(15, Math.floor(wy / 30) * 30 + 15);
      return { x: gx, y: gy };
    },
    [snapToGrid]
  );

  // Keyboard bindings (Playtest jump + Editor pan/shortcuts)
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

      if (isPlaytesting) {
        if (e.code === 'Escape') {
          e.preventDefault();
          onStopPlaytest();
          return;
        }
        if (aiBotActive) return;
        if (e.code === 'Space' || e.code === 'ArrowUp' || e.code === 'KeyW') {
          e.preventDefault();
          if (!playRef.current.inputHeld) {
            playRef.current.inputBufferTimer = 0.095;
          }
          playRef.current.inputHeld = true;
        } else if (e.code === 'KeyR') {
          e.preventDefault();
          resetPlaytest(true);
        }
        return;
      }

      if (e.code === 'Space') {
        spaceHeldRef.current = true;
      }
    };

    const onKeyUp = (e: KeyboardEvent) => {
      if (isPlaytesting) {
        if (aiBotActive) return;
        if (e.code === 'Space' || e.code === 'ArrowUp' || e.code === 'KeyW') {
          playRef.current.inputHeld = false;
        }
        return;
      }
      if (e.code === 'Space') {
        spaceHeldRef.current = false;
      }
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, [isPlaytesting, aiBotActive, onStopPlaytest, resetPlaytest]);

  // Hit-testing an object at world coordinates
  const findObjectAt = useCallback(
    (wx: number, wy: number): GDObject | null => {
      for (let i = level.objects.length - 1; i >= 0; i--) {
        const obj = level.objects[i];
        const def = getObjectDef(obj.id);
        const s = obj.scale ?? 1;
        const hw = Math.max(15, (def.width * s) / 2);
        const hh = Math.max(15, (def.height * s) / 2);
        if (Math.abs(wx - obj.x) <= hw && Math.abs(wy - obj.y) <= hh) {
          return obj;
        }
      }
      return null;
    },
    [level.objects]
  );

  // Place object helper
  const placeObjectAt = useCallback(
    (wx: number, wy: number, recordHistory: boolean) => {
      const { x, y } = snapCoord(wx, wy);
      const def = getObjectDef(activeObjectId);
      const exists = level.objects.some(
        (o) => o.id === activeObjectId && Math.abs(o.x - x) < 2 && Math.abs(o.y - y) < 2
      );
      if (exists) return;

      const newObj: GDObject = {
        uid: nextUid(),
        id: activeObjectId,
        x,
        y,
        ...(def.defaultProps ? { ...def.defaultProps } : {}),
      };
      onChangeObjects((prev) => [...prev, newObj], recordHistory);
      onSelectUids([newObj.uid]);
    },
    [activeObjectId, level.objects, onChangeObjects, onSelectUids, snapCoord]
  );

  // Pointer Handlers
  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.setPointerCapture(e.pointerId);

    if (isPlaytesting) {
      if (!aiBotActive && e.button === 0) {
        if (!playRef.current.inputHeld) {
          playRef.current.inputBufferTimer = 0.095;
        }
        playRef.current.inputHeld = true;
      }
      return;
    }

    const rect = canvas.getBoundingClientRect();
    const sx = e.clientX - rect.left;
    const sy = e.clientY - rect.top;
    const { wx, wy } = screenToWorld(sx, sy, rect.height);

    // Middle click, Space+click, or Pan tool -> Pan camera
    if (e.button === 1 || spaceHeldRef.current || tool === 'pan') {
      dragRef.current = {
        ...dragRef.current,
        type: 'pan',
        startScreenX: sx,
        startScreenY: sy,
        startCamX: camRef.current.x,
        startCamY: camRef.current.y,
        curScreenX: sx,
        curScreenY: sy,
      };
      return;
    }

    // Right click -> Erase
    if (e.button === 2 || tool === 'delete') {
      const hit = findObjectAt(wx, wy);
      if (hit) {
        onChangeObjects((prev) => prev.filter((o) => o.uid !== hit.uid), true);
        onSelectUids(selectedUids.filter((u) => u !== hit.uid));
      }
      dragRef.current = {
        ...dragRef.current,
        type: 'erase',
        startScreenX: sx,
        startScreenY: sy,
        curScreenX: sx,
        curScreenY: sy,
      };
      return;
    }

    // Select tool
    if (tool === 'select') {
      const hit = findObjectAt(wx, wy);
      if (hit) {
        let nextSel = selectedUids;
        if (e.shiftKey) {
          nextSel = selectedUids.includes(hit.uid)
            ? selectedUids.filter((u) => u !== hit.uid)
            : [...selectedUids, hit.uid];
          onSelectUids(nextSel);
        } else if (!selectedUids.includes(hit.uid)) {
          nextSel = [hit.uid];
          onSelectUids(nextSel);
        }

        const posMap = new Map<string, { x: number; y: number }>();
        level.objects.forEach((o) => {
          if (nextSel.includes(o.uid)) {
            posMap.set(o.uid, { x: o.x, y: o.y });
          }
        });

        dragRef.current = {
          ...dragRef.current,
          type: 'move',
          startScreenX: sx,
          startScreenY: sy,
          curScreenX: sx,
          curScreenY: sy,
          moveStartWorldX: wx,
          moveStartWorldY: wy,
          initialPositions: posMap,
        };
      } else {
        if (!e.shiftKey) onSelectUids([]);
        dragRef.current = {
          ...dragRef.current,
          type: 'marquee',
          startScreenX: sx,
          startScreenY: sy,
          curScreenX: sx,
          curScreenY: sy,
        };
      }
      return;
    }

    // Build / Swipe tool
    if (tool === 'build' || tool === 'swipe') {
      const snapped = snapCoord(wx, wy);
      const cellKey = `${snapped.x}:${snapped.y}`;
      const painted = new Set<string>([cellKey]);
      placeObjectAt(wx, wy, true);

      if (tool === 'swipe') {
        dragRef.current = {
          ...dragRef.current,
          type: 'swipe',
          startScreenX: sx,
          startScreenY: sy,
          curScreenX: sx,
          curScreenY: sy,
          paintedCells: painted,
        };
      }
    }
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const sx = e.clientX - rect.left;
    const sy = e.clientY - rect.top;
    const { wx, wy } = screenToWorld(sx, sy, rect.height);

    setCursorCoords({
      x: Math.round(wx),
      y: Math.max(0, Math.round(wy)),
    });

    if (isPlaytesting) return;

    const drag = dragRef.current;
    drag.curScreenX = sx;
    drag.curScreenY = sy;

    if (drag.type === 'pan') {
      const dx = (sx - drag.startScreenX) / zoom;
      const dy = (sy - drag.startScreenY) / zoom;
      camRef.current.x = Math.max(-400, drag.startCamX - dx);
      camRef.current.y = Math.max(-180, Math.min(480, drag.startCamY + dy));
      return;
    }

    if (drag.type === 'swipe') {
      const snapped = snapCoord(wx, wy);
      const key = `${snapped.x}:${snapped.y}`;
      if (!drag.paintedCells.has(key)) {
        drag.paintedCells.add(key);
        placeObjectAt(wx, wy, false);
      }
      return;
    }

    if (drag.type === 'erase') {
      const hit = findObjectAt(wx, wy);
      if (hit) {
        onChangeObjects((prev) => prev.filter((o) => o.uid !== hit.uid), false);
      }
      return;
    }

    if (drag.type === 'move') {
      const rawDx = wx - drag.moveStartWorldX;
      const rawDy = wy - drag.moveStartWorldY;
      const dx = snapToGrid ? Math.round(rawDx / 30) * 30 : Math.round(rawDx);
      const dy = snapToGrid ? Math.round(rawDy / 30) * 30 : Math.round(rawDy);

      onChangeObjects(
        (prev) =>
          prev.map((o) => {
            const init = drag.initialPositions.get(o.uid);
            if (!init) return o;
            return {
              ...o,
              x: Math.max(15, init.x + dx),
              y: Math.max(15, init.y + dy),
            };
          }),
        false
      );
    }
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (canvas && canvas.hasPointerCapture(e.pointerId)) {
      canvas.releasePointerCapture(e.pointerId);
    }

    if (isPlaytesting) {
      playRef.current.inputHeld = false;
      return;
    }

    const drag = dragRef.current;
    if (drag.type === 'marquee' && canvas) {
      const rect = canvas.getBoundingClientRect();
      const x1 = Math.min(drag.startScreenX, drag.curScreenX);
      const x2 = Math.max(drag.startScreenX, drag.curScreenX);
      const y1 = Math.min(drag.startScreenY, drag.curScreenY);
      const y2 = Math.max(drag.startScreenY, drag.curScreenY);
      if (x2 - x1 > 6 || y2 - y1 > 6) {
        const w1 = screenToWorld(x1, y2, rect.height);
        const w2 = screenToWorld(x2, y1, rect.height);
        const minX = Math.min(w1.wx, w2.wx);
        const maxX = Math.max(w1.wx, w2.wx);
        const minY = Math.min(w1.wy, w2.wy);
        const maxY = Math.max(w1.wy, w2.wy);
        const hits = level.objects
          .filter((o) => o.x >= minX && o.x <= maxX && o.y >= minY && o.y <= maxY)
          .map((o) => o.uid);
        onSelectUids(hits);
      }
    }

    drag.type = 'none';
  };

  const handleWheel = (e: React.WheelEvent<HTMLCanvasElement>) => {
    if (isPlaytesting) return;
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      const factor = e.deltaY < 0 ? 1.1 : 0.9;
      onZoomChange(Math.max(0.45, Math.min(2.5, Number((zoom * factor).toFixed(2)))));
    } else {
      const panDeltaX = (e.deltaX !== 0 ? e.deltaX : e.shiftKey ? e.deltaY : 0) / zoom;
      const panDeltaY = !e.shiftKey && e.deltaX === 0 ? e.deltaY / zoom : 0;
      if (e.deltaX !== 0 || e.shiftKey) {
        camRef.current.x = Math.max(-400, camRef.current.x + panDeltaX);
      } else {
        // Vertical wheel pans horizontally by default in GD editor!
        camRef.current.x = Math.max(-400, camRef.current.x + panDeltaY);
      }
    }
  };

  // Main Animation & 120Hz Fixed-Timestep Physics Loop
  useEffect(() => {
    let rafId = 0;
    let lastTime = performance.now();
    let accumulator = 0;
    const FIXED_DT = 1 / 120;

    const triggerDeath = (p: typeof playRef.current) => {
      if (p.dead || p.completed) return;
      p.dead = true;
      p.deadTimer = aiBotActive ? 0.42 : 0.72;
      if (aiBotActive) {
        botCrashXRef.current = Math.max(botCrashXRef.current, p.x);
      }
      gdAudio.playDeath();
      for (let i = 0; i < 22; i++) {
        const ang = (Math.PI * 2 * i) / 22 + Math.random() * 0.2;
        const spd = 110 + Math.random() * 240;
        p.particles.push({
          x: p.x,
          y: p.y,
          vx: Math.cos(ang) * spd,
          vy: Math.sin(ang) * spd,
          life: 0.65,
          maxLife: 0.65,
          color: i % 2 === 0 ? '#22d3ee' : '#f43f5e',
          size: 3 + Math.random() * 4,
        });
      }
    };

    const stepPhysics = (dt: number) => {
      const p = playRef.current;

      // Update particles regardless
      p.particles = p.particles
        .map((pt) => ({
          ...pt,
          x: pt.x + pt.vx * dt,
          y: pt.y + pt.vy * dt,
          vy: pt.vy - 600 * dt,
          life: pt.life - dt,
        }))
        .filter((pt) => pt.life > 0);

      if (p.dead) {
        p.deadTimer -= dt;
        if (p.deadTimer <= 0) {
          if (aiBotActive) {
            if (p.attempt >= MAX_BOT_ATTEMPTS) {
              if (botVerdictRef.current === 'testing') {
                botVerdictRef.current = 'impossible';
                setBotVerdict('impossible');
                const crashAt = botCrashXRef.current;
                const totalAttempts = p.attempt;
                botResultTimerRef.current = window.setTimeout(() => {
                  if (!botResultSentRef.current) {
                    botResultSentRef.current = true;
                    onAiBotResultRef.current?.('impossible', {
                      crashX: crashAt,
                      attempts: totalAttempts,
                    });
                  }
                }, 650);
              }
              return;
            }
          }
          resetPlaytest(true);
        }
        return;
      }

      if (p.completed) return;

      // AI Bot 120Hz input controller (10-tick decision slices matching planBotReplay)
      if (aiBotActive && botPlanRef.current) {
        if (botTickRef.current % 10 === 0) {
          const sliceIdx = Math.floor(botTickRef.current / 10);
          const scripts = botPlanRef.current.attemptScripts;
          const script =
            scripts[Math.min(Math.max(0, p.attempt - 1), Math.max(0, scripts.length - 1))] || [];
          const pair = script[sliceIdx];
          const tap = pair ? pair[0] : false;
          const hold = pair ? pair[1] : false;
          if (tap) {
            p.inputBufferTimer = 0.095;
          }
          p.inputHeld = hold;
        }
        botTickRef.current += 1;
      }

      if (p.inputBufferTimer > 0) {
        p.inputBufferTimer = Math.max(0, p.inputBufferTimer - dt);
      }

      const speedUps = SPEED_UNITS_PER_SEC[p.speed];
      const pHalf = p.mode === 4 ? 8 : 15;
      const prevY = p.y;
      p.x += speedUps * dt;

      // Update Color Tweens
      p.colorTweens = p.colorTweens.filter((tw) => {
        tw.elapsed += dt;
        const t = tw.duration <= 0 ? 1 : Math.min(1, tw.elapsed / tw.duration);
        const cur = {
          r: Math.round(tw.from.r + (tw.to.r - tw.from.r) * t),
          g: Math.round(tw.from.g + (tw.to.g - tw.from.g) * t),
          b: Math.round(tw.from.b + (tw.to.b - tw.from.b) * t),
        };
        if (tw.targetId === 1000) p.bgRgb = cur;
        else if (tw.targetId === 1001) p.groundRgb = cur;
        else if (tw.targetId === 1002) p.lineRgb = cur;
        return t < 1;
      });

      // Update Move Tweens
      p.moveTweens = p.moveTweens.filter((tw) => {
        tw.elapsed += dt;
        const t = tw.duration <= 0 ? 1 : Math.min(1, tw.elapsed / tw.duration);
        const targetDx = tw.dx * t;
        const targetDy = tw.dy * t;
        const stepDx = targetDx - tw.appliedDx;
        const stepDy = targetDy - tw.appliedDy;
        tw.appliedDx = targetDx;
        tw.appliedDy = targetDy;
        const cur = p.groupOffsets.get(tw.groupId) || { x: 0, y: 0 };
        p.groupOffsets.set(tw.groupId, { x: cur.x + stepDx, y: cur.y + stepDy });
        return t < 1;
      });

      // Update Alpha Tweens
      p.alphaTweens = p.alphaTweens.filter((tw) => {
        tw.elapsed += dt;
        const t = tw.duration <= 0 ? 1 : Math.min(1, tw.elapsed / tw.duration);
        p.groupAlpha.set(tw.groupId, tw.from + (tw.to - tw.from) * t);
        return t < 1;
      });

      // Mode-specific movement & input
      const gravAcc = -3050 * p.gravity;
      if (p.mode === 0) {
        // Cube: allows continuous hold-jump on ground OR buffered tap
        if ((p.inputHeld || p.inputBufferTimer > 0) && p.onGround) {
          p.vy = 620 * p.gravity;
          p.onGround = false;
          p.inputBufferTimer = 0;
          gdAudio.playJump();
        }
        p.vy = Math.max(-920, Math.min(920, p.vy + gravAcc * dt));
        p.y += p.vy * dt;
        if (!p.onGround) {
          p.angle += 7.2 * p.gravity * dt;
        } else {
          const snap = Math.round(p.angle / (Math.PI / 2)) * (Math.PI / 2);
          p.angle += (snap - p.angle) * Math.min(1, dt * 28);
        }
      } else if (p.mode === 1) {
        // Ship
        const thrust = p.inputHeld ? 1650 * p.gravity : -1350 * p.gravity;
        p.vy = Math.max(-460, Math.min(460, p.vy + thrust * dt));
        p.y += p.vy * dt;
        p.angle = Math.max(-0.55, Math.min(0.55, -p.vy / 850));
      } else if (p.mode === 2) {
        // Ball
        if (p.inputBufferTimer > 0 && p.onGround) {
          p.gravity *= -1;
          p.vy = -140 * p.gravity;
          p.onGround = false;
          p.inputBufferTimer = 0;
          gdAudio.playJump();
        }
        p.vy = Math.max(-850, Math.min(850, p.vy + -2400 * p.gravity * dt));
        p.y += p.vy * dt;
        p.angle += 8.0 * p.gravity * dt;
      } else if (p.mode === 3) {
        // UFO
        if (p.inputBufferTimer > 0) {
          p.vy = 485 * p.gravity;
          p.onGround = false;
          p.inputBufferTimer = 0;
          gdAudio.playJump();
        }
        p.vy = Math.max(-720, Math.min(720, p.vy + -2250 * p.gravity * dt));
        p.y += p.vy * dt;
        p.angle = Math.max(-0.32, Math.min(0.32, -p.vy / 1400));
      } else if (p.mode === 4) {
        // Wave (45-deg slope)
        const dir = p.inputHeld ? 1 : -1;
        p.vy = speedUps * dir * p.gravity;
        p.y += p.vy * dt;
        p.angle = p.vy >= 0 ? -Math.PI / 4 : Math.PI / 4;
      } else if (p.mode === 5) {
        // Robot
        if (p.inputBufferTimer > 0 && p.onGround) {
          p.vy = 520 * p.gravity;
          p.onGround = false;
          p.robotHoldTimer = 0.24;
          p.inputBufferTimer = 0;
          gdAudio.playJump();
        } else if (p.inputHeld && p.robotHoldTimer > 0) {
          p.vy += 2100 * p.gravity * dt;
          p.robotHoldTimer -= dt;
        }
        p.vy = Math.max(-920, Math.min(920, p.vy + gravAcc * dt));
        p.y += p.vy * dt;
        p.angle = 0;
      } else if (p.mode === 6) {
        // Spider
        if (p.inputBufferTimer > 0 && p.onGround) {
          p.gravity *= -1;
          p.inputBufferTimer = 0;
          let targetY = p.gravity === 1 ? pHalf : 360 - pHalf;
          for (const obj of level.objects) {
            const def = getObjectDef(obj.id);
            if (def.hitbox !== 'solid') continue;
            const off = obj.groups?.[0] ? p.groupOffsets.get(obj.groups[0]) : undefined;
            const ox = obj.x + (off?.x || 0);
            const oy = obj.y + (off?.y || 0);
            const s = obj.scale ?? 1;
            const hw = (def.width * s) / 2;
            const hh = (def.height * s) / 2;
            if (Math.abs(p.x - ox) < pHalf + hw - 3) {
              if (p.gravity === -1 && oy - hh > p.y && oy - hh - pHalf < targetY) {
                targetY = oy - hh - pHalf;
              } else if (p.gravity === 1 && oy + hh < p.y && oy + hh + pHalf > targetY) {
                targetY = oy + hh + pHalf;
              }
            }
          }
          p.y = targetY;
          p.vy = 0;
          p.onGround = true;
          gdAudio.playJump();
        }
        p.vy = Math.max(-920, Math.min(920, p.vy + gravAcc * dt));
        p.y += p.vy * dt;
        p.angle = 0;
      }

      // Ground & Ceiling safe bounds
      p.onGround = false;
      const floorY = pHalf;
      const ceilingY = 360 - pHalf;

      if (p.y <= floorY) {
        p.y = floorY;
        if (p.vy < 0) p.vy = 0;
        if (p.gravity === 1) {
          p.onGround = true;
        }
      }
      if (p.y >= ceilingY) {
        p.y = ceilingY;
        triggerDeath(p);
        return;
      }

      // Resolve world positions for nearby objects
      const nearby = level.objects.filter(
        (o) => Math.abs(o.x - p.x) < 120 || getObjectDef(o.id).hitbox === 'trigger'
      );

      const solidList: { ox: number; oy: number; hw: number; hh: number }[] = [];

      for (const obj of nearby) {
        const def = getObjectDef(obj.id);
        let ox = obj.x;
        let oy = obj.y;
        if (obj.groups && obj.groups.length > 0) {
          const off = p.groupOffsets.get(obj.groups[0]);
          if (off) {
            ox += off.x;
            oy += off.y;
          }
        }

        // 1. Triggers
        if (def.hitbox === 'trigger') {
          if (!p.triggeredUids.has(obj.uid) && p.x >= ox) {
            p.triggeredUids.add(obj.uid);
            if (obj.id === 899 && obj.r !== undefined && obj.g !== undefined && obj.b !== undefined) {
              const targetId = obj.targetColorId ?? 1000;
              const fromRgb =
                targetId === 1001 ? { ...p.groundRgb } : targetId === 1002 ? { ...p.lineRgb } : { ...p.bgRgb };
              p.colorTweens.push({
                targetId,
                from: fromRgb,
                to: { r: obj.r, g: obj.g, b: obj.b },
                elapsed: 0,
                duration: obj.duration ?? 0.5,
              });
            } else if (obj.id === 901 && obj.targetGroup) {
              p.moveTweens.push({
                groupId: obj.targetGroup,
                dx: obj.moveX ?? 0,
                dy: obj.moveY ?? 0,
                elapsed: 0,
                duration: obj.duration ?? 0.5,
                appliedDx: 0,
                appliedDy: 0,
              });
            } else if (obj.id === 1007 && obj.targetGroup) {
              p.alphaTweens.push({
                groupId: obj.targetGroup,
                from: p.groupAlpha.get(obj.targetGroup) ?? 1,
                to: obj.opacity ?? 0.35,
                elapsed: 0,
                duration: obj.duration ?? 0.4,
              });
            }
          }
          continue;
        }

        const hw = (def.width * (obj.scale ?? 1)) / 2;
        const hh = (def.height * (obj.scale ?? 1)) / 2;

        if (def.hitbox === 'solid') {
          solidList.push({ ox, oy, hw, hh });
        } else if (def.hitbox === 'hazard') {
          if (obj.id === 88 || obj.id === 1705) {
            // Circular sawblade hitbox
            const dx = p.x - ox;
            const dy = p.y - oy;
            const r = Math.max(6, hw * 0.72 + pHalf * 0.65);
            if (dx * dx + dy * dy < r * r) {
              triggerDeath(p);
              return;
            }
          } else {
            // Forgiving inner spike hitbox
            const shrinkX = obj.id === 8 || obj.id === 39 ? 9 : 6;
            const shrinkY = obj.id === 8 || obj.id === 39 ? 8 : 5;
            if (
              Math.abs(p.x - ox) < pHalf * 0.75 + Math.max(3, hw - shrinkX) &&
              Math.abs(p.y - oy) < pHalf * 0.75 + Math.max(3, hh - shrinkY)
            ) {
              triggerDeath(p);
              return;
            }
          }
        } else if (def.hitbox === 'portal') {
          if (
            !p.triggeredUids.has(obj.uid) &&
            Math.abs(p.x - ox) < pHalf + hw &&
            Math.abs(p.y - oy) < pHalf + hh
          ) {
            p.triggeredUids.add(obj.uid);
            gdAudio.playPortal();
            if (obj.id === 12) p.mode = 0;
            else if (obj.id === 13) p.mode = 1;
            else if (obj.id === 47) p.mode = 2;
            else if (obj.id === 111) p.mode = 3;
            else if (obj.id === 660) p.mode = 4;
            else if (obj.id === 745) p.mode = 5;
            else if (obj.id === 1331) p.mode = 6;
            else if (obj.id === 10) p.gravity = 1;
            else if (obj.id === 11) p.gravity = -1;
            else if (obj.id === 200) p.speed = 1;
            else if (obj.id === 201) p.speed = 0;
            else if (obj.id === 202) p.speed = 2;
            else if (obj.id === 203) p.speed = 3;
            else if (obj.id === 1334) p.speed = 4;
          }
        } else if (def.hitbox === 'pad') {
          if (
            !p.triggeredUids.has(obj.uid) &&
            Math.abs(p.x - ox) < pHalf + hw &&
            Math.abs(p.y - oy) < pHalf + hh + 6
          ) {
            p.triggeredUids.add(obj.uid);
            gdAudio.playOrb();
            if (obj.id === 35) p.vy = 830 * p.gravity; // Yellow pad
            else if (obj.id === 140) p.vy = 560 * p.gravity; // Pink pad
            else if (obj.id === 1332) p.vy = 980 * p.gravity; // Red pad
            else if (obj.id === 67) {
              p.gravity *= -1;
              p.vy = 320 * p.gravity;
            }
            p.onGround = false;
          }
        } else if (def.hitbox === 'orb') {
          if (
            !p.triggeredUids.has(obj.uid) &&
            p.inputBufferTimer > 0 &&
            Math.abs(p.x - ox) < pHalf + hw + 9 &&
            Math.abs(p.y - oy) < pHalf + hh + 9
          ) {
            p.triggeredUids.add(obj.uid);
            p.inputBufferTimer = 0;
            gdAudio.playOrb();
            if (obj.id === 36) p.vy = 620 * p.gravity;
            else if (obj.id === 141) p.vy = 460 * p.gravity;
            else if (obj.id === 1333) p.vy = 810 * p.gravity;
            else if (obj.id === 84) {
              p.gravity *= -1;
              p.vy = 360 * p.gravity;
            } else if (obj.id === 1022) {
              p.gravity *= -1;
              p.vy = 610 * p.gravity;
            } else if (obj.id === 1330) {
              p.vy = -880 * p.gravity;
            }
            p.onGround = false;
          }
        } else if (def.hitbox === 'coin') {
          if (
            !p.collectedCoins.has(obj.uid) &&
            Math.abs(p.x - ox) < pHalf + hw &&
            Math.abs(p.y - oy) < pHalf + hh
          ) {
            p.collectedCoins.add(obj.uid);
            gdAudio.playCoin();
          }
        }
      }

      // Two-pass solid collision: Pass 1 = vertical surface landing/support
      for (const s of solidList) {
        const dx = Math.abs(p.x - s.ox);
        if (dx >= pHalf + s.hw - 2) continue;

        if (p.mode === 4) {
          // Wave dies on any solid block contact
          if (Math.abs(p.y - s.oy) < pHalf + s.hh) {
            triggerDeath(p);
            return;
          }
          continue;
        }

        const topSurface = s.oy + s.hh + pHalf;
        const bottomSurface = s.oy - s.hh - pHalf;

        if (p.vy <= 0 && prevY >= topSurface - 8 && p.y <= topSurface + 1.2 && p.y >= s.oy) {
          // Landed on top of block
          if (p.gravity === 1 || p.mode === 1 || p.mode === 3) {
            p.y = topSurface;
            p.vy = 0;
            if (p.gravity === 1) p.onGround = true;
          }
        } else if (p.vy >= 0 && prevY <= bottomSurface + 8 && p.y >= bottomSurface - 1.2 && p.y <= s.oy) {
          // Bonked/landed on underside of block
          if (p.gravity === -1 || p.mode === 1 || p.mode === 3) {
            p.y = bottomSurface;
            p.vy = 0;
            if (p.gravity === -1) p.onGround = true;
          } else {
            // Normal-gravity Cube/Robot/Spider hitting ceiling underside dies
            triggerDeath(p);
            return;
          }
        }
      }

      // Pass 2 = side-wall crash check (forgiving seam clearance)
      for (const s of solidList) {
        const dx = Math.abs(p.x - s.ox);
        const dy = Math.abs(p.y - s.oy);
        if (dx < pHalf + s.hw - 3 && dy < pHalf + s.hh - 4) {
          triggerDeath(p);
          return;
        }
      }

      // Trail (record every few units or direction shift)
      const lastTrail = p.trail[p.trail.length - 1];
      if (!lastTrail || Math.hypot(p.x - lastTrail.x, p.y - lastTrail.y) >= 4) {
        p.trail.push({ x: p.x, y: p.y });
        if (p.trail.length > 70) p.trail.shift();
      }

      // Camera tracks player smoothly
      camRef.current.x = p.x - 190;
      camRef.current.y = Math.max(-40, Math.min(180, p.y - 125));

      const pct = Math.min(100, Math.max(0, Math.round((p.x / p.endX) * 100)));
      if (p.x >= p.endX && !p.completed) {
        p.completed = true;
        gdAudio.playComplete();
        if (aiBotActive && botVerdictRef.current === 'testing') {
          botVerdictRef.current = 'possible';
          setBotVerdict('possible');
          const endAt = p.x;
          const totalAttempts = p.attempt;
          botResultTimerRef.current = window.setTimeout(() => {
            if (!botResultSentRef.current) {
              botResultSentRef.current = true;
              onAiBotResultRef.current?.('possible', {
                crashX: endAt,
                attempts: totalAttempts,
              });
            }
          }, 750);
        }
      }

      setPlayStats({
        running: true,
        progress: pct,
        attempt: p.attempt,
        gamemode: p.mode,
        speed: p.speed,
        gravityInverted: p.gravity === -1,
        coinsCollected: p.collectedCoins.size,
        totalCoins: level.objects.filter((o) => o.id === 1329).length,
        dead: p.dead,
        completed: p.completed,
      });
    };

    const render = (now: number) => {
      const frameDt = Math.min(0.05, (now - lastTime) / 1000);
      lastTime = now;

      if (isPlaytesting) {
        const timeScale = aiBotActive ? botSpeedRef.current : 1;
        accumulator = Math.min(0.15, accumulator + frameDt * timeScale);
        while (accumulator >= FIXED_DT) {
          stepPhysics(FIXED_DT);
          accumulator -= FIXED_DT;
        }
      }

      const canvas = canvasRef.current;
      const container = containerRef.current;
      if (canvas && container) {
        const dpr = window.devicePixelRatio || 1;
        const w = container.clientWidth;
        const h = container.clientHeight;
        if (canvas.width !== Math.floor(w * dpr) || canvas.height !== Math.floor(h * dpr)) {
          canvas.width = Math.floor(w * dpr);
          canvas.height = Math.floor(h * dpr);
        }

        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.save();
          ctx.scale(dpr, dpr);

          const p = playRef.current;
          const bgCol = isPlaytesting
            ? `rgb(${p.bgRgb.r}, ${p.bgRgb.g}, ${p.bgRgb.b})`
            : level.meta.bgColor;
          const groundCol = isPlaytesting
            ? `rgb(${p.groundRgb.r}, ${p.groundRgb.g}, ${p.groundRgb.b})`
            : level.meta.groundColor;
          const lineCol = isPlaytesting
            ? `rgb(${p.lineRgb.r}, ${p.lineRgb.g}, ${p.lineRgb.b})`
            : level.meta.lineColor;

          const groundPos = worldToScreen(0, 0, h);
          const groundY = groundPos.sy;

          // 1. Background sky + parallax GD texture
          drawBackgroundPattern(
            ctx,
            w,
            h,
            groundY,
            camRef.current.x,
            level.meta.bgTexture,
            bgCol
          );

          // 2. Editor Grid (only in editor mode)
          const step = 30 * zoom;
          const startWorldX = Math.floor(camRef.current.x / 30) * 30;
          const endWorldX = camRef.current.x + w / zoom + 30;

          if (!isPlaytesting) {
            ctx.beginPath();
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.065)';
            ctx.lineWidth = 1;
            for (let wx = startWorldX; wx <= endWorldX; wx += 30) {
              const { sx } = worldToScreen(wx, 0, h);
              ctx.moveTo(sx, 0);
              ctx.lineTo(sx, h);
            }
            const minWorldY = Math.floor((camRef.current.y - h / zoom) / 30) * 30;
            const maxWorldY = Math.ceil((camRef.current.y + h / zoom) / 30) * 30;
            for (let wy = minWorldY; wy <= maxWorldY; wy += 30) {
              const { sy } = worldToScreen(0, wy, h);
              ctx.moveTo(0, sy);
              ctx.lineTo(w, sy);
            }
            ctx.stroke();

            // Major 10-block beat markers
            ctx.strokeStyle = 'rgba(56, 189, 248, 0.14)';
            ctx.beginPath();
            for (let wx = Math.floor(startWorldX / 300) * 300; wx <= endWorldX; wx += 300) {
              if (wx < 0) continue;
              const { sx } = worldToScreen(wx, 0, h);
              ctx.moveTo(sx, 0);
              ctx.lineTo(sx, h);
            }
            ctx.stroke();

            // Start line (X = 0)
            const startLine = worldToScreen(0, 0, h);
            ctx.strokeStyle = '#10b981';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(startLine.sx, 0);
            ctx.lineTo(startLine.sx, h);
            ctx.stroke();
          }

          // 3. Ground Floor (y <= 0) & BG Ceiling Death Boundary (y = 360)
          drawGroundPattern(
            ctx,
            w,
            h,
            groundY,
            camRef.current.x,
            zoom,
            level.meta.groundTexture,
            groundCol,
            lineCol
          );

          const ceilingPos = worldToScreen(0, 360, h);
          if (ceilingPos.sy > -10 && ceilingPos.sy < h + 10) {
            ctx.save();
            ctx.strokeStyle = 'rgba(244, 63, 94, 0.45)';
            ctx.lineWidth = 1.5;
            ctx.setLineDash([8, 6]);
            ctx.beginPath();
            ctx.moveTo(0, ceilingPos.sy);
            ctx.lineTo(w, ceilingPos.sy);
            ctx.stroke();
            ctx.restore();
          }

          // 4. Ghost placement preview in build/swipe mode
          if (!isPlaytesting && (tool === 'build' || tool === 'swipe') && cursorCoords) {
            const snapped = snapCoord(cursorCoords.x, cursorCoords.y);
            const { sx, sy } = worldToScreen(snapped.x, snapped.y, h);
            drawGDObject(ctx, { id: activeObjectId }, sx, sy, zoom, now / 1000, {
              ghost: true,
              objColor: level.meta.objColor,
            });
          }

          // 5. Render all visible objects
          const timeSec = now / 1000;
          const selectedSet = new Set(selectedUids);

          for (const obj of level.objects) {
            if (isPlaytesting && obj.id === 1329 && p.collectedCoins.has(obj.uid)) {
              continue; // collected coin disappears
            }
            let ox = obj.x;
            let oy = obj.y;
            let alpha = 1;
            if (isPlaytesting && obj.groups && obj.groups.length > 0) {
              const off = p.groupOffsets.get(obj.groups[0]);
              if (off) {
                ox += off.x;
                oy += off.y;
              }
              const ga = p.groupAlpha.get(obj.groups[0]);
              if (ga !== undefined) alpha = ga;
            }
            // Hide trigger icons during playtest for authentic look
            if (isPlaytesting && (obj.id === 899 || obj.id === 901 || obj.id === 1007)) {
              continue;
            }

            const { sx, sy } = worldToScreen(ox, oy, h);
            if (sx < -80 || sx > w + 80 || sy < -80 || sy > h + 80) continue;

            drawGDObject(ctx, obj, sx, sy, zoom, timeSec, {
              selected: !isPlaytesting && selectedSet.has(obj.uid),
              objColor: level.meta.objColor,
              opacity: alpha,
              showTriggerTags: !isPlaytesting,
            });
          }

          // 6. Playtest Trail, Player & Particles
          if (isPlaytesting) {
            // End wall marker
            const endPos = worldToScreen(p.endX, 0, h);
            if (endPos.sx < w + 60) {
              ctx.save();
              ctx.strokeStyle = '#10b981';
              ctx.lineWidth = 3;
              ctx.setLineDash([8, 6]);
              ctx.beginPath();
              ctx.moveTo(endPos.sx, 0);
              ctx.lineTo(endPos.sx, groundY);
              ctx.stroke();
              ctx.restore();
            }

            // Player trail
            if (p.trail.length > 1) {
              ctx.save();
              ctx.beginPath();
              p.trail.forEach((pt, idx) => {
                const { sx, sy } = worldToScreen(pt.x, pt.y, h);
                if (idx === 0) ctx.moveTo(sx, sy);
                else ctx.lineTo(sx, sy);
              });
              ctx.strokeStyle = p.mode === 4 ? 'rgba(56, 189, 248, 0.85)' : 'rgba(34, 211, 238, 0.35)';
              ctx.lineWidth = p.mode === 4 ? 5 * zoom : 10 * zoom;
              ctx.lineCap = 'round';
              ctx.lineJoin = 'round';
              ctx.stroke();
              ctx.restore();
            }

            // Player sprite
            if (!p.dead) {
              const { sx, sy } = worldToScreen(p.x, p.y, h);
              drawPlayerIcon(ctx, p.mode, sx, sy, zoom, p.angle, p.gravity === -1);
            }

            // Death particles
            for (const pt of p.particles) {
              const { sx, sy } = worldToScreen(pt.x, pt.y, h);
              ctx.save();
              ctx.globalAlpha = Math.max(0, pt.life / pt.maxLife);
              ctx.fillStyle = pt.color;
              ctx.fillRect(sx - pt.size / 2, sy - pt.size / 2, pt.size, pt.size);
              ctx.restore();
            }
          }

          // 7. Marquee selection box
          if (!isPlaytesting && dragRef.current.type === 'marquee') {
            const x = Math.min(dragRef.current.startScreenX, dragRef.current.curScreenX);
            const y = Math.min(dragRef.current.startScreenY, dragRef.current.curScreenY);
            const mw = Math.abs(dragRef.current.curScreenX - dragRef.current.startScreenX);
            const mh = Math.abs(dragRef.current.curScreenY - dragRef.current.startScreenY);
            ctx.save();
            ctx.fillStyle = 'rgba(34, 211, 238, 0.14)';
            ctx.strokeStyle = '#22d3ee';
            ctx.lineWidth = 1.5;
            ctx.fillRect(x, y, mw, mh);
            ctx.strokeRect(x, y, mw, mh);
            ctx.restore();
          }

          // Suppress unused var warning if step is referenced
          void step;
          ctx.restore();
        }
      }

      rafId = requestAnimationFrame(render);
    };

    rafId = requestAnimationFrame(render);
    return () => cancelAnimationFrame(rafId);
  }, [
    activeObjectId,
    aiBotActive,
    cursorCoords,
    isPlaytesting,
    level.meta.bgColor,
    level.meta.bgTexture,
    level.meta.groundColor,
    level.meta.groundTexture,
    level.meta.lineColor,
    level.meta.objColor,
    level.objects,
    resetPlaytest,
    selectedUids,
    snapCoord,
    tool,
    worldToScreen,
    zoom,
  ]);

  const toggleMute = () => {
    gdAudio.muted = !muted;
    setMuted(!muted);
  };

  return (
    <div
      ref={containerRef}
      className="relative flex-1 w-full h-full overflow-hidden bg-[#060911] select-none"
      onContextMenu={(e) => e.preventDefault()}
    >
      <canvas
        ref={canvasRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={() => setCursorCoords(null)}
        onWheel={handleWheel}
        className={`w-full h-full block touch-none ${
          isPlaytesting
            ? 'cursor-pointer'
            : tool === 'pan'
            ? 'cursor-grab active:cursor-grabbing'
            : tool === 'delete'
            ? 'cursor-crosshair'
            : 'cursor-crosshair'
        }`}
      />

      {/* Editor HUD: Coordinates & Shortcuts */}
      {!isPlaytesting && (
        <div className="pointer-events-none absolute top-3 left-3 flex items-center gap-3 px-3 py-1.5 rounded-lg bg-slate-950/80 border border-white/10 backdrop-blur-sm text-xs text-slate-300">
          <span className="font-mono-tabular">
            X: {cursorCoords ? cursorCoords.x : 0} · Y: {cursorCoords ? cursorCoords.y : 0}
          </span>
          <span className="text-slate-600" aria-hidden="true">|</span>
          <span className="text-slate-400">
            Zoom: <span className="font-mono-tabular text-slate-200">{Math.round(zoom * 100)}%</span>
          </span>
          <span className="hidden xl:inline text-slate-600" aria-hidden="true">|</span>
          <span className="hidden xl:inline text-slate-400">
            Chuột phải: Xóa nhanh · Space + Kéo: Di chuyển vùng nhìn
          </span>
        </div>
      )}

      {/* Playtest HUD */}
      {isPlaytesting && (
        <>
          <div className="absolute top-3 left-1/2 -translate-x-1/2 flex items-center gap-3.5 px-4 py-2 rounded-xl bg-slate-950/90 border border-white/15 backdrop-blur-md shadow-xl">
            {aiBotActive && (
              <>
                <div
                  className={`flex items-center gap-1.5 text-xs font-semibold whitespace-nowrap ${
                    botVerdict === 'possible'
                      ? 'text-emerald-300'
                      : botVerdict === 'impossible'
                      ? 'text-rose-300'
                      : 'text-cyan-300'
                  }`}
                >
                  {botVerdict === 'possible' ? (
                    <CheckCircle2 className="w-4 h-4" />
                  ) : botVerdict === 'impossible' ? (
                    <ShieldAlert className="w-4 h-4" />
                  ) : (
                    <Bot className="w-4 h-4 animate-pulse" />
                  )}
                  <span>
                    {botVerdict === 'possible'
                      ? 'Possible! Đang thoát...'
                      : botVerdict === 'impossible'
                      ? 'Level Impossible!'
                      : 'AI đang tự chơi kiểm tra'}
                  </span>
                </div>
                <span className="text-slate-700" aria-hidden="true">|</span>
              </>
            )}

            <div className="flex items-center gap-2 min-w-[140px]">
              <div className="flex-1 h-2 bg-slate-800 rounded-full overflow-hidden">
                <div
                  className={`h-full transition-[width] duration-75 ${
                    botVerdict === 'impossible' ? 'bg-rose-400' : 'bg-emerald-400'
                  }`}
                  style={{ width: `${playStats.progress}%` }}
                />
              </div>
              <span
                className={`text-xs font-mono-tabular font-semibold w-9 text-right ${
                  botVerdict === 'impossible' ? 'text-rose-400' : 'text-emerald-400'
                }`}
              >
                {playStats.progress}%
              </span>
            </div>

            <span className="text-slate-700" aria-hidden="true">|</span>

            <div className="flex items-center gap-2.5 text-xs text-slate-300 whitespace-nowrap">
              <span>
                Lần thử{' '}
                <strong className="font-mono-tabular text-white">
                  {aiBotActive ? `${playStats.attempt}/${MAX_BOT_ATTEMPTS}` : playStats.attempt}
                </strong>
              </span>
              <span className="text-slate-600">·</span>
              <span className="text-cyan-300 font-medium">{GAMEMODE_NAMES[playStats.gamemode]}</span>
              {playStats.totalCoins > 0 && (
                <>
                  <span className="text-slate-600">·</span>
                  <span className="text-amber-300 font-mono-tabular">
                    Xu {playStats.coinsCollected}/{playStats.totalCoins}
                  </span>
                </>
              )}
            </div>

            {aiBotActive && (
              <>
                <span className="text-slate-700" aria-hidden="true">|</span>
                <div className="flex items-center gap-1 bg-slate-900 rounded-md p-0.5 border border-white/10">
                  {([1, 1.5, 2] as const).map((spd) => (
                    <button
                      key={spd}
                      type="button"
                      onClick={() => setBotSpeed(spd)}
                      className={`px-1.5 py-0.5 rounded text-[11px] font-mono-tabular transition-colors ${
                        botSpeed === spd
                          ? 'bg-cyan-400 text-slate-950 font-semibold'
                          : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      {spd}x
                    </button>
                  ))}
                </div>
              </>
            )}

            <span className="text-slate-700" aria-hidden="true">|</span>

            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={toggleMute}
                title={muted ? 'Bật âm thanh' : 'Tắt âm thanh'}
                className="p-1.5 rounded-md text-slate-300 hover:text-white hover:bg-white/10 transition-colors"
              >
                {muted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
              </button>
              {!aiBotActive && (
                <button
                  type="button"
                  onClick={() => resetPlaytest(true)}
                  title="Chơi lại (R)"
                  className="p-1.5 rounded-md text-slate-300 hover:text-white hover:bg-white/10 transition-colors"
                >
                  <RotateCcw className="w-4 h-4" />
                </button>
              )}
              <button
                type="button"
                onClick={onStopPlaytest}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-rose-500/20 text-rose-300 hover:bg-rose-500/30 text-xs font-medium transition-colors whitespace-nowrap"
              >
                <Square className="w-3.5 h-3.5 fill-current" />
                Dừng
              </button>
            </div>
          </div>

          {/* Level Complete Banner (manual playtest only; AI Bot exits automatically) */}
          {playStats.completed && !aiBotActive && (
            <div className="absolute inset-0 flex items-center justify-center bg-slate-950/50 backdrop-blur-[2px]">
              <div className="bg-slate-900 border border-emerald-500/40 rounded-xl p-6 text-center shadow-2xl max-w-sm w-full mx-4">
                <p className="text-xs font-medium text-emerald-400 tracking-wide mb-1">
                  Hoàn thành màn chơi
                </p>
                <h3 className="font-display text-2xl font-bold text-white mb-2">
                  {level.meta.name}
                </h3>
                <p className="text-sm text-slate-400 mb-5 font-mono-tabular">
                  Lần thử {playStats.attempt} · Xu thu thập {playStats.coinsCollected}/{playStats.totalCoins}
                </p>
                <div className="flex items-center justify-center gap-3">
                  <button
                    type="button"
                    onClick={() => resetPlaytest(true)}
                    className="flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-semibold text-sm transition-colors"
                  >
                    <Play className="w-4 h-4 fill-current" />
                    Chơi lại
                  </button>
                  <button
                    type="button"
                    onClick={onStopPlaytest}
                    className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium text-sm transition-colors"
                  >
                    Về trình sửa
                  </button>
                </div>
              </div>
            </div>
          )}

          <div className="pointer-events-none absolute bottom-3 left-3 px-3 py-1.5 rounded-lg bg-slate-950/75 border border-white/10 text-xs text-slate-300">
            {aiBotActive ? (
              <>
                AI Bot đang tự chơi trực tiếp trước mắt bạn · <span className="font-mono text-white">Esc</span> hoặc <span className="font-mono text-white">Dừng</span> để hủy
              </>
            ) : (
              <>
                Nhấn giữ <span className="font-mono text-white">Space</span> / <span className="font-mono text-white">↑</span> hoặc <span className="font-mono text-white">Click chuột</span> để điều khiển · <span className="font-mono text-white">R</span> chơi lại · <span className="font-mono text-white">Esc</span> thoát
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
};
