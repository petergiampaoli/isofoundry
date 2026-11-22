import { clamp, hashString, lerp } from './rng';
import { blendHue } from './color';
import { refreshDNA, createDNA, cloneDNA, makeDirection, generateDirectionName } from './dna';
import type { AssetKind, StyleDNA, TraitKey } from '../types';

export interface PromptInsight {
  summary: string[];
  keywords: string[];
  antiGoals: string[];
  subjectHint?: AssetKind;
}

interface LexEntry {
  words: string[];
  tags: string[];
  summary: string;
  hue?: number;
  accentHue?: number;
  foliageHue?: number;
  chroma?: number;
  contrast?: number;
  warmth?: number;
  roundness?: number;
  chunkiness?: number;
  spikiness?: number;
  asymmetry?: number;
  detail?: number;
  outline?: number;
  dither?: number;
  headScale?: number;
  height?: number;
  golden?: number;
  bounce?: number;
  weight?: number;
  sway?: number;
}

const LEXICON: LexEntry[] = [
  {
    words: ['moss', 'mossy', 'overgrown', 'verdant', 'forest', 'woodland', 'wild', 'green', 'growth'],
    tags: ['moss', 'organic'],
    summary: 'Pulled the palette toward moss, damp stone, and overgrowth.',
    hue: 112,
    foliageHue: 108,
    accentHue: 150,
    chroma: 0.42,
    warmth: -0.1,
    roundness: 0.58,
    detail: 0.58,
  },
  {
    words: ['iron', 'steel', 'metal', 'industrial', 'gunmetal', 'forge', 'practical', 'fortress', 'keep', 'armor'],
    tags: ['iron', 'hard'],
    summary: 'Leaned into practical iron, worn metal, and low-chroma stone.',
    hue: 218,
    chroma: 0.24,
    contrast: 0.66,
    spikiness: 0.42,
    detail: 0.56,
    outline: 0.78,
  },
  {
    words: ['stone', 'rock', 'granite', 'slate', 'ruin', 'ruined', 'ancient', 'old'],
    tags: ['stone', 'weathered'],
    summary: 'Weighted the world toward old stone and mineral surfaces.',
    hue: 224,
    chroma: 0.2,
    contrast: 0.58,
    detail: 0.62,
    dither: 0.52,
  },
  {
    words: ['ash', 'ashen', 'grey', 'gray', 'bleak', 'barren', 'wasteland'],
    tags: ['ash', 'muted'],
    summary: 'Muted the palette toward ash, dust, and bleached value.',
    hue: 42,
    chroma: 0.15,
    contrast: 0.46,
    warmth: 0.1,
    detail: 0.55,
  },
  {
    words: ['frost', 'ice', 'icy', 'winter', 'snow', 'moon', 'moonlit', 'cold', 'cool', 'pale'],
    tags: ['frost', 'cold'],
    summary: 'Cooled the light and pulled accent color toward frost.',
    hue: 208,
    accentHue: 186,
    foliageHue: 176,
    chroma: 0.34,
    contrast: 0.56,
    warmth: -0.7,
  },
  {
    words: ['ember', 'fire', 'flame', 'rust', 'autumn', 'sunset', 'amber', 'copper', 'warm', 'hearth'],
    tags: ['ember', 'warm'],
    summary: 'Warmed the palette toward ember, rust, and hearth light.',
    hue: 28,
    accentHue: 52,
    foliageHue: 38,
    chroma: 0.56,
    contrast: 0.6,
    warmth: 0.7,
  },
  {
    words: ['royal', 'regal', 'ornate', 'baroque', 'gilded', 'gold', 'golden', 'crowned', 'noble', 'intricate', 'classical', 'harmonic', 'balanced'],
    tags: ['royal', 'ornate'],
    summary: 'Raised the ornament, brought gold into the accents, and tightened the composition.',
    accentHue: 78,
    chroma: 0.54,
    detail: 0.82,
    roundness: 0.56,
    height: 0.62,
    golden: 0.78,
  },
  {
    words: ['strange', 'weird', 'eldritch', 'alien', 'otherworldly', 'dream', 'dreamlike', 'occult', 'arcane', 'magic'],
    tags: ['weird', 'otherworldly'],
    summary: 'Pushed the forms and palette toward something quieter and stranger.',
    hue: 286,
    accentHue: 190,
    foliageHue: 304,
    chroma: 0.62,
    asymmetry: 0.72,
    spikiness: 0.54,
    detail: 0.66,
    golden: 0.42,
  },
  {
    words: ['toxic', 'poison', 'poisoned', 'acid', 'venom', 'witch', 'sick'],
    tags: ['poison', 'vivid'],
    summary: 'Sharpened the palette with a poisonous green accent.',
    hue: 96,
    accentHue: 78,
    foliageHue: 104,
    chroma: 0.78,
    contrast: 0.64,
  },
  {
    words: ['clean', 'minimal', 'simple', 'quiet', 'calm', 'still', 'lean', 'restrained'],
    tags: ['clean', 'restrained'],
    summary: 'Reduced the detail budget and kept the read clean.',
    detail: 0.24,
    outline: 0.7,
    dither: 0.1,
    chroma: 0.28,
    roundness: 0.6,
    golden: 0.66,
  },
  {
    words: ['brutal', 'harsh', 'hostile', 'savage', 'grim', 'grimdark', 'flint', 'severe'],
    tags: ['brutal', 'severe'],
    summary: 'Made the silhouettes harsher and the value structure more severe.',
    spikiness: 0.7,
    roundness: 0.24,
    contrast: 0.74,
    detail: 0.6,
    headScale: 0.42,
    golden: 0.5,
  },
  {
    words: ['cozy', 'soft', 'gentle', 'storybook', 'fairy', 'whimsical', 'friendly', 'warmhearted'],
    tags: ['cozy', 'soft'],
    summary: 'Softened the forms and made the whole world more approachable.',
    roundness: 0.8,
    headScale: 0.72,
    chroma: 0.45,
    contrast: 0.4,
    bounce: 0.62,
    detail: 0.5,
  },
  {
    words: ['gritty', 'weathered', 'worn', 'rough', 'battered', 'scarred', 'dusty', 'dust'],
    tags: ['gritty', 'weathered'],
    summary: 'Added wear, grit, and more surface history.',
    detail: 0.76,
    dither: 0.7,
    contrast: 0.6,
    chroma: 0.32,
  },
  {
    words: ['tall', 'slender', 'elegant', 'graceful', 'willowy', 'lanky'],
    tags: ['tall', 'elegant'],
    summary: 'Stretched the proportions and narrowed the silhouettes.',
    height: 0.82,
    chunkiness: 0.22,
    spikiness: 0.28,
  },
  {
    words: ['chunky', 'stout', 'bulky', 'dwarf', 'heavy', 'stocky', 'broad'],
    tags: ['chunky', 'heavy'],
    summary: 'Thickened the forms and lowered the center of gravity.',
    chunkiness: 0.8,
    height: 0.35,
    roundness: 0.65,
    weight: 0.72,
  },
  {
    words: ['spiky', 'jagged', 'thorn', 'thorned', 'barbed', 'serrated', 'bramble'],
    tags: ['spiky', 'thorned'],
    summary: 'Made the silhouette thornier and less forgiving.',
    spikiness: 0.8,
    roundness: 0.22,
  },
  {
    words: ['weighty', 'deliberate', 'slow', 'monumental', 'labored', 'grounded'],
    tags: ['weighty', 'deliberate'],
    summary: 'Gave the motion weight and follow-through.',
    weight: 0.8,
    bounce: 0.24,
    sway: 0.35,
  },
  {
    words: ['springy', 'bouncy', 'energetic', 'quick', 'snappy', 'playful', 'lively'],
    tags: ['springy', 'lively'],
    summary: 'Made the motion quicker, springier, and more readable.',
    bounce: 0.8,
    weight: 0.34,
    sway: 0.55,
  },
  {
    words: ['floaty', 'ethereal', 'dreamy', 'weightless', 'spectral'],
    tags: ['floaty', 'spectral'],
    summary: 'Let the motion float and the forms thin at the edges.',
    weight: 0.18,
    bounce: 0.46,
    sway: 0.78,
    height: 0.72,
  },
  {
    words: ['pastel', 'candy', 'softcolor', 'light'],
    tags: ['pastel'],
    summary: 'Lowered contrast and moved toward a pastel range.',
    chroma: 0.3,
    contrast: 0.3,
    roundness: 0.72,
    detail: 0.48,
  },
  {
    words: ['monochrome', 'blackandwhite', 'desaturated', 'muted'],
    tags: ['muted'],
    summary: 'Compressed the palette to a narrower, quieter range.',
    chroma: 0.1,
    contrast: 0.62,
  },
  {
    words: ['desert', 'sun', 'sunbleached', 'bleached', 'dry', 'arid', 'sand', 'sandstone'],
    tags: ['sun', 'dry'],
    summary: 'Bleached the world toward sun, sand, and dry stone.',
    hue: 42,
    accentHue: 24,
    foliageHue: 68,
    chroma: 0.32,
    contrast: 0.52,
    warmth: 0.8,
    detail: 0.5,
  },
  {
    words: ['bone', 'ivory', 'pale', 'skull'],
    tags: ['bone'],
    summary: 'Brought bone and ivory into the material story.',
    hue: 48,
    accentHue: 36,
    chroma: 0.18,
    contrast: 0.52,
  },
  {
    words: ['red', 'crimson', 'scarlet', 'blood'],
    tags: ['red'],
    summary: 'Moved the base hue toward a crimson range.',
    hue: 12,
    accentHue: 36,
  },
  {
    words: ['blue', 'azure', 'cobalt', 'indigo'],
    tags: ['blue'],
    summary: 'Moved the base hue toward a cool blue range.',
    hue: 225,
    accentHue: 195,
    warmth: -0.5,
  },
  {
    words: ['purple', 'violet', 'magenta', 'plum'],
    tags: ['purple'],
    summary: 'Tinted the world toward violet and magenta.',
    hue: 292,
    accentHue: 330,
  },
  {
    words: ['teal', 'cyan', 'aqua', 'turquoise'],
    tags: ['teal'],
    summary: 'Pulled the accents toward teal and cyan.',
    hue: 196,
    accentHue: 174,
    warmth: -0.4,
  },
  {
    words: ['orange', 'tangerine', 'pumpkin'],
    tags: ['orange'],
    summary: 'Shifted the palette toward a heated orange.',
    hue: 32,
    accentHue: 50,
    warmth: 0.5,
  },
  {
    words: ['pink', 'rose', 'blush'],
    tags: ['pink'],
    summary: 'Brought a rosy accent into the palette.',
    hue: 338,
    accentHue: 352,
  },
];

const MODIFIERS: Record<string, { field: string; amount: number; label: string }> = {
  saturated: { field: 'chroma', amount: 0.22, label: 'more saturated' },
  vivid: { field: 'chroma', amount: 0.2, label: 'more vivid' },
  muted: { field: 'chroma', amount: -0.2, label: 'more muted' },
  desaturated: { field: 'chroma', amount: -0.24, label: 'more desaturated' },
  contrast: { field: 'contrast', amount: 0.16, label: 'more contrast' },
  detailed: { field: 'detail', amount: 0.18, label: 'more detailed' },
  intricate: { field: 'detail', amount: 0.2, label: 'more intricate' },
  ornate: { field: 'detail', amount: 0.2, label: 'more ornate' },
  simple: { field: 'detail', amount: -0.2, label: 'simpler' },
  rounded: { field: 'roundness', amount: 0.18, label: 'rounder' },
  round: { field: 'roundness', amount: 0.18, label: 'rounder' },
  angular: { field: 'spikiness', amount: 0.18, label: 'more angular' },
  spiky: { field: 'spikiness', amount: 0.18, label: 'spikier' },
  chunky: { field: 'chunkiness', amount: 0.18, label: 'chunkier' },
  bulky: { field: 'chunkiness', amount: 0.18, label: 'bulkier' },
  tall: { field: 'height', amount: 0.16, label: 'taller' },
  slender: { field: 'chunkiness', amount: -0.14, label: 'more slender' },
  heavy: { field: 'weight', amount: 0.16, label: 'heavier' },
  weighty: { field: 'weight', amount: 0.16, label: 'weightier' },
  bouncy: { field: 'bounce', amount: 0.18, label: 'bouncier' },
  springy: { field: 'bounce', amount: 0.18, label: 'springier' },
  gritty: { field: 'detail', amount: 0.14, label: 'grittier' },
  weathered: { field: 'dither', amount: 0.16, label: 'more weathered' },
  cute: { field: 'headScale', amount: 0.14, label: 'cuter' },
  balanced: { field: 'golden', amount: 0.12, label: 'more balanced' },
  harmonic: { field: 'golden', amount: 0.14, label: 'more harmonic' },
  chaotic: { field: 'golden', amount: -0.16, label: 'more chaotic' },
  dark: { field: 'contrast', amount: 0.1, label: 'darker' },
  warm: { field: 'warmth', amount: 0.22, label: 'warmer' },
  cold: { field: 'warmth', amount: -0.22, label: 'cooler' },
};

const SUBJECTS: Array<{ kind: AssetKind; words: string[] }> = [
  { kind: 'character', words: ['character', 'person', 'hero', 'knight', 'wanderer', 'ranger', 'mage', 'warrior', 'guardian', 'enemy', 'goblin', 'creature'] },
  { kind: 'building', words: ['building', 'house', 'tower', 'keep', 'shrine', 'temple', 'castle', 'tavern', 'forge', 'hut'] },
  { kind: 'tree', words: ['tree', 'pine', 'oak', 'grove', 'sapling', 'trunk'] },
  { kind: 'stone', words: ['stone', 'rock', 'boulder', 'cliff', 'pebble'] },
  { kind: 'crystal', words: ['crystal', 'shard', 'gem', 'prism'] },
];

function fieldsForTrait(trait: TraitKey): string[] {
  switch (trait) {
    case 'palette':
      return ['hue', 'accentHue', 'foliageHue', 'chroma', 'contrast', 'warmth'];
    case 'form':
      return ['roundness', 'chunkiness', 'spikiness', 'asymmetry', 'headScale', 'height', 'golden'];
    case 'detail':
      return ['detail', 'dither'];
    case 'line':
      return ['outline'];
    case 'motion':
      return ['bounce', 'weight', 'sway'];
  }
}

function normalizeText(text: string): string {
  return text.toLowerCase().replace(/[’']/g, '').replace(/\s+/g, ' ').trim();
}

function containsWord(text: string, word: string): boolean {
  const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`(^|[^a-z])${escaped}([^a-z]|$)`, 'i').test(text);
}

function applyLexEntry(dna: StyleDNA, entry: LexEntry, strength: number): void {
  if (entry.hue != null) dna.paletteParams.hue = blendHue(dna.paletteParams.hue, entry.hue, strength);
  if (entry.accentHue != null) dna.paletteParams.accentHue = blendHue(dna.paletteParams.accentHue, entry.accentHue, strength);
  if (entry.foliageHue != null) dna.paletteParams.foliageHue = blendHue(dna.paletteParams.foliageHue, entry.foliageHue, strength);
  if (entry.chroma != null) dna.paletteParams.chroma = lerp(dna.paletteParams.chroma, entry.chroma, strength);
  if (entry.contrast != null) dna.paletteParams.contrast = lerp(dna.paletteParams.contrast, entry.contrast, strength);
  if (entry.warmth != null) dna.paletteParams.warmth = lerp(dna.paletteParams.warmth, entry.warmth, strength);
  if (entry.roundness != null) dna.roundness = lerp(dna.roundness, entry.roundness, strength);
  if (entry.chunkiness != null) dna.chunkiness = lerp(dna.chunkiness, entry.chunkiness, strength);
  if (entry.spikiness != null) dna.spikiness = lerp(dna.spikiness, entry.spikiness, strength);
  if (entry.asymmetry != null) dna.asymmetry = lerp(dna.asymmetry, entry.asymmetry, strength);
  if (entry.detail != null) dna.detail = lerp(dna.detail, entry.detail, strength);
  if (entry.outline != null) dna.outline = lerp(dna.outline, entry.outline, strength);
  if (entry.dither != null) dna.dither = lerp(dna.dither, entry.dither, strength);
  if (entry.headScale != null) dna.headScale = lerp(dna.headScale, entry.headScale, strength);
  if (entry.height != null) dna.height = lerp(dna.height, entry.height, strength);
  if (entry.golden != null) dna.golden = lerp(dna.golden ?? 0.618, entry.golden, strength);
  if (entry.bounce != null) dna.bounce = lerp(dna.bounce, entry.bounce, strength);
  if (entry.weight != null) dna.weight = lerp(dna.weight, entry.weight, strength);
  if (entry.sway != null) dna.sway = lerp(dna.sway, entry.sway, strength);
}

function bump(dna: StyleDNA, field: string, amount: number): void {
  switch (field) {
    case 'hue':
      dna.paletteParams.hue = blendHue(dna.paletteParams.hue, amount > 0 ? 35 : 220, Math.abs(amount));
      break;
    case 'accentHue':
      dna.paletteParams.accentHue = blendHue(dna.paletteParams.accentHue, amount > 0 ? 78 : 210, Math.abs(amount));
      break;
    case 'chroma':
      dna.paletteParams.chroma = clamp(dna.paletteParams.chroma + amount);
      break;
    case 'contrast':
      dna.paletteParams.contrast = clamp(dna.paletteParams.contrast + amount);
      break;
    case 'warmth':
      dna.paletteParams.warmth = clamp(dna.paletteParams.warmth + amount, -1, 1);
      break;
    case 'roundness':
      dna.roundness = clamp(dna.roundness + amount);
      break;
    case 'chunkiness':
      dna.chunkiness = clamp(dna.chunkiness + amount);
      break;
    case 'spikiness':
      dna.spikiness = clamp(dna.spikiness + amount);
      break;
    case 'asymmetry':
      dna.asymmetry = clamp(dna.asymmetry + amount);
      break;
    case 'detail':
      dna.detail = clamp(dna.detail + amount);
      break;
    case 'outline':
      dna.outline = clamp(dna.outline + amount);
      break;
    case 'dither':
      dna.dither = clamp(dna.dither + amount);
      break;
    case 'headScale':
      dna.headScale = clamp(dna.headScale + amount);
      break;
    case 'height':
      dna.height = clamp(dna.height + amount);
      break;
    case 'golden':
      dna.golden = clamp((dna.golden ?? 0.618) + amount);
      break;
    case 'bounce':
      dna.bounce = clamp(dna.bounce + amount);
      break;
    case 'weight':
      dna.weight = clamp(dna.weight + amount);
      break;
    case 'sway':
      dna.sway = clamp(dna.sway + amount);
      break;
  }
}

function applyModifierWords(text: string, dna: StyleDNA, summary: string[]): void {
  const matches = text.matchAll(/\b(more|less|very|slightly)\s+([a-z-]+)\b/g);
  for (const match of matches) {
    const direction = match[1] === 'less' ? -1 : 1;
    const word = match[2];
    const modifier = MODIFIERS[word];
    if (!modifier) continue;
    bump(dna, modifier.field, modifier.amount * direction);
    const label = direction < 0 ? modifier.label.replace(/^more /, 'less ') : modifier.label;
    summary.push(`Adjusted the direction: ${label}.`);
  }

  const direct = text.matchAll(/\b(rounder|chunkier|warmer|colder|grittier|simpler|cleaner|taller|shorter|heavier|lighter|bouncier|spikier|saturated|desaturated|darker|brighter|ornate)\b/g);
  for (const match of direct) {
    const word = match[1];
    const map: Record<string, [string, number, string]> = {
      rounder: ['roundness', 0.14, 'rounder'],
      chunkier: ['chunkiness', 0.14, 'chunkier'],
      warmer: ['warmth', 0.2, 'warmer'],
      colder: ['warmth', -0.2, 'cooler'],
      grittier: ['detail', 0.14, 'grittier'],
      simpler: ['detail', -0.16, 'simpler'],
      cleaner: ['detail', -0.16, 'cleaner'],
      taller: ['height', 0.14, 'taller'],
      shorter: ['height', -0.14, 'shorter'],
      heavier: ['weight', 0.14, 'heavier'],
      lighter: ['weight', -0.14, 'lighter'],
      bouncier: ['bounce', 0.16, 'bouncier'],
      spikier: ['spikiness', 0.16, 'spikier'],
      saturated: ['chroma', 0.18, 'more saturated'],
      desaturated: ['chroma', -0.18, 'more desaturated'],
      darker: ['contrast', 0.12, 'darker'],
      brighter: ['contrast', 0.12, 'brighter'],
      ornate: ['detail', 0.16, 'more ornate'],
    };
    const [field, amount, label] = map[word];
    bump(dna, field, amount);
    summary.push(`Adjusted the direction: ${label}.`);
  }
}

function applyAntiGoals(
  antiGoals: string[],
  dna: StyleDNA,
  summary: string[],
  locks: TraitKey[],
): void {
  for (const goal of antiGoals) {
    if (/(neon|saturated|vivid|fluorescent)/.test(goal) && !locks.includes('palette')) {
      dna.paletteParams.chroma = clamp(dna.paletteParams.chroma - 0.22);
      summary.push('Kept saturation away from neon.');
    }
    if (/(cute|chibi|childlike|toy)/.test(goal)) {
      if (!locks.includes('form')) {
        dna.roundness = clamp(dna.roundness - 0.12);
        dna.headScale = clamp(dna.headScale - 0.12);
      }
      if (!locks.includes('motion')) dna.bounce = clamp(dna.bounce - 0.12);
      summary.push('Avoided a cute read.');
    }
    if (/(gloss|glossy|shiny|polished)/.test(goal) && !locks.includes('palette')) {
      dna.paletteParams.contrast = clamp(dna.paletteParams.contrast - 0.06);
      summary.push('Kept highlights matte instead of glossy.');
    }
    if (/(ornate|busy|intricate)/.test(goal) && !locks.includes('detail')) {
      dna.detail = clamp(dna.detail - 0.16);
      summary.push('Kept the detail from becoming busy.');
    }
    if (/(spiky|thorn|jagged)/.test(goal) && !locks.includes('form')) {
      dna.spikiness = clamp(dna.spikiness - 0.18);
      summary.push('Softened the thorn line.');
    }
  }
}

export function parsePrompt(
  prompt: string,
  base: StyleDNA | null,
  locks: TraitKey[],
  salt = 0,
): { dna: StyleDNA; insight: PromptInsight } {
  const normalized = normalizeText(prompt);
  const seed = hashString(`${normalized}|${base?.seed ?? 'fresh'}|${salt}`);
  const dna = base ? cloneDNA(base) : createDNA(seed, prompt);
  dna.seed = seed;
  dna.prompt = prompt;

  const antiGoals: string[] = [];
  const antiMatches = [...normalized.matchAll(/\b(?:no|not|avoid|without|never)\s+((?:[a-z][a-z-]*)(?:\s+(?:[a-z][a-z-]*))?)/g)];
  for (const match of antiMatches) {
    const phrase = match[1].trim();
    if (phrase && !antiGoals.includes(phrase)) antiGoals.push(phrase);
  }
  const cleaned = normalized.replace(/\b(?:no|not|avoid|without|never)\s+((?:[a-z][a-z-]*)(?:\s+(?:[a-z][a-z-]*))?)/g, ' ');

  const keywords: string[] = [];
  const summary: string[] = [];
  const matchedEntries: LexEntry[] = [];
  for (const entry of LEXICON) {
    if (entry.words.some((word) => containsWord(cleaned, word))) {
      matchedEntries.push(entry);
      for (const tag of entry.tags) if (!keywords.includes(tag)) keywords.push(tag);
      if (!summary.includes(entry.summary)) summary.push(entry.summary);
    }
  }

  const strength = base ? 0.64 : 0.82;
  for (const entry of matchedEntries) applyLexEntry(dna, entry, strength);
  applyModifierWords(cleaned, dna, summary);
  applyAntiGoals(antiGoals, dna, summary, locks);

  let subjectHint: AssetKind | undefined;
  for (const subject of SUBJECTS) {
    if (subject.words.some((word) => containsWord(cleaned, word))) {
      subjectHint = subject.kind;
      break;
    }
  }

  if (matchedEntries.length === 0 && summary.length === 0) {
    summary.push(base
      ? 'Kept the current balance and shifted the seed for a new interpretation.'
      : 'Started from a neutral seed; the direction is carried by form, palette, and finish.');
  }
  if (antiGoals.length > 0) summary.push(`Anti-goals locked: ${antiGoals.join(', ')}.`);

  for (const trait of locks) {
    const fields = fieldsForTrait(trait);
    if (!base) continue;
    if (trait === 'palette') {
      dna.paletteParams = { ...base.paletteParams };
      dna.palette = { ...base.palette };
    }
    if (trait === 'form') {
      dna.roundness = base.roundness;
      dna.chunkiness = base.chunkiness;
      dna.spikiness = base.spikiness;
      dna.asymmetry = base.asymmetry;
      dna.headScale = base.headScale;
      dna.height = base.height;
      dna.golden = base.golden ?? 0.618;
    }
    if (trait === 'detail') {
      dna.detail = base.detail;
      dna.dither = base.dither;
    }
    if (trait === 'line') dna.outline = base.outline;
    if (trait === 'motion') {
      dna.bounce = base.bounce;
      dna.weight = base.weight;
      dna.sway = base.sway;
    }
    if (fields.length === 0) continue;
  }

  return {
    dna: refreshDNA(dna),
    insight: { summary: [...new Set(summary)].slice(0, 6), keywords, antiGoals, subjectHint },
  };
}

export function buildDirections(
  prompt: string,
  base: StyleDNA | null,
  locks: TraitKey[],
  salt: number,
  count = 4,
): { directions: ReturnType<typeof makeDirection>[]; insight: PromptInsight } {
  const directions: ReturnType<typeof makeDirection>[] = [];
  const usedNames = new Set<string>();
  let insight: PromptInsight = { summary: [], keywords: [], antiGoals: [] };

  for (let i = 0; i < count; i += 1) {
    const parsed = parsePrompt(prompt, base, locks, salt + i * 131);
    if (i === 0) insight = parsed.insight;
    const dna = parsed.dna;
    const variationLabels: string[] = [];

    if (!locks.includes('palette')) {
      dna.paletteParams.hue = (dna.paletteParams.hue + (i - 1.5) * 14 + 360) % 360;
      dna.paletteParams.accentHue = (dna.paletteParams.accentHue + (i - 1.5) * 30 + 360) % 360;
      dna.paletteParams.foliageHue = (dna.paletteParams.foliageHue + (i - 1.5) * 10 + 360) % 360;
      dna.paletteParams.chroma = clamp(dna.paletteParams.chroma + ((i % 2 === 0 ? 1 : -1) * 0.085));
      dna.paletteParams.contrast = clamp(dna.paletteParams.contrast + ((i % 3) - 1) * 0.045, 0.2, 0.92);
      if (i % 2 === 1) variationLabels.push('cooler variation');
      else variationLabels.push('warmer variation');
    }
    if (!locks.includes('form')) {
      dna.roundness = clamp(dna.roundness + (i - 1.5) * 0.075);
      dna.chunkiness = clamp(dna.chunkiness + ((i % 3) - 1) * 0.06);
      dna.spikiness = clamp(dna.spikiness + (i % 2 === 0 ? 0.1 : -0.1));
      dna.height = clamp(dna.height + ((i % 2) * 2 - 1) * 0.05);
      dna.golden = clamp((dna.golden ?? 0.618) + (i - 1.5) * 0.035);
      variationLabels.push(i % 2 === 0 ? 'heavier silhouette' : 'leaner silhouette');
    }
    if (!locks.includes('detail')) {
      dna.detail = clamp(dna.detail + (i - 1.5) * 0.06);
      if (i >= 2) variationLabels.push('more surface history');
    }
    if (!locks.includes('motion')) {
      dna.bounce = clamp(dna.bounce + (i - 1.5) * 0.06);
      dna.weight = clamp(dna.weight + ((i % 2) * 2 - 1) * 0.05);
    }

    const refreshed = refreshDNA(dna);
    const labels = [...new Set([...parsed.insight.summary.slice(0, 2), ...variationLabels])];
    const direction = makeDirection(
      refreshed,
      `dir_${refreshed.seed.toString(36)}_${i}`,
      parsed.insight.keywords,
      parsed.insight.antiGoals,
      labels,
      i,
    );
    let attempt = 0;
    while (usedNames.has(direction.name) && attempt < 24) {
      attempt += 1;
      const alternative = generateDirectionName(
        refreshed.seed + attempt * 97,
        parsed.insight.keywords.length ? parsed.insight.keywords : ['weird'],
        i + attempt,
      );
      direction.name = alternative;
      direction.dna.name = alternative;
    }
    if (usedNames.has(direction.name)) {
      direction.name = `${direction.name} II`;
      direction.dna.name = direction.name;
    }
    usedNames.add(direction.name);
    directions.push(direction);
  }

  return { directions, insight };
}

export const PROMPT_SUGGESTIONS = [
  'More grounded, less ornate, colder light',
  'Rounder silhouettes and a warmer palette',
  'More weathered stone, heavier motion',
  'Cleaner, simpler, higher contrast',
  'Stranger forms, quieter color, no neon',
];
