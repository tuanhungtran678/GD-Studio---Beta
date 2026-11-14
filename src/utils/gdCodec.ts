import { gzip, ungzip } from 'pako';
import { EncodingMode, GDLevel, GDLevelMeta, GDObject, GamemodeId, SpeedId } from '../types/gd';
import { nextUid, SPEED_UNITS_PER_SEC } from '../data/gdCatalog';

// --- Color Helpers ---

export function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const clean = hex.replace('#', '').trim();
  if (clean.length === 3) {
    const r = parseInt(clean[0] + clean[0], 16);
    const g = parseInt(clean[1] + clean[1], 16);
    const b = parseInt(clean[2] + clean[2], 16);
    return { r: isNaN(r) ? 30 : r, g: isNaN(g) ? 58 : g, b: isNaN(b) ? 138 : b };
  }
  const r = parseInt(clean.slice(0, 2), 16);
  const g = parseInt(clean.slice(2, 4), 16);
  const b = parseInt(clean.slice(4, 6), 16);
  return {
    r: isNaN(r) ? 30 : r,
    g: isNaN(g) ? 58 : g,
    b: isNaN(b) ? 138 : b,
  };
}

export function rgbToHex(r: number, g: number, b: number): string {
  const clamp = (n: number) => Math.max(0, Math.min(255, Math.round(n || 0)));
  return (
    '#' +
    [clamp(r), clamp(g), clamp(b)]
      .map((c) => c.toString(16).padStart(2, '0'))
      .join('')
  );
}

// --- Base64 & XOR Helpers ---

function uint8ToBase64(bytes: Uint8Array, urlSafe = true): string {
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  const b64 = btoa(binary);
  return urlSafe ? b64.replace(/\+/g, '-').replace(/\//g, '_') : b64;
}

function base64ToUint8(b64: string): Uint8Array {
  let normalized = b64.trim().replace(/-/g, '+').replace(/_/g, '/');
  while (normalized.length % 4 !== 0) {
    normalized += '=';
  }
  const binary = atob(normalized);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    out[i] = binary.charCodeAt(i);
  }
  return out;
}

function utf8Encode(str: string): Uint8Array {
  return new TextEncoder().encode(str);
}

function utf8Decode(bytes: Uint8Array): string {
  return new TextDecoder('utf-8', { fatal: false }).decode(bytes);
}

function xorBytes(bytes: Uint8Array, key = 11): Uint8Array {
  const out = new Uint8Array(bytes.length);
  for (let i = 0; i < bytes.length; i++) {
    out[i] = bytes[i] ^ key;
  }
  return out;
}

// --- Level String Serialization (RobTop Inner Format) ---

function buildColorChannelString(channelId: number, hex: string): string {
  const { r, g, b } = hexToRgb(hex);
  // RobTop 2.1/2.2 kS38 format: 1_R_2_G_3_B_11_255_12_255_13_255_4_-1_6_ChannelID_7_1_15_1_18_0_8_1
  return `1_${r}_2_${g}_3_${b}_11_255_12_255_13_255_4_-1_6_${channelId}_7_1_15_1_18_0_8_1`;
}

export function serializeLevelString(level: GDLevel): string {
  const { meta, objects } = level;

  const colorChannels = [
    buildColorChannelString(1000, meta.bgColor),     // BG
    buildColorChannelString(1001, meta.groundColor), // Ground
    buildColorChannelString(1002, meta.lineColor),   // Line
    buildColorChannelString(1003, meta.bgColor),     // 3DL
    buildColorChannelString(1004, meta.objColor),    // Obj
    buildColorChannelString(1, '#38bdf8'),
    buildColorChannelString(2, '#f472b6'),
    buildColorChannelString(3, '#facc15'),
  ].join('|');

  const headerPairs: [string, string | number][] = [
    ['kS38', `${colorChannels}|`],
    ['kA13', 0],
    ['kA15', 0],
    ['kA16', 0],
    ['kA14', ''],
    ['kA6', meta.bgTexture || 1],
    ['kA7', meta.groundTexture || 1],
    ['kA17', 1],
    ['kA18', 0],
    ['kS39', 0],
    ['kA2', meta.startMode],
    ['kA3', meta.miniMode ? 1 : 0],
    ['kA8', 0],
    ['kA4', meta.startSpeed],
    ['kA9', 0],
    ['kA10', 0],
    ['kA11', meta.flipGravity ? 1 : 0],
  ];

  const headerStr = headerPairs.map(([k, v]) => `${k},${v}`).join(',');

  const objectStrs = objects.map((obj) => {
    const pairs: [string, string | number][] = [
      ['1', obj.id],
      ['2', Math.round(obj.x * 100) / 100],
      ['3', Math.round(obj.y * 100) / 100],
    ];

    if (obj.flipX) pairs.push(['4', 1]);
    if (obj.flipY) pairs.push(['5', 1]);
    if (obj.rotation && obj.rotation !== 0) pairs.push(['6', obj.rotation]);
    if (obj.layer && obj.layer !== 0) pairs.push(['20', obj.layer]);
    if (obj.colorId && obj.colorId > 0) pairs.push(['21', obj.colorId]);
    if (obj.detailColorId && obj.detailColorId > 0) pairs.push(['22', obj.detailColorId]);
    if (obj.scale !== undefined && obj.scale !== 1) pairs.push(['32', obj.scale]);
    if (obj.groups && obj.groups.length > 0) pairs.push(['57', obj.groups.join('.')]);

    // Triggers
    if (obj.id === 899) {
      if (obj.r !== undefined) pairs.push(['7', obj.r]);
      if (obj.g !== undefined) pairs.push(['8', obj.g]);
      if (obj.b !== undefined) pairs.push(['9', obj.b]);
      if (obj.duration !== undefined) pairs.push(['10', obj.duration]);
      if (obj.targetColorId !== undefined) pairs.push(['23', obj.targetColorId]);
      pairs.push(['36', 1]); // trigger flag
    } else if (obj.id === 901) {
      if (obj.moveX !== undefined) pairs.push(['28', obj.moveX]);
      if (obj.moveY !== undefined) pairs.push(['29', obj.moveY]);
      if (obj.duration !== undefined) pairs.push(['10', obj.duration]);
      if (obj.targetGroup !== undefined) pairs.push(['51', obj.targetGroup]);
      pairs.push(['36', 1]);
    } else if (obj.id === 1007) {
      if (obj.opacity !== undefined) pairs.push(['35', obj.opacity]);
      if (obj.duration !== undefined) pairs.push(['10', obj.duration]);
      if (obj.targetGroup !== undefined) pairs.push(['51', obj.targetGroup]);
      pairs.push(['36', 1]);
    }

    if (obj.extraRaw) {
      const existingKeys = new Set(pairs.map(([k]) => k));
      for (const [k, v] of Object.entries(obj.extraRaw)) {
        if (!existingKeys.has(k)) {
          pairs.push([k, v]);
        }
      }
    }

    return pairs.map(([k, v]) => `${k},${v}`).join(',');
  });

  if (objectStrs.length === 0) {
    return `${headerStr};`;
  }
  return `${headerStr};${objectStrs.join(';')};`;
}

// --- Level String Parsing ---

function parseColorChannels(kS38: string): Partial<GDLevelMeta> {
  const result: Partial<GDLevelMeta> = {};
  const channels = kS38.split('|').filter(Boolean);
  for (const ch of channels) {
    const parts = ch.split('_');
    const map: Record<string, string> = {};
    for (let i = 0; i + 1 < parts.length; i += 2) {
      map[parts[i]] = parts[i + 1];
    }
    const chId = Number(map['6']);
    const r = Number(map['1']);
    const g = Number(map['2']);
    const b = Number(map['3']);
    if (!isNaN(r) && !isNaN(g) && !isNaN(b)) {
      const hex = rgbToHex(r, g, b);
      if (chId === 1000) result.bgColor = hex;
      else if (chId === 1001) result.groundColor = hex;
      else if (chId === 1002) result.lineColor = hex;
      else if (chId === 1004) result.objColor = hex;
    }
  }
  return result;
}

export function parseLevelString(
  raw: string,
  metaOverrides?: Partial<GDLevelMeta>
): GDLevel {
  const segments = raw.split(';').filter((s) => s.trim().length > 0);

  const meta: GDLevelMeta = {
    name: metaOverrides?.name || 'Imported Level',
    author: metaOverrides?.author || 'GD Player',
    description: metaOverrides?.description || 'Imported into GD Studio',
    officialSongId: metaOverrides?.officialSongId ?? 0,
    customSongId: metaOverrides?.customSongId ?? 0,
    startMode: 0,
    startSpeed: 0,
    miniMode: false,
    flipGravity: false,
    bgColor: '#0f2557',
    groundColor: '#091638',
    lineColor: '#38bdf8',
    objColor: '#ffffff',
    bgTexture: 1,
    groundTexture: 1,
  };

  const objects: GDObject[] = [];
  let startIdx = 0;

  if (segments.length > 0 && (segments[0].includes('kA') || segments[0].includes('kS'))) {
    const headerParts = segments[0].split(',');
    for (let i = 0; i + 1 < headerParts.length; i += 2) {
      const k = headerParts[i];
      const v = headerParts[i + 1];
      if (k === 'kS38') {
        Object.assign(meta, parseColorChannels(v));
      } else if (k === 'kA2') {
        const mode = Number(v);
        if (mode >= 0 && mode <= 6) meta.startMode = mode as GamemodeId;
      } else if (k === 'kA3') {
        meta.miniMode = v === '1';
      } else if (k === 'kA4') {
        const spd = Number(v);
        if (spd >= 0 && spd <= 4) meta.startSpeed = spd as SpeedId;
      } else if (k === 'kA6') {
        meta.bgTexture = Number(v) || 1;
      } else if (k === 'kA7') {
        meta.groundTexture = Number(v) || 1;
      } else if (k === 'kA11') {
        meta.flipGravity = v === '1';
      }
    }
    startIdx = 1;
  }

  for (let s = startIdx; s < segments.length; s++) {
    const parts = segments[s].split(',');
    const kv: Record<string, string> = {};
    for (let i = 0; i + 1 < parts.length; i += 2) {
      kv[parts[i]] = parts[i + 1];
    }
    const id = Number(kv['1']);
    const x = Number(kv['2']);
    const y = Number(kv['3']);
    if (isNaN(id) || isNaN(x) || isNaN(y)) continue;

    const knownKeys = new Set([
      '1', '2', '3', '4', '5', '6', '7', '8', '9', '10',
      '20', '21', '22', '23', '28', '29', '32', '35', '51', '57',
    ]);
    const extraRaw: Record<string, string> = {};
    for (const [k, v] of Object.entries(kv)) {
      if (!knownKeys.has(k)) extraRaw[k] = v;
    }

    const obj: GDObject = {
      uid: nextUid(),
      id,
      x,
      y,
      flipX: kv['4'] === '1',
      flipY: kv['5'] === '1',
      rotation: kv['6'] ? Number(kv['6']) : undefined,
      layer: kv['20'] ? Number(kv['20']) : undefined,
      colorId: kv['21'] ? Number(kv['21']) : undefined,
      detailColorId: kv['22'] ? Number(kv['22']) : undefined,
      scale: kv['32'] ? Number(kv['32']) : undefined,
      groups: kv['57']
        ? kv['57'].split('.').map(Number).filter((n) => !isNaN(n))
        : undefined,
      r: kv['7'] !== undefined ? Number(kv['7']) : undefined,
      g: kv['8'] !== undefined ? Number(kv['8']) : undefined,
      b: kv['9'] !== undefined ? Number(kv['9']) : undefined,
      duration: kv['10'] !== undefined ? Number(kv['10']) : undefined,
      targetColorId: kv['23'] !== undefined ? Number(kv['23']) : undefined,
      moveX: kv['28'] !== undefined ? Number(kv['28']) : undefined,
      moveY: kv['29'] !== undefined ? Number(kv['29']) : undefined,
      targetGroup: kv['51'] !== undefined ? Number(kv['51']) : undefined,
      opacity: kv['35'] !== undefined ? Number(kv['35']) : undefined,
      extraRaw: Object.keys(extraRaw).length > 0 ? extraRaw : undefined,
    };
    objects.push(obj);
  }

  return { meta, objects };
}

// --- AES-256-GCM Password Encryption (Web Crypto API) ---

async function deriveAesKey(password: string, salt: Uint8Array): Promise<CryptoKey> {
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    utf8Encode(password) as BufferSource,
    { name: 'PBKDF2' },
    false,
    ['deriveKey']
  );
  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: salt as BufferSource,
      iterations: 100000,
      hash: 'SHA-256',
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

async function encryptAesGcm(plaintext: string, password: string): Promise<string> {
  if (!password) {
    throw new Error('Vui lòng nhập mật khẩu để mã hóa AES-256-GCM.');
  }
  const compressed = gzip(utf8Encode(plaintext));
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveAesKey(password, salt);
  const cipherBuf = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: iv as BufferSource },
    key,
    compressed as BufferSource
  );
  const cipherBytes = new Uint8Array(cipherBuf);
  const combined = new Uint8Array(salt.length + iv.length + cipherBytes.length);
  combined.set(salt, 0);
  combined.set(iv, salt.length);
  combined.set(cipherBytes, salt.length + iv.length);
  return `GDVAULT1:${uint8ToBase64(combined, true)}`;
}

async function decryptAesGcm(payload: string, password: string): Promise<string> {
  if (!password) {
    throw new Error('Dữ liệu được khóa bằng AES-256-GCM. Vui lòng nhập mật khẩu giải mã.');
  }
  const b64 = payload.replace(/^GDVAULT1:/, '').trim();
  const combined = base64ToUint8(b64);
  if (combined.length < 29) {
    throw new Error('Dữ liệu AES-256-GCM không hợp lệ.');
  }
  const salt = combined.slice(0, 16);
  const iv = combined.slice(16, 28);
  const cipherBytes = combined.slice(28);
  const key = await deriveAesKey(password, salt);
  try {
    const plainBuf = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: iv as BufferSource },
      key,
      cipherBytes as BufferSource
    );
    const decompressed = ungzip(new Uint8Array(plainBuf));
    return utf8Decode(decompressed);
  } catch {
    throw new Error('Sai mật khẩu hoặc dữ liệu AES-256-GCM bị hỏng.');
  }
}

// --- Public Codec API ---

export async function encodeLevelData(
  rawLevelString: string,
  mode: EncodingMode,
  password = ''
): Promise<string> {
  if (mode === 'raw') {
    return rawLevelString;
  }
  if (mode === 'gzip-b64') {
    const gz = gzip(utf8Encode(rawLevelString));
    return uint8ToBase64(gz, true);
  }
  if (mode === 'xor11-gzip-b64') {
    // Authentic GD save-style XOR-11 over gzipped+base64 payload, or XOR-11 on gzip bytes
    // Standard RobTop CCLocalLevels applies: gzip -> urlsafe base64 -> XOR 11 (or reverse for decode)
    const gz = gzip(utf8Encode(rawLevelString));
    const b64 = uint8ToBase64(gz, true);
    const xored = xorBytes(utf8Encode(b64), 11);
    return `XOR11:${uint8ToBase64(xored, true)}`;
  }
  if (mode === 'aes-gcm') {
    return encryptAesGcm(rawLevelString, password);
  }
  return rawLevelString;
}

export interface DecodedLevelResult {
  rawString: string;
  detectedMode: EncodingMode;
  level: GDLevel;
}

function tryUngzipFromBase64(b64: string): string | null {
  try {
    const bytes = base64ToUint8(b64);
    const decompressed = ungzip(bytes);
    return utf8Decode(decompressed);
  } catch {
    return null;
  }
}

export async function decodeLevelData(
  input: string,
  password = ''
): Promise<DecodedLevelResult> {
  const trimmed = input.trim();
  if (!trimmed) {
    throw new Error('Vui lòng nhập chuỗi dữ liệu hoặc chọn file .gmd.');
  }

  // 1. Check if full .gmd XML plist
  if (trimmed.startsWith('<?xml') || trimmed.includes('<plist') || trimmed.includes('<k>k4</k>')) {
    return parseGmdXml(trimmed, password);
  }

  // 2. AES-256-GCM Vault
  if (trimmed.startsWith('GDVAULT1:')) {
    const rawString = await decryptAesGcm(trimmed, password);
    return {
      rawString,
      detectedMode: 'aes-gcm',
      level: parseLevelString(rawString),
    };
  }

  // 3. Explicit XOR-11 prefix
  if (trimmed.startsWith('XOR11:')) {
    const innerB64 = trimmed.slice(6).trim();
    const xoredBytes = base64ToUint8(innerB64);
    const unxoredStr = utf8Decode(xorBytes(xoredBytes, 11));
    const gunzipped = tryUngzipFromBase64(unxoredStr);
    if (gunzipped) {
      return {
        rawString: gunzipped,
        detectedMode: 'xor11-gzip-b64',
        level: parseLevelString(gunzipped),
      };
    }
    throw new Error('Không thể giải mã chuỗi XOR-11.');
  }

  // 4. Raw RobTop level string
  if (trimmed.startsWith('kS') || trimmed.startsWith('kA') || /^\d+,\d+/.test(trimmed)) {
    return {
      rawString: trimmed,
      detectedMode: 'raw',
      level: parseLevelString(trimmed),
    };
  }

  // 5. Standard GZip + Base64 (either raw level string or compressed XML plist)
  const standardGunzip = tryUngzipFromBase64(trimmed);
  if (standardGunzip) {
    if (standardGunzip.includes('<plist') || standardGunzip.includes('<k>k4</k>')) {
      return parseGmdXml(standardGunzip, password);
    }
    if (standardGunzip.includes('kA') || standardGunzip.includes(';') || standardGunzip.includes(',')) {
      return {
        rawString: standardGunzip,
        detectedMode: 'gzip-b64',
        level: parseLevelString(standardGunzip),
      };
    }
  }

  // 6. Fallback: Raw RobTop CCLocalLevels XOR-11 (without prefix)
  try {
    const rawBytes = utf8Encode(trimmed);
    const unxoredB64 = utf8Decode(xorBytes(rawBytes, 11));
    const gunzipped = tryUngzipFromBase64(unxoredB64);
    if (gunzipped) {
      return {
        rawString: gunzipped,
        detectedMode: 'xor11-gzip-b64',
        level: parseLevelString(gunzipped),
      };
    }
  } catch {
    // ignore
  }

  throw new Error('Định dạng dữ liệu level không hợp lệ hoặc bị hỏng.');
}

// --- .gmd XML Plist Builder & Parser ---

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export function estimateLengthCategory(objects: GDObject[], startSpeed: SpeedId): number {
  if (objects.length === 0) return 0;
  const maxX = Math.max(...objects.map((o) => o.x));
  const secs = maxX / SPEED_UNITS_PER_SEC[startSpeed];
  if (secs < 10) return 0; // Tiny
  if (secs < 30) return 1; // Short
  if (secs < 60) return 2; // Medium
  if (secs < 120) return 3; // Long
  return 4; // XL
}

export type LevelFileFormat = 'gdlvl' | 'gmd';

export function buildGmdXml(
  level: GDLevel,
  encodedK4: string,
  format: LevelFileFormat = 'gmd'
): string {
  const { meta, objects } = level;
  const descBase64 = uint8ToBase64(utf8Encode(meta.description || ''), false);
  const lengthCat = estimateLengthCategory(objects, meta.startSpeed);
  const binaryVersion = format === 'gdlvl' ? 40 : 35;

  const customSongTag =
    meta.customSongId && meta.customSongId > 0
      ? `\n\t<k>k45</k><i>${Math.floor(meta.customSongId)}</i>`
      : '';

  return `<?xml version="1.0"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0" gjver="2.0">
<dict>
\t<k>kCEK</k><i>4</i>
\t<k>k2</k><s>${escapeXml(meta.name || 'Untitled Level')}</s>
\t<k>k3</k><s>${descBase64}</s>
\t<k>k4</k><s>${escapeXml(encodedK4)}</s>
\t<k>k5</k><s>${escapeXml(meta.author || 'Player')}</s>
\t<k>k8</k><i>${meta.officialSongId || 0}</i>${customSongTag}
\t<k>k13</k><t />
\t<k>k21</k><i>2</i>
\t<k>k16</k><i>1</i>
\t<k>k23</k><i>${lengthCat}</i>
\t<k>k50</k><i>${binaryVersion}</i>
\t<k>kI1</k><r>0</r>
\t<k>kI2</k><r>0</r>
\t<k>kI3</k><r>1</r>
</dict>
</plist>`;
}

export async function parseGmdXml(
  xmlText: string,
  password = ''
): Promise<DecodedLevelResult> {
  const parser = new DOMParser();
  const doc = parser.parseFromString(xmlText, 'application/xml');
  const dict = doc.querySelector('plist > dict') || doc.querySelector('dict');
  if (!dict) {
    throw new Error('File .gmd không đúng cấu trúc XML plist.');
  }

  const children = Array.from(dict.children);
  const values: Record<string, string> = {};
  for (let i = 0; i + 1 < children.length; i++) {
    const keyEl = children[i];
    if (keyEl.tagName === 'k' || keyEl.tagName === 'key') {
      const keyName = keyEl.textContent?.trim() || '';
      const valEl = children[i + 1];
      values[keyName] = valEl.textContent || '';
      i++;
    }
  }

  const k4 = values['k4'];
  if (!k4) {
    throw new Error('Không tìm thấy trường dữ liệu level (k4) trong file .gmd.');
  }

  const decoded = await decodeLevelData(k4, password);

  // Try decode base64 k3 description
  let desc = values['k3'] || '';
  if (desc) {
    try {
      const maybeDesc = utf8Decode(base64ToUint8(desc));
      if (maybeDesc && !/[\x00-\x08]/.test(maybeDesc)) {
        desc = maybeDesc;
      }
    } catch {
      // keep original if plain string
    }
  }

  decoded.level.meta = {
    ...decoded.level.meta,
    name: values['k2'] || decoded.level.meta.name,
    description: desc || decoded.level.meta.description,
    author: values['k5'] || decoded.level.meta.author,
    officialSongId: values['k8'] ? Number(values['k8']) : decoded.level.meta.officialSongId,
    customSongId: values['k45'] ? Number(values['k45']) : decoded.level.meta.customSongId,
  };

  return decoded;
}
