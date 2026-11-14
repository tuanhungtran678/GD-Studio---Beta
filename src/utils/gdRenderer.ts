import { GDObject, GamemodeId } from '../types/gd';
import { getObjectDef } from '../data/gdCatalog';

export interface RenderObjectState {
  offsetX?: number;
  offsetY?: number;
  opacity?: number;
}

export function drawGDObject(
  ctx: CanvasRenderingContext2D,
  obj: Pick<GDObject, 'id' | 'rotation' | 'flipX' | 'flipY' | 'scale' | 'groups' | 'targetGroup' | 'targetColorId' | 'r' | 'g' | 'b'>,
  cx: number,
  cy: number,
  unitScale: number, // pixels per GD unit (default 1 unit = 1px at zoom 1, or scaled)
  timeSec = 0,
  options?: {
    selected?: boolean;
    objColor?: string;
    opacity?: number;
    showTriggerTags?: boolean;
    ghost?: boolean;
  }
) {
  const def = getObjectDef(obj.id);
  const scale = obj.scale ?? 1;
  const s = unitScale * scale;
  const rotRad = ((obj.rotation || 0) * Math.PI) / 180;
  const baseOpacity = options?.ghost ? 0.5 : options?.opacity ?? 1;

  ctx.save();
  ctx.globalAlpha = Math.max(0.05, Math.min(1, baseOpacity));
  ctx.translate(cx, cy);
  if (rotRad !== 0) ctx.rotate(rotRad);
  if (obj.flipX || obj.flipY) {
    ctx.scale(obj.flipX ? -1 : 1, obj.flipY ? -1 : 1);
  }

  const lineCol = options?.objColor || '#f8fafc';

  switch (obj.id) {
    case 1: {
      // Basic Block
      const half = 15 * s;
      const grad = ctx.createLinearGradient(-half, -half, half, half);
      grad.addColorStop(0, '#1e293b');
      grad.addColorStop(1, '#090d16');
      ctx.fillStyle = grad;
      ctx.fillRect(-half, -half, half * 2, half * 2);
      ctx.strokeStyle = lineCol;
      ctx.lineWidth = Math.max(1.2, 1.8 * s);
      ctx.strokeRect(-half + 0.8 * s, -half + 0.8 * s, half * 2 - 1.6 * s, half * 2 - 1.6 * s);
      ctx.strokeStyle = 'rgba(255,255,255,0.22)';
      ctx.lineWidth = Math.max(1, 1 * s);
      ctx.strokeRect(-half + 5 * s, -half + 5 * s, half * 2 - 10 * s, half * 2 - 10 * s);
      break;
    }

    case 2: {
      // Grid Block
      const half = 15 * s;
      ctx.fillStyle = 'rgba(15, 23, 42, 0.82)';
      ctx.fillRect(-half, -half, half * 2, half * 2);
      ctx.strokeStyle = lineCol;
      ctx.lineWidth = Math.max(1.2, 1.6 * s);
      ctx.strokeRect(-half + 0.8 * s, -half + 0.8 * s, half * 2 - 1.6 * s, half * 2 - 1.6 * s);
      ctx.beginPath();
      ctx.moveTo(-half, 0);
      ctx.lineTo(half, 0);
      ctx.moveTo(0, -half);
      ctx.lineTo(0, half);
      ctx.strokeStyle = 'rgba(255,255,255,0.28)';
      ctx.lineWidth = Math.max(0.8, 1 * s);
      ctx.stroke();
      break;
    }

    case 4: {
      // Brick Block
      const half = 15 * s;
      ctx.fillStyle = '#1e1b4b';
      ctx.fillRect(-half, -half, half * 2, half * 2);
      ctx.strokeStyle = lineCol;
      ctx.lineWidth = Math.max(1.2, 1.6 * s);
      ctx.strokeRect(-half + 0.8 * s, -half + 0.8 * s, half * 2 - 1.6 * s, half * 2 - 1.6 * s);
      ctx.strokeStyle = 'rgba(255,255,255,0.35)';
      ctx.lineWidth = Math.max(0.8, 1 * s);
      ctx.beginPath();
      ctx.moveTo(-half, -5 * s);
      ctx.lineTo(half, -5 * s);
      ctx.moveTo(-half, 5 * s);
      ctx.lineTo(half, 5 * s);
      ctx.moveTo(0, -half);
      ctx.lineTo(0, -5 * s);
      ctx.moveTo(-7 * s, -5 * s);
      ctx.lineTo(-7 * s, 5 * s);
      ctx.moveTo(7 * s, -5 * s);
      ctx.lineTo(7 * s, 5 * s);
      ctx.moveTo(0, 5 * s);
      ctx.lineTo(0, half);
      ctx.stroke();
      break;
    }

    case 40: {
      // Half Slab
      const hw = 15 * s;
      const hh = 7.5 * s;
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(-hw, -hh, hw * 2, hh * 2);
      ctx.strokeStyle = lineCol;
      ctx.lineWidth = Math.max(1.2, 1.6 * s);
      ctx.strokeRect(-hw + 0.8 * s, -hh + 0.8 * s, hw * 2 - 1.6 * s, hh * 2 - 1.6 * s);
      break;
    }

    case 5: {
      // Deco block (non-solid)
      const half = 15 * s;
      ctx.fillStyle = 'rgba(148, 163, 184, 0.16)';
      ctx.fillRect(-half, -half, half * 2, half * 2);
      ctx.setLineDash([3 * s, 3 * s]);
      ctx.strokeStyle = 'rgba(226, 232, 240, 0.55)';
      ctx.lineWidth = Math.max(1, 1.2 * s);
      ctx.strokeRect(-half + 1 * s, -half + 1 * s, half * 2 - 2 * s, half * 2 - 2 * s);
      ctx.setLineDash([]);
      break;
    }

    case 6: {
      // Striped pillar
      const half = 15 * s;
      ctx.fillStyle = '#064e3b';
      ctx.fillRect(-half, -half, half * 2, half * 2);
      ctx.strokeStyle = '#34d399';
      ctx.lineWidth = Math.max(1.2, 1.6 * s);
      ctx.strokeRect(-half + 0.8 * s, -half + 0.8 * s, half * 2 - 1.6 * s, half * 2 - 1.6 * s);
      ctx.fillStyle = 'rgba(52, 211, 153, 0.35)';
      ctx.fillRect(-7 * s, -half + 2 * s, 4 * s, half * 2 - 4 * s);
      ctx.fillRect(3 * s, -half + 2 * s, 4 * s, half * 2 - 4 * s);
      break;
    }

    case 17: {
      // Neon Corner Frame (Deco)
      const half = 15 * s;
      const arm = 7 * s;
      ctx.fillStyle = 'rgba(34, 211, 238, 0.08)';
      ctx.fillRect(-half, -half, half * 2, half * 2);
      ctx.strokeStyle = '#22d3ee';
      ctx.lineWidth = Math.max(1.4, 2 * s);
      ctx.beginPath();
      // Top-left
      ctx.moveTo(-half + 1 * s, -half + arm);
      ctx.lineTo(-half + 1 * s, -half + 1 * s);
      ctx.lineTo(-half + arm, -half + 1 * s);
      // Top-right
      ctx.moveTo(half - arm, -half + 1 * s);
      ctx.lineTo(half - 1 * s, -half + 1 * s);
      ctx.lineTo(half - 1 * s, -half + arm);
      // Bottom-right
      ctx.moveTo(half - 1 * s, half - arm);
      ctx.lineTo(half - 1 * s, half - 1 * s);
      ctx.lineTo(half - arm, half - 1 * s);
      // Bottom-left
      ctx.moveTo(-half + arm, half - 1 * s);
      ctx.lineTo(-half + 1 * s, half - 1 * s);
      ctx.lineTo(-half + 1 * s, half - arm);
      ctx.stroke();

      ctx.fillStyle = 'rgba(34, 211, 238, 0.45)';
      ctx.fillRect(-3.5 * s, -3.5 * s, 7 * s, 7 * s);
      break;
    }

    case 18: {
      // Deco 45-degree Slope
      const half = 15 * s;
      ctx.beginPath();
      ctx.moveTo(-half, half);
      ctx.lineTo(half, -half);
      ctx.lineTo(half, half);
      ctx.closePath();
      const grad = ctx.createLinearGradient(-half, half, half, -half);
      grad.addColorStop(0, 'rgba(56, 189, 248, 0.16)');
      grad.addColorStop(1, 'rgba(15, 23, 42, 0.72)');
      ctx.fillStyle = grad;
      ctx.fill();
      ctx.strokeStyle = lineCol;
      ctx.lineWidth = Math.max(1.2, 1.6 * s);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(-half + 7 * s, half - 3 * s);
      ctx.lineTo(half - 3 * s, -half + 7 * s);
      ctx.strokeStyle = 'rgba(56, 189, 248, 0.55)';
      ctx.lineWidth = Math.max(1, 1.2 * s);
      ctx.stroke();
      break;
    }

    case 21: {
      // Hanging Chain (Deco)
      const half = 15 * s;
      ctx.strokeStyle = '#cbd5e1';
      ctx.lineWidth = Math.max(1.3, 1.8 * s);
      for (let i = -1; i <= 1; i++) {
        const ly = i * 9 * s;
        ctx.beginPath();
        ctx.roundRect(-4.5 * s, ly - 5 * s, 9 * s, 10 * s, 4 * s);
        ctx.stroke();
      }
      ctx.beginPath();
      ctx.moveTo(0, -half);
      ctx.lineTo(0, half);
      ctx.strokeStyle = 'rgba(255,255,255,0.22)';
      ctx.lineWidth = Math.max(1, 1.1 * s);
      ctx.stroke();
      break;
    }

    case 44: {
      // Glow Direction Arrow (Deco)
      ctx.save();
      ctx.shadowColor = '#34d399';
      ctx.shadowBlur = 8 * s;
      ctx.strokeStyle = '#34d399';
      ctx.lineWidth = Math.max(1.8, 2.4 * s);
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.beginPath();
      ctx.moveTo(-9 * s, -8 * s);
      ctx.lineTo(0, 0);
      ctx.lineTo(-9 * s, 8 * s);
      ctx.moveTo(-1 * s, -8 * s);
      ctx.lineTo(8 * s, 0);
      ctx.lineTo(-1 * s, 8 * s);
      ctx.stroke();
      ctx.restore();
      break;
    }

    case 45: {
      // Ambient Neon Glow Bloom (Deco)
      const rad = 16 * s;
      const pulse = 0.92 + Math.sin(timeSec * 3.2) * 0.08;
      const grad = ctx.createRadialGradient(0, 0, 1 * s, 0, 0, rad * pulse);
      grad.addColorStop(0, 'rgba(167, 139, 250, 0.85)');
      grad.addColorStop(0.45, 'rgba(139, 92, 246, 0.35)');
      grad.addColorStop(1, 'rgba(139, 92, 246, 0)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(0, 0, rad * pulse, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(0, 0, 3.5 * s, 0, Math.PI * 2);
      ctx.fillStyle = '#ede9fe';
      ctx.fill();
      break;
    }

    case 46: {
      // Neon 4-point Star Spark (Deco)
      const outer = 12 * s * (0.94 + Math.sin(timeSec * 4) * 0.06);
      const inner = 3.5 * s;
      ctx.save();
      ctx.shadowColor = '#facc15';
      ctx.shadowBlur = 7 * s;
      ctx.beginPath();
      for (let i = 0; i < 8; i++) {
        const ang = (i * Math.PI) / 4;
        const r = i % 2 === 0 ? outer : inner;
        const px = Math.cos(ang) * r;
        const py = Math.sin(ang) * r;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.fillStyle = 'rgba(250, 204, 21, 0.85)';
      ctx.fill();
      ctx.strokeStyle = '#fef9c3';
      ctx.lineWidth = Math.max(0.8, 1 * s);
      ctx.stroke();
      ctx.restore();
      break;
    }

    case 130: {
      // Dark Background Brick Tile (Deco, non-solid)
      const half = 15 * s;
      ctx.fillStyle = 'rgba(30, 27, 75, 0.55)';
      ctx.fillRect(-half, -half, half * 2, half * 2);
      ctx.strokeStyle = 'rgba(129, 140, 248, 0.45)';
      ctx.lineWidth = Math.max(1, 1.2 * s);
      ctx.strokeRect(-half + 0.8 * s, -half + 0.8 * s, half * 2 - 1.6 * s, half * 2 - 1.6 * s);
      ctx.beginPath();
      ctx.moveTo(-half, 0);
      ctx.lineTo(half, 0);
      ctx.moveTo(0, -half);
      ctx.lineTo(0, 0);
      ctx.moveTo(-7 * s, 0);
      ctx.lineTo(-7 * s, half);
      ctx.moveTo(7 * s, 0);
      ctx.lineTo(7 * s, half);
      ctx.strokeStyle = 'rgba(129, 140, 248, 0.25)';
      ctx.stroke();
      break;
    }

    case 131: {
      // Tech Circuit Conduit (Deco)
      const half = 15 * s;
      ctx.fillStyle = 'rgba(8, 51, 68, 0.42)';
      ctx.fillRect(-half, -half, half * 2, half * 2);
      ctx.strokeStyle = 'rgba(6, 182, 212, 0.85)';
      ctx.lineWidth = Math.max(1.2, 1.6 * s);
      ctx.beginPath();
      ctx.moveTo(-half, 4 * s);
      ctx.lineTo(-4 * s, 4 * s);
      ctx.lineTo(4 * s, -4 * s);
      ctx.lineTo(half, -4 * s);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(-4 * s, 4 * s, 2.5 * s, 0, Math.PI * 2);
      ctx.arc(4 * s, -4 * s, 2.5 * s, 0, Math.PI * 2);
      ctx.fillStyle = '#67e8f9';
      ctx.fill();
      break;
    }

    case 132: {
      // Caution Warning Stripe Block (Deco)
      const half = 15 * s;
      ctx.save();
      ctx.beginPath();
      ctx.rect(-half, -half, half * 2, half * 2);
      ctx.clip();
      ctx.fillStyle = 'rgba(15, 23, 42, 0.72)';
      ctx.fillRect(-half, -half, half * 2, half * 2);
      ctx.fillStyle = 'rgba(245, 158, 11, 0.45)';
      for (let x = -half * 2; x < half * 2; x += 10 * s) {
        ctx.beginPath();
        ctx.moveTo(x, half);
        ctx.lineTo(x + 5 * s, half);
        ctx.lineTo(x + 17 * s, -half);
        ctx.lineTo(x + 12 * s, -half);
        ctx.closePath();
        ctx.fill();
      }
      ctx.restore();
      ctx.strokeStyle = 'rgba(245, 158, 11, 0.7)';
      ctx.lineWidth = Math.max(1, 1.3 * s);
      ctx.strokeRect(-half + 0.8 * s, -half + 0.8 * s, half * 2 - 1.6 * s, half * 2 - 1.6 * s);
      break;
    }

    case 8: {
      // Regular Spike
      const half = 15 * s;
      ctx.beginPath();
      ctx.moveTo(0, -half);
      ctx.lineTo(half, half);
      ctx.lineTo(-half, half);
      ctx.closePath();
      const grad = ctx.createLinearGradient(0, -half, 0, half);
      grad.addColorStop(0, '#0f172a');
      grad.addColorStop(1, '#020617');
      ctx.fillStyle = grad;
      ctx.fill();
      ctx.strokeStyle = lineCol;
      ctx.lineWidth = Math.max(1.2, 1.8 * s);
      ctx.stroke();

      // Inner highlight triangle
      ctx.beginPath();
      ctx.moveTo(0, -half + 7 * s);
      ctx.lineTo(half - 6 * s, half - 3 * s);
      ctx.lineTo(-half + 6 * s, half - 3 * s);
      ctx.closePath();
      ctx.strokeStyle = 'rgba(244, 63, 94, 0.65)';
      ctx.lineWidth = Math.max(0.9, 1.1 * s);
      ctx.stroke();
      break;
    }

    case 39: {
      // Small Spike
      const half = 15 * s;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(half, half);
      ctx.lineTo(-half, half);
      ctx.closePath();
      ctx.fillStyle = '#090d16';
      ctx.fill();
      ctx.strokeStyle = lineCol;
      ctx.lineWidth = Math.max(1.2, 1.6 * s);
      ctx.stroke();
      break;
    }

    case 9: {
      // Ground Thorns (3 mini spikes)
      const w = 10 * s;
      const base = 15 * s;
      for (let i = -1; i <= 1; i++) {
        const ox = i * w;
        ctx.beginPath();
        ctx.moveTo(ox, 2 * s);
        ctx.lineTo(ox + w / 2, base);
        ctx.lineTo(ox - w / 2, base);
        ctx.closePath();
        ctx.fillStyle = '#090d16';
        ctx.fill();
        ctx.strokeStyle = '#fb7185';
        ctx.lineWidth = Math.max(1, 1.4 * s);
        ctx.stroke();
      }
      break;
    }

    case 88:
    case 1705: {
      // Sawblades
      const radius = (obj.id === 88 ? 22 : 16) * s;
      const teeth = obj.id === 88 ? 12 : 10;
      ctx.save();
      ctx.rotate(timeSec * 4.5);
      ctx.beginPath();
      for (let i = 0; i < teeth * 2; i++) {
        const angle = (i * Math.PI) / teeth;
        const r = i % 2 === 0 ? radius : radius * 0.68;
        const px = Math.cos(angle) * r;
        const py = Math.sin(angle) * r;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.fillStyle = '#0f172a';
      ctx.fill();
      ctx.strokeStyle = '#f43f5e';
      ctx.lineWidth = Math.max(1.3, 1.8 * s);
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(0, 0, radius * 0.35, 0, Math.PI * 2);
      ctx.fillStyle = '#f43f5e';
      ctx.fill();
      ctx.restore();
      break;
    }

    // PORTALS (Gamemodes & Gravity)
    case 12:
    case 13:
    case 47:
    case 111:
    case 660:
    case 745:
    case 1331:
    case 10:
    case 11: {
      const rw = 11 * s;
      const rh = 34 * s;
      ctx.save();
      ctx.shadowColor = def.accentColor;
      ctx.shadowBlur = 10 * s;
      ctx.beginPath();
      ctx.ellipse(0, 0, rw, rh, 0, 0, Math.PI * 2);
      ctx.fillStyle = `${def.accentColor}26`;
      ctx.fill();
      ctx.strokeStyle = def.accentColor;
      ctx.lineWidth = Math.max(2, 3 * s);
      ctx.stroke();
      ctx.restore();

      // Inner core
      ctx.beginPath();
      ctx.ellipse(0, 0, rw * 0.45, rh * 0.68, 0, 0, Math.PI * 2);
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = Math.max(1, 1.3 * s);
      ctx.stroke();

      // Mode label tag inside portal
      const shortTag =
        obj.id === 12 ? 'CUB' :
        obj.id === 13 ? 'SHP' :
        obj.id === 47 ? 'BAL' :
        obj.id === 111 ? 'UFO' :
        obj.id === 660 ? 'WAV' :
        obj.id === 745 ? 'BOT' :
        obj.id === 1331 ? 'SPD' :
        obj.id === 10 ? 'G↓' : 'G↑';
      ctx.fillStyle = '#ffffff';
      ctx.font = `700 ${Math.max(8, Math.round(9 * s))}px "JetBrains Mono", monospace`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(shortTag, 0, 0);
      break;
    }

    // SPEED PORTALS
    case 200:
    case 201:
    case 202:
    case 203:
    case 1334: {
      const chevrons = obj.id === 200 ? 1 : obj.id === 201 ? 1 : obj.id === 202 ? 2 : obj.id === 203 ? 3 : 4;
      const dir = obj.id === 200 ? -1 : 1;
      ctx.fillStyle = `${def.accentColor}22`;
      ctx.strokeStyle = def.accentColor;
      ctx.lineWidth = Math.max(1.5, 2 * s);
      ctx.beginPath();
      ctx.roundRect(-13 * s, -20 * s, 26 * s, 40 * s, 6 * s);
      ctx.fill();
      ctx.stroke();

      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = Math.max(1.5, 2.2 * s);
      const spacing = 5 * s;
      const startX = -((chevrons - 1) * spacing) / 2;
      for (let i = 0; i < chevrons; i++) {
        const ox = startX + i * spacing;
        ctx.beginPath();
        ctx.moveTo(ox - 4 * dir * s, -8 * s);
        ctx.lineTo(ox + 4 * dir * s, 0);
        ctx.lineTo(ox - 4 * dir * s, 8 * s);
        ctx.stroke();
      }
      break;
    }

    // JUMP PADS
    case 35:
    case 140:
    case 1332:
    case 67: {
      ctx.save();
      ctx.shadowColor = def.accentColor;
      ctx.shadowBlur = 8 * s;
      ctx.beginPath();
      ctx.arc(0, 15 * s, 12 * s, Math.PI, 0);
      ctx.closePath();
      ctx.fillStyle = def.accentColor;
      ctx.fill();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = Math.max(1, 1.4 * s);
      ctx.stroke();
      ctx.restore();
      break;
    }

    // JUMP ORBS
    case 36:
    case 141:
    case 1333:
    case 84:
    case 1022:
    case 1330: {
      const pulse = 1 + Math.sin(timeSec * 5) * 0.08;
      const r = 10 * s * pulse;
      ctx.save();
      ctx.shadowColor = def.accentColor;
      ctx.shadowBlur = 10 * s;
      ctx.beginPath();
      ctx.arc(0, 0, r, 0, Math.PI * 2);
      ctx.fillStyle = obj.id === 1330 ? '#020617' : def.accentColor;
      ctx.fill();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = Math.max(1.3, 1.8 * s);
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(0, 0, r * 1.32, 0, Math.PI * 2);
      ctx.strokeStyle = `${def.accentColor}aa`;
      ctx.lineWidth = Math.max(1, 1.3 * s);
      ctx.stroke();
      ctx.restore();
      break;
    }

    // USER COIN
    case 1329: {
      const r = 13 * s;
      ctx.save();
      ctx.shadowColor = '#fbbf24';
      ctx.shadowBlur = 10 * s;
      ctx.beginPath();
      ctx.arc(0, 0, r, 0, Math.PI * 2);
      const grad = ctx.createRadialGradient(-3 * s, -3 * s, 2 * s, 0, 0, r);
      grad.addColorStop(0, '#fef08a');
      grad.addColorStop(0.6, '#f59e0b');
      grad.addColorStop(1, '#b45309');
      ctx.fillStyle = grad;
      ctx.fill();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = Math.max(1.2, 1.6 * s);
      ctx.stroke();
      ctx.fillStyle = '#78350f';
      ctx.font = `700 ${Math.max(8, Math.round(11 * s))}px "Outfit", sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('C', 0, 1 * s);
      ctx.restore();
      break;
    }

    // TRIGGERS (Color, Move, Alpha)
    case 899:
    case 901:
    case 1007: {
      const r = 12 * s;
      ctx.beginPath();
      ctx.arc(0, 0, r, 0, Math.PI * 2);
      ctx.fillStyle =
        obj.id === 899 && obj.r !== undefined && obj.g !== undefined && obj.b !== undefined
          ? `rgb(${obj.r}, ${obj.g}, ${obj.b})`
          : `${def.accentColor}33`;
      ctx.fill();
      ctx.strokeStyle = def.accentColor;
      ctx.lineWidth = Math.max(1.5, 2 * s);
      ctx.stroke();

      const label = obj.id === 899 ? 'COL' : obj.id === 901 ? 'MOV' : 'ALP';
      ctx.fillStyle = '#ffffff';
      ctx.font = `700 ${Math.max(7, Math.round(8 * s))}px "JetBrains Mono", monospace`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(label, 0, 0);
      break;
    }

    default: {
      const half = 14 * s;
      ctx.fillStyle = 'rgba(100, 116, 139, 0.3)';
      ctx.fillRect(-half, -half, half * 2, half * 2);
      ctx.strokeStyle = '#94a3b8';
      ctx.lineWidth = 1.2 * s;
      ctx.strokeRect(-half, -half, half * 2, half * 2);
      ctx.fillStyle = '#e2e8f0';
      ctx.font = `600 ${Math.max(7, Math.round(8 * s))}px "JetBrains Mono", monospace`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(`${obj.id}`, 0, 0);
      break;
    }
  }

  ctx.restore();

  // Selection highlight & group tags (not rotated)
  if (options?.selected) {
    const hw = (def.width / 2) * s + 3;
    const hh = (def.height / 2) * s + 3;
    ctx.save();
    ctx.strokeStyle = '#22d3ee';
    ctx.lineWidth = 2;
    ctx.setLineDash([4, 3]);
    ctx.strokeRect(cx - hw, cy - hh, hw * 2, hh * 2);
    ctx.restore();
  }

  if (options?.showTriggerTags && obj.groups && obj.groups.length > 0) {
    ctx.save();
    ctx.fillStyle = '#06b6d4';
    ctx.font = `600 9px "JetBrains Mono", monospace`;
    ctx.textAlign = 'center';
    ctx.fillText(`G${obj.groups.join('.')}`, cx, cy - 18 * s);
    ctx.restore();
  }
}

export function drawPlayerIcon(
  ctx: CanvasRenderingContext2D,
  mode: GamemodeId,
  cx: number,
  cy: number,
  unitScale: number,
  angleRad: number,
  gravityInverted: boolean
) {
  const half = 14.5 * unitScale;
  ctx.save();
  ctx.translate(cx, cy);
  if (gravityInverted && mode !== 0 && mode !== 2) {
    ctx.scale(1, -1);
  }
  ctx.rotate(angleRad);

  if (mode === 0) {
    // Cube
    ctx.fillStyle = '#22d3ee';
    ctx.fillRect(-half, -half, half * 2, half * 2);
    ctx.strokeStyle = '#0f172a';
    ctx.lineWidth = 2 * unitScale;
    ctx.strokeRect(-half, -half, half * 2, half * 2);
    // Eyes + mouth
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(-7 * unitScale, -6 * unitScale, 4.5 * unitScale, 4.5 * unitScale);
    ctx.fillRect(2.5 * unitScale, -6 * unitScale, 4.5 * unitScale, 4.5 * unitScale);
    ctx.fillRect(-6 * unitScale, 3 * unitScale, 12 * unitScale, 3.5 * unitScale);
  } else if (mode === 1) {
    // Ship
    ctx.beginPath();
    ctx.moveTo(-16 * unitScale, 4 * unitScale);
    ctx.lineTo(16 * unitScale, 4 * unitScale);
    ctx.lineTo(10 * unitScale, 13 * unitScale);
    ctx.lineTo(-12 * unitScale, 13 * unitScale);
    ctx.closePath();
    ctx.fillStyle = '#f472b6';
    ctx.fill();
    ctx.strokeStyle = '#0f172a';
    ctx.lineWidth = 1.8 * unitScale;
    ctx.stroke();

    // Mini pilot cube
    ctx.fillStyle = '#22d3ee';
    ctx.fillRect(-7 * unitScale, -9 * unitScale, 14 * unitScale, 13 * unitScale);
    ctx.strokeRect(-7 * unitScale, -9 * unitScale, 14 * unitScale, 13 * unitScale);
  } else if (mode === 2) {
    // Ball
    ctx.beginPath();
    ctx.arc(0, 0, half, 0, Math.PI * 2);
    ctx.fillStyle = '#fb923c';
    ctx.fill();
    ctx.strokeStyle = '#0f172a';
    ctx.lineWidth = 2 * unitScale;
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(-half, 0);
    ctx.lineTo(half, 0);
    ctx.moveTo(0, -half);
    ctx.lineTo(0, half);
    ctx.strokeStyle = '#fef3c7';
    ctx.lineWidth = 1.5 * unitScale;
    ctx.stroke();
  } else if (mode === 3) {
    // UFO
    ctx.beginPath();
    ctx.arc(0, -2 * unitScale, 10 * unitScale, Math.PI, 0);
    ctx.fillStyle = 'rgba(250, 204, 21, 0.45)';
    ctx.fill();
    ctx.strokeStyle = '#facc15';
    ctx.lineWidth = 1.8 * unitScale;
    ctx.stroke();

    ctx.beginPath();
    ctx.ellipse(0, 4 * unitScale, 16 * unitScale, 6 * unitScale, 0, 0, Math.PI * 2);
    ctx.fillStyle = '#facc15';
    ctx.fill();
    ctx.strokeStyle = '#0f172a';
    ctx.stroke();
  } else if (mode === 4) {
    // Wave
    ctx.beginPath();
    ctx.moveTo(15 * unitScale, 0);
    ctx.lineTo(-12 * unitScale, -11 * unitScale);
    ctx.lineTo(-7 * unitScale, 0);
    ctx.lineTo(-12 * unitScale, 11 * unitScale);
    ctx.closePath();
    ctx.fillStyle = '#38bdf8';
    ctx.fill();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1.8 * unitScale;
    ctx.stroke();
  } else if (mode === 5) {
    // Robot
    ctx.fillStyle = '#e2e8f0';
    ctx.fillRect(-10 * unitScale, -12 * unitScale, 20 * unitScale, 17 * unitScale);
    ctx.strokeStyle = '#0f172a';
    ctx.lineWidth = 2 * unitScale;
    ctx.strokeRect(-10 * unitScale, -12 * unitScale, 20 * unitScale, 17 * unitScale);
    ctx.fillStyle = '#06b6d4';
    ctx.fillRect(-5 * unitScale, -7 * unitScale, 10 * unitScale, 5 * unitScale);
    ctx.fillStyle = '#94a3b8';
    ctx.fillRect(-8 * unitScale, 5 * unitScale, 5 * unitScale, 9 * unitScale);
    ctx.fillRect(3 * unitScale, 5 * unitScale, 5 * unitScale, 9 * unitScale);
  } else {
    // Spider
    ctx.fillStyle = '#c084fc';
    ctx.fillRect(-11 * unitScale, -10 * unitScale, 22 * unitScale, 16 * unitScale);
    ctx.strokeStyle = '#0f172a';
    ctx.lineWidth = 2 * unitScale;
    ctx.strokeRect(-11 * unitScale, -10 * unitScale, 22 * unitScale, 16 * unitScale);
    ctx.strokeStyle = '#c084fc';
    ctx.lineWidth = 3 * unitScale;
    ctx.beginPath();
    ctx.moveTo(-8 * unitScale, 6 * unitScale);
    ctx.lineTo(-13 * unitScale, 14 * unitScale);
    ctx.moveTo(8 * unitScale, 6 * unitScale);
    ctx.lineTo(13 * unitScale, 14 * unitScale);
    ctx.stroke();
  }

  ctx.restore();
}

export function drawBackgroundPattern(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  groundY: number,
  camX: number,
  bgTexture: number,
  bgColor: string
) {
  const skyBottom = Math.min(h, Math.max(0, groundY));
  const skyGrad = ctx.createLinearGradient(0, 0, 0, skyBottom || h);
  skyGrad.addColorStop(0, bgColor);
  skyGrad.addColorStop(1, '#04070f');
  ctx.fillStyle = skyGrad;
  ctx.fillRect(0, 0, w, h);

  ctx.save();
  if (skyBottom > 0) {
    ctx.beginPath();
    ctx.rect(0, 0, w, skyBottom);
    ctx.clip();
  }

  const style = bgTexture || 1;

  if (style === 1) {
    // 1. Classic Stereo Squares
    const tile = 180;
    const ox = ((camX * 0.22) % tile + tile) % tile;
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.06)';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.025)';
    ctx.lineWidth = 1.5;
    for (let px = -ox; px < w + tile; px += tile) {
      for (let py = 24; py < skyBottom; py += tile) {
        ctx.fillRect(px + 12, py, 136, 136);
        ctx.strokeRect(px + 12, py, 136, 136);
        ctx.strokeRect(px + 34, py + 22, 92, 92);
      }
    }
  } else if (style === 2) {
    // 2. City Skyline Parallax
    const heights = [150, 220, 120, 260, 180, 290, 140, 200];
    const bWidth = 96;
    const span = heights.length * bWidth;
    const ox = ((camX * 0.18) % span + span) % span;
    for (let rep = -1; rep <= Math.ceil(w / span) + 1; rep++) {
      for (let i = 0; i < heights.length; i++) {
        const bx = rep * span + i * bWidth - ox;
        if (bx + bWidth < 0 || bx > w) continue;
        const bh = heights[i];
        const by = skyBottom - bh;
        ctx.fillStyle = 'rgba(0, 0, 0, 0.28)';
        ctx.fillRect(bx + 4, by, bWidth - 8, bh);
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
        ctx.lineWidth = 1;
        ctx.strokeRect(bx + 4, by, bWidth - 8, bh);
        // Windows
        ctx.fillStyle = 'rgba(255, 255, 255, 0.08)';
        for (let wy = by + 14; wy < skyBottom - 18; wy += 24) {
          for (let wx = bx + 14; wx < bx + bWidth - 20; wx += 20) {
            ctx.fillRect(wx, wy, 10, 12);
          }
        }
      }
    }
  } else if (style === 3) {
    // 3. Tech Circuit Board
    const tile = 220;
    const ox = ((camX * 0.2) % tile + tile) % tile;
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.11)';
    ctx.fillStyle = 'rgba(56, 189, 248, 0.14)';
    ctx.lineWidth = 1.5;
    for (let px = -ox; px < w + tile; px += tile) {
      for (let py = 30; py < skyBottom; py += 160) {
        ctx.beginPath();
        ctx.moveTo(px, py + 30);
        ctx.lineTo(px + 60, py + 30);
        ctx.lineTo(px + 90, py + 60);
        ctx.lineTo(px + 180, py + 60);
        ctx.moveTo(px + 90, py + 60);
        ctx.lineTo(px + 90, py + 120);
        ctx.lineTo(px + 150, py + 120);
        ctx.stroke();

        ctx.beginPath();
        ctx.arc(px + 60, py + 30, 4, 0, Math.PI * 2);
        ctx.arc(px + 180, py + 60, 4, 0, Math.PI * 2);
        ctx.arc(px + 150, py + 120, 4, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  } else if (style === 4) {
    // 4. Geometric Peaks & Starfield
    const starSpan = 320;
    const starOx = ((camX * 0.08) % starSpan + starSpan) % starSpan;
    ctx.fillStyle = 'rgba(255, 255, 255, 0.26)';
    for (let sx = -starOx; sx < w + starSpan; sx += starSpan) {
      [
        [30, 45], [110, 90], [195, 35], [270, 120], [75, 160], [230, 185],
      ].forEach(([dx, dy]) => {
        if (dy < skyBottom - 40) {
          ctx.fillRect(sx + dx, dy, 2.5, 2.5);
        }
      });
    }

    const peakW = 240;
    const ox = ((camX * 0.16) % peakW + peakW) % peakW;
    for (let px = -ox - peakW; px < w + peakW; px += peakW) {
      ctx.beginPath();
      ctx.moveTo(px, skyBottom);
      ctx.lineTo(px + peakW * 0.5, Math.max(40, skyBottom - 210));
      ctx.lineTo(px + peakW, skyBottom);
      ctx.closePath();
      ctx.fillStyle = 'rgba(0, 0, 0, 0.25)';
      ctx.fill();
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.09)';
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }
  } else if (style === 5) {
    // 5. Cyber Horizon Perspective Grid
    const horizonY = Math.max(60, skyBottom * 0.42);
    const sunGrad = ctx.createRadialGradient(w * 0.5, horizonY, 10, w * 0.5, horizonY, 160);
    sunGrad.addColorStop(0, 'rgba(34, 211, 238, 0.22)');
    sunGrad.addColorStop(1, 'rgba(34, 211, 238, 0)');
    ctx.fillStyle = sunGrad;
    ctx.fillRect(0, 0, w, skyBottom);

    ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
    ctx.lineWidth = 1;
    // Horizontal lines accelerating toward bottom
    for (let i = 0; i <= 8; i++) {
      const t = (i / 8) ** 1.6;
      const ly = horizonY + t * (skyBottom - horizonY);
      ctx.beginPath();
      ctx.moveTo(0, ly);
      ctx.lineTo(w, ly);
      ctx.stroke();
    }
    // Scrolling vertical perspective rays
    const rayStep = 110;
    const ox = ((camX * 0.35) % rayStep + rayStep) % rayStep;
    const vanishX = w * 0.5;
    for (let rx = -ox - rayStep * 4; rx < w + rayStep * 4; rx += rayStep) {
      ctx.beginPath();
      ctx.moveTo(vanishX + (rx - vanishX) * 0.18, horizonY);
      ctx.lineTo(rx, skyBottom);
      ctx.stroke();
    }
  } else {
    // 6. Floating Neon Diamonds
    const tile = 160;
    const ox = ((camX * 0.22) % tile + tile) % tile;
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.03)';
    ctx.lineWidth = 1.5;
    for (let px = -ox; px < w + tile; px += tile) {
      for (let py = 40; py < skyBottom; py += 150) {
        const cx = px + tile / 2;
        const cy = py + 50;
        const r = 46;
        ctx.beginPath();
        ctx.moveTo(cx, cy - r);
        ctx.lineTo(cx + r, cy);
        ctx.lineTo(cx, cy + r);
        ctx.lineTo(cx - r, cy);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      }
    }
  }

  ctx.restore();
}

export function drawGroundPattern(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  groundY: number,
  camX: number,
  zoom: number,
  groundTexture: number,
  groundColor: string,
  lineColor: string
) {
  if (groundY >= h) return;

  const gGrad = ctx.createLinearGradient(0, groundY, 0, h);
  gGrad.addColorStop(0, groundColor);
  gGrad.addColorStop(1, '#02040a');
  ctx.fillStyle = gGrad;
  ctx.fillRect(0, groundY, w, h - groundY);

  const style = groundTexture || 1;
  const tileW = 60 * zoom;
  const offsetTile = (((camX * zoom) % tileW) + tileW) % tileW;

  ctx.save();
  ctx.beginPath();
  ctx.rect(0, groundY, w, h - groundY);
  ctx.clip();

  ctx.strokeStyle = 'rgba(255, 255, 255, 0.09)';
  ctx.lineWidth = 1;

  if (style === 1) {
    // Classic Squares
    for (let gx = -offsetTile; gx < w + tileW; gx += tileW) {
      ctx.strokeRect(
        gx + 6 * zoom,
        groundY + 8 * zoom,
        tileW - 12 * zoom,
        Math.min(48 * zoom, Math.max(10, h - groundY - 12))
      );
    }
  } else if (style === 2) {
    // Tech Plates
    for (let gx = -offsetTile; gx < w + tileW; gx += tileW) {
      ctx.beginPath();
      ctx.moveTo(gx, groundY);
      ctx.lineTo(gx, h);
      ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,0.06)';
      ctx.fillRect(gx + 10 * zoom, groundY + 10 * zoom, tileW - 20 * zoom, 8 * zoom);
    }
  } else if (style === 3) {
    // Diagonal Hazard Stripes
    ctx.fillStyle = 'rgba(0, 0, 0, 0.22)';
    for (let gx = -offsetTile - tileW; gx < w + tileW * 2; gx += tileW) {
      ctx.beginPath();
      ctx.moveTo(gx, groundY);
      ctx.lineTo(gx + tileW * 0.5, groundY);
      ctx.lineTo(gx + tileW * 0.2, h);
      ctx.lineTo(gx - tileW * 0.3, h);
      ctx.closePath();
      ctx.fill();
    }
  } else {
    // Neon Grid Floor
    ctx.strokeStyle = `${lineColor}44`;
    for (let gx = -offsetTile; gx < w + tileW; gx += tileW) {
      ctx.beginPath();
      ctx.moveTo(gx, groundY);
      ctx.lineTo(gx, h);
      ctx.stroke();
    }
    for (let gy = groundY + 24 * zoom; gy < h; gy += 24 * zoom) {
      ctx.beginPath();
      ctx.moveTo(0, gy);
      ctx.lineTo(w, gy);
      ctx.stroke();
    }
  }

  ctx.restore();

  // Horizon bright line
  ctx.strokeStyle = lineColor;
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(0, groundY);
  ctx.lineTo(w, groundY);
  ctx.stroke();
}

