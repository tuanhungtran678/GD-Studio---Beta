import { useCallback, useEffect, useState } from 'react';
import { AITestReport, EditorTool, GDLevel, GDLevelMeta, GDObject } from './types/gd';
import { PRESET_LEVELS, nextUid } from './data/gdCatalog';
import { TopBar } from './components/TopBar';
import { LevelCanvas } from './components/LevelCanvas';
import { ObjectPalette } from './components/ObjectPalette';
import { InspectorSidebar } from './components/InspectorSidebar';
import { CodecModal } from './components/CodecModal';
import { PresetModal } from './components/PresetModal';
import { AiApplyMeta, AiGeneratorModal, AiRecreateRequest } from './components/AiGeneratorModal';
import { AlertTriangle, CheckCircle2, Loader2, Play, ShieldCheck, X } from 'lucide-react';

const STORAGE_KEY = 'gd_studio_autosave_v1';

function loadInitialLevel(): GDLevel {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved) as GDLevel;
      if (parsed && parsed.meta && Array.isArray(parsed.objects)) {
        return parsed;
      }
    }
  } catch {
    // ignore storage errors
  }
  return structuredClone(PRESET_LEVELS[0].level);
}

export default function App() {
  const [level, setLevel] = useState<GDLevel>(loadInitialLevel);
  const [history, setHistory] = useState<GDObject[][]>([]);
  const [future, setFuture] = useState<GDObject[][]>([]);

  const [activeObjectId, setActiveObjectId] = useState<number>(1);
  const [tool, setTool] = useState<EditorTool>('build');
  const [snapToGrid, setSnapToGrid] = useState<boolean>(true);
  const [selectedUids, setSelectedUids] = useState<string[]>([]);
  const [isPlaytesting, setIsPlaytesting] = useState<boolean>(false);
  const [aiBotActive, setAiBotActive] = useState<boolean>(false);
  const [zoom, setZoom] = useState<number>(1);

  const [codecModal, setCodecModal] = useState<{ open: boolean; tab: 'export' | 'import' }>({
    open: false,
    tab: 'export',
  });
  const [presetOpen, setPresetOpen] = useState<boolean>(false);
  const [aiOpen, setAiOpen] = useState<boolean>(false);
  const [cameraResetKey, setCameraResetKey] = useState<number>(0);
  const [aiToast, setAiToast] = useState<{
    name: string;
    objectCount: number;
    elapsedMs: number;
    testReport?: AITestReport;
    liveVerifiedAttempts?: number;
  } | null>(null);
  const [recreateRequest, setRecreateRequest] = useState<AiRecreateRequest | null>(null);
  const [pendingAiVerify, setPendingAiVerify] = useState<{
    report?: AITestReport;
    prompt: string;
    length: 'short' | 'medium' | 'long';
    difficulty: 'easy' | 'normal' | 'hard';
    thinkingMode: 'fast' | 'deep';
    applyMode: 'replace' | 'append';
    elapsedMs: number;
    recreateAttempt: number;
    levelName: string;
    objectCount: number;
  } | null>(null);
  const [lastAiContext, setLastAiContext] = useState<{
    prompt: string;
    length: 'short' | 'medium' | 'long';
    difficulty: 'easy' | 'normal' | 'hard';
    thinkingMode: 'fast' | 'deep';
  } | null>(null);
  const [boringDialog, setBoringDialog] = useState<{
    report: AITestReport;
    prompt: string;
    length: 'short' | 'medium' | 'long';
    difficulty: 'easy' | 'normal' | 'hard';
    thinkingMode: 'fast' | 'deep';
    applyMode: 'replace' | 'append';
  } | null>(null);
  const [isSpicingUp, setIsSpicingUp] = useState(false);
  const [spiceError, setSpiceError] = useState('');

  useEffect(() => {
    if (!aiToast) return;
    const timer = window.setTimeout(() => setAiToast(null), 5500);
    return () => window.clearTimeout(timer);
  }, [aiToast]);

  // Persist level locally
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(level));
    } catch {
      // ignore quota errors
    }
  }, [level]);

  const handleChangeObjects = useCallback(
    (updater: (prev: GDObject[]) => GDObject[], recordHistory = true) => {
      setLevel((prev) => {
        const nextObjects = updater(prev.objects);
        if (recordHistory) {
          setHistory((h) => [...h.slice(-49), prev.objects]);
          setFuture([]);
        }
        return { ...prev, objects: nextObjects };
      });
    },
    []
  );

  const handleUpdateMeta = useCallback((patch: Partial<GDLevelMeta>) => {
    setLevel((prev) => ({
      ...prev,
      meta: { ...prev.meta, ...patch },
    }));
  }, []);

  const handleUndo = useCallback(() => {
    setHistory((prevHist) => {
      if (prevHist.length === 0) return prevHist;
      const previousObjects = prevHist[prevHist.length - 1];
      setLevel((cur) => {
        setFuture((f) => [cur.objects, ...f.slice(0, 49)]);
        return { ...cur, objects: previousObjects };
      });
      setSelectedUids([]);
      return prevHist.slice(0, -1);
    });
  }, []);

  const handleRedo = useCallback(() => {
    setFuture((prevFuture) => {
      if (prevFuture.length === 0) return prevFuture;
      const nextObjects = prevFuture[0];
      setLevel((cur) => {
        setHistory((h) => [...h.slice(-49), cur.objects]);
        return { ...cur, objects: nextObjects };
      });
      setSelectedUids([]);
      return prevFuture.slice(1);
    });
  }, []);

  const handleUpdateSelected = useCallback(
    (patch: Partial<GDObject>) => {
      if (selectedUids.length === 0) return;
      const selSet = new Set(selectedUids);
      handleChangeObjects(
        (prev) => prev.map((o) => (selSet.has(o.uid) ? { ...o, ...patch } : o)),
        true
      );
    },
    [handleChangeObjects, selectedUids]
  );

  const handleRotateSelected = useCallback(
    (degDelta: number) => {
      if (selectedUids.length === 0) return;
      const selSet = new Set(selectedUids);
      handleChangeObjects(
        (prev) =>
          prev.map((o) =>
            selSet.has(o.uid)
              ? { ...o, rotation: (((o.rotation || 0) + degDelta) % 360 + 360) % 360 }
              : o
          ),
        true
      );
    },
    [handleChangeObjects, selectedUids]
  );

  const handleFlipSelected = useCallback(
    (axis: 'x' | 'y') => {
      if (selectedUids.length === 0) return;
      const selSet = new Set(selectedUids);
      handleChangeObjects(
        (prev) =>
          prev.map((o) =>
            selSet.has(o.uid)
              ? axis === 'x'
                ? { ...o, flipX: !o.flipX }
                : { ...o, flipY: !o.flipY }
              : o
          ),
        true
      );
    },
    [handleChangeObjects, selectedUids]
  );

  const handleDuplicateSelected = useCallback(() => {
    if (selectedUids.length === 0) return;
    const selSet = new Set(selectedUids);
    const clones: GDObject[] = [];
    level.objects.forEach((o) => {
      if (selSet.has(o.uid)) {
        clones.push({
          ...structuredClone(o),
          uid: nextUid(),
          x: o.x + 30,
        });
      }
    });
    if (clones.length > 0) {
      handleChangeObjects((prev) => [...prev, ...clones], true);
      setSelectedUids(clones.map((c) => c.uid));
    }
  }, [handleChangeObjects, level.objects, selectedUids]);

  const handleDeleteSelected = useCallback(() => {
    if (selectedUids.length === 0) return;
    const selSet = new Set(selectedUids);
    handleChangeObjects((prev) => prev.filter((o) => !selSet.has(o.uid)), true);
    setSelectedUids([]);
  }, [handleChangeObjects, selectedUids]);

  // Global Keyboard Shortcuts for Editor
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (isPlaytesting || codecModal.open || presetOpen || aiOpen || boringDialog) return;
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

      const mod = e.ctrlKey || e.metaKey;
      if (mod && e.key.toLowerCase() === 'z' && !e.shiftKey) {
        e.preventDefault();
        handleUndo();
      } else if ((mod && e.key.toLowerCase() === 'y') || (mod && e.shiftKey && e.key.toLowerCase() === 'z')) {
        e.preventDefault();
        handleRedo();
      } else if (mod && e.key.toLowerCase() === 'd') {
        e.preventDefault();
        handleDuplicateSelected();
      } else if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selectedUids.length > 0) {
          e.preventDefault();
          handleDeleteSelected();
        }
      } else if (e.key.toLowerCase() === 'e' && selectedUids.length > 0) {
        e.preventDefault();
        handleRotateSelected(90);
      } else if (e.key.toLowerCase() === 'q' && selectedUids.length > 0) {
        e.preventDefault();
        handleRotateSelected(-90);
      } else if (selectedUids.length > 0 && ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
        e.preventDefault();
        const step = e.shiftKey ? 5 : 30;
        const dx = e.key === 'ArrowLeft' ? -step : e.key === 'ArrowRight' ? step : 0;
        const dy = e.key === 'ArrowUp' ? step : e.key === 'ArrowDown' ? -step : 0;
        const selSet = new Set(selectedUids);
        handleChangeObjects(
          (prev) =>
            prev.map((o) =>
              selSet.has(o.uid)
                ? { ...o, x: Math.max(15, o.x + dx), y: Math.max(15, o.y + dy) }
                : o
            ),
          true
        );
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [
    codecModal.open,
    handleChangeObjects,
    handleDeleteSelected,
    handleDuplicateSelected,
    handleRedo,
    handleRotateSelected,
    handleUndo,
    isPlaytesting,
    presetOpen,
    aiOpen,
    boringDialog,
    selectedUids,
  ]);

  const selectedObjects = level.objects.filter((o) => selectedUids.includes(o.uid));

  return (
    <div className="h-screen w-screen flex flex-col overflow-hidden bg-[#0B0F17] text-slate-100">
      <TopBar
        levelName={level.meta.name}
        onLevelNameChange={(name) => handleUpdateMeta({ name })}
        isPlaytesting={isPlaytesting}
        aiBotActive={aiBotActive}
        onTogglePlaytest={() => {
          setSelectedUids([]);
          if (isPlaytesting) {
            setIsPlaytesting(false);
            setAiBotActive(false);
            setPendingAiVerify(null);
          } else {
            setAiBotActive(false);
            setIsPlaytesting(true);
          }
        }}
        onStartAiBotTest={() => {
          setSelectedUids([]);
          setAiToast(null);
          const ctx = lastAiContext;
          setPendingAiVerify({
            prompt:
              ctx?.prompt ||
              `Tạo lại màn chơi Geometry Dash hợp lệ và vượt qua được dựa trên chủ đề "${level.meta.name}"`,
            length: ctx?.length || 'medium',
            difficulty: ctx?.difficulty || 'normal',
            thinkingMode: ctx?.thinkingMode || 'fast',
            applyMode: 'replace',
            elapsedMs: 0,
            recreateAttempt: 0,
            levelName: level.meta.name,
            objectCount: level.objects.length,
          });
          setAiBotActive(true);
          setIsPlaytesting(true);
        }}
        canUndo={history.length > 0}
        canRedo={future.length > 0}
        onUndo={handleUndo}
        onRedo={handleRedo}
        zoom={zoom}
        onZoomChange={setZoom}
        onOpenPresets={() => setPresetOpen(true)}
        onOpenAiGenerator={() => {
          setRecreateRequest(null);
          setAiOpen(true);
        }}
        onOpenImport={() => setCodecModal({ open: true, tab: 'import' })}
        onOpenExport={() => setCodecModal({ open: true, tab: 'export' })}
      />

      <div className="flex-1 flex min-h-0 overflow-hidden">
        <LevelCanvas
          level={level}
          activeObjectId={activeObjectId}
          tool={tool}
          snapToGrid={snapToGrid}
          selectedUids={selectedUids}
          isPlaytesting={isPlaytesting}
          aiBotActive={aiBotActive}
          onAiBotResult={(result, info) => {
            setIsPlaytesting(false);
            setAiBotActive(false);

            if (result === 'possible') {
              const verified = pendingAiVerify;
              setPendingAiVerify(null);
              setRecreateRequest(null);
              const passedReport: AITestReport | undefined = verified?.report
                ? { ...verified.report, passed: true }
                : undefined;

              setAiToast({
                name: verified?.levelName || level.meta.name,
                objectCount: verified?.objectCount ?? level.objects.length,
                elapsedMs: verified?.elapsedMs || 0,
                testReport: passedReport,
                liveVerifiedAttempts: info.attempts,
              });

              if (passedReport?.isBoring && verified) {
                setSpiceError('');
                setBoringDialog({
                  report: passedReport,
                  prompt: verified.prompt,
                  length: verified.length,
                  difficulty: verified.difficulty,
                  thinkingMode: verified.thinkingMode,
                  applyMode: verified.applyMode,
                });
              }
            } else {
              // Confirmed Impossible after multiple live attempts -> return to AI modal & recreate
              const cur = pendingAiVerify;
              const nextAttempt = (cur?.recreateAttempt ?? 0) + 1;
              const basePrompt =
                cur?.prompt ||
                lastAiContext?.prompt ||
                `Tạo lại màn chơi Geometry Dash hợp lệ dựa trên "${level.meta.name}"`;
              setPendingAiVerify(null);
              setRecreateRequest({
                id: Date.now(),
                prompt: basePrompt,
                length: cur?.length || lastAiContext?.length || 'medium',
                difficulty: cur?.difficulty || lastAiContext?.difficulty || 'normal',
                thinkingMode: cur?.thinkingMode || lastAiContext?.thinkingMode || 'fast',
                applyMode: cur?.applyMode || 'replace',
                crashX: info.crashX,
                recreateAttempt: nextAttempt,
                message: 'Level Impossible. Recreating...',
              });
              setAiOpen(true);
            }
          }}
          zoom={zoom}
          onZoomChange={setZoom}
          onSelectUids={setSelectedUids}
          onChangeObjects={handleChangeObjects}
          onStopPlaytest={() => {
            setIsPlaytesting(false);
            setAiBotActive(false);
            setPendingAiVerify(null);
          }}
          cameraResetKey={cameraResetKey}
        />

        <InspectorSidebar
          level={level}
          selectedObjects={selectedObjects}
          isPlaytesting={isPlaytesting}
          onUpdateMeta={handleUpdateMeta}
          onUpdateSelected={handleUpdateSelected}
          onRotateSelected={handleRotateSelected}
          onFlipSelected={handleFlipSelected}
          onDuplicateSelected={handleDuplicateSelected}
          onDeleteSelected={handleDeleteSelected}
        />
      </div>

      <ObjectPalette
        activeObjectId={activeObjectId}
        onSelectObject={setActiveObjectId}
        tool={tool}
        onSelectTool={setTool}
        snapToGrid={snapToGrid}
        onToggleSnap={() => setSnapToGrid((s) => !s)}
        disabled={isPlaytesting}
      />

      <CodecModal
        open={codecModal.open}
        initialTab={codecModal.tab}
        level={level}
        onClose={() => setCodecModal((prev) => ({ ...prev, open: false }))}
        onImportLevel={(imported) => {
          setHistory((h) => [...h.slice(-49), level.objects]);
          setFuture([]);
          setLevel(imported);
          setSelectedUids([]);
          setCameraResetKey((k) => k + 1);
        }}
      />

      <PresetModal
        open={presetOpen}
        onClose={() => setPresetOpen(false)}
        onSelectPreset={(presetLevel) => {
          setHistory((h) => [...h.slice(-49), level.objects]);
          setFuture([]);
          setLevel(presetLevel);
          setSelectedUids([]);
          setCameraResetKey((k) => k + 1);
        }}
      />

      <AiGeneratorModal
        open={aiOpen}
        recreateRequest={recreateRequest}
        onClose={() => setAiOpen(false)}
        onApplyLevel={(generated, mode, meta?: AiApplyMeta) => {
          setHistory((h) => [...h.slice(-49), level.objects]);
          setFuture([]);
          let appliedObjCount = generated.objects.length;
          if (mode === 'replace') {
            setLevel(generated);
            setCameraResetKey((k) => k + 1);
          } else {
            const maxExistingX =
              level.objects.length > 0
                ? Math.max(...level.objects.map((o) => o.x)) + 180
                : 0;
            const offset = Math.ceil(maxExistingX / 30) * 30;
            const appended = generated.objects.map((o) => ({
              ...o,
              uid: nextUid(),
              x: o.x + offset,
            }));
            appliedObjCount = level.objects.length + appended.length;
            setLevel((prev) => ({
              ...prev,
              objects: [...prev.objects, ...appended],
            }));
          }
          setSelectedUids([]);
          setAiToast(null);
          setBoringDialog(null);

          const promptUsed =
            meta?.prompt || generated.meta.description || generated.meta.name;
          const lengthUsed = meta?.length || 'medium';
          const diffUsed = meta?.difficulty || 'normal';
          const thinkUsed = meta?.thinkingMode || 'fast';

          setLastAiContext({
            prompt: promptUsed,
            length: lengthUsed,
            difficulty: diffUsed,
            thinkingMode: thinkUsed,
          });

          setPendingAiVerify({
            report: meta?.testReport,
            prompt: promptUsed,
            length: lengthUsed,
            difficulty: diffUsed,
            thinkingMode: thinkUsed,
            applyMode: mode,
            elapsedMs: meta?.elapsedMs || 0,
            recreateAttempt: meta?.recreateAttempt ?? 0,
            levelName: generated.meta.name,
            objectCount: appliedObjCount,
          });

          // Immediately auto-play right in the editor before the user's eyes!
          setAiBotActive(true);
          setIsPlaytesting(true);
        }}
      />

      {boringDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4">
          <div className="bg-[#0F1522] border border-amber-400/35 rounded-xl w-full max-w-md shadow-2xl overflow-hidden">
            <div className="px-5 py-4 border-b border-white/10 flex items-start gap-3">
              <div className="p-2 rounded-lg bg-amber-400/15 text-amber-300 shrink-0 mt-0.5">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <h3 className="font-display text-base font-bold text-white leading-snug">
                  Gameplay có chán hay không?
                </h3>
                <p className="text-xs font-medium text-amber-200/85 mt-0.5">
                  Is the gameplay boring?
                </p>
              </div>
            </div>

            <div className="p-5 flex flex-col gap-3 text-xs">
              <div className="flex items-center justify-between gap-2 px-3 py-2 rounded-lg bg-slate-900/90 border border-white/10">
                <span className="text-slate-300">
                  Điểm thú vị: <strong className="text-amber-300 font-mono-tabular">{boringDialog.report.funScore}/100</strong>
                </span>
                <span className="text-slate-400 font-mono-tabular">
                  {boringDialog.report.actionsPerSec} thao tác/s · {boringDialog.report.modeCount} chế độ
                </span>
              </div>

              {boringDialog.report.boringReasons.length > 0 && (
                <ul className="list-disc list-inside text-slate-300 space-y-1 bg-slate-900/50 rounded-lg p-3 border border-white/5">
                  {boringDialog.report.boringReasons.map((reason, idx) => (
                    <li key={idx}>{reason}</li>
                  ))}
                </ul>
              )}

              <div className="flex items-center gap-2 text-[11px] text-emerald-300/90">
                <ShieldCheck className="w-4 h-4 shrink-0" />
                <span>
                  {boringDialog.report.passed
                    ? 'AI đã tự chơi thử 120Hz và xác nhận qua màn 100%.'
                    : 'AI đã tối ưu tối đa các điểm nghẽn trong màn.'}
                  {boringDialog.report.repairsMade > 0
                    ? ` (Đã tự sửa ${boringDialog.report.repairsMade} lỗi bất khả thi)`
                    : ''}
                </span>
              </div>

              <p className="text-slate-400 leading-relaxed">
                Chọn <strong className="text-white">Có</strong> để AI tự thiết kế lại nhịp điệu sôi động hơn (nhiều cổng, ngọc và thử thách hơn), hoặc chọn <strong className="text-white">Không</strong> để giữ nguyên màn chơi hiện tại.
              </p>

              {spiceError && (
                <div className="p-2.5 rounded-lg bg-rose-500/15 border border-rose-500/40 text-rose-200">
                  {spiceError}
                </div>
              )}
            </div>

            <div className="px-5 py-3.5 border-t border-white/10 bg-slate-900/50 flex items-center justify-end gap-2.5">
              <button
                type="button"
                disabled={isSpicingUp}
                onClick={() => setBoringDialog(null)}
                className="px-4 py-2 rounded-lg border border-white/15 bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-100 transition-colors disabled:opacity-50"
              >
                Không
              </button>
              <button
                type="button"
                disabled={isSpicingUp}
                onClick={async () => {
                  if (!boringDialog || isSpicingUp) return;
                  setIsSpicingUp(true);
                  setSpiceError('');
                  try {
                    const res = await fetch('/api/generate-level', {
                      method: 'POST',
                      headers: {
                        'Content-Type': 'application/json',
                        Accept: 'application/json',
                      },
                      body: JSON.stringify({
                        prompt: boringDialog.prompt,
                        length: boringDialog.length,
                        difficulty: boringDialog.difficulty,
                        thinkingMode: boringDialog.thinkingMode,
                        stream: false,
                        spiceUp: true,
                      }),
                    });
                    const data = await res.json();
                    if (!res.ok) {
                      throw new Error(data.error || 'Không thể tạo lại level.');
                    }
                    const regenerated = data.level as GDLevel;
                    const newReport = data.testReport as AITestReport | undefined;

                    setHistory((h) => [...h.slice(-49), level.objects]);
                    setFuture([]);
                    let appliedCount = regenerated.objects.length;
                    if (boringDialog.applyMode === 'replace') {
                      setLevel(regenerated);
                      setCameraResetKey((k) => k + 1);
                    } else {
                      const maxExistingX =
                        level.objects.length > 0
                          ? Math.max(...level.objects.map((o) => o.x)) + 180
                          : 0;
                      const offset = Math.ceil(maxExistingX / 30) * 30;
                      const appended = regenerated.objects.map((o) => ({
                        ...o,
                        uid: nextUid(),
                        x: o.x + offset,
                      }));
                      appliedCount = level.objects.length + appended.length;
                      setLevel((prev) => ({
                        ...prev,
                        objects: [...prev.objects, ...appended],
                      }));
                    }
                    setSelectedUids([]);
                    setAiToast(null);
                    setBoringDialog(null);
                    setPendingAiVerify({
                      report: newReport,
                      prompt: boringDialog.prompt,
                      length: boringDialog.length,
                      difficulty: boringDialog.difficulty,
                      thinkingMode: boringDialog.thinkingMode,
                      applyMode: boringDialog.applyMode,
                      elapsedMs: Number(data.elapsedMs) || 0,
                      recreateAttempt: 0,
                      levelName: regenerated.meta.name,
                      objectCount: appliedCount,
                    });
                    setAiBotActive(true);
                    setIsPlaytesting(true);
                  } catch (err) {
                    setSpiceError(
                      err instanceof Error ? err.message : 'Lỗi khi tạo lại level.'
                    );
                  } finally {
                    setIsSpicingUp(false);
                  }
                }}
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-amber-400 hover:bg-amber-300 text-slate-950 text-xs font-semibold transition-colors disabled:opacity-50"
              >
                {isSpicingUp ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    Đang tạo lại...
                  </>
                ) : (
                  'Có'
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {aiToast && !isPlaytesting && (
        <div className="fixed bottom-24 right-72 z-40 flex items-center gap-3 px-4 py-2.5 rounded-lg bg-[#0F1522]/95 border border-emerald-400/40 shadow-2xl backdrop-blur-md">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <div className="text-xs">
            <div className="font-semibold text-white">
              Đã nạp &ldquo;{aiToast.name}&rdquo;
            </div>
            <div className="text-slate-400 font-mono-tabular">
              {aiToast.objectCount} đối tượng
              {aiToast.elapsedMs > 0
                ? ` · ${(aiToast.elapsedMs / 1000).toFixed(2)}s`
                : ''}
              {aiToast.liveVerifiedAttempts
                ? ` · Possible (${aiToast.liveVerifiedAttempts} lần thử)`
                : ''}
              {aiToast.testReport
                ? ` · Fun ${aiToast.testReport.funScore}/100`
                : ''}
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              setAiToast(null);
              setSelectedUids([]);
              setAiBotActive(false);
              setIsPlaytesting(true);
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-emerald-400 hover:bg-emerald-300 text-slate-950 text-xs font-semibold transition-colors ml-1"
          >
            <Play className="w-3.5 h-3.5 fill-current" />
            Chơi thử
          </button>
          <button
            type="button"
            onClick={() => setAiToast(null)}
            aria-label="Đóng thông báo"
            className="p-1 rounded text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
    </div>
  );
}
