export type AssetKind = 'tree' | 'stone' | 'character' | 'enemy' | 'building' | 'crystal' | 'object' | 'terrain';
export type Stage = 'sketch' | 'refine' | 'final';
export type TraitKey = 'palette' | 'form' | 'detail' | 'line' | 'motion';

export type Material =
  | 'foliage'
  | 'wood'
  | 'stone'
  | 'metal'
  | 'cloth'
  | 'skin'
  | 'accent'
  | 'bone'
  | 'gold';

export interface PaletteParams {
  hue: number;
  accentHue: number;
  foliageHue: number;
  chroma: number;
  contrast: number;
  warmth: number;
}

export interface Palette {
  ramps: Record<Material, string[]>;
  outline: string;
  shadow: string;
  accent: string;
}

export interface VoiceAxes {
  grounded: number;
  ornate: number;
  brutal: number;
  springy: number;
  vivid: number;
  gritty: number;
}

export interface StyleDNA {
  name: string;
  seed: number;
  prompt: string;
  paletteParams: PaletteParams;
  palette: Palette;
  voice: VoiceAxes;
  roundness: number;
  chunkiness: number;
  spikiness: number;
  asymmetry: number;
  detail: number;
  outline: number;
  dither: number;
  headScale: number;
  height: number;
  golden: number;
  bounce: number;
  weight: number;
  sway: number;
  referencePalette?: string[];
  paletteFidelity?: number;
  voiceOverride?: Partial<VoiceAxes>;
}

export type InspirationFeature = 'palette' | 'form' | 'finish' | 'line';
export type InspirationMode = 'palette' | 'form' | 'finish' | 'prompt';

export interface InspirationConfidence {
  palette: number;
  form: number;
  finish: number;
  line: number;
  voice: number;
}

export interface InspirationRead {
  palette: string[];
  paletteShares: number[];
  hue: number;
  accentHue: number;
  foliageHue: number;
  chroma: number;
  contrast: number;
  warmth: number;
  meanL: number;
  stdL: number;
  edgeDensity: number;
  detailEntropy: number;
  texture: number;
  flatness: number;
  angularity: number;
  symmetry: number;
  keywords: string[];
  confidence: InspirationConfidence;
  suggestedVoice: VoiceAxes;
}

export interface InspirationAsset {
  id: string;
  name: string;
  hash: string;
  width: number;
  height: number;
  thumbnail: string;
  preview: string;
  read: InspirationRead;
  weight: number;
  createdAt: number;
}

export interface CombinedInspirationRead extends InspirationRead {
  notes: string;
  sources: Array<{ id: string; name: string; weight: number; primary: boolean }>;
}

export interface VisionRead {
  provider: string;
  model: string;
  createdAt: number;
  theme: string;
  motifs: string[];
  materials: string[];
  mood: string;
  shapeLanguage: string;
  narrativeVoice: string;
  motionDescription: string;
  suggestedMotion: { weight: number; bounce: number; sway: number };
  voice: VoiceAxes;
  keywords: string[];
  antiGoals: string[];
  manifesto: string;
  confidence: number;
  accepted: boolean;
}

export interface InspirationSettings {
  influence: number;
  features: Record<InspirationFeature, boolean>;
  paletteFidelity: number;
  notes: string;
  includeInExport: boolean;
}

export interface DirectionInspiration {
  mode: InspirationMode;
  match: number;
  sourceIds: string[];
  sourceNames: string[];
}

export interface Direction {
  id: string;
  name: string;
  seed: number;
  dna: StyleDNA;
  manifesto: string;
  keywords: string[];
  antiGoals: string[];
  deltas: string[];
  inspiration?: DirectionInspiration;
  createdAt: number;
}

export interface PaletteBin {
  color: string;
  share: number;
}

export interface StyleSignature {
  version: 1;
  topColors: string[];
  paletteHistogram: number[];
  colorCount: number;
  meanL: number;
  stdL: number;
  edgeDensity: number;
  outlineRatio: number;
  isolatedRatio: number;
  detailEntropy: number;
  fillRatio: number;
  symmetry: number;
  silhouetteComplexity: number;
  dominantHue: number;
  visiblePixels: number;
}

export interface FitSubscores {
  palette: number;
  luminance: number;
  contrast: number;
  edge: number;
  detail: number;
  silhouette: number;
  outline: number;
  fill: number;
  symmetry: number;
  hue: number;
}

export interface FitResult {
  score: number;
  subscores: FitSubscores;
  candidate: StyleSignature;
  drift: boolean;
}

export interface FitTest {
  id: string;
  kind: AssetKind;
  seed: number;
  score: number;
  drift: boolean;
  createdAt: number;
}

export interface Anchor {
  id: string;
  name: string;
  directionId: string;
  directionName: string;
  kind: AssetKind;
  seed: number;
  dna: StyleDNA;
  signature: StyleSignature;
  createdAt: number;
  frames: number;
}

export type JourneyEventType =
  | 'project'
  | 'prompt'
  | 'select'
  | 'refine'
  | 'lock'
  | 'anchor'
  | 'test'
  | 'export'
  | 'reset'
  | 'inspiration';

export interface JourneyEvent {
  id: string;
  type: JourneyEventType;
  label: string;
  detail?: string;
  at: number;
  data?: unknown;
}

export interface ProjectState {
  version: 1;
  id: string;
  name: string;
  prompt: string;
  directions: Direction[];
  selectedDirectionId: string | null;
  lockedTraits: TraitKey[];
  anchor: Anchor | null;
  tests: FitTest[];
  events: JourneyEvent[];
  inspirations: InspirationAsset[];
  primaryInspirationId: string | null;
  inspirationSettings: InspirationSettings;
  inspirationVision: VisionRead | null;
  createdAt: number;
  updatedAt: number;
  shuffle: number;
}

export const DEFAULT_INSPIRATION_SETTINGS: InspirationSettings = {
  influence: 0.65,
  features: {
    palette: true,
    form: true,
    finish: true,
    line: false,
  },
  paletteFidelity: 0.55,
  notes: '',
  includeInExport: true,
};

export const ASSET_LABELS: Record<AssetKind, string> = {
  tree: 'Tree',
  stone: 'Stone',
  character: 'Wanderer',
  enemy: 'Enemy',
  building: 'Shrine',
  crystal: 'Crystal',
  object: 'Crate',
  terrain: 'Terrain',
};

export const PROBE_KINDS: AssetKind[] = ['tree', 'stone', 'character'];
