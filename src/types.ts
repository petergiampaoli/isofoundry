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
  | 'reset';

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
  createdAt: number;
  updatedAt: number;
  shuffle: number;
}

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
