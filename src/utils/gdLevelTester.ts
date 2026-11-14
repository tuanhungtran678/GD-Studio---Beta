import { AITestReport, GDLevel, GDObject, GamemodeId, SpeedId } from '../types/gd';

const SPEED_UNITS_PER_SEC: Record<SpeedId, number> = {
  1: 251.16,
  0: 311.58,
  2: 387.42,
  3: 468.0,
  4: 576.0,
};

type SimpleHitbox = 'solid' | 'hazard' | 'portal' | 'pad' | 'orb' | 'coin' | 'trigger' | 'none';

const HITBOX_LOOKUP = new Map<number, { hitbox: SimpleHitbox; w: number; h: number }>([
  [1, { hitbox: 'solid', w: 30, h: 30 }],
  [2, { hitbox: 'solid', w: 30, h: 30 }],
  [4, { hitbox: 'solid', w: 30, h: 30 }],
  [6, { hitbox: 'solid', w: 30, h: 30 }],
  [40, { hitbox: 'solid', w: 30, h: 15 }],
  [5, { hitbox: 'none', w: 30, h: 30 }],
  [17, { hitbox: 'none', w: 30, h: 30 }],
  [18, { hitbox: 'none', w: 30, h: 30 }],
  [21, { hitbox: 'none', w: 30, h: 30 }],
  [44, { hitbox: 'none', w: 30, h: 30 }],
  [45, { hitbox: 'none', w: 30, h: 30 }],
  [46, { hitbox: 'none', w: 30, h: 30 }],
  [130, { hitbox: 'none', w: 30, h: 30 }],
  [131, { hitbox: 'none', w: 30, h: 30 }],
  [132, { hitbox: 'none', w: 30, h: 30 }],
  [8, { hitbox: 'hazard', w: 30, h: 30 }],
  [39, { hitbox: 'hazard', w: 30, h: 16 }],
  [9, { hitbox: 'hazard', w: 30, h: 14 }],
  [88, { hitbox: 'hazard', w: 44, h: 44 }],
  [1705, { hitbox: 'hazard', w: 32, h: 32 }],
  [12, { hitbox: 'portal', w: 30, h: 75 }],
  [13, { hitbox: 'portal', w: 30, h: 75 }],
  [47, { hitbox: 'portal', w: 30, h: 75 }],
  [111, { hitbox: 'portal', w: 30, h: 75 }],
  [660, { hitbox: 'portal', w: 30, h: 75 }],
  [745, { hitbox: 'portal', w: 30, h: 75 }],
  [1331, { hitbox: 'portal', w: 30, h: 75 }],
  [10, { hitbox: 'portal', w: 28, h: 72 }],
  [11, { hitbox: 'portal', w: 28, h: 72 }],
  [200, { hitbox: 'portal', w: 28, h: 44 }],
  [201, { hitbox: 'portal', w: 28, h: 44 }],
  [202, { hitbox: 'portal', w: 28, h: 44 }],
  [203, { hitbox: 'portal', w: 28, h: 44 }],
  [1334, { hitbox: 'portal', w: 28, h: 44 }],
  [35, { hitbox: 'pad', w: 30, h: 10 }],
  [140, { hitbox: 'pad', w: 30, h: 10 }],
  [1332, { hitbox: 'pad', w: 30, h: 10 }],
  [67, { hitbox: 'pad', w: 30, h: 10 }],
  [36, { hitbox: 'orb', w: 28, h: 28 }],
  [141, { hitbox: 'orb', w: 28, h: 28 }],
  [1333, { hitbox: 'orb', w: 28, h: 28 }],
  [84, { hitbox: 'orb', w: 28, h: 28 }],
  [1022, { hitbox: 'orb', w: 28, h: 28 }],
  [1330, { hitbox: 'orb', w: 28, h: 28 }],
  [1329, { hitbox: 'coin', w: 30, h: 30 }],
  [899, { hitbox: 'trigger', w: 28, h: 28 }],
  [901, { hitbox: 'trigger', w: 28, h: 28 }],
  [1007, { hitbox: 'trigger', w: 28, h: 28 }],
]);

function getHitboxDef(id: number) {
  return HITBOX_LOOKUP.get(id) ?? { hitbox: 'none' as SimpleHitbox, w: 30, h: 30 };
}

interface SimState {
  x: number;
  y: number;
  vy: number;
  mode: GamemodeId;
  speed: SpeedId;
  gravity: number; // 1 | -1
  onGround: boolean;
  robotHoldTimer: number;
  triggered: Set<string>;
  actions: number;
  prevInputHeld: boolean;
  inputLog: [boolean, boolean][];
}

function cloneSimState(s: SimState): SimState {
  return {
    ...s,
    triggered: new Set(s.triggered),
    inputLog: [...s.inputLog],
  };
}

function buildSpatialBuckets(objects: GDObject[]) {
  const buckets = new Map<number, GDObject[]>();
  const solids: GDObject[] = [];
  for (const obj of objects) {
    const def = getHitboxDef(obj.id);
    if (def.hitbox === 'none' || def.hitbox === 'trigger' || def.hitbox === 'coin') continue;
    if (def.hitbox === 'solid') solids.push(obj);
    const bMin = Math.floor((obj.x - 60) / 120);
    const bMax = Math.floor((obj.x + 60) / 120);
    for (let b = bMin; b <= bMax; b++) {
      const list = buckets.get(b);
      if (list) list.push(obj);
      else buckets.set(b, [obj]);
    }
  }
  return { buckets, solids };
}

function stepSlice(
  initial: SimState,
  ticks: number,
  inputTapAtStart: boolean,
  inputHold: boolean,
  buckets: Map<number, GDObject[]>,
  solids: GDObject[]
): { alive: boolean; state: SimState; crashX: number; crashY: number } {
  const dt = 1 / 120;
  const p = cloneSimState(initial);
  let inputBufferTimer = inputTapAtStart ? 0.095 : 0;
  const inputHeld = inputHold;
  if (inputTapAtStart && !initial.prevInputHeld) {
    p.actions += 1;
  }
  p.prevInputHeld = inputHeld;
  p.inputLog.push([inputTapAtStart, inputHold]);

  for (let tick = 0; tick < ticks; tick++) {
    if (inputBufferTimer > 0) {
      inputBufferTimer = Math.max(0, inputBufferTimer - dt);
    }

    const speedUps = SPEED_UNITS_PER_SEC[p.speed];
    const pHalf = p.mode === 4 ? 8 : 15;
    const prevY = p.y;
    p.x += speedUps * dt;

    const gravAcc = -3050 * p.gravity;
    if (p.mode === 0) {
      if ((inputHeld || inputBufferTimer > 0) && p.onGround) {
        p.vy = 620 * p.gravity;
        p.onGround = false;
        inputBufferTimer = 0;
      }
      p.vy = Math.max(-920, Math.min(920, p.vy + gravAcc * dt));
      p.y += p.vy * dt;
    } else if (p.mode === 1) {
      const thrust = inputHeld ? 1650 * p.gravity : -1350 * p.gravity;
      p.vy = Math.max(-460, Math.min(460, p.vy + thrust * dt));
      p.y += p.vy * dt;
    } else if (p.mode === 2) {
      if (inputBufferTimer > 0 && p.onGround) {
        p.gravity *= -1;
        p.vy = -140 * p.gravity;
        p.onGround = false;
        inputBufferTimer = 0;
      }
      p.vy = Math.max(-850, Math.min(850, p.vy + -2400 * p.gravity * dt));
      p.y += p.vy * dt;
    } else if (p.mode === 3) {
      if (inputBufferTimer > 0) {
        p.vy = 485 * p.gravity;
        p.onGround = false;
        inputBufferTimer = 0;
      }
      p.vy = Math.max(-720, Math.min(720, p.vy + -2250 * p.gravity * dt));
      p.y += p.vy * dt;
    } else if (p.mode === 4) {
      const dir = inputHeld ? 1 : -1;
      p.vy = speedUps * dir * p.gravity;
      p.y += p.vy * dt;
    } else if (p.mode === 5) {
      if (inputBufferTimer > 0 && p.onGround) {
        p.vy = 520 * p.gravity;
        p.onGround = false;
        p.robotHoldTimer = 0.24;
        inputBufferTimer = 0;
      } else if (inputHeld && p.robotHoldTimer > 0) {
        p.vy += 2100 * p.gravity * dt;
        p.robotHoldTimer -= dt;
      }
      p.vy = Math.max(-920, Math.min(920, p.vy + gravAcc * dt));
      p.y += p.vy * dt;
    } else if (p.mode === 6) {
      if (inputBufferTimer > 0 && p.onGround) {
        p.gravity *= -1;
        inputBufferTimer = 0;
        let targetY = p.gravity === 1 ? pHalf : 360 - pHalf;
        for (const obj of solids) {
          if (Math.abs(obj.x - p.x) > 45) continue;
          const def = getHitboxDef(obj.id);
          const s = obj.scale ?? 1;
          const hw = (def.w * s) / 2;
          const hh = (def.h * s) / 2;
          if (Math.abs(p.x - obj.x) < pHalf + hw - 3) {
            if (p.gravity === -1 && obj.y - hh > p.y && obj.y - hh - pHalf < targetY) {
              targetY = obj.y - hh - pHalf;
            } else if (p.gravity === 1 && obj.y + hh < p.y && obj.y + hh + pHalf > targetY) {
              targetY = obj.y + hh + pHalf;
            }
          }
        }
        p.y = targetY;
        p.vy = 0;
        p.onGround = true;
      }
      p.vy = Math.max(-920, Math.min(920, p.vy + gravAcc * dt));
      p.y += p.vy * dt;
    }

    p.onGround = false;
    const floorY = pHalf;
    const ceilingY = 360 - pHalf;
    if (p.y <= floorY) {
      p.y = floorY;
      if (p.vy < 0) p.vy = 0;
      if (p.gravity === 1) p.onGround = true;
    }
    if (p.y >= ceilingY) {
      p.y = ceilingY;
      return { alive: false, state: p, crashX: p.x, crashY: p.y };
    }

    const bucket = buckets.get(Math.floor(p.x / 120)) || [];
    const nearbySolids: { ox: number; oy: number; hw: number; hh: number }[] = [];

    for (const obj of bucket) {
      if (Math.abs(obj.x - p.x) >= 120) continue;
      const def = getHitboxDef(obj.id);
      const s = obj.scale ?? 1;
      const hw = (def.w * s) / 2;
      const hh = (def.h * s) / 2;
      const ox = obj.x;
      const oy = obj.y;

      if (def.hitbox === 'solid') {
        nearbySolids.push({ ox, oy, hw, hh });
      } else if (def.hitbox === 'hazard') {
        if (obj.id === 88 || obj.id === 1705) {
          const dx = p.x - ox;
          const dy = p.y - oy;
          const r = Math.max(6, hw * 0.72 + pHalf * 0.65);
          if (dx * dx + dy * dy < r * r) {
            return { alive: false, state: p, crashX: p.x, crashY: p.y };
          }
        } else {
          const shrinkX = obj.id === 8 || obj.id === 39 ? 9 : 6;
          const shrinkY = obj.id === 8 || obj.id === 39 ? 8 : 5;
          if (
            Math.abs(p.x - ox) < pHalf * 0.75 + Math.max(3, hw - shrinkX) &&
            Math.abs(p.y - oy) < pHalf * 0.75 + Math.max(3, hh - shrinkY)
          ) {
            return { alive: false, state: p, crashX: p.x, crashY: p.y };
          }
        }
      } else if (def.hitbox === 'portal') {
        if (
          !p.triggered.has(obj.uid) &&
          Math.abs(p.x - ox) < pHalf + hw &&
          Math.abs(p.y - oy) < pHalf + hh
        ) {
          p.triggered.add(obj.uid);
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
          !p.triggered.has(obj.uid) &&
          Math.abs(p.x - ox) < pHalf + hw &&
          Math.abs(p.y - oy) < pHalf + hh + 6
        ) {
          p.triggered.add(obj.uid);
          if (obj.id === 35) p.vy = 830 * p.gravity;
          else if (obj.id === 140) p.vy = 560 * p.gravity;
          else if (obj.id === 1332) p.vy = 980 * p.gravity;
          else if (obj.id === 67) {
            p.gravity *= -1;
            p.vy = 320 * p.gravity;
          }
          p.onGround = false;
        }
      } else if (def.hitbox === 'orb') {
        if (
          !p.triggered.has(obj.uid) &&
          inputBufferTimer > 0 &&
          Math.abs(p.x - ox) < pHalf + hw + 9 &&
          Math.abs(p.y - oy) < pHalf + hh + 9
        ) {
          p.triggered.add(obj.uid);
          inputBufferTimer = 0;
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
      }
    }

    for (const s of nearbySolids) {
      const dx = Math.abs(p.x - s.ox);
      if (dx >= pHalf + s.hw - 2) continue;

      if (p.mode === 4) {
        if (Math.abs(p.y - s.oy) < pHalf + s.hh) {
          return { alive: false, state: p, crashX: p.x, crashY: p.y };
        }
        continue;
      }

      const topSurface = s.oy + s.hh + pHalf;
      const bottomSurface = s.oy - s.hh - pHalf;

      if (p.vy <= 0 && prevY >= topSurface - 8 && p.y <= topSurface + 1.2 && p.y >= s.oy) {
        if (p.gravity === 1 || p.mode === 1 || p.mode === 3) {
          p.y = topSurface;
          p.vy = 0;
          if (p.gravity === 1) p.onGround = true;
        }
      } else if (p.vy >= 0 && prevY <= bottomSurface + 8 && p.y >= bottomSurface - 1.2 && p.y <= s.oy) {
        if (p.gravity === -1 || p.mode === 1 || p.mode === 3) {
          p.y = bottomSurface;
          p.vy = 0;
          if (p.gravity === -1) p.onGround = true;
        } else {
          return { alive: false, state: p, crashX: p.x, crashY: p.y };
        }
      }
    }

    for (const s of nearbySolids) {
      const dx = Math.abs(p.x - s.ox);
      const dy = Math.abs(p.y - s.oy);
      if (dx < pHalf + s.hw - 3 && dy < pHalf + s.hh - 4) {
        return { alive: false, state: p, crashX: p.x, crashY: p.y };
      }
    }
  }

  return { alive: true, state: p, crashX: p.x, crashY: p.y };
}

function runBeamPlaytest(level: GDLevel): {
  passed: boolean;
  furthestX: number;
  crashX: number;
  crashY: number;
  crashMode: GamemodeId;
  bestState: SimState;
  durationSec: number;
} {
  const maxObjX =
    level.objects.length > 0 ? Math.max(...level.objects.map((o) => o.x)) + 300 : 1500;
  const endX = Math.max(900, maxObjX);
  const { buckets, solids } = buildSpatialBuckets(level.objects);

  let beam: SimState[] = [
    {
      x: 0,
      y: level.meta.flipGravity ? 345 : 15,
      vy: 0,
      mode: level.meta.startMode,
      speed: level.meta.startSpeed,
      gravity: level.meta.flipGravity ? -1 : 1,
      onGround: true,
      robotHoldTimer: 0,
      triggered: new Set<string>(),
      actions: 0,
      prevInputHeld: false,
      inputLog: [],
    },
  ];

  let bestOverall = beam[0];
  let furthestCrashX = 0;
  let furthestCrashY = 15;
  let crashMode: GamemodeId = level.meta.startMode;
  let slices = 0;

  while (beam.length > 0 && slices < 900) {
    slices++;
    const nextCandidates: SimState[] = [];
    const sliceTicks = 10; // ~0.083s per decision step

    for (const st of beam) {
      if (st.x >= endX) {
        return {
          passed: true,
          furthestX: st.x,
          crashX: st.x,
          crashY: st.y,
          crashMode: st.mode,
          bestState: st,
          durationSec: Math.max(1, (slices * sliceTicks) / 120),
        };
      }

      const actions: [boolean, boolean][] = [
        [false, false], // release / idle
        [true, true],   // tap + hold
      ];
      // For Cube/Robot/Ship/Wave, continuing hold without fresh edge or quick tap without hold
      if (st.mode === 0) {
        actions.push([true, false]);
      } else if (st.mode === 5) {
        actions.push([true, false]);
        actions.push([false, true]);
      } else if (st.mode === 1 || st.mode === 4) {
        actions.push([false, true]);
      }

      for (const [tap, hold] of actions) {
        const res = stepSlice(st, sliceTicks, tap, hold, buckets, solids);
        if (res.alive) {
          nextCandidates.push(res.state);
        } else if (res.crashX >= furthestCrashX) {
          furthestCrashX = res.crashX;
          furthestCrashY = res.crashY;
          crashMode = res.state.mode;
        }
      }
    }

    if (nextCandidates.length === 0) {
      return {
        passed: false,
        furthestX: bestOverall.x,
        crashX: Math.max(bestOverall.x, furthestCrashX),
        crashY: furthestCrashY,
        crashMode,
        bestState: bestOverall,
        durationSec: Math.max(1, (slices * sliceTicks) / 120),
      };
    }

    // Deduplicate & keep diverse vertical lanes (Beam width = 10)
    const bucketed = new Map<string, SimState>();
    for (const c of nextCandidates) {
      const yB = Math.round(c.y / 24);
      const vyB = Math.round(c.vy / 140);
      const key = `${c.mode}:${c.gravity}:${yB}:${vyB}`;
      const existing = bucketed.get(key);
      if (!existing || c.x > existing.x) {
        bucketed.set(key, c);
      }
    }

    // Score states: prefer advancing X, staying away from extreme ceiling/floor in aerial modes
    const scored = [...bucketed.values()].sort((a, b) => {
      if (Math.abs(a.x - b.x) > 15) return b.x - a.x;
      const distMidA = Math.abs(a.y - 150);
      const distMidB = Math.abs(b.y - 150);
      return distMidA - distMidB;
    });

    beam = scored.slice(0, 10);
    if (beam[0].x > bestOverall.x) {
      bestOverall = beam[0];
    }
  }

  return {
    passed: bestOverall.x >= endX * 0.96,
    furthestX: bestOverall.x,
    crashX: bestOverall.x,
    crashY: bestOverall.y,
    crashMode: bestOverall.mode,
    bestState: bestOverall,
    durationSec: Math.max(1, (slices * 10) / 120),
  };
}

function evaluateGameplayFun(
  level: GDLevel,
  bestActions: number,
  durationSec: number
): {
  funScore: number;
  isBoring: boolean;
  boringReasons: string[];
  actionsPerSec: number;
  modeCount: number;
  longestFlatGap: number;
} {
  const gameplayObjs = level.objects.filter((o) => {
    const h = getHitboxDef(o.id).hitbox;
    return h === 'solid' || h === 'hazard' || h === 'pad' || h === 'orb' || h === 'portal';
  });

  const sortedX = gameplayObjs.map((o) => o.x).sort((a, b) => a - b);
  let longestFlatGap = 0;
  for (let i = 1; i < sortedX.length; i++) {
    const gap = sortedX[i] - sortedX[i - 1];
    if (gap > longestFlatGap) longestFlatGap = gap;
  }

  const modes = new Set<number>([level.meta.startMode]);
  let hasOrbsOrPads = false;
  let hasHazards = false;
  let hasSpeedOrTriggers = false;
  for (const o of level.objects) {
    if ([12, 13, 47, 111, 660, 745, 1331].includes(o.id)) modes.add(o.id);
    if ([35, 140, 1332, 67, 36, 141, 1333, 84, 1022, 1330].includes(o.id)) hasOrbsOrPads = true;
    if ([8, 9, 39, 88, 1705].includes(o.id)) hasHazards = true;
    if ([200, 202, 203, 1334, 899, 901].includes(o.id)) hasSpeedOrTriggers = true;
  }

  const actionsPerSec = Number((bestActions / Math.max(1, durationSec)).toFixed(2));
  const modeCount = modes.size;

  let score = 45;
  if (actionsPerSec >= 1.0 && actionsPerSec <= 4.5) score += 20;
  else if (actionsPerSec >= 0.65) score += 8;
  else score -= 18;

  if (modeCount >= 3) score += 18;
  else if (modeCount === 2) score += 10;
  else score -= 8;

  if (hasOrbsOrPads) score += 10;
  if (hasHazards) score += 8;
  if (hasSpeedOrTriggers) score += 7;
  if (longestFlatGap > 950) score -= 20;
  if (gameplayObjs.length < 18) score -= 22;

  const funScore = Math.max(0, Math.min(100, Math.round(score)));
  const boringReasons: string[] = [];
  if (actionsPerSec < 0.75) boringReasons.push('Nhịp thao tác quá thưa');
  if (longestFlatGap > 950) boringReasons.push(`Có đoạn trống dài (${Math.round(longestFlatGap)}u)`);
  if (modeCount < 2 && gameplayObjs.length < 28) boringReasons.push('Ít biến đổi chế độ chơi');
  if (!hasOrbsOrPads && !hasHazards) boringReasons.push('Thiếu thử thách gai, bệ hoặc ngọc');

  const isBoring = funScore < 50 || boringReasons.length >= 2 || gameplayObjs.length < 16;

  return {
    funScore,
    isBoring,
    boringReasons,
    actionsPerSec,
    modeCount,
    longestFlatGap: Math.round(longestFlatGap),
  };
}

export function testAndFixGDLevel(rawLevel: GDLevel): {
  level: GDLevel;
  report: AITestReport;
} {
  const working: GDLevel = {
    meta: { ...rawLevel.meta },
    objects: rawLevel.objects.map((o) => ({ ...o })),
  };

  let repairsMade = 0;
  const repairNotes: string[] = [];

  // Pre-clean: ensure safe 330-unit start runway (no hazards before x=330)
  const beforeLen = working.objects.length;
  working.objects = working.objects.filter((o) => {
    const def = getHitboxDef(o.id);
    if ((def.hitbox === 'hazard' || def.hitbox === 'solid') && o.x < 330) {
      return false;
    }
    return true;
  });
  if (working.objects.length < beforeLen) {
    repairsMade++;
    repairNotes.push('Dọn sạch chướng ngại đầu màn (x < 330)');
  }

  let sim = runBeamPlaytest(working);
  let passAttempt = 0;

  while (!sim.passed && passAttempt < 8) {
    passAttempt++;
    const cx = sim.crashX;
    const cy = sim.crashY;
    let fixedInPass = false;

    // 1. Remove any hazard directly overlapping crash point or dense cluster near crashX
    const hazardIdx = working.objects.findIndex((o) => {
      const def = getHitboxDef(o.id);
      return (
        def.hitbox === 'hazard' &&
        Math.abs(o.x - cx) <= 65 &&
        Math.abs(o.y - cy) <= 65
      );
    });
    if (hazardIdx !== -1) {
      const removed = working.objects[hazardIdx];
      working.objects.splice(hazardIdx, 1);
      repairsMade++;
      repairNotes.push(`Gỡ bẫy gây bất khả thi tại X=${Math.round(removed.x)}`);
      fixedInPass = true;
    }

    // 2. If solid blocks block the corridor around crashY at crashX, carve a 4-block passage
    if (!fixedInPass) {
      const blockingSolids = working.objects.filter((o) => {
        const def = getHitboxDef(o.id);
        return (
          def.hitbox === 'solid' &&
          Math.abs(o.x - cx) <= 45 &&
          Math.abs(o.y - cy) <= 55
        );
      });
      if (blockingSolids.length > 0) {
        const removeSet = new Set(blockingSolids.map((b) => b.uid));
        working.objects = working.objects.filter((o) => !removeSet.has(o.uid));
        repairsMade++;
        repairNotes.push(`Mở rộng hành lang khối rắn tại X=${Math.round(cx)}`);
        fixedInPass = true;
      }
    }

    // 3. Fallback: clear any obstacle/hazard within [cx - 45, cx + 90] and add a helpful Yellow Pad if grounded mode
    if (!fixedInPass) {
      const prevCount = working.objects.length;
      working.objects = working.objects.filter((o) => {
        const def = getHitboxDef(o.id);
        if (def.hitbox === 'hazard' && o.x >= cx - 45 && o.x <= cx + 90) {
          return false;
        }
        return true;
      });
      if (working.objects.length < prevCount) {
        repairsMade++;
        repairNotes.push(`Làm thoáng cụm chướng ngại tại X=${Math.round(cx)}`);
        fixedInPass = true;
      } else if ((sim.crashMode === 0 || sim.crashMode === 5) && cx > 360) {
        // Insert a Yellow Pad slightly before crashX to help clear high platforms
        const padX = Math.max(345, Math.round((cx - 90) / 30) * 30 + 15);
        working.objects.push({
          uid: `ai_fix_${Date.now().toString(36)}_${passAttempt}`,
          id: 35,
          x: padX,
          y: 15,
        });
        repairsMade++;
        repairNotes.push(`Thêm bệ bật hỗ trợ tại X=${padX}`);
        fixedInPass = true;
      }
    }

    if (!fixedInPass) break;
    working.objects.sort((a, b) => a.x - b.x || a.y - b.y);
    sim = runBeamPlaytest(working);
  }

  const fun = evaluateGameplayFun(
    working,
    sim.bestState.actions,
    sim.durationSec
  );

  return {
    level: working,
    report: {
      passed: sim.passed,
      repairsMade,
      repairNotes,
      funScore: fun.funScore,
      isBoring: fun.isBoring,
      boringReasons: fun.boringReasons,
      actionsPerSec: fun.actionsPerSec,
      modeCount: fun.modeCount,
      longestFlatGap: fun.longestFlatGap,
    },
  };
}

export interface BotReplayPlan {
  possible: boolean;
  crashX: number;
  attemptScripts: [boolean, boolean][][];
  report: AITestReport;
}

export function evaluateLevelOnly(rawLevel: GDLevel): AITestReport {
  const sim = runBeamPlaytest(rawLevel);
  const fun = evaluateGameplayFun(
    rawLevel,
    sim.bestState.actions,
    sim.durationSec
  );
  return {
    passed: sim.passed,
    repairsMade: 0,
    repairNotes: [],
    funScore: fun.funScore,
    isBoring: fun.isBoring,
    boringReasons: fun.boringReasons,
    actionsPerSec: fun.actionsPerSec,
    modeCount: fun.modeCount,
    longestFlatGap: fun.longestFlatGap,
  };
}

export function planBotReplay(rawLevel: GDLevel): BotReplayPlan {
  const sim = runBeamPlaytest(rawLevel);
  const fun = evaluateGameplayFun(
    rawLevel,
    sim.bestState.actions,
    sim.durationSec
  );
  const baseLog = sim.bestState.inputLog;

  let attemptScripts: [boolean, boolean][][];
  if (sim.passed) {
    attemptScripts = [baseLog, baseLog, baseLog];
  } else {
    const attempt1 = [...baseLog];
    // Attempt 2: try holding/jumping earlier before the impossible wall
    const attempt2 = baseLog.map((pair, idx) =>
      idx >= Math.max(0, baseLog.length - 8) ? ([true, true] as [boolean, boolean]) : pair
    );
    for (let k = 0; k < 14; k++) attempt2.push([true, true]);

    // Attempt 3: try low/alternating tap timing before the impossible wall
    const attempt3 = baseLog.map((pair, idx) =>
      idx >= Math.max(0, baseLog.length - 12)
        ? (idx % 2 === 0 ? ([false, false] as [boolean, boolean]) : ([true, false] as [boolean, boolean]))
        : pair
    );
    for (let k = 0; k < 14; k++) {
      attempt3.push(k % 3 === 0 ? [true, false] : [false, false]);
    }
    attemptScripts = [attempt1, attempt2, attempt3];
  }

  return {
    possible: sim.passed,
    crashX: sim.crashX,
    attemptScripts,
    report: {
      passed: sim.passed,
      repairsMade: 0,
      repairNotes: [],
      funScore: fun.funScore,
      isBoring: fun.isBoring,
      boringReasons: fun.boringReasons,
      actionsPerSec: fun.actionsPerSec,
      modeCount: fun.modeCount,
      longestFlatGap: fun.longestFlatGap,
    },
  };
}
