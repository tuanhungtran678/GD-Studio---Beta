export type GamemodeId = 0 | 1 | 2 | 3 | 4 | 5 | 6;
// 0: Cube, 1: Ship, 2: Ball, 3: UFO, 4: Wave, 5: Robot, 6: Spider

export type SpeedId = 0 | 1 | 2 | 3 | 4;
// 0: 1x (10.386 bl/s), 1: 0.5x (8.37), 2: 2x (12.91), 3: 3x (15.6), 4: 4x (19.2)

export type ObjectCategory =
  | 'blocks'
  | 'decorations'
  | 'hazards'
  | 'portals'
  | 'pads_orbs'
  | 'triggers_coins';

export type HitboxKind = 'solid' | 'hazard' | 'portal' | 'pad' | 'orb' | 'coin' | 'trigger' | 'none';

export type EditorTool = 'build' | 'swipe' | 'select' | 'delete' | 'pan';

export type EncodingMode = 'gzip-b64' | 'xor11-gzip-b64' | 'aes-gcm' | 'raw';

export interface GDObjectDef {
  id: number;
  name: string;
  category: ObjectCategory;
  hitbox: HitboxKind;
  width: number;  // in GD units (30 = 1 grid block)
  height: number; // in GD units
  accentColor: string;
  description: string;
  defaultProps?: Partial<GDObject>;
}

export interface GDObject {
  uid: string;
  id: number;       // GD Object ID (key 1)
  x: number;        // GD X in units (key 2), 15 = first column center
  y: number;        // GD Y in units (key 3), 15 = ground row 0 center
  flipX?: boolean;  // key 4
  flipY?: boolean;  // key 5
  rotation?: number;// key 6 (degrees, clockwise in GD)
  layer?: number;   // key 20
  colorId?: number; // key 21
  detailColorId?: number; // key 22
  scale?: number;   // key 32
  groups?: number[];// key 57 (e.g. [1, 2])
  // Trigger specific fields
  targetColorId?: number; // key 23 (Color trigger)
  r?: number;       // key 7
  g?: number;       // key 8
  b?: number;       // key 9
  duration?: number;// key 10
  moveX?: number;   // key 28 (Move trigger)
  moveY?: number;   // key 29 (Move trigger)
  targetGroup?: number; // key 51 (Move / Alpha trigger)
  opacity?: number; // key 35 (Alpha trigger, 0..1)
  // Extra preserved raw key-value pairs for round-trip fidelity
  extraRaw?: Record<string, string>;
}

export interface GDLevelMeta {
  name: string;
  author: string;
  description: string;
  officialSongId: number;
  customSongId: number;
  startMode: GamemodeId;
  startSpeed: SpeedId;
  miniMode: boolean;
  flipGravity: boolean;
  bgColor: string;     // hex e.g. #1e3a8a
  groundColor: string; // hex e.g. #172554
  lineColor: string;   // hex e.g. #ffffff
  objColor: string;    // hex e.g. #ffffff
  bgTexture: number;   // kA6
  groundTexture: number; // kA7
}

export interface GDLevel {
  meta: GDLevelMeta;
  objects: GDObject[];
}

export interface PlaytestStats {
  running: boolean;
  progress: number;    // 0..100
  attempt: number;
  gamemode: GamemodeId;
  speed: SpeedId;
  gravityInverted: boolean;
  coinsCollected: number;
  totalCoins: number;
  dead: boolean;
  completed: boolean;
}

export interface AITestReport {
  passed: boolean;
  repairsMade: number;
  repairNotes: string[];
  funScore: number;
  isBoring: boolean;
  boringReasons: string[];
  actionsPerSec: number;
  modeCount: number;
  longestFlatGap: number;
}
