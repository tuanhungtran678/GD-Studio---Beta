import React from 'react';
import { GDLevel } from '../types/gd';
import { PRESET_LEVELS } from '../data/gdCatalog';
import { Layers, X } from 'lucide-react';

interface PresetModalProps {
  open: boolean;
  onClose: () => void;
  onSelectPreset: (level: GDLevel) => void;
}

export const PresetModal: React.FC<PresetModalProps> = ({
  open,
  onClose,
  onSelectPreset,
}) => {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4">
      <div className="bg-[#0F1522] border border-white/15 rounded-xl w-full max-w-lg shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-white/10">
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-cyan-400" />
            <h2 className="text-sm font-semibold text-white">Chọn mẫu level khởi tạo</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Đóng"
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-4 flex flex-col gap-2.5">
          {PRESET_LEVELS.map((preset) => (
            <button
              key={preset.id}
              type="button"
              onClick={() => {
                onSelectPreset(structuredClone(preset.level));
                onClose();
              }}
              className="flex items-center justify-between text-left p-3.5 rounded-lg bg-slate-900/80 hover:bg-slate-800 border border-white/10 hover:border-cyan-400/50 transition-colors"
            >
              <div>
                <div className="text-sm font-semibold text-white">{preset.title}</div>
                <div className="text-xs text-slate-400 mt-0.5">{preset.subtitle}</div>
              </div>
              <span className="text-xs font-mono-tabular text-cyan-300">
                {preset.level.objects.length} khối
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};
