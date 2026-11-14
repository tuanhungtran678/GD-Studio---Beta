import { GDLevel, GDLevelMeta, GDObject, GamemodeId, SpeedId } from '../types/gd';

export type BlueprintPattern =
  | 'cube_stair_orb'
  | 'cube_pad_triple'
  | 'cube_half_slab_rhythm'
  | 'cube_timing_pillars'
  | 'ship_saw_corridor'
  | 'ship_pillar_weave'
  | 'wave_tunnel_45'
  | 'wave_diamond_pillars'
  | 'ball_gravity_corridor'
  | 'ball_orb_switch'
  | 'ufo_gate_pillars'
  | 'ufo_gravity_arcs'
  | 'robot_micro_macro'
  | 'robot_orb_climb'
  | 'spider_dual_chamber'
  | 'deco_rest_transition';

export interface BlueprintSection {
  gamemode: number; // 0..6
  pattern: BlueprintPattern | string;
  durationBeats: number; // 4..16
  speed: number; // 0..4
  elevation: 'low' | 'mid' | 'high';
  intensity: 'low' | 'medium' | 'high';
  hasCoin?: boolean;
  hasMovePlatform?: boolean;
  colorShiftHex?: string;
  note?: string;
}

export interface BlueprintMeta {
  name: string;
  description: string;
  officialSongId: number;
  startMode: number;
  startSpeed: number;
  bgColor: string;
  groundColor: string;
  lineColor: string;
  objColor: string;
  bgTexture: number;
  groundTexture: number;
}

export interface LevelBlueprint {
  meta: Partial<BlueprintMeta>;
  sections: BlueprintSection[];
}

const SPEED_UNITS_PER_SEC: Record<SpeedId, number> = {
  1: 251.16,
  0: 311.58,
  2: 387.42,
  3: 468.0,
  4: 576.0,
};

const MODE_PORTAL_ID: Record<GamemodeId, number> = {
  0: 12,
  1: 13,
  2: 47,
  3: 111,
  4: 660,
  5: 745,
  6: 1331,
};

const SPEED_PORTAL_ID: Record<SpeedId, number> = {
  1: 200,
  0: 201,
  2: 202,
  3: 203,
  4: 1334,
};

function clampInt(val: unknown, min: number, max: number, fallback: number): number {
  const n = Number(val);
  return Number.isFinite(n) ? Math.max(min, Math.min(max, Math.round(n))) : fallback;
}

function sanitizeHex(val: unknown, fallback: string): string {
  return typeof val === 'string' && /^#[0-9a-fA-F]{6}$/.test(val.trim()) ? val.trim() : fallback;
}

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const clean = hex.replace('#', '');
  const num = parseInt(clean.length === 3 ? clean.replace(/(.)/g, '$1$1') : clean, 16);
  if (Number.isNaN(num)) return { r: 24, g: 38, b: 84 };
  return {
    r: (num >> 16) & 255,
    g: (num >> 8) & 255,
    b: num & 255,
  };
}

function snapGrid(val: number): number {
  return Math.round((val - 15) / 30) * 30 + 15;
}

function snapY(val: number): number {
  return Math.max(15, Math.min(315, snapGrid(val)));
}

function elevationBaseY(elevation: 'low' | 'mid' | 'high'): number {
  if (elevation === 'high') return 75;
  if (elevation === 'mid') return 45;
  return 15;
}

function normalizePattern(rawPattern: string, mode: GamemodeId): BlueprintPattern {
  const valid: Set<string> = new Set([
    'cube_stair_orb',
    'cube_pad_triple',
    'cube_half_slab_rhythm',
    'cube_timing_pillars',
    'ship_saw_corridor',
    'ship_pillar_weave',
    'wave_tunnel_45',
    'wave_diamond_pillars',
    'ball_gravity_corridor',
    'ball_orb_switch',
    'ufo_gate_pillars',
    'ufo_gravity_arcs',
    'robot_micro_macro',
    'robot_orb_climb',
    'spider_dual_chamber',
    'deco_rest_transition',
  ]);
  if (valid.has(rawPattern)) {
    return rawPattern as BlueprintPattern;
  }
  switch (mode) {
    case 1:
      return 'ship_saw_corridor';
    case 2:
      return 'ball_gravity_corridor';
    case 3:
      return 'ufo_gate_pillars';
    case 4:
      return 'wave_tunnel_45';
    case 5:
      return 'robot_micro_macro';
    case 6:
      return 'spider_dual_chamber';
    default:
      return 'cube_stair_orb';
  }
}

export function compileBlueprintToLevel(
  blueprint: LevelBlueprint,
  fallbackPrompt: string,
  difficulty: 'easy' | 'normal' | 'hard' = 'normal'
): GDLevel {
  const rawMeta = blueprint.meta || {};
  const startMode = clampInt(rawMeta.startMode, 0, 6, 0) as GamemodeId;
  const startSpeed = clampInt(rawMeta.startSpeed, 0, 4, 0) as SpeedId;

  const meta: GDLevelMeta = {
    name: String(rawMeta.name || 'AI Rhythm Stage').slice(0, 40),
    author: 'GD Studio AI',
    description: String(rawMeta.description || fallbackPrompt).slice(0, 140),
    officialSongId: clampInt(rawMeta.officialSongId, 0, 21, 0),
    customSongId: 0,
    startMode,
    startSpeed,
    miniMode: false,
    flipGravity: false,
    bgColor: sanitizeHex(rawMeta.bgColor, '#0f2557'),
    groundColor: sanitizeHex(rawMeta.groundColor, '#091638'),
    lineColor: sanitizeHex(rawMeta.lineColor, '#38bdf8'),
    objColor: sanitizeHex(rawMeta.objColor, '#ffffff'),
    bgTexture: clampInt(rawMeta.bgTexture, 1, 6, 5),
    groundTexture: clampInt(rawMeta.groundTexture, 1, 4, 4),
  };

  const rawSections = Array.isArray(blueprint.sections) && blueprint.sections.length > 0
    ? blueprint.sections
    : [
        {
          gamemode: startMode,
          pattern: normalizePattern('', startMode),
          durationBeats: 8,
          speed: startSpeed,
          elevation: 'low' as const,
          intensity: 'medium' as const,
          hasCoin: true,
        },
      ];

  const stamp = Date.now().toString(36);
  const objects: GDObject[] = [];
  const occupiedSolidOrHazard = new Set<string>();
  let uidCounter = 0;
  let nextGroupId = 1;
  let coinsPlaced = 0;

  const pushObj = (obj: Omit<GDObject, 'uid'>) => {
    const x = Math.max(15, Math.round(obj.x));
    const y = Math.max(15, Math.min(345, Math.round(obj.y)));
    // Prevent overlapping solids/hazards on the exact same cell
    const isSolidOrHazard = [1, 2, 4, 6, 40, 8, 9, 39].includes(obj.id);
    if (isSolidOrHazard) {
      const cellKey = `${x}:${y}`;
      if (occupiedSolidOrHazard.has(cellKey)) return;
      occupiedSolidOrHazard.add(cellKey);
    }
    objects.push({
      ...obj,
      x,
      y,
      uid: `ai_${stamp}_${uidCounter++}`,
    });
  };

  const addBlockCol = (x: number, bottomY: number, topY: number, blockId = 1) => {
    for (let y = snapY(bottomY); y <= snapY(topY); y += 30) {
      pushObj({ id: blockId, x, y });
    }
  };

  const addBlockRow = (startX: number, endX: number, y: number, blockId = 1) => {
    for (let x = snapGrid(startX); x <= snapGrid(endX); x += 30) {
      pushObj({ id: blockId, x, y: snapY(y) });
    }
  };

  const addDecoPillar = (x: number, yStart: number, count: number, id = 130) => {
    for (let i = 0; i < count; i++) {
      pushObj({ id, x, y: snapY(yStart + i * 30) });
    }
  };

  let curX = 375; // Safe >= 330 flat runway before any obstacle
  let curMode: GamemodeId = startMode;
  let curSpeed: SpeedId = startSpeed;
  let gravityInverted = false;

  // Decorative intro runway markers (non-solid visual rhythm cues)
  pushObj({ id: 131, x: 195, y: 15 });
  pushObj({ id: 17, x: 225, y: 15 });
  pushObj({ id: 44, x: 255, y: 45 });
  pushObj({ id: 46, x: 285, y: 75 });

  rawSections.forEach((rawSec, secIdx) => {
    const mode = clampInt(rawSec.gamemode, 0, 6, curMode) as GamemodeId;
    const speed = clampInt(rawSec.speed, 0, 4, curSpeed) as SpeedId;
    const intensity: 'low' | 'medium' | 'high' =
      rawSec.intensity === 'low' || rawSec.intensity === 'high' ? rawSec.intensity : 'medium';
    const elevation: 'low' | 'mid' | 'high' =
      rawSec.elevation === 'mid' || rawSec.elevation === 'high' ? rawSec.elevation : 'low';
    const pattern = normalizePattern(String(rawSec.pattern || ''), mode);
    const beats = clampInt(rawSec.durationBeats, 4, 14, 8);

    const speedUps = SPEED_UNITS_PER_SEC[speed];
    // 1 beat ~ 0.45s -> section span in GD units, snapped to grid 30
    const rawSpan = Math.max(480, Math.min(1380, Math.round((beats * 0.44 * speedUps) / 30) * 30));

    // Normalize gravity before entering new section if previous mode left gravity inverted
    if (gravityInverted) {
      pushObj({ id: 10, x: curX, y: 75 });
      gravityInverted = false;
      curX += 90;
    }

    // Color Trigger at section transition
    if (rawSec.colorShiftHex && /^#[0-9a-fA-F]{6}$/.test(rawSec.colorShiftHex.trim())) {
      const rgb = hexToRgb(rawSec.colorShiftHex.trim());
      pushObj({
        id: 899,
        x: curX,
        y: 285,
        targetColorId: 1000,
        r: rgb.r,
        g: rgb.g,
        b: rgb.b,
        duration: 0.6,
      });
      pushObj({
        id: 899,
        x: curX + 30,
        y: 285,
        targetColorId: 1001,
        r: Math.max(8, Math.round(rgb.r * 0.58)),
        g: Math.max(10, Math.round(rgb.g * 0.58)),
        b: Math.max(16, Math.round(rgb.b * 0.58)),
        duration: 0.6,
      });
    }

    // Mode portal if changed (or at section 0 if section 0 differs from startMode)
    if (mode !== curMode) {
      pushObj({ id: MODE_PORTAL_ID[mode], x: curX, y: 75 });
      curMode = mode;
      curX += 120;
    }

    // Speed portal if changed
    if (speed !== curSpeed) {
      pushObj({ id: SPEED_PORTAL_ID[speed], x: curX, y: 75 });
      curSpeed = speed;
      curX += 90;
    }

    // Spacing multiplier scaled to speed so jumps are always physically reachable
    const speedScale = speed === 4 ? 1.5 : speed === 3 ? 1.25 : speed === 2 ? 1.12 : speed === 1 ? 0.9 : 1.0;
    const baseY = elevationBaseY(elevation);
    const sectionStart = curX;
    const sectionEnd = sectionStart + rawSpan;
    const wantCoin = Boolean(rawSec.hasCoin) && coinsPlaced < 3;
    let coinUsedInSection = false;

    const placeCoinOnce = (cx: number, cy: number) => {
      if (!wantCoin || coinUsedInSection || coinsPlaced >= 3) return;
      pushObj({ id: 1329, x: snapGrid(cx), y: snapY(cy) });
      coinUsedInSection = true;
      coinsPlaced++;
    };

    // Compile section according to deliberate choreography pattern
    switch (pattern) {
      case 'cube_stair_orb': {
        let px = sectionStart;
        const stepGap = Math.round((150 * speedScale) / 30) * 30;
        let cycle = 0;
        while (px + 330 <= sectionEnd) {
          const h1 = baseY;
          const h2 = Math.min(135, h1 + 30);
          const h3 = Math.min(165, h2 + 30);
          // Pillar 1
          addBlockCol(px, 15, h1, 1);
          addBlockRow(px, px + 60, h1, 2);
          if (difficulty !== 'easy' && cycle % 2 === 0) {
            pushObj({ id: 8, x: px + 90, y: 15 });
          }
          // Elevated platform + orb jump
          const p2x = px + stepGap;
          addBlockRow(p2x, p2x + 60, h2, 4);
          addBlockCol(p2x + 30, 15, h2 - 30, 6);
          if (intensity !== 'low') {
            pushObj({ id: 8, x: p2x - 30, y: 15 });
          }
          // Yellow orb bridging to peak platform
          const orbX = p2x + 120;
          pushObj({ id: 36, x: orbX, y: h2 + 60 });
          if (difficulty === 'hard') {
            pushObj({ id: 8, x: orbX, y: 15 });
            pushObj({ id: 8, x: orbX + 30, y: 15 });
          } else {
            pushObj({ id: 9, x: orbX, y: 15 });
          }
          const p3x = orbX + 90;
          addBlockRow(p3x, p3x + 90, h3, 1);
          addDecoPillar(p3x + 30, 15, Math.max(1, Math.floor((h3 - 15) / 30)));
          if (cycle === 0) {
            placeCoinOnce(p3x + 45, h3 + 60);
          }
          // Clean drop down to safe landing pad
          const landX = p3x + 180;
          if (intensity === 'high') {
            pushObj({ id: 39, x: landX - 30, y: 15 });
          }
          px = landX + 90;
          cycle++;
        }
        curX = Math.max(sectionEnd, px + 90);
        break;
      }

      case 'cube_pad_triple': {
        let px = sectionStart;
        const launchGap = Math.round((180 * speedScale) / 30) * 30;
        let cycle = 0;
        while (px + 360 <= sectionEnd) {
          // Launch pad on floor or base block
          addBlockRow(px, px + 60, baseY, 2);
          const padId = cycle % 2 === 0 ? 35 : 1332; // Yellow or Red Pad
          pushObj({ id: padId, x: px + 60, y: baseY + 30 });
          // Triple spike hazard underneath arc
          const spikeCount = difficulty === 'easy' ? 2 : 3;
          for (let s = 0; s < spikeCount; s++) {
            pushObj({ id: 8, x: px + 120 + s * 30, y: 15 });
          }
          // Landing deck at mid-height
          const deckX = px + launchGap + 30;
          const deckY = padId === 1332 ? Math.min(165, baseY + 90) : Math.min(135, baseY + 60);
          addBlockRow(deckX, deckX + 120, deckY, 4);
          addBlockCol(deckX + 60, 15, deckY - 30, 6);
          if (cycle === 0) {
            placeCoinOnce(px + 150, deckY + 60);
          }
          // Optional Black Orb fast drop on hard/medium
          if (intensity !== 'low' && deckX + 210 <= sectionEnd) {
            pushObj({ id: 1330, x: deckX + 150, y: deckY + 45 });
            pushObj({ id: 9, x: deckX + 120, y: 15 });
          }
          px = deckX + 240;
          cycle++;
        }
        curX = Math.max(sectionEnd, px + 90);
        break;
      }

      case 'cube_half_slab_rhythm': {
        let px = sectionStart;
        const hopGap = Math.round((150 * speedScale) / 30) * 30;
        let idx = 0;
        while (px + 240 <= sectionEnd) {
          const slabY = Math.min(135, baseY + (idx % 3) * 30);
          pushObj({ id: 40, x: px, y: slabY });
          pushObj({ id: 40, x: px + 30, y: slabY });
          addDecoPillar(px + 15, 15, Math.max(0, Math.floor((slabY - 15) / 30)));
          if (idx % 2 === 1 && difficulty !== 'easy') {
            pushObj({ id: 39, x: px + 60, y: 15 });
          }
          if (idx === 1) {
            placeCoinOnce(px + 15, slabY + 60);
          }
          px += hopGap;
          idx++;
        }
        curX = Math.max(sectionEnd, px + 90);
        break;
      }

      case 'cube_timing_pillars': {
        let px = sectionStart;
        const gap = Math.round((180 * speedScale) / 30) * 30;
        let idx = 0;
        while (px + 210 <= sectionEnd) {
          if (idx % 3 === 1) {
            // Single or double floor spike rhythm
            pushObj({ id: 8, x: px + 30, y: 15 });
            if (difficulty === 'hard') {
              pushObj({ id: 8, x: px + 60, y: 15 });
            }
          } else {
            const pY = Math.min(105, baseY + (idx % 2) * 30);
            addBlockRow(px, px + 60, pY, 1);
            if (pY > 15) addBlockCol(px + 30, 15, pY - 30, 6);
            if (intensity === 'high' && idx % 2 === 0) {
              pushObj({ id: 39, x: px + 30, y: pY + 30 });
            }
            if (idx === 2) {
              placeCoinOnce(px + 30, pY + 75);
            }
          }
          px += gap;
          idx++;
        }
        curX = Math.max(sectionEnd, px + 90);
        break;
      }

      case 'ship_saw_corridor': {
        const floorY = 15;
        const ceilY = 285;
        addBlockRow(sectionStart, sectionEnd - 30, floorY, 2);
        addBlockRow(sectionStart, sectionEnd - 30, ceilY, 2);

        const sawSpacing = difficulty === 'hard' ? 180 : difficulty === 'easy' ? 270 : 210;
        let idx = 0;
        for (let sx = sectionStart + 90; sx <= sectionEnd - 90; sx += sawSpacing) {
          const isTop = idx % 2 === 0;
          // Guarantee >= 135 units vertical corridor clearance
          const sawY = isTop ? (intensity === 'high' ? 210 : 225) : (intensity === 'high' ? 90 : 75);
          const x = snapGrid(sx);
          pushObj({ id: intensity === 'high' ? 88 : 1705, x, y: sawY });
          if (isTop && sawY <= 225) {
            pushObj({ id: 21, x, y: 255 }); // Hanging chain from ceiling
          } else if (!isTop && sawY >= 75) {
            pushObj({ id: 21, x, y: 45 }); // Anchor chain from floor
          }
          if (idx === 1) {
            placeCoinOnce(sx, isTop ? 105 : 195);
          }
          idx++;
        }
        curX = sectionEnd + 90;
        break;
      }

      case 'ship_pillar_weave': {
        const spacing = difficulty === 'hard' ? 210 : 270;
        let idx = 0;
        for (let sx = sectionStart + 60; sx <= sectionEnd - 90; sx += spacing) {
          const x = snapGrid(sx);
          if (idx % 2 === 0) {
            // Bottom pillar leaving y >= 120 open
            addBlockCol(x, 15, 75, 6);
            pushObj({ id: 8, x, y: 105 });
          } else {
            // Top hanging pillar leaving y <= 165 open
            addBlockCol(x, 225, 285, 6);
            pushObj({ id: 8, x, y: 195, rotation: 180 });
          }
          if (idx === 1) {
            placeCoinOnce(x, 135);
          }
          idx++;
        }
        curX = sectionEnd + 90;
        break;
      }

      case 'wave_tunnel_45': {
        // True 45-degree zig-zag corridor (Wave travels dy/dx = +-1)
        const halfCorridor = difficulty === 'hard' ? 60 : difficulty === 'easy' ? 90 : 75;
        let centerY = 150;
        let goingUp = true;
        let x = sectionStart;
        let stepCount = 0;
        while (x <= sectionEnd - 30) {
          const botBlockY = centerY - halfCorridor - 15;
          const topBlockY = centerY + halfCorridor + 15;
          if (botBlockY >= 15) {
            pushObj({ id: 1, x, y: snapY(botBlockY) });
          }
          if (topBlockY <= 315) {
            pushObj({ id: 1, x, y: snapY(topBlockY) });
          }
          if (stepCount === Math.floor((sectionEnd - sectionStart) / 60)) {
            placeCoinOnce(x, centerY);
          }
          if (goingUp) {
            centerY += 30;
            if (centerY >= 210) goingUp = false;
          } else {
            centerY -= 30;
            if (centerY <= 105) goingUp = true;
          }
          x += 30;
          stepCount++;
        }
        curX = sectionEnd + 120;
        break;
      }

      case 'wave_diamond_pillars': {
        addBlockRow(sectionStart, sectionEnd - 30, 15, 4);
        addBlockRow(sectionStart, sectionEnd - 30, 285, 4);
        const spacing = difficulty === 'hard' ? 180 : 240;
        let idx = 0;
        for (let sx = sectionStart + 90; sx <= sectionEnd - 90; sx += spacing) {
          const x = snapGrid(sx);
          const cy = idx % 2 === 0 ? 150 : 120;
          pushObj({ id: 1, x, y: cy });
          pushObj({ id: 1, x: x - 30, y: cy });
          pushObj({ id: 1, x: x + 30, y: cy });
          pushObj({ id: 1705, x, y: cy + 30 });
          pushObj({ id: 1705, x, y: cy - 30 });
          if (idx === 1) {
            placeCoinOnce(x, cy + 90);
          }
          idx++;
        }
        curX = sectionEnd + 120;
        break;
      }

      case 'ball_gravity_corridor': {
        // Ground floor y=0 (player at y=15), Ceiling blocks at y=225 -> Ball flips cleanly between y=15 and y=195
        addBlockRow(Math.max(345, sectionStart - 60), sectionEnd - 30, 225, 2);
        const spacing = Math.round((210 * speedScale) / 30) * 30;
        let idx = 0;
        for (let sx = sectionStart + 90; sx <= sectionEnd - 90; sx += spacing) {
          const x = snapGrid(sx);
          if (idx % 2 === 0) {
            // Spike on ground -> player flips up to ceiling
            pushObj({ id: 8, x, y: 15 });
            if (intensity === 'high') pushObj({ id: 8, x: x + 30, y: 15 });
          } else {
            // Upside-down spike on ceiling -> player flips down to ground
            pushObj({ id: 8, x, y: 195, rotation: 180 });
            if (intensity === 'high') pushObj({ id: 8, x: x + 30, y: 195, rotation: 180 });
          }
          if (idx === 1) {
            placeCoinOnce(x, 105);
          }
          idx++;
        }
        curX = sectionEnd + 120;
        break;
      }

      case 'ball_orb_switch': {
        let px = sectionStart;
        const step = Math.round((210 * speedScale) / 30) * 30;
        let idx = 0;
        while (px + 210 <= sectionEnd) {
          if (idx % 2 === 0) {
            addBlockRow(px, px + 90, 45, 4);
            pushObj({ id: 84, x: px + 120, y: 90 }); // Blue orb flips gravity up
            addBlockRow(px + 150, px + 240, 225, 4);
          } else {
            pushObj({ id: 1022, x: px + 30, y: 165 }); // Green orb flips + jumps down
            addBlockRow(px + 60, px + 150, 45, 4);
            if (idx === 1) placeCoinOnce(px + 105, 90);
          }
          px += step;
          idx++;
        }
        curX = Math.max(sectionEnd, px + 120);
        break;
      }

      case 'ufo_gate_pillars': {
        const spacing = difficulty === 'hard' ? 210 : 270;
        let idx = 0;
        for (let sx = sectionStart + 90; sx <= sectionEnd - 90; sx += spacing) {
          const x = snapGrid(sx);
          const gapCenter = idx % 3 === 0 ? 135 : idx % 3 === 1 ? 195 : 105;
          const halfGap = difficulty === 'hard' ? 60 : 75;
          const botTop = gapCenter - halfGap;
          const topBot = gapCenter + halfGap;
          if (botTop >= 15) {
            addBlockCol(x, 15, botTop, 6);
            pushObj({ id: 39, x, y: snapY(botTop + 30) });
          }
          if (topBot <= 285) {
            addBlockCol(x, topBot, 285, 6);
            pushObj({ id: 39, x, y: snapY(topBot - 30), rotation: 180 });
          }
          if (idx === 1) {
            placeCoinOnce(x, gapCenter);
          }
          idx++;
        }
        curX = sectionEnd + 120;
        break;
      }

      case 'ufo_gravity_arcs': {
        const midX = snapGrid(sectionStart + rawSpan * 0.45);
        pushObj({ id: 11, x: midX, y: 165 }); // Invert Gravity Portal
        gravityInverted = true;
        const spacing = 240;
        let idx = 0;
        for (let sx = sectionStart + 90; sx <= sectionEnd - 90; sx += spacing) {
          const x = snapGrid(sx);
          const sawY = idx % 2 === 0 ? 90 : 210;
          pushObj({ id: 1705, x, y: sawY });
          if (idx === 1) placeCoinOnce(x, idx % 2 === 0 ? 195 : 105);
          idx++;
        }
        curX = sectionEnd + 120;
        break;
      }

      case 'robot_micro_macro': {
        let px = sectionStart;
        const gap = Math.round((180 * speedScale) / 30) * 30;
        let idx = 0;
        while (px + 240 <= sectionEnd) {
          if (idx % 2 === 0) {
            // Micro hop over small spike
            pushObj({ id: 39, x: px + 30, y: 15 });
            addBlockRow(px + 90, px + 150, 45, 2);
          } else {
            // Held Robot jump onto 3-block tall ledge
            addBlockCol(px + 30, 15, 75, 4);
            addBlockRow(px + 30, px + 120, 75, 4);
            if (intensity !== 'low') {
              pushObj({ id: 8, x: px - 30, y: 15 });
            }
            if (idx === 1) placeCoinOnce(px + 75, 135);
          }
          px += gap;
          idx++;
        }
        curX = Math.max(sectionEnd, px + 120);
        break;
      }

      case 'robot_orb_climb': {
        let px = sectionStart;
        let idx = 0;
        while (px + 300 <= sectionEnd) {
          addBlockRow(px, px + 60, 45, 1);
          pushObj({ id: 141, x: px + 105, y: 105 }); // Pink Orb
          addBlockRow(px + 150, px + 240, 135, 1);
          addDecoPillar(px + 180, 15, 3);
          pushObj({ id: 8, x: px + 120, y: 15 });
          if (idx === 0) placeCoinOnce(px + 195, 195);
          px += 300;
          idx++;
        }
        curX = Math.max(sectionEnd, px + 90);
        break;
      }

      case 'spider_dual_chamber': {
        // Ground floor y=0 (player at y=15), Ceiling at y=255 -> Spider teleports crisply between y=15 and y=225
        addBlockRow(Math.max(345, sectionStart - 60), sectionEnd - 30, 255, 6);
        const spacing = Math.round((210 * speedScale) / 30) * 30;
        let idx = 0;
        for (let sx = sectionStart + 90; sx <= sectionEnd - 90; sx += spacing) {
          const x = snapGrid(sx);
          if (idx % 2 === 0) {
            pushObj({ id: 8, x, y: 15 });
            pushObj({ id: 1, x: x + 30, y: 15 });
          } else {
            pushObj({ id: 8, x, y: 225, rotation: 180 });
            pushObj({ id: 1, x: x + 30, y: 225 });
          }
          if (idx === 1) placeCoinOnce(x, 120);
          idx++;
        }
        curX = sectionEnd + 120;
        break;
      }

      case 'deco_rest_transition':
      default: {
        // Flowing elevated walkway with decorative rhythm pillars
        const step = 120;
        for (let sx = sectionStart + 30; sx <= sectionEnd - 60; sx += step) {
          const x = snapGrid(sx);
          addBlockRow(x, x + 60, baseY, 2);
          addDecoPillar(x + 30, baseY + 30, 2);
        }
        placeCoinOnce(sectionStart + Math.floor(rawSpan / 2), baseY + 75);
        curX = sectionEnd + 90;
        break;
      }
    }

    // Optional Move Trigger floating bonus platform at section tail
    if (rawSec.hasMovePlatform && nextGroupId <= 10) {
      const grp = nextGroupId++;
      const platX = snapGrid(sectionStart + rawSpan * 0.5);
      const platY = mode === 1 || mode === 4 ? 150 : 105;
      pushObj({ id: 5, x: platX, y: platY, groups: [grp] });
      pushObj({ id: 5, x: platX + 30, y: platY, groups: [grp] });
      pushObj({
        id: 901,
        x: Math.max(15, platX - 180),
        y: 285,
        targetGroup: grp,
        moveX: 0,
        moveY: 45,
        duration: 0.7,
      });
    }

    // Visual beat divider & ambient glow/stars between sections
    if (secIdx < rawSections.length - 1) {
      pushObj({ id: 17, x: curX - 30, y: 255 });
      pushObj({ id: 45, x: curX - 30, y: 195 });
      pushObj({ id: 46, x: Math.max(345, sectionStart + 60), y: 255 });
    }
  });

  // Sort strictly by x for optimal engine performance & clean serialization
  objects.sort((a, b) => a.x - b.x || a.y - b.y);

  return { meta, objects };
}
