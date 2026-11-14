import React from 'react';
import {
  Bot,
  Download,
  FolderOpen,
  Layers,
  Play,
  Redo2,
  Square,
  Undo2,
  Wand2,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';

interface TopBarProps {
  levelName: string;
  onLevelNameChange: (name: string) => void;
  isPlaytesting: boolean;
  aiBotActive?: boolean;
  onTogglePlaytest: () => void;
  onStartAiBotTest: () => void;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  zoom: number;
  onZoomChange: (zoom: number) => void;
  onOpenPresets: () => void;
  onOpenAiGenerator: () => void;
  onOpenImport: () => void;
  onOpenExport: () => void;
}

export const TopBar: React.FC<TopBarProps> = ({
  levelName,
  onLevelNameChange,
  isPlaytesting,
  aiBotActive = false,
  onTogglePlaytest,
  onStartAiBotTest,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  zoom,
  onZoomChange,
  onOpenPresets,
  onOpenAiGenerator,
  onOpenImport,
  onOpenExport,
}) => {
  return (
    <header className="h-14 shrink-0 bg-[#0F1522] border-b border-white/10 px-4 flex items-center justify-between gap-4">
      {/* Left: Brand & Level Title */}
      <div className="flex items-center gap-3 min-w-0">
        <span className="font-display text-lg font-bold tracking-tight text-white whitespace-nowrap shrink-0">
          GD Studio
        </span>
        <span className="text-slate-700 shrink-0" aria-hidden="true">/</span>
        <input
          type="text"
          value={levelName}
          onChange={(e) => onLevelNameChange(e.target.value)}
          disabled={isPlaytesting}
          aria-label="Tên level"
          className="bg-slate-900/80 border border-white/10 focus:border-cyan-400 focus:outline-none rounded-md px-2.5 py-1 text-sm font-medium text-slate-100 w-44 sm:w-56 truncate disabled:opacity-60"
        />
        <button
          type="button"
          onClick={onOpenPresets}
          disabled={isPlaytesting}
          className="hidden md:flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium text-slate-300 hover:text-white hover:bg-white/5 border border-white/10 transition-colors whitespace-nowrap shrink-0 disabled:opacity-50"
        >
          <Layers className="w-3.5 h-3.5 text-cyan-400" />
          Mẫu level
        </button>
        <button
          type="button"
          onClick={onOpenAiGenerator}
          disabled={isPlaytesting}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium text-cyan-200 bg-cyan-500/15 hover:bg-cyan-500/25 border border-cyan-500/35 transition-colors whitespace-nowrap shrink-0 disabled:opacity-50"
        >
          <Wand2 className="w-3.5 h-3.5 text-cyan-400" />
          Tạo bằng AI
        </button>
      </div>

      {/* Center: Playtest & History/Zoom Controls */}
      <div className="flex items-center gap-2 shrink-0">
        <button
          type="button"
          onClick={onTogglePlaytest}
          className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
            isPlaytesting
              ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40 hover:bg-rose-500/30'
              : 'bg-emerald-500 text-slate-950 hover:bg-emerald-400'
          }`}
        >
          {isPlaytesting ? (
            <>
              <Square className="w-3.5 h-3.5 fill-current" />
              {aiBotActive ? 'Dừng AI Bot' : 'Dừng chơi thử'}
            </>
          ) : (
            <>
              <Play className="w-3.5 h-3.5 fill-current" />
              Chơi thử
            </>
          )}
        </button>

        {!isPlaytesting && (
          <button
            type="button"
            onClick={onStartAiBotTest}
            title="AI tự chơi thử ngay trong Editor để kiểm tra Possible / Impossible"
            className="hidden sm:flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium text-emerald-200 bg-emerald-500/12 hover:bg-emerald-500/22 border border-emerald-500/30 transition-colors whitespace-nowrap shrink-0"
          >
            <Bot className="w-3.5 h-3.5 text-emerald-400" />
            AI Tự chơi
          </button>
        )}

        <div className="hidden sm:flex items-center gap-1 ml-1 bg-slate-900/90 border border-white/10 rounded-lg p-0.5">
          <button
            type="button"
            onClick={onUndo}
            disabled={!canUndo || isPlaytesting}
            title="Hoàn tác (Ctrl+Z)"
            className="p-1.5 rounded-md text-slate-300 hover:text-white hover:bg-white/10 disabled:opacity-30 transition-colors"
          >
            <Undo2 className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={onRedo}
            disabled={!canRedo || isPlaytesting}
            title="Làm lại (Ctrl+Y)"
            className="p-1.5 rounded-md text-slate-300 hover:text-white hover:bg-white/10 disabled:opacity-30 transition-colors"
          >
            <Redo2 className="w-4 h-4" />
          </button>
        </div>

        <div className="hidden lg:flex items-center gap-1 bg-slate-900/90 border border-white/10 rounded-lg p-0.5">
          <button
            type="button"
            onClick={() => onZoomChange(Math.max(0.45, Number((zoom - 0.15).toFixed(2))))}
            disabled={isPlaytesting}
            title="Thu nhỏ"
            className="p-1.5 rounded-md text-slate-300 hover:text-white hover:bg-white/10 disabled:opacity-30 transition-colors"
          >
            <ZoomOut className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => onZoomChange(1)}
            disabled={isPlaytesting}
            title="Đặt lại 100%"
            className="px-2 py-1 text-xs font-mono-tabular text-slate-300 hover:text-white transition-colors"
          >
            {Math.round(zoom * 100)}%
          </button>
          <button
            type="button"
            onClick={() => onZoomChange(Math.min(2.5, Number((zoom + 0.15).toFixed(2))))}
            disabled={isPlaytesting}
            title="Phóng to"
            className="p-1.5 rounded-md text-slate-300 hover:text-white hover:bg-white/10 disabled:opacity-30 transition-colors"
          >
            <ZoomIn className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Right: Import/Decode & Primary Export .gmd CTA */}
      <div className="flex items-center gap-2 shrink-0">
        <button
          type="button"
          onClick={onOpenImport}
          disabled={isPlaytesting}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-slate-200 bg-slate-800/80 hover:bg-slate-800 border border-white/10 transition-colors whitespace-nowrap shrink-0 disabled:opacity-50"
        >
          <FolderOpen className="w-3.5 h-3.5 text-amber-400" />
          Nhập / Giải mã
        </button>

        <button
          type="button"
          onClick={onOpenExport}
          className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold text-slate-950 bg-cyan-400 hover:bg-cyan-300 transition-colors whitespace-nowrap shrink-0"
        >
          <Download className="w-3.5 h-3.5" />
          Xuất .gdlvl / .gmd
        </button>
      </div>
    </header>
  );
};
