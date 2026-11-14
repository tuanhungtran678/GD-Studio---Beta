import React, { useEffect, useRef, useState } from 'react';
import { EditorTool, ObjectCategory } from '../types/gd';
import { CATEGORY_LABELS, GD_OBJECTS } from '../data/gdCatalog';
import { drawGDObject } from '../utils/gdRenderer';
import {
  Brush,
  Eraser,
  Grid3X3,
  Hand,
  MousePointer,
  PlusSquare,
} from 'lucide-react';

interface ObjectThumbProps {
  objectId: number;
  selected: boolean;
}

const ObjectThumb: React.FC<ObjectThumbProps> = ({ objectId }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    const size = 38;
    canvas.width = size * dpr;
    canvas.height = size * dpr;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, size, size);

    // Scale tall portals down slightly to fit comfortably in 38x38 thumbnail
    const isTallPortal = [10, 11, 12, 13, 47, 111, 660, 745, 1331].includes(objectId);
    const scale = isTallPortal ? 0.48 : objectId === 88 ? 0.72 : 0.92;
    drawGDObject(ctx, { id: objectId }, size / 2, size / 2, scale, 0, {
      objColor: '#f8fafc',
    });
  }, [objectId]);

  return <canvas ref={canvasRef} className="w-[38px] h-[38px] pointer-events-none" />;
};

interface ObjectPaletteProps {
  activeObjectId: number;
  onSelectObject: (id: number) => void;
  tool: EditorTool;
  onSelectTool: (tool: EditorTool) => void;
  snapToGrid: boolean;
  onToggleSnap: () => void;
  disabled: boolean;
}

const CATEGORIES: ObjectCategory[] = [
  'blocks',
  'decorations',
  'hazards',
  'portals',
  'pads_orbs',
  'triggers_coins',
];

export const ObjectPalette: React.FC<ObjectPaletteProps> = ({
  activeObjectId,
  onSelectObject,
  tool,
  onSelectTool,
  snapToGrid,
  onToggleSnap,
  disabled,
}) => {
  const [category, setCategory] = useState<ObjectCategory>('blocks');

  const filteredObjects = GD_OBJECTS.filter((o) => o.category === category);

  const tools: { id: EditorTool; label: string; icon: React.ReactNode }[] = [
    { id: 'build', label: 'Đặt', icon: <PlusSquare className="w-3.5 h-3.5" /> },
    { id: 'swipe', label: 'Vẽ nét', icon: <Brush className="w-3.5 h-3.5" /> },
    { id: 'select', label: 'Chọn', icon: <MousePointer className="w-3.5 h-3.5" /> },
    { id: 'delete', label: 'Xóa', icon: <Eraser className="w-3.5 h-3.5" /> },
    { id: 'pan', label: 'Kéo', icon: <Hand className="w-3.5 h-3.5" /> },
  ];

  return (
    <div
      className={`shrink-0 bg-[#0F1522] border-t border-white/10 px-4 py-2.5 flex flex-col gap-2.5 ${
        disabled ? 'opacity-45 pointer-events-none' : ''
      }`}
    >
      {/* Top row: Tools + Category Tabs + Grid Snap */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        {/* Editor Tool Switcher */}
        <div className="flex items-center gap-1 bg-slate-900 border border-white/10 rounded-lg p-0.5">
          {tools.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => onSelectTool(t.id)}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                tool === t.id
                  ? 'bg-cyan-400 text-slate-950 font-semibold'
                  : 'text-slate-300 hover:text-white hover:bg-white/5'
              }`}
            >
              {t.icon}
              <span>{t.label}</span>
            </button>
          ))}
        </div>

        {/* Object Category Tabs */}
        <div className="flex items-center gap-1 bg-slate-900 border border-white/10 rounded-lg p-0.5 overflow-x-auto">
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => setCategory(cat)}
              className={`px-3 py-1 rounded-md text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                category === cat
                  ? 'bg-slate-800 text-cyan-300 border border-cyan-500/30'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {CATEGORY_LABELS[cat]}
            </button>
          ))}
        </div>

        {/* Snap Toggle */}
        <button
          type="button"
          onClick={onToggleSnap}
          className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-colors whitespace-nowrap shrink-0 ${
            snapToGrid
              ? 'bg-cyan-500/15 border-cyan-500/40 text-cyan-300'
              : 'bg-slate-900 border-white/10 text-slate-400 hover:text-slate-200'
          }`}
        >
          <Grid3X3 className="w-3.5 h-3.5" />
          Bám lưới {snapToGrid ? 'Bật' : 'Tắt'}
        </button>
      </div>

      {/* Bottom row: Object Thumbnails */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        {filteredObjects.map((def) => {
          const isSelected = activeObjectId === def.id && (tool === 'build' || tool === 'swipe');
          return (
            <button
              key={def.id}
              type="button"
              title={`${def.name} — ${def.description}`}
              onClick={() => {
                onSelectObject(def.id);
                if (tool !== 'build' && tool !== 'swipe') {
                  onSelectTool('build');
                }
              }}
              className={`group flex flex-col items-center justify-center gap-1 px-2.5 py-1.5 rounded-lg border min-w-[76px] transition-colors shrink-0 ${
                isSelected
                  ? 'bg-cyan-500/15 border-cyan-400 text-white'
                  : 'bg-slate-900/75 border-white/10 text-slate-400 hover:border-white/25 hover:text-slate-200'
              }`}
            >
              <ObjectThumb objectId={def.id} selected={isSelected} />
              <span className="text-[11px] font-medium truncate max-w-[74px]">
                {def.name}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
};
