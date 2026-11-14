import React from 'react';
import { GDLevel, GDLevelMeta, GDObject, GamemodeId, SpeedId } from '../types/gd';
import {
  BG_TEXTURES,
  GAMEMODE_NAMES,
  GROUND_TEXTURES,
  OFFICIAL_SONGS,
  SPEED_LABELS,
  SPEED_UNITS_PER_SEC,
  getObjectDef,
} from '../data/gdCatalog';
import {
  Copy,
  FlipHorizontal,
  FlipVertical,
  RotateCw,
  Trash2,
} from 'lucide-react';
import { hexToRgb, rgbToHex } from '../utils/gdCodec';

interface InspectorSidebarProps {
  level: GDLevel;
  selectedObjects: GDObject[];
  isPlaytesting: boolean;
  onUpdateMeta: (patch: Partial<GDLevelMeta>) => void;
  onUpdateSelected: (patch: Partial<GDObject>) => void;
  onRotateSelected: (degDelta: number) => void;
  onFlipSelected: (axis: 'x' | 'y') => void;
  onDuplicateSelected: () => void;
  onDeleteSelected: () => void;
}

export const InspectorSidebar: React.FC<InspectorSidebarProps> = ({
  level,
  selectedObjects,
  isPlaytesting,
  onUpdateMeta,
  onUpdateSelected,
  onRotateSelected,
  onFlipSelected,
  onDuplicateSelected,
  onDeleteSelected,
}) => {
  const single = selectedObjects.length === 1 ? selectedObjects[0] : null;
  const maxX =
    level.objects.length > 0 ? Math.max(...level.objects.map((o) => o.x)) : 0;
  const estSeconds = Math.round(maxX / SPEED_UNITS_PER_SEC[level.meta.startSpeed]);
  const coinCount = level.objects.filter((o) => o.id === 1329).length;

  return (
    <aside
      className={`w-[288px] shrink-0 bg-[#0F1522] border-l border-white/10 flex flex-col overflow-y-auto ${
        isPlaytesting ? 'opacity-50 pointer-events-none' : ''
      }`}
    >
      {selectedObjects.length > 0 ? (
        <div className="p-4 flex flex-col gap-4">
          <div className="flex items-center justify-between border-b border-white/10 pb-3">
            <div>
              <h2 className="text-sm font-semibold text-white">
                {single ? getObjectDef(single.id).name : `${selectedObjects.length} đối tượng đang chọn`}
              </h2>
              <p className="text-xs text-slate-400 font-mono-tabular">
                {single ? `ID ${single.id}` : 'Chỉnh sửa hàng loạt'}
              </p>
            </div>
            <button
              type="button"
              onClick={onDeleteSelected}
              title="Xóa đối tượng (Del)"
              className="p-1.5 rounded-md bg-rose-500/15 text-rose-400 hover:bg-rose-500/25 transition-colors"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>

          {/* Quick Transform Actions */}
          <div className="grid grid-cols-4 gap-1.5">
            <button
              type="button"
              onClick={() => onRotateSelected(90)}
              title="Xoay 90° (E)"
              className="flex flex-col items-center gap-1 py-2 rounded-lg bg-slate-900 border border-white/10 hover:border-cyan-400/50 text-slate-300 hover:text-white text-[11px] transition-colors"
            >
              <RotateCw className="w-3.5 h-3.5" />
              Xoay 90°
            </button>
            <button
              type="button"
              onClick={() => onFlipSelected('x')}
              title="Lật ngang"
              className="flex flex-col items-center gap-1 py-2 rounded-lg bg-slate-900 border border-white/10 hover:border-cyan-400/50 text-slate-300 hover:text-white text-[11px] transition-colors"
            >
              <FlipHorizontal className="w-3.5 h-3.5" />
              Lật X
            </button>
            <button
              type="button"
              onClick={() => onFlipSelected('y')}
              title="Lật dọc"
              className="flex flex-col items-center gap-1 py-2 rounded-lg bg-slate-900 border border-white/10 hover:border-cyan-400/50 text-slate-300 hover:text-white text-[11px] transition-colors"
            >
              <FlipVertical className="w-3.5 h-3.5" />
              Lật Y
            </button>
            <button
              type="button"
              onClick={onDuplicateSelected}
              title="Nhân bản (Ctrl+D)"
              className="flex flex-col items-center gap-1 py-2 rounded-lg bg-slate-900 border border-white/10 hover:border-cyan-400/50 text-slate-300 hover:text-white text-[11px] transition-colors"
            >
              <Copy className="w-3.5 h-3.5" />
              Nhân bản
            </button>
          </div>

          {single && (
            <div className="grid grid-cols-2 gap-2.5">
              <label className="flex flex-col gap-1 text-xs text-slate-400">
                Tọa độ X
                <input
                  type="number"
                  step={15}
                  value={single.x}
                  onChange={(e) => onUpdateSelected({ x: Number(e.target.value) || 0 })}
                  className="bg-slate-900 border border-white/10 rounded-md px-2.5 py-1.5 text-sm font-mono-tabular text-white focus:border-cyan-400 focus:outline-none"
                />
              </label>
              <label className="flex flex-col gap-1 text-xs text-slate-400">
                Tọa độ Y
                <input
                  type="number"
                  step={15}
                  min={15}
                  value={single.y}
                  onChange={(e) => onUpdateSelected({ y: Math.max(15, Number(e.target.value) || 15) })}
                  className="bg-slate-900 border border-white/10 rounded-md px-2.5 py-1.5 text-sm font-mono-tabular text-white focus:border-cyan-400 focus:outline-none"
                />
              </label>
              <label className="flex flex-col gap-1 text-xs text-slate-400">
                Góc xoay (°)
                <input
                  type="number"
                  step={15}
                  value={single.rotation || 0}
                  onChange={(e) => onUpdateSelected({ rotation: Number(e.target.value) || 0 })}
                  className="bg-slate-900 border border-white/10 rounded-md px-2.5 py-1.5 text-sm font-mono-tabular text-white focus:border-cyan-400 focus:outline-none"
                />
              </label>
              <label className="flex flex-col gap-1 text-xs text-slate-400">
                Tỉ lệ (Scale)
                <input
                  type="number"
                  step={0.1}
                  min={0.3}
                  max={3}
                  value={single.scale ?? 1}
                  onChange={(e) =>
                    onUpdateSelected({ scale: Math.max(0.3, Math.min(3, Number(e.target.value) || 1)) })
                  }
                  className="bg-slate-900 border border-white/10 rounded-md px-2.5 py-1.5 text-sm font-mono-tabular text-white focus:border-cyan-400 focus:outline-none"
                />
              </label>
            </div>
          )}

          {/* Group ID & Layer */}
          <div className="grid grid-cols-2 gap-2.5 pt-2 border-t border-white/10">
            <label className="flex flex-col gap-1 text-xs text-slate-400">
              Group ID (cách dấu .)
              <input
                type="text"
                placeholder="vd: 1.2"
                value={single?.groups?.join('.') || ''}
                onChange={(e) => {
                  const parsed = e.target.value
                    .split('.')
                    .map((s) => Number(s.trim()))
                    .filter((n) => !isNaN(n) && n > 0);
                  onUpdateSelected({ groups: parsed.length > 0 ? parsed : undefined });
                }}
                className="bg-slate-900 border border-white/10 rounded-md px-2.5 py-1.5 text-sm font-mono-tabular text-white focus:border-cyan-400 focus:outline-none"
              />
            </label>
            <label className="flex flex-col gap-1 text-xs text-slate-400">
              Editor Layer
              <input
                type="number"
                min={0}
                value={single?.layer ?? 0}
                onChange={(e) => onUpdateSelected({ layer: Math.max(0, Number(e.target.value) || 0) })}
                className="bg-slate-900 border border-white/10 rounded-md px-2.5 py-1.5 text-sm font-mono-tabular text-white focus:border-cyan-400 focus:outline-none"
              />
            </label>
          </div>

          {/* Trigger Specific Settings */}
          {single && single.id === 899 && (
            <div className="pt-3 border-t border-white/10 flex flex-col gap-2.5">
              <h3 className="text-xs font-semibold text-pink-300">Cấu hình Color Trigger</h3>
              <label className="flex flex-col gap-1 text-xs text-slate-400">
                Kênh màu mục tiêu
                <select
                  value={single.targetColorId ?? 1000}
                  onChange={(e) => onUpdateSelected({ targetColorId: Number(e.target.value) })}
                  className="bg-slate-900 border border-white/10 rounded-md px-2.5 py-1.5 text-sm text-white focus:border-cyan-400 focus:outline-none"
                >
                  <option value={1000}>1000 — Nền (BG)</option>
                  <option value={1001}>1001 — Mặt đất (Ground)</option>
                  <option value={1002}>1002 — Đường kẻ (Line)</option>
                  <option value={1004}>1004 — Đối tượng (Obj)</option>
                  <option value={1}>Channel 1</option>
                  <option value={2}>Channel 2</option>
                </select>
              </label>
              <div className="grid grid-cols-2 gap-2.5">
                <label className="flex flex-col gap-1 text-xs text-slate-400">
                  Màu đích
                  <input
                    type="color"
                    value={rgbToHex(single.r ?? 15, single.g ?? 23, single.b ?? 42)}
                    onChange={(e) => {
                      const rgb = hexToRgb(e.target.value);
                      onUpdateSelected({ r: rgb.r, g: rgb.g, b: rgb.b });
                    }}
                    className="h-9 w-full bg-slate-900 border border-white/10 rounded-md cursor-pointer p-0.5"
                  />
                </label>
                <label className="flex flex-col gap-1 text-xs text-slate-400">
                  Thời gian (giây)
                  <input
                    type="number"
                    step={0.1}
                    min={0}
                    max={10}
                    value={single.duration ?? 0.5}
                    onChange={(e) => onUpdateSelected({ duration: Math.max(0, Number(e.target.value)) })}
                    className="bg-slate-900 border border-white/10 rounded-md px-2.5 py-1.5 text-sm font-mono-tabular text-white focus:border-cyan-400 focus:outline-none"
                  />
                </label>
              </div>
            </div>
          )}

          {single && single.id === 901 && (
            <div className="pt-3 border-t border-white/10 flex flex-col gap-2.5">
              <h3 className="text-xs font-semibold text-cyan-300">Cấu hình Move Trigger</h3>
              <div className="grid grid-cols-2 gap-2.5">
                <label className="flex flex-col gap-1 text-xs text-slate-400">
                  Target Group ID
                  <input
                    type="number"
                    min={1}
                    value={single.targetGroup ?? 1}
                    onChange={(e) => onUpdateSelected({ targetGroup: Math.max(1, Number(e.target.value) || 1) })}
                    className="bg-slate-900 border border-white/10 rounded-md px-2.5 py-1.5 text-sm font-mono-tabular text-white focus:border-cyan-400 focus:outline-none"
                  />
                </label>
                <label className="flex flex-col gap-1 text-xs text-slate-400">
                  Thời gian (giây)
                  <input
                    type="number"
                    step={0.1}
                    min={0}
                    value={single.duration ?? 0.5}
                    onChange={(e) => onUpdateSelected({ duration: Math.max(0, Number(e.target.value)) })}
                    className="bg-slate-900 border border-white/10 rounded-md px-2.5 py-1.5 text-sm font-mono-tabular text-white focus:border-cyan-400 focus:outline-none"
                  />
                </label>
                <label className="flex flex-col gap-1 text-xs text-slate-400">
                  Dịch chuyển X
                  <input
                    type="number"
                    step={15}
                    value={single.moveX ?? 0}
                    onChange={(e) => onUpdateSelected({ moveX: Number(e.target.value) || 0 })}
                    className="bg-slate-900 border border-white/10 rounded-md px-2.5 py-1.5 text-sm font-mono-tabular text-white focus:border-cyan-400 focus:outline-none"
                  />
                </label>
                <label className="flex flex-col gap-1 text-xs text-slate-400">
                  Dịch chuyển Y
                  <input
                    type="number"
                    step={15}
                    value={single.moveY ?? 30}
                    onChange={(e) => onUpdateSelected({ moveY: Number(e.target.value) || 0 })}
                    className="bg-slate-900 border border-white/10 rounded-md px-2.5 py-1.5 text-sm font-mono-tabular text-white focus:border-cyan-400 focus:outline-none"
                  />
                </label>
              </div>
            </div>
          )}

          {single && single.id === 1007 && (
            <div className="pt-3 border-t border-white/10 flex flex-col gap-2.5">
              <h3 className="text-xs font-semibold text-violet-300">Cấu hình Alpha Trigger</h3>
              <div className="grid grid-cols-2 gap-2.5">
                <label className="flex flex-col gap-1 text-xs text-slate-400">
                  Target Group ID
                  <input
                    type="number"
                    min={1}
                    value={single.targetGroup ?? 1}
                    onChange={(e) => onUpdateSelected({ targetGroup: Math.max(1, Number(e.target.value) || 1) })}
                    className="bg-slate-900 border border-white/10 rounded-md px-2.5 py-1.5 text-sm font-mono-tabular text-white focus:border-cyan-400 focus:outline-none"
                  />
                </label>
                <label className="flex flex-col gap-1 text-xs text-slate-400">
                  Độ mờ (0–1)
                  <input
                    type="number"
                    step={0.05}
                    min={0}
                    max={1}
                    value={single.opacity ?? 0.35}
                    onChange={(e) =>
                      onUpdateSelected({ opacity: Math.max(0, Math.min(1, Number(e.target.value))) })
                    }
                    className="bg-slate-900 border border-white/10 rounded-md px-2.5 py-1.5 text-sm font-mono-tabular text-white focus:border-cyan-400 focus:outline-none"
                  />
                </label>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="p-4 flex flex-col gap-4">
          <div className="border-b border-white/10 pb-3">
            <h2 className="text-sm font-semibold text-white">Thuộc tính Level</h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Thông số lưu trực tiếp vào header & file .gmd
            </p>
          </div>

          {/* Stats row (clean unboxed text) */}
          <div className="flex items-center justify-between text-xs text-slate-400 bg-slate-900/70 border border-white/10 rounded-lg px-3 py-2">
            <span>
              <strong className="font-mono-tabular text-white">{level.objects.length}</strong> đối tượng
            </span>
            <span className="text-slate-600">·</span>
            <span>
              <strong className="font-mono-tabular text-white">{estSeconds}s</strong> thời lượng
            </span>
            <span className="text-slate-600">·</span>
            <span>
              <strong className="font-mono-tabular text-amber-300">{coinCount}</strong> xu
            </span>
          </div>

          <div className="flex flex-col gap-3">
            <label className="flex flex-col gap-1 text-xs text-slate-400">
              Tên tác giả (Creator)
              <input
                type="text"
                value={level.meta.author}
                onChange={(e) => onUpdateMeta({ author: e.target.value })}
                className="bg-slate-900 border border-white/10 rounded-md px-2.5 py-1.5 text-sm text-white focus:border-cyan-400 focus:outline-none"
              />
            </label>

            <label className="flex flex-col gap-1 text-xs text-slate-400">
              Mô tả (Description)
              <textarea
                rows={2}
                value={level.meta.description}
                onChange={(e) => onUpdateMeta({ description: e.target.value })}
                className="bg-slate-900 border border-white/10 rounded-md px-2.5 py-1.5 text-xs text-white focus:border-cyan-400 focus:outline-none resize-none"
              />
            </label>

            <div className="grid grid-cols-2 gap-2.5">
              <label className="flex flex-col gap-1 text-xs text-slate-400">
                Chế độ khởi đầu
                <select
                  value={level.meta.startMode}
                  onChange={(e) => onUpdateMeta({ startMode: Number(e.target.value) as GamemodeId })}
                  className="bg-slate-900 border border-white/10 rounded-md px-2 py-1.5 text-xs text-white focus:border-cyan-400 focus:outline-none"
                >
                  {Object.entries(GAMEMODE_NAMES).map(([id, label]) => (
                    <option key={id} value={id}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>

              <label className="flex flex-col gap-1 text-xs text-slate-400">
                Tốc độ khởi đầu
                <select
                  value={level.meta.startSpeed}
                  onChange={(e) => onUpdateMeta({ startSpeed: Number(e.target.value) as SpeedId })}
                  className="bg-slate-900 border border-white/10 rounded-md px-2 py-1.5 text-xs text-white focus:border-cyan-400 focus:outline-none"
                >
                  {Object.entries(SPEED_LABELS).map(([id, label]) => (
                    <option key={id} value={id}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <label className="flex flex-col gap-1 text-xs text-slate-400">
              Nhạc chính thức (Official Song)
              <select
                value={level.meta.officialSongId}
                onChange={(e) => onUpdateMeta({ officialSongId: Number(e.target.value) })}
                className="bg-slate-900 border border-white/10 rounded-md px-2.5 py-1.5 text-xs text-white focus:border-cyan-400 focus:outline-none"
              >
                {OFFICIAL_SONGS.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.id}. {s.name} — {s.artist}
                  </option>
                ))}
              </select>
            </label>

            <label className="flex flex-col gap-1 text-xs text-slate-400">
              Custom Song ID (Newgrounds, 0 = không dùng)
              <input
                type="number"
                min={0}
                value={level.meta.customSongId}
                onChange={(e) => onUpdateMeta({ customSongId: Math.max(0, Number(e.target.value) || 0) })}
                className="bg-slate-900 border border-white/10 rounded-md px-2.5 py-1.5 text-sm font-mono-tabular text-white focus:border-cyan-400 focus:outline-none"
              />
            </label>

            <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer pt-1">
              <input
                type="checkbox"
                checked={level.meta.flipGravity}
                onChange={(e) => onUpdateMeta({ flipGravity: e.target.checked })}
                className="rounded border-white/20 bg-slate-900 text-cyan-400 focus:ring-cyan-400"
              />
              Đảo ngược trọng lực khi bắt đầu
            </label>

            {/* Background & Ground Textures */}
            <div className="pt-3 border-t border-white/10 flex flex-col gap-2.5">
              <h3 className="text-xs font-semibold text-slate-200">Họa tiết Nền & Mặt đất</h3>
              <label className="flex flex-col gap-1 text-xs text-slate-400">
                Kiểu nền (Background — kA6)
                <select
                  value={level.meta.bgTexture || 1}
                  onChange={(e) => onUpdateMeta({ bgTexture: Number(e.target.value) })}
                  className="bg-slate-900 border border-white/10 rounded-md px-2.5 py-1.5 text-xs text-white focus:border-cyan-400 focus:outline-none"
                >
                  {BG_TEXTURES.map((bg) => (
                    <option key={bg.id} value={bg.id}>
                      {bg.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1 text-xs text-slate-400">
                Kiểu mặt đất (Ground — kA7)
                <select
                  value={level.meta.groundTexture || 1}
                  onChange={(e) => onUpdateMeta({ groundTexture: Number(e.target.value) })}
                  className="bg-slate-900 border border-white/10 rounded-md px-2.5 py-1.5 text-xs text-white focus:border-cyan-400 focus:outline-none"
                >
                  {GROUND_TEXTURES.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.name}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            {/* Color Palette */}
            <div className="pt-3 border-t border-white/10">
              <h3 className="text-xs font-semibold text-slate-200 mb-2.5">Bảng màu kênh chuẩn (kS38)</h3>
              <div className="grid grid-cols-2 gap-2.5">
                <label className="flex items-center justify-between gap-2 bg-slate-900 border border-white/10 rounded-md px-2.5 py-1.5 text-xs text-slate-300">
                  <span>Nền (BG)</span>
                  <input
                    type="color"
                    value={level.meta.bgColor}
                    onChange={(e) => onUpdateMeta({ bgColor: e.target.value })}
                    className="w-6 h-6 bg-transparent border-0 cursor-pointer"
                  />
                </label>
                <label className="flex items-center justify-between gap-2 bg-slate-900 border border-white/10 rounded-md px-2.5 py-1.5 text-xs text-slate-300">
                  <span>Mặt đất</span>
                  <input
                    type="color"
                    value={level.meta.groundColor}
                    onChange={(e) => onUpdateMeta({ groundColor: e.target.value })}
                    className="w-6 h-6 bg-transparent border-0 cursor-pointer"
                  />
                </label>
                <label className="flex items-center justify-between gap-2 bg-slate-900 border border-white/10 rounded-md px-2.5 py-1.5 text-xs text-slate-300">
                  <span>Đường kẻ</span>
                  <input
                    type="color"
                    value={level.meta.lineColor}
                    onChange={(e) => onUpdateMeta({ lineColor: e.target.value })}
                    className="w-6 h-6 bg-transparent border-0 cursor-pointer"
                  />
                </label>
                <label className="flex items-center justify-between gap-2 bg-slate-900 border border-white/10 rounded-md px-2.5 py-1.5 text-xs text-slate-300">
                  <span>Viền khối</span>
                  <input
                    type="color"
                    value={level.meta.objColor}
                    onChange={(e) => onUpdateMeta({ objColor: e.target.value })}
                    className="w-6 h-6 bg-transparent border-0 cursor-pointer"
                  />
                </label>
              </div>
            </div>
          </div>
        </div>
      )}
    </aside>
  );
};
