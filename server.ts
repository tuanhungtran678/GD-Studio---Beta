import 'dotenv/config';
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI, ThinkingLevel } from '@google/genai';
import {
  LevelBlueprint,
  compileBlueprintToLevel,
} from './src/utils/gdPatternCompiler.js';
import {
  evaluateLevelOnly,
  testAndFixGDLevel,
} from './src/utils/gdLevelTester.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = 3000;
const app = express();
app.use(express.json({ limit: '1mb' }));

const BLUEPRINT_SYSTEM_INSTRUCTION = `You are a master Geometry Dash level choreographer.
Output ONLY one valid JSON object (no markdown fences) with "meta" and "sections":
{
  "meta": {
    "name": "short title (2-4 words)",
    "description": "brief Vietnamese summary (<=10 words)",
    "officialSongId": 0..21,
    "startMode": 0..6,
    "startSpeed": 0..4,
    "bgColor": "#RRGGBB",
    "groundColor": "#RRGGBB",
    "lineColor": "#RRGGBB",
    "objColor": "#RRGGBB",
    "bgTexture": 1..6,
    "groundTexture": 1..4
  },
  "sections": [
    {
      "gamemode": 0..6,
      "pattern": "valid pattern below",
      "durationBeats": 4..12,
      "speed": 0..4,
      "elevation": "low"|"mid"|"high",
      "intensity": "low"|"medium"|"high",
      "hasCoin": true|false,
      "hasMovePlatform": true|false,
      "colorShiftHex": "#RRGGBB",
      "note": "2-4 Vietnamese words"
    }
  ]
}
Modes: 0=Cube,1=Ship,2=Ball,3=UFO,4=Wave,5=Robot,6=Spider. Speeds: 1=0.5x,0=1x,2=2x,3=3x,4=4x.
Patterns: 0:["cube_stair_orb","cube_pad_triple","cube_half_slab_rhythm","cube_timing_pillars","deco_rest_transition"], 1:["ship_saw_corridor","ship_pillar_weave"], 2:["ball_gravity_corridor","ball_orb_switch"], 3:["ufo_gate_pillars","ufo_gravity_arcs"], 4:["wave_tunnel_45","wave_diamond_pillars"], 5:["robot_micro_macro","robot_orb_climb"], 6:["spider_dual_chamber"].
Set hasCoin:true on 2-3 sections. Sequence Intro->Build->Drop->Finale.`;

// Rolling latency calibration (ms) per mode & length based on real measurements
const latencyHistory: Record<string, number[]> = {
  'fast:short': [3000],
  'fast:medium': [4500],
  'fast:long': [6000],
  'deep:short': [6500],
  'deep:medium': [8500],
  'deep:long': [11000],
};

function getEstimatedMs(thinkingMode: string, length: string): number {
  const key = `${thinkingMode === 'deep' ? 'deep' : 'fast'}:${
    length === 'short' || length === 'long' ? length : 'medium'
  }`;
  const arr = latencyHistory[key] || [2800];
  return Math.round(arr.reduce((a, b) => a + b, 0) / arr.length);
}

function recordLatencyMs(thinkingMode: string, length: string, ms: number) {
  const key = `${thinkingMode === 'deep' ? 'deep' : 'fast'}:${
    length === 'short' || length === 'long' ? length : 'medium'
  }`;
  const arr = latencyHistory[key] || [];
  arr.push(ms);
  if (arr.length > 8) arr.shift();
  latencyHistory[key] = arr;
}

function parseJsonObjectSafely(raw: string): LevelBlueprint {
  const cleaned = raw
    .trim()
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/```\s*$/i, '')
    .trim();
  const firstBrace = cleaned.indexOf('{');
  const lastBrace = cleaned.lastIndexOf('}');
  const slice =
    firstBrace !== -1 && lastBrace > firstBrace
      ? cleaned.slice(firstBrace, lastBrace + 1)
      : cleaned;
  return JSON.parse(slice) as LevelBlueprint;
}

app.get('/api/generate-level/estimate', (req, res) => {
  const thinkingMode = req.query.thinkingMode === 'deep' ? 'deep' : 'fast';
  const length =
    req.query.length === 'short' || req.query.length === 'long'
      ? req.query.length
      : 'medium';
  res.json({
    estimatedMs: getEstimatedMs(thinkingMode, length),
  });
});

app.post('/api/generate-level', async (req, res) => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    res.status(500).json({
      error: 'Chưa cấu hình GEMINI_API_KEY trên máy chủ. Vui lòng kiểm tra mục Secrets.',
    });
    return;
  }

  const {
    prompt,
    length = 'medium',
    difficulty = 'normal',
    thinkingMode = 'fast',
    stream = true,
    spiceUp = false,
    recreateAttempt = 0,
    impossibleHint = '',
  } = req.body || {};

  if (!prompt || typeof prompt !== 'string' || !prompt.trim()) {
    res.status(400).json({ error: 'Vui lòng nhập mô tả level (prompt).' });
    return;
  }

  const sectionCountHint =
    length === 'short'
      ? '4 to 5 tightly paced sections'
      : length === 'long'
      ? '9 to 11 rich varied sections'
      : '6 to 8 well-paced sections';

  const difficultyHint =
    difficulty === 'easy'
      ? 'Easy/Normal (2-3 stars): low/medium intensity, generous flow, accessible timings.'
      : difficulty === 'hard'
      ? 'Harder/Demon (7-10 stars): high intensity, fast speed shifts (2x-4x), crisp Wave/Ship/Spider sequences.'
      : 'Medium (4-6 stars): balanced progression from accessible opening to exciting drop.';

  const useSSE = stream !== false && req.headers.accept !== 'application/json';
  const startedAt = Date.now();
  const estimatedMs = getEstimatedMs(thinkingMode, length);
  let clientClosed = false;

  if (useSSE) {
    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders?.();
    res.on('close', () => {
      if (!res.writableEnded) {
        clientClosed = true;
      }
    });
  }

  const sendSse = (event: string, payload: unknown) => {
    if (!useSSE || clientClosed || res.writableEnded) return;
    res.write(`event: ${event}\ndata: ${JSON.stringify(payload)}\n\n`);
  };

  const ai = new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });

  const isDeep = thinkingMode === 'deep';
  const modelName = 'gemini-3.1-flash-lite';
  const thinkingLevel = isDeep ? ThinkingLevel.MEDIUM : ThinkingLevel.MINIMAL;

  const spiceInstruction = spiceUp
    ? `\nSPICE-UP REQUIREMENT: Maximize gameplay variety and excitement! Include at least 3 distinct gamemode transitions (Cube, Ship, Wave, Ball, UFO, Robot, Spider), dynamic speed portals (2x or 3x), rhythmic orbs and jump pads, varied obstacles, and vivid colorShiftHex triggers. Do NOT use deco_rest_transition or long empty stretches.`
    : '';

  const recreateInstruction =
    Number(recreateAttempt) > 0
      ? `\nCRITICAL RECREATION FIX (Attempt #${recreateAttempt}): The previous level failed live playtesting and was confirmed IMPOSSIBLE (${
          impossibleHint ? String(impossibleHint) : 'blocked path'
        }). Redesign ALL sections so every obstacle has generous clearance, reachable jumps, and 100% POSSIBLE progression.`
      : '';

  const userContents = `Prompt: "${prompt.trim()}"
Scope: ${sectionCountHint}.
Difficulty: ${difficultyHint}.${spiceInstruction}${recreateInstruction}
Design a cohesive, non-random Geometry Dash Choreography Blueprint tailored closely to this prompt.`;

  try {
    if (useSSE) {
      sendSse('status', {
        phase: 'connecting',
        estimatedMs,
        model: modelName,
        message: 'Đang thiết kế cấu trúc màn chơi...',
      });
    }

    const response = await ai.models.generateContent({
      model: modelName,
      contents: userContents,
      config: {
        systemInstruction: BLUEPRINT_SYSTEM_INSTRUCTION,
        thinkingConfig: { thinkingLevel },
        responseMimeType: 'application/json',
      },
    });

    if (useSSE && clientClosed) return;

    const cleanText = (response.text || '').trim();
    if (!cleanText) {
      throw new Error('AI không trả về dữ liệu.');
    }

    const blueprint = parseJsonObjectSafely(cleanText);
    const sectionsCount = Array.isArray(blueprint.sections) ? blueprint.sections.length : 1;

    if (useSSE) {
      sendSse('meta', {
        name: blueprint.meta?.name || 'AI Rhythm Stage',
        bgColor: blueprint.meta?.bgColor || '#0f2557',
        elapsedMs: Date.now() - startedAt,
      });
      sendSse('progress', {
        sectionsBuilt: sectionsCount,
        note: 'Đang biên dịch hình học chuẩn vật lý...',
        elapsedMs: Date.now() - startedAt,
      });
    }

    const compiledLevel = compileBlueprintToLevel(
      blueprint,
      prompt.trim(),
      difficulty === 'easy' || difficulty === 'hard' ? difficulty : 'normal'
    );

    if (useSSE) {
      sendSse('progress', {
        sectionsBuilt: sectionsCount,
        note:
          Number(recreateAttempt) > 0
            ? 'Đang kiểm tra lại đường đi khả thi trước khi nạp...'
            : 'Đang chuẩn bị trình tự chơi thử trong Editor...',
        elapsedMs: Date.now() - startedAt,
      });
    }

    let verifiedLevel = compiledLevel;
    let testReport;
    if (Number(recreateAttempt) > 0) {
      const fixed = testAndFixGDLevel(compiledLevel);
      verifiedLevel = fixed.level;
      testReport = fixed.report;
    } else {
      testReport = evaluateLevelOnly(compiledLevel);
    }

    const elapsedMs = Date.now() - startedAt;
    recordLatencyMs(thinkingMode, length, elapsedMs);

    if (useSSE) {
      sendSse('complete', {
        level: verifiedLevel,
        testReport,
        sectionsCount,
        elapsedMs,
        estimatedMs,
      });
      res.end();
      return;
    }

    res.json({
      level: verifiedLevel,
      testReport,
      sectionsCount,
      elapsedMs,
      estimatedMs,
    });
  } catch (err: unknown) {
    console.error('Gemini level generation error:', err);
    const msg = err instanceof Error ? err.message : 'Lỗi không xác định khi gọi AI.';
    let status = 500;
    let friendly = `Không thể tạo level: ${msg}`;
    if (msg.includes('API_KEY_INVALID') || msg.includes('PERMISSION_DENIED')) {
      status = 403;
      friendly =
        'API key không hợp lệ hoặc bị từ chối. Vui lòng kiểm tra GEMINI_API_KEY trong Settings > Secrets.';
    } else if (msg.includes('RESOURCE_EXHAUSTED') || msg.includes('429')) {
      status = 429;
      friendly = 'Đã chạm giới hạn lượt gọi AI. Vui lòng thử lại sau ít phút.';
    }

    if (useSSE) {
      sendSse('error', { error: friendly, status });
      res.end();
    } else {
      res.status(status).json({ error: friendly });
    }
  }
});

async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`GD Studio server running on http://localhost:${PORT}`);
  });
}

startServer();
