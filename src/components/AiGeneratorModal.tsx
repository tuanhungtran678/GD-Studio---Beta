import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AITestReport, GDLevel } from '../types/gd';
import { AlertTriangle, BrainCircuit, Clock, Loader2, Wand2, X, Zap } from 'lucide-react';

export interface AiApplyMeta {
  elapsedMs: number;
  sectionsCount: number;
  testReport?: AITestReport;
  prompt?: string;
  length?: 'short' | 'medium' | 'long';
  difficulty?: 'easy' | 'normal' | 'hard';
  thinkingMode?: 'fast' | 'deep';
  applyMode?: 'replace' | 'append';
  recreateAttempt?: number;
}

export interface AiRecreateRequest {
  id: number;
  prompt: string;
  length: 'short' | 'medium' | 'long';
  difficulty: 'easy' | 'normal' | 'hard';
  thinkingMode: 'fast' | 'deep';
  applyMode: 'replace' | 'append';
  crashX: number;
  recreateAttempt: number;
  message: string;
}

interface AiGeneratorModalProps {
  open: boolean;
  recreateRequest?: AiRecreateRequest | null;
  onClose: () => void;
  onApplyLevel: (
    level: GDLevel,
    mode: 'replace' | 'append',
    meta?: AiApplyMeta
  ) => void;
}

const PROMPT_SUGGESTIONS = [
  'Màn Cyber Neon tốc độ 2x: mở đầu Cube nhảy qua bậc thang và ngọc vàng, giữa bài chuyển Ship né lưỡi cưa, cuối bài Wave chui hầm và 3 đồng xu',
  'Thử thách Wave & Ball tốc độ 3x phong cách mạch điện tử xanh dương, có nhiều cổng đảo trọng lực và Color Trigger đổi màu tím',
  'Màn Cube cổ điển dễ chơi như Stereo Madness: nền xanh đậm, bậc thang gạch, bệ nhảy vàng, gai đơn và đôi vừa phải',
  'Màn Robot & Spider trong thành phố đêm: nhảy qua hố gai, leo tường đảo trọng lực liên hoàn với ngọc xanh dương',
];

const FALLBACK_EST_MS: Record<string, number> = {
  'fast:short': 3000,
  'fast:medium': 4500,
  'fast:long': 6000,
  'deep:short': 6500,
  'deep:medium': 8500,
  'deep:long': 11000,
};

export const AiGeneratorModal: React.FC<AiGeneratorModalProps> = ({
  open,
  recreateRequest = null,
  onClose,
  onApplyLevel,
}) => {
  const [prompt, setPrompt] = useState('');
  const [length, setLength] = useState<'short' | 'medium' | 'long'>('medium');
  const [difficulty, setDifficulty] = useState<'easy' | 'normal' | 'hard'>('normal');
  const [applyMode, setApplyMode] = useState<'replace' | 'append'>('replace');
  const [thinkingMode, setThinkingMode] = useState<'fast' | 'deep'>('fast');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [recreateBanner, setRecreateBanner] = useState<string>('');
  const [elapsedSec, setElapsedSec] = useState(0);
  const [estimatedMs, setEstimatedMs] = useState<number>(
    FALLBACK_EST_MS['fast:medium']
  );
  const [streamStatus, setStreamStatus] = useState<{
    name: string;
    bgColor: string;
    sectionsBuilt: number;
    note: string;
  }>({
    name: '',
    bgColor: '',
    sectionsBuilt: 0,
    note: '',
  });

  const abortRef = useRef<AbortController | null>(null);
  const lastHandledRecreateIdRef = useRef<number>(0);

  useEffect(() => {
    if (!open) return;
    const key = `${thinkingMode}:${length}`;
    setEstimatedMs(FALLBACK_EST_MS[key] || 3800);
    let cancelled = false;
    fetch(
      `/api/generate-level/estimate?thinkingMode=${encodeURIComponent(
        thinkingMode
      )}&length=${encodeURIComponent(length)}`
    )
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!cancelled && data && typeof data.estimatedMs === 'number') {
          setEstimatedMs(data.estimatedMs);
        }
      })
      .catch(() => {
        // ignore network errors for estimate preview
      });
    return () => {
      cancelled = true;
    };
  }, [open, thinkingMode, length]);

  useEffect(() => {
    if (!loading) return;
    const start = performance.now();
    setElapsedSec(0);
    const id = window.setInterval(() => {
      setElapsedSec((performance.now() - start) / 1000);
    }, 60);
    return () => window.clearInterval(id);
  }, [loading]);

  useEffect(() => {
    if (!open && abortRef.current) {
      abortRef.current.abort();
      abortRef.current = null;
      setLoading(false);
    }
    if (!open) {
      setRecreateBanner('');
    }
  }, [open]);

  const runGeneration = useCallback(
    async (opts?: {
      prompt: string;
      length: 'short' | 'medium' | 'long';
      difficulty: 'easy' | 'normal' | 'hard';
      thinkingMode: 'fast' | 'deep';
      applyMode: 'replace' | 'append';
      recreateAttempt: number;
      impossibleHint?: string;
    }) => {
      const targetPrompt = (opts ? opts.prompt : prompt).trim();
      if (!targetPrompt) return;

      if (abortRef.current) {
        abortRef.current.abort();
      }
      const controller = new AbortController();
      abortRef.current = controller;

      const targetLength = opts ? opts.length : length;
      const targetDifficulty = opts ? opts.difficulty : difficulty;
      const targetThinking = opts ? opts.thinkingMode : thinkingMode;
      const targetApply = opts ? opts.applyMode : applyMode;
      const targetRecreateAttempt = opts ? opts.recreateAttempt : 0;

      setLoading(true);
      setError('');
      setStreamStatus({
        name: '',
        bgColor: '',
        sectionsBuilt: 0,
        note:
          targetRecreateAttempt > 0
            ? 'Level Impossible. Recreating...'
            : 'Đang kết nối AI thiết kế màn chơi...',
      });

      try {
        const res = await fetch('/api/generate-level', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'text/event-stream',
          },
          signal: controller.signal,
          body: JSON.stringify({
            prompt: targetPrompt,
            length: targetLength,
            difficulty: targetDifficulty,
            thinkingMode: targetThinking,
            recreateAttempt: targetRecreateAttempt,
            impossibleHint: opts?.impossibleHint || '',
            stream: true,
          }),
        });

        const contentType = res.headers.get('content-type') || '';

        if (!contentType.includes('text/event-stream')) {
          const data = await res.json();
          if (!res.ok) {
            throw new Error(data.error || 'Không thể tạo level.');
          }
          if (!data.level || !Array.isArray(data.level.objects)) {
            throw new Error('Dữ liệu level trả về không hợp lệ.');
          }
          setRecreateBanner('');
          onApplyLevel(data.level as GDLevel, targetApply, {
            elapsedMs: Number(data.elapsedMs) || 0,
            sectionsCount: Number(data.sectionsCount) || 1,
            testReport: data.testReport as AITestReport | undefined,
            prompt: targetPrompt,
            length: targetLength,
            difficulty: targetDifficulty,
            thinkingMode: targetThinking,
            applyMode: targetApply,
            recreateAttempt: targetRecreateAttempt,
          });
          onClose();
          return;
        }

        if (!res.body) {
          throw new Error('Trình duyệt không hỗ trợ đọc luồng dữ liệu AI.');
        }

        const reader = res.body.getReader();
        const decoder = new TextDecoder('utf-8');
        let buffer = '';
        let completed = false;

        const processEventBlock = (block: string) => {
          const lines = block.split('\n');
          let eventName = 'message';
          const dataLines: string[] = [];

          for (const rawLine of lines) {
            const line = rawLine.trimEnd();
            if (line.startsWith('event:')) {
              eventName = line.slice(6).trim();
            } else if (line.startsWith('data:')) {
              dataLines.push(line.slice(5).trim());
            }
          }

          if (dataLines.length === 0) return;
          const payload = JSON.parse(dataLines.join('\n'));

          if (eventName === 'status') {
            if (typeof payload.estimatedMs === 'number') {
              setEstimatedMs(payload.estimatedMs);
            }
            setStreamStatus((prev) => ({
              ...prev,
              note: payload.message || prev.note,
            }));
          } else if (eventName === 'meta') {
            setStreamStatus((prev) => ({
              ...prev,
              name: payload.name || prev.name,
              bgColor: payload.bgColor || prev.bgColor,
              note: 'Đang bố trí các phân đoạn nhịp điệu...',
            }));
          } else if (eventName === 'progress') {
            setStreamStatus((prev) => ({
              ...prev,
              sectionsBuilt: payload.sectionsBuilt ?? prev.sectionsBuilt,
              note: payload.note || prev.note,
            }));
          } else if (eventName === 'error') {
            throw new Error(payload.error || 'Lỗi khi tạo level.');
          } else if (eventName === 'complete') {
            if (!payload.level || !Array.isArray(payload.level.objects)) {
              throw new Error('Dữ liệu level trả về không hợp lệ.');
            }
            completed = true;
            setRecreateBanner('');
            onApplyLevel(payload.level as GDLevel, targetApply, {
              elapsedMs: Number(payload.elapsedMs) || 0,
              sectionsCount: Number(payload.sectionsCount) || 1,
              testReport: payload.testReport as AITestReport | undefined,
              prompt: targetPrompt,
              length: targetLength,
              difficulty: targetDifficulty,
              thinkingMode: targetThinking,
              applyMode: targetApply,
              recreateAttempt: targetRecreateAttempt,
            });
            onClose();
          }
        };

        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });

          let boundary = buffer.indexOf('\n\n');
          while (boundary !== -1) {
            const block = buffer.slice(0, boundary).trim();
            buffer = buffer.slice(boundary + 2);
            if (block) {
              processEventBlock(block);
            }
            boundary = buffer.indexOf('\n\n');
          }
        }

        if (buffer.trim() && !completed) {
          processEventBlock(buffer.trim());
        }

        if (!completed && !controller.signal.aborted) {
          throw new Error('Kết nối stream kết thúc trước khi hoàn tất level.');
        }
      } catch (err) {
        if (err instanceof DOMException && err.name === 'AbortError') {
          return;
        }
        setError(err instanceof Error ? err.message : 'Lỗi kết nối máy chủ AI.');
      } finally {
        abortRef.current = null;
        setLoading(false);
      }
    },
    [applyMode, difficulty, length, onApplyLevel, onClose, prompt, thinkingMode]
  );

  // Auto-trigger recreation when Editor AI Bot confirms level is impossible
  useEffect(() => {
    if (!open || !recreateRequest) return;
    if (recreateRequest.id === lastHandledRecreateIdRef.current) return;
    lastHandledRecreateIdRef.current = recreateRequest.id;

    setPrompt(recreateRequest.prompt);
    setLength(recreateRequest.length);
    setDifficulty(recreateRequest.difficulty);
    setThinkingMode(recreateRequest.thinkingMode);
    setApplyMode(recreateRequest.applyMode);
    setRecreateBanner(recreateRequest.message || 'Level Impossible. Recreating...');

    const timer = window.setTimeout(() => {
      runGeneration({
        prompt: recreateRequest.prompt,
        length: recreateRequest.length,
        difficulty: recreateRequest.difficulty,
        thinkingMode: recreateRequest.thinkingMode,
        applyMode: recreateRequest.applyMode,
        recreateAttempt: recreateRequest.recreateAttempt,
        impossibleHint: `Failed live playtest near X=${Math.round(recreateRequest.crashX)}`,
      });
    }, 350);

    return () => window.clearTimeout(timer);
  }, [open, recreateRequest, runGeneration]);

  if (!open) return null;

  const expectedSections = length === 'short' ? 5 : length === 'long' ? 10 : 7;
  const estSec = Math.max(1, estimatedMs / 1000);
  const remainingSec = Math.max(0, estSec - elapsedSec);
  const sectionPct =
    streamStatus.sectionsBuilt > 0
      ? Math.round((streamStatus.sectionsBuilt / expectedSections) * 88) + 8
      : streamStatus.name
      ? 16
      : 6;
  const timePct = Math.min(90, Math.round((elapsedSec / estSec) * 85));
  const progressPct = Math.min(96, Math.max(sectionPct, timePct));

  const handleClose = () => {
    if (abortRef.current) {
      abortRef.current.abort();
      abortRef.current = null;
    }
    setLoading(false);
    setRecreateBanner('');
    onClose();
  };

  const handleGenerate = () => {
    if (!prompt.trim() || loading) return;
    setRecreateBanner('');
    void runGeneration();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4">
      <div className="bg-[#0F1522] border border-white/15 rounded-xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-white/10">
          <div className="flex items-center gap-2">
            <Wand2 className="w-4 h-4 text-cyan-400" />
            <h2 className="font-display text-sm font-semibold text-white">
              Tạo Level bằng AI (Tự động nạp vào Editor)
            </h2>
          </div>
          <button
            type="button"
            onClick={handleClose}
            aria-label="Đóng"
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 overflow-y-auto flex flex-col gap-4">
          {recreateBanner && (
            <div className="flex items-center gap-3 p-3.5 rounded-lg bg-rose-500/15 border border-rose-500/45 text-rose-100">
              <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0" />
              <div className="min-w-0">
                <div className="text-sm font-bold text-white">
                  {recreateBanner}
                </div>
                <div className="text-xs text-rose-200/85 mt-0.5">
                  AI vừa tự chơi thử trong Editor và xác nhận màn không thể qua. Đang tự động thiết kế lại để kiểm tra lại...
                </div>
              </div>
            </div>
          )}

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-slate-300">
              Mô tả ý tưởng level Geometry Dash của bạn
            </label>
            <textarea
              rows={3}
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              disabled={loading}
              placeholder="Ví dụ: Tạo màn phong cách không gian 3D tốc độ 2x, đoạn đầu Cube kết hợp Orb vàng, giữa màn là Ship né lưỡi cưa và cuối màn là Wave..."
              className="w-full bg-slate-950 border border-white/15 focus:border-cyan-400 focus:outline-none rounded-lg p-3 text-sm text-white placeholder:text-slate-500 resize-none disabled:opacity-60"
            />
          </div>

          {/* Prompt Quick Suggestions */}
          <div className="flex flex-col gap-1.5">
            <span className="text-xs text-slate-400">Gợi ý nhanh:</span>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {PROMPT_SUGGESTIONS.map((s, idx) => (
                <button
                  key={idx}
                  type="button"
                  disabled={loading}
                  onClick={() => setPrompt(s)}
                  className="text-left p-2.5 rounded-lg bg-slate-900/80 hover:bg-slate-800 border border-white/10 hover:border-cyan-400/40 text-xs text-slate-300 line-clamp-2 transition-colors disabled:opacity-50"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>

          {/* Speed / Reasoning Mode Toggle */}
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-400">Chế độ tạo & suy luận</span>
              <span className="flex items-center gap-1 text-xs font-mono-tabular text-cyan-300">
                <Clock className="w-3.5 h-3.5" />
                Est ~{estSec.toFixed(1)}s
              </span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                disabled={loading}
                onClick={() => setThinkingMode('fast')}
                className={`flex items-center justify-between p-2.5 rounded-lg border text-left transition-colors ${
                  thinkingMode === 'fast'
                    ? 'bg-cyan-400/12 border-cyan-400/60 text-white'
                    : 'bg-slate-900/70 border-white/10 text-slate-400 hover:text-slate-200'
                }`}
              >
                <div className="flex items-center gap-2">
                  <Zap
                    className={`w-4 h-4 shrink-0 ${
                      thinkingMode === 'fast' ? 'text-cyan-400' : 'text-slate-500'
                    }`}
                  />
                  <div>
                    <div className="text-xs font-semibold">Tốc độ cao</div>
                    <div className="text-[11px] text-slate-400">
                      Phản hồi nhanh (~3–6s), biên dịch chuẩn vật lý
                    </div>
                  </div>
                </div>
              </button>

              <button
                type="button"
                disabled={loading}
                onClick={() => setThinkingMode('deep')}
                className={`flex items-center justify-between p-2.5 rounded-lg border text-left transition-colors ${
                  thinkingMode === 'deep'
                    ? 'bg-cyan-400/12 border-cyan-400/60 text-white'
                    : 'bg-slate-900/70 border-white/10 text-slate-400 hover:text-slate-200'
                }`}
              >
                <div className="flex items-center gap-2">
                  <BrainCircuit
                    className={`w-4 h-4 shrink-0 ${
                      thinkingMode === 'deep' ? 'text-cyan-400' : 'text-slate-500'
                    }`}
                  />
                  <div>
                    <div className="text-xs font-semibold">Suy luận sâu</div>
                    <div className="text-[11px] text-slate-400">
                      Phân tích kỹ kịch bản phức tạp (~6–11s)
                    </div>
                  </div>
                </div>
              </button>
            </div>
          </div>

          {/* Options */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-0.5">
            <label className="flex flex-col gap-1 text-xs text-slate-400">
              Độ dài màn chơi
              <select
                value={length}
                disabled={loading}
                onChange={(e) => setLength(e.target.value as 'short' | 'medium' | 'long')}
                className="bg-slate-900 border border-white/10 rounded-md px-2.5 py-2 text-xs text-white focus:border-cyan-400 focus:outline-none disabled:opacity-60"
              >
                <option value="short">Ngắn (~15 giây)</option>
                <option value="medium">Trung bình (~25 giây)</option>
                <option value="long">Dài (~40 giây)</option>
              </select>
            </label>

            <label className="flex flex-col gap-1 text-xs text-slate-400">
              Độ khó
              <select
                value={difficulty}
                disabled={loading}
                onChange={(e) => setDifficulty(e.target.value as 'easy' | 'normal' | 'hard')}
                className="bg-slate-900 border border-white/10 rounded-md px-2.5 py-2 text-xs text-white focus:border-cyan-400 focus:outline-none disabled:opacity-60"
              >
                <option value="easy">Dễ (2–3★)</option>
                <option value="normal">Trung bình (4–6★)</option>
                <option value="hard">Khó / Demon (7–10★)</option>
              </select>
            </label>

            <label className="flex flex-col gap-1 text-xs text-slate-400">
              Cách áp dụng
              <select
                value={applyMode}
                disabled={loading}
                onChange={(e) => setApplyMode(e.target.value as 'replace' | 'append')}
                className="bg-slate-900 border border-white/10 rounded-md px-2.5 py-2 text-xs text-white focus:border-cyan-400 focus:outline-none disabled:opacity-60"
              >
                <option value="replace">Thay thế level hiện tại</option>
                <option value="append">Nối thêm vào cuối level</option>
              </select>
            </label>
          </div>

          {error && (
            <div className="p-3 rounded-lg bg-rose-500/15 border border-rose-500/40 text-xs text-rose-200">
              {error}
            </div>
          )}

          {/* Live SSE Stream Progress */}
          {loading && (
            <div className="bg-slate-900/90 border border-cyan-400/35 rounded-lg p-3.5 flex flex-col gap-2.5">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  {streamStatus.bgColor ? (
                    <span
                      className="w-3 h-3 rounded-sm border border-white/30 shrink-0"
                      style={{ backgroundColor: streamStatus.bgColor }}
                    />
                  ) : (
                    <Loader2 className="w-3.5 h-3.5 text-cyan-400 animate-spin shrink-0" />
                  )}
                  <span className="text-xs font-semibold text-white truncate">
                    {streamStatus.name || 'Đang dựng bản thiết kế màn chơi...'}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-xs font-mono-tabular shrink-0">
                  <span className="text-cyan-300">{elapsedSec.toFixed(1)}s</span>
                  <span className="text-slate-600">/</span>
                  <span className="text-slate-400">
                    {remainingSec > 0.2
                      ? `Còn ~${remainingSec.toFixed(1)}s`
                      : 'Đang hoàn thiện...'}
                  </span>
                </div>
              </div>

              <div className="w-full h-1.5 bg-slate-800 rounded-sm overflow-hidden">
                <div
                  className="h-full bg-cyan-400 transition-[width] duration-150"
                  style={{ width: `${progressPct}%` }}
                />
              </div>

              <div className="flex items-center justify-between text-[11px] text-slate-400">
                <span className="truncate">{streamStatus.note}</span>
                <span className="font-mono-tabular shrink-0 ml-2">
                  Phân đoạn {streamStatus.sectionsBuilt}/{expectedSections}
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3.5 border-t border-white/10 flex items-center justify-between gap-3 bg-slate-900/40">
          <div className="flex items-center gap-1.5 text-xs text-slate-400 font-mono-tabular">
            <Clock className="w-3.5 h-3.5 text-slate-500" />
            <span>
              {loading
                ? remainingSec > 0.2
                  ? `Ước tính còn ~${remainingSec.toFixed(1)}s`
                  : 'Đang biên dịch hoàn tất...'
                : `Thời gian ước tính (Est): ~${estSec.toFixed(1)}s`}
            </span>
          </div>
          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={handleClose}
              className="px-3.5 py-2 rounded-lg text-xs font-medium text-slate-300 hover:text-white hover:bg-white/5 transition-colors"
            >
              {loading ? 'Hủy' : 'Đóng'}
            </button>
            <button
              type="button"
              disabled={!prompt.trim() || loading}
              onClick={handleGenerate}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-cyan-400 hover:bg-cyan-300 text-slate-950 text-xs font-semibold transition-colors disabled:opacity-45"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Đang tạo & nạp...
                </>
              ) : (
                <>
                  <Wand2 className="w-4 h-4" />
                  Tạo & Nạp ngay
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
