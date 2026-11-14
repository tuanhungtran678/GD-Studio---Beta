import React, { useEffect, useMemo, useState } from 'react';
import { EncodingMode, GDLevel } from '../types/gd';
import {
  LevelFileFormat,
  buildGmdXml,
  decodeLevelData,
  encodeLevelData,
  serializeLevelString,
} from '../utils/gdCodec';
import {
  Check,
  Copy,
  Download,
  FileCode2,
  KeyRound,
  Lock,
  Upload,
  X,
} from 'lucide-react';

interface CodecModalProps {
  open: boolean;
  initialTab: 'export' | 'import';
  level: GDLevel;
  onClose: () => void;
  onImportLevel: (imported: GDLevel) => void;
}

const ENCODING_OPTIONS: {
  id: EncodingMode;
  title: string;
  subtitle: string;
}[] = [
  {
    id: 'gzip-b64',
    title: 'GZip + Base64 URL-Safe (Chuẩn GD / .gmd)',
    subtitle: 'Nén chuẩn RobTop (H4sI...) tương thích trực tiếp GDShare & Geometry Dash.',
  },
  {
    id: 'xor11-gzip-b64',
    title: 'XOR-11 + GZip + Base64 (Mã hóa Save GD)',
    subtitle: 'Áp dụng phép XOR byte 11 giống file lưu cục bộ CCLocalLevels của game.',
  },
  {
    id: 'aes-gcm',
    title: 'AES-256-GCM + Mật khẩu (Bảo mật cao)',
    subtitle: 'Mã hóa đối xứng PBKDF2 + AES-GCM 256-bit bằng mật khẩu riêng.',
  },
  {
    id: 'raw',
    title: 'Chuỗi thô không nén (Plaintext)',
    subtitle: 'Hiển thị toàn bộ cặp khóa-giá trị RobTop để kiểm tra hoặc sửa tay.',
  },
];

export const CodecModal: React.FC<CodecModalProps> = ({
  open,
  initialTab,
  level,
  onClose,
  onImportLevel,
}) => {
  const [tab, setTab] = useState<'export' | 'import'>(initialTab);
  const [fileFormat, setFileFormat] = useState<LevelFileFormat>('gdlvl');
  const [mode, setMode] = useState<EncodingMode>('gzip-b64');
  const [password, setPassword] = useState('');
  const [encodedData, setEncodedData] = useState('');
  const [encodeError, setEncodeError] = useState('');
  const [copiedType, setCopiedType] = useState<'k4' | 'xml' | null>(null);

  // Import state
  const [importText, setImportText] = useState('');
  const [importPassword, setImportPassword] = useState('');
  const [importError, setImportError] = useState('');
  const [importPreview, setImportPreview] = useState<{
    detectedMode: EncodingMode;
    rawString: string;
    level: GDLevel;
  } | null>(null);

  useEffect(() => {
    if (open) {
      setTab(initialTab);
      setImportError('');
      setEncodeError('');
    }
  }, [open, initialTab]);

  const rawLevelString = useMemo(() => serializeLevelString(level), [level]);

  useEffect(() => {
    if (!open || tab !== 'export') return;
    let cancelled = false;

    (async () => {
      try {
        setEncodeError('');
        const out = await encodeLevelData(rawLevelString, mode, password);
        if (!cancelled) setEncodedData(out);
      } catch (err) {
        if (!cancelled) {
          setEncodedData('');
          setEncodeError(err instanceof Error ? err.message : 'Lỗi mã hóa dữ liệu.');
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [open, tab, rawLevelString, mode, password]);

  const gmdXml = useMemo(() => {
    if (!encodedData) return '';
    return buildGmdXml(level, encodedData, fileFormat);
  }, [level, encodedData, fileFormat]);

  if (!open) return null;

  const rawBytes = new TextEncoder().encode(rawLevelString).length;
  const encodedBytes = new TextEncoder().encode(encodedData).length;
  const ratio = rawBytes > 0 && encodedBytes > 0 ? Math.round((encodedBytes / rawBytes) * 100) : 100;

  const handleCopy = async (text: string, type: 'k4' | 'xml') => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedType(type);
      setTimeout(() => setCopiedType(null), 1800);
    } catch {
      // ignore clipboard errors
    }
  };

  const handleDownloadFile = (targetFormat: LevelFileFormat) => {
    if (!encodedData) return;
    const xmlContent = buildGmdXml(level, encodedData, targetFormat);
    const safeName = (level.meta.name || 'level')
      .replace(/[^a-zA-Z0-9_\-\s]/g, '')
      .trim()
      .replace(/\s+/g, '_') || 'gd_level';
    const blob = new Blob([xmlContent], { type: 'application/xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${safeName}.${targetFormat}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleDownloadRaw = () => {
    if (!encodedData) return;
    const safeName = (level.meta.name || 'level')
      .replace(/[^a-zA-Z0-9_\-\s]/g, '')
      .trim()
      .replace(/\s+/g, '_') || 'gd_level';
    const blob = new Blob([encodedData], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${safeName}_${mode}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    setImportText(text);
    setImportError('');
    setImportPreview(null);
    try {
      const res = await decodeLevelData(text, importPassword);
      setImportPreview(res);
    } catch (err) {
      setImportError(err instanceof Error ? err.message : 'Không thể đọc file.');
    }
  };

  const handleDecodeClick = async () => {
    setImportError('');
    setImportPreview(null);
    try {
      const res = await decodeLevelData(importText, importPassword);
      setImportPreview(res);
    } catch (err) {
      setImportError(err instanceof Error ? err.message : 'Giải mã thất bại.');
    }
  };

  const handleApplyImport = () => {
    if (!importPreview) return;
    onImportLevel(importPreview.level);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4">
      <div className="bg-[#0F1522] border border-white/15 rounded-xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1 bg-slate-900 border border-white/10 rounded-lg p-0.5">
                <button
                type="button"
                onClick={() => setTab('export')}
                className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors whitespace-nowrap ${
                  tab === 'export'
                    ? 'bg-cyan-400 text-slate-950'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                Mã hóa & Xuất (.gdlvl / .gmd)
              </button>
              <button
                type="button"
                onClick={() => setTab('import')}
                className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors whitespace-nowrap ${
                  tab === 'import'
                    ? 'bg-amber-400 text-slate-950'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                Nhập & Giải mã (.gdlvl / .gmd / Chuỗi)
              </button>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Đóng"
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5">
          {tab === 'export' ? (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
              {/* Left: File format & Encoding method selection */}
              <div className="lg:col-span-5 flex flex-col gap-3">
                <h3 className="text-xs font-semibold text-slate-300">
                  Định dạng file xuất
                </h3>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setFileFormat('gdlvl')}
                    className={`text-left p-2.5 rounded-lg border transition-colors ${
                      fileFormat === 'gdlvl'
                        ? 'bg-emerald-500/12 border-emerald-400 text-white'
                        : 'bg-slate-900/70 border-white/10 text-slate-300 hover:border-white/25'
                    }`}
                  >
                    <div className="text-xs font-bold font-mono">.gdlvl</div>
                    <div className="text-[11px] text-emerald-300 font-medium mt-0.5">
                      Recommended (in 2.2091)
                    </div>
                  </button>
                  <button
                    type="button"
                    onClick={() => setFileFormat('gmd')}
                    className={`text-left p-2.5 rounded-lg border transition-colors ${
                      fileFormat === 'gmd'
                        ? 'bg-cyan-500/12 border-cyan-400 text-white'
                        : 'bg-slate-900/70 border-white/10 text-slate-300 hover:border-white/25'
                    }`}
                  >
                    <div className="text-xs font-bold font-mono">.gmd</div>
                    <div className="text-[11px] text-cyan-300 font-medium mt-0.5">
                      For GDShare
                    </div>
                  </button>
                </div>

                <h3 className="text-xs font-semibold text-slate-300 pt-1">
                  Chọn phương thức mã hóa dữ liệu level (k4)
                </h3>
                <div className="flex flex-col gap-2">
                  {ENCODING_OPTIONS.map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => setMode(opt.id)}
                      className={`text-left p-3 rounded-lg border transition-colors ${
                        mode === opt.id
                          ? 'bg-cyan-500/12 border-cyan-400 text-white'
                          : 'bg-slate-900/70 border-white/10 text-slate-300 hover:border-white/25'
                      }`}
                    >
                      <div className="text-xs font-semibold">{opt.title}</div>
                      <div className="text-[11px] text-slate-400 mt-1 leading-relaxed">
                        {opt.subtitle}
                      </div>
                    </button>
                  ))}
                </div>

                {mode === 'aes-gcm' && (
                  <label className="flex flex-col gap-1.5 text-xs text-slate-300 bg-slate-900 border border-cyan-500/30 rounded-lg p-3">
                    <span className="flex items-center gap-1.5 font-medium text-cyan-300">
                      <Lock className="w-3.5 h-3.5" />
                      Mật khẩu khóa dữ liệu AES-256-GCM
                    </span>
                    <input
                      type="password"
                      placeholder="Nhập mật khẩu bất kỳ..."
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="bg-slate-950 border border-white/15 rounded-md px-3 py-1.5 text-sm text-white focus:border-cyan-400 focus:outline-none"
                    />
                  </label>
                )}

                {/* Compression Metrics */}
                <div className="bg-slate-900/80 border border-white/10 rounded-lg p-3 flex items-center justify-between text-xs">
                  <div>
                    <div className="text-slate-400">Dữ liệu gốc</div>
                    <div className="font-mono-tabular text-sm font-semibold text-white">
                      {rawBytes.toLocaleString()} bytes
                    </div>
                  </div>
                  <div className="text-slate-600">→</div>
                  <div>
                    <div className="text-slate-400">Sau mã hóa</div>
                    <div className="font-mono-tabular text-sm font-semibold text-cyan-300">
                      {encodedBytes.toLocaleString()} bytes
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-slate-400">Tỉ lệ</div>
                    <div className="font-mono-tabular text-sm font-semibold text-emerald-400">
                      {ratio}%
                    </div>
                  </div>
                </div>
              </div>

              {/* Right: Preview & Download */}
              <div className="lg:col-span-7 flex flex-col gap-4">
                {encodeError && (
                  <div className="p-3 rounded-lg bg-rose-500/15 border border-rose-500/40 text-xs text-rose-200">
                    {encodeError}
                  </div>
                )}

                <div className="flex flex-col gap-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-slate-300">
                      Chuỗi dữ liệu level đã mã hóa (k4)
                    </span>
                    <button
                      type="button"
                      disabled={!encodedData}
                      onClick={() => handleCopy(encodedData, 'k4')}
                      className="flex items-center gap-1 text-xs text-cyan-300 hover:text-cyan-200 disabled:opacity-40"
                    >
                      {copiedType === 'k4' ? (
                        <>
                          <Check className="w-3.5 h-3.5" /> Đã sao chép
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5" /> Sao chép chuỗi
                        </>
                      )}
                    </button>
                  </div>
                  <textarea
                    readOnly
                    rows={4}
                    value={encodedData}
                    className="w-full bg-slate-950 border border-white/10 rounded-lg p-3 text-xs font-mono text-cyan-200/90 focus:outline-none resize-none"
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-slate-300">
                      Cấu trúc file .{fileFormat} (XML Plist)
                    </span>
                    <button
                      type="button"
                      disabled={!gmdXml}
                      onClick={() => handleCopy(gmdXml, 'xml')}
                      className="flex items-center gap-1 text-xs text-slate-300 hover:text-white disabled:opacity-40"
                    >
                      {copiedType === 'xml' ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-emerald-400" /> Đã sao chép
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5" /> Sao chép XML
                        </>
                      )}
                    </button>
                  </div>
                  <textarea
                    readOnly
                    rows={7}
                    value={gmdXml}
                    className="w-full bg-slate-950 border border-white/10 rounded-lg p-3 text-[11px] font-mono text-slate-300 focus:outline-none resize-none"
                  />
                </div>

                <div className="flex flex-wrap items-center justify-end gap-2 pt-1">
                  <button
                    type="button"
                    disabled={!encodedData}
                    onClick={handleDownloadRaw}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium transition-colors disabled:opacity-40 whitespace-nowrap"
                  >
                    <FileCode2 className="w-4 h-4" />
                    Tải chuỗi (.txt)
                  </button>
                  <button
                    type="button"
                    disabled={!encodedData}
                    onClick={() => handleDownloadFile('gmd')}
                    className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-cyan-500/20 hover:bg-cyan-500/30 border border-cyan-400/50 text-cyan-200 text-xs font-semibold transition-colors disabled:opacity-40 whitespace-nowrap"
                  >
                    <Download className="w-4 h-4" />
                    Xuất .gmd (For GDShare)
                  </button>
                  <button
                    type="button"
                    disabled={!encodedData}
                    onClick={() => handleDownloadFile('gdlvl')}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-semibold transition-colors disabled:opacity-40 whitespace-nowrap"
                  >
                    <Download className="w-4 h-4" />
                    Xuất .gdlvl (Recommended in 2.2091)
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-900/70 border border-white/10 rounded-lg p-3.5">
                <div>
                  <h3 className="text-sm font-semibold text-white">
                    Mở file .gdlvl / .gmd hoặc dán chuỗi dữ liệu level
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Tự động nhận diện định dạng .gdlvl, .gmd XML, GZip+Base64 (H4sI...), XOR-11, AES-256-GCM hoặc chuỗi thô.
                  </p>
                </div>
                <label className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-amber-400 hover:bg-amber-300 text-slate-950 text-xs font-semibold cursor-pointer transition-colors">
                  <Upload className="w-4 h-4" />
                  Chọn file .gdlvl / .gmd
                  <input
                    type="file"
                    accept=".gdlvl,.gmd,.gmd2,.txt,.xml"
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                </label>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
                <div className="md:col-span-8">
                  <textarea
                    rows={6}
                    placeholder="Dán nội dung file .gdlvl / .gmd hoặc chuỗi H4sI... / XOR11:... / GDVAULT1:... / kS38,... vào đây"
                    value={importText}
                    onChange={(e) => setImportText(e.target.value)}
                    className="w-full bg-slate-950 border border-white/10 rounded-lg p-3 text-xs font-mono text-slate-200 focus:border-amber-400 focus:outline-none resize-none"
                  />
                </div>
                <div className="md:col-span-4 flex flex-col justify-between gap-3 bg-slate-900/60 border border-white/10 rounded-lg p-3">
                  <label className="flex flex-col gap-1.5 text-xs text-slate-300">
                    <span className="flex items-center gap-1.5 font-medium">
                      <KeyRound className="w-3.5 h-3.5 text-amber-400" />
                      Mật khẩu (nếu dùng AES-256)
                    </span>
                    <input
                      type="password"
                      placeholder="Bỏ trống nếu không khóa"
                      value={importPassword}
                      onChange={(e) => setImportPassword(e.target.value)}
                      className="bg-slate-950 border border-white/10 rounded-md px-2.5 py-1.5 text-xs text-white focus:border-amber-400 focus:outline-none"
                    />
                  </label>

                  <button
                    type="button"
                    onClick={handleDecodeClick}
                    className="w-full py-2 rounded-lg bg-slate-800 hover:bg-slate-700 border border-white/10 text-xs font-semibold text-white transition-colors"
                  >
                    Phân tích & Giải mã
                  </button>
                </div>
              </div>

              {importError && (
                <div className="p-3 rounded-lg bg-rose-500/15 border border-rose-500/40 text-xs text-rose-200">
                  {importError}
                </div>
              )}

              {importPreview && (
                <div className="bg-emerald-500/10 border border-emerald-500/35 rounded-lg p-4 flex flex-col gap-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <div className="text-xs text-emerald-400 font-medium">
                        Giải mã thành công · Định dạng: {importPreview.detectedMode}
                      </div>
                      <div className="text-base font-bold text-white mt-0.5">
                        {importPreview.level.meta.name} — {importPreview.level.objects.length} đối tượng
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={handleApplyImport}
                      className="px-4 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-semibold transition-colors"
                    >
                      Nạp vào trình chỉnh sửa
                    </button>
                  </div>
                  <pre className="bg-slate-950/90 border border-white/10 rounded-md p-2.5 text-[11px] font-mono text-slate-300 max-h-28 overflow-auto">
                    {importPreview.rawString.slice(0, 600)}
                    {importPreview.rawString.length > 600 ? '...' : ''}
                  </pre>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
