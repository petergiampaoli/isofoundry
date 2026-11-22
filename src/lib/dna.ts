import { RNG, clamp, hashString } from './rng';
import { blendHue } from './color';
import { defaultPaletteParams, paletteFromParams } from './palette';
import type { Direction, StyleDNA, TraitKey, VoiceAxes } from '../types';

export function deriveVoice(dna: Omit<StyleDNA, 'voice' | 'palette' | 'name'>): VoiceAxes {
  const chroma = dna.paletteParams.chroma;
  return {
    grounded: clamp(0.45 + dna.weight * 0.3 - dna.bounce * 0.24 + dna.chunkiness * 0.08),
    ornate: clamp(dna.detail * 0.62 + dna.headScale * 0.16 + dna.paletteParams.contrast * 0.22),
    brutal: clamp(dna.spikiness * 0.48 + (1 - dna.roundness) * 0.24 + dna.detail * 0.12),
    springy: clamp(dna.bounce * 0.82 + dna.sway * 0.16),
    vivid: clamp(chroma * 0.9 + dna.detail * 0.1),
    gritty: clamp(dna.detail * 0.38 + dna.dither * 0.44 + (1 - dna.chunkiness) * 0.12),
  };
}

export function createDNA(seed: number, prompt = ''): StyleDNA {
  const rng = new RNG(seed);
  const paletteParams = defaultPaletteParams(seed);
  const base: Omit<StyleDNA, 'voice' | 'palette' | 'name'> = {
    seed,
    prompt,
    paletteParams,
    roundness: rng.float(0.34, 0.7),
    chunkiness: rng.float(0.38, 0.68),
    spikiness: rng.float(0.18, 0.54),
    asymmetry: rng.float(0.2, 0.5),
    detail: rng.float(0.46, 0.72),
    outline: rng.float(0.55, 0.9),
    dither: rng.float(0.2, 0.48),
    headScale: rng.float(0.42, 0.64),
    height: rng.float(0.42, 0.64),
    golden: rng.float(0.46, 0.72),
    bounce: rng.float(0.3, 0.56),
    weight: rng.float(0.48, 0.7),
    sway: rng.float(0.3, 0.58),
  };
  return {
    ...base,
    name: 'New direction',
    palette: paletteFromParams(paletteParams),
    voice: deriveVoice(base),
  };
}

export function refreshDNA(dna: StyleDNA): StyleDNA {
  const palette = paletteFromParams(dna.paletteParams);
  const golden = Number.isFinite(dna.golden) ? dna.golden : 0.618;
  return {
    ...dna,
    golden,
    palette,
    voice: deriveVoice(dna),
  };
}

export function cloneDNA(dna: StyleDNA): StyleDNA {
  return JSON.parse(JSON.stringify(dna)) as StyleDNA;
}

export function mutateDNA(dna: StyleDNA, seed: number, strength = 1): StyleDNA {
  const rng = new RNG(seed);
  const shift = (value: number, amount: number) => clamp(value + rng.float(-amount, amount) * strength);
  const paletteParams = {
    ...dna.paletteParams,
    hue: (dna.paletteParams.hue + rng.float(-28, 28) * strength + 360) % 360,
    accentHue: (dna.paletteParams.accentHue + rng.float(-36, 36) * strength + 360) % 360,
    chroma: shift(dna.paletteParams.chroma, 0.14),
    contrast: shift(dna.paletteParams.contrast, 0.12),
  };
  const next: StyleDNA = {
    ...dna,
    seed,
    paletteParams,
    roundness: shift(dna.roundness, 0.13),
    chunkiness: shift(dna.chunkiness, 0.1),
    spikiness: shift(dna.spikiness, 0.14),
    asymmetry: shift(dna.asymmetry, 0.12),
    detail: shift(dna.detail, 0.12),
    outline: shift(dna.outline, 0.12),
    dither: shift(dna.dither, 0.1),
    headScale: shift(dna.headScale, 0.09),
    height: shift(dna.height, 0.1),
    golden: shift(dna.golden ?? 0.618, 0.1),
    bounce: shift(dna.bounce, 0.12),
    weight: shift(dna.weight, 0.1),
    sway: shift(dna.sway, 0.1),
  };
  return refreshDNA(next);
}

export function driftDNA(dna: StyleDNA, seed: number): StyleDNA {
  const rng = new RNG(seed);
  const next: StyleDNA = {
    ...dna,
    seed,
    paletteParams: {
      hue: (dna.paletteParams.hue + rng.float(120, 210)) % 360,
      accentHue: (dna.paletteParams.accentHue + rng.float(100, 220)) % 360,
      foliageHue: (dna.paletteParams.foliageHue + rng.float(70, 160)) % 360,
      chroma: clamp(dna.paletteParams.chroma + 0.34),
      contrast: clamp(dna.paletteParams.contrast + 0.2),
      warmth: clamp(dna.paletteParams.warmth + rng.float(-0.7, 0.7), -1, 1),
    },
    roundness: clamp(dna.roundness + rng.float(-0.45, 0.45)),
    chunkiness: clamp(dna.chunkiness + rng.float(-0.35, 0.35)),
    spikiness: clamp(dna.spikiness + rng.float(0.2, 0.5)),
    detail: clamp(dna.detail + rng.float(0.25, 0.5)),
    outline: 0.02,
    dither: clamp(dna.dither + 0.35),
    headScale: clamp(dna.headScale + rng.float(-0.25, 0.25)),
    height: clamp(dna.height + rng.float(-0.3, 0.3)),
    golden: clamp((dna.golden ?? 0.618) + rng.float(-0.35, 0.35)),
    bounce: clamp(dna.bounce + 0.3),
    weight: clamp(dna.weight - 0.3),
  };
  return refreshDNA(next);
}

export function withPaletteParams(dna: StyleDNA, params: Partial<StyleDNA['paletteParams']>): StyleDNA {
  return refreshDNA({
    ...dna,
    paletteParams: {
      ...dna.paletteParams,
      ...params,
      hue: (params.hue ?? dna.paletteParams.hue + 360) % 360,
      accentHue: (params.accentHue ?? dna.paletteParams.accentHue + 360) % 360,
      foliageHue: (params.foliageHue ?? dna.paletteParams.foliageHue + 360) % 360,
    },
  });
}

const ADJECTIVES: Record<string, string[]> = {
  moss: ['Mossbound', 'Verdant', 'Bramble', 'Damp', 'Overgrown'],
  iron: ['Iron', 'Grim', 'Ashen', 'Weathered', 'Sable'],
  frost: ['Frost', 'Pale', 'Moonlit', 'Rime', 'Winter'],
  ember: ['Ember', 'Cinder', 'Saffron', 'Rust', 'Sunset'],
  royal: ['Gilded', 'Crowned', 'Velvet', 'Regal', 'Golden'],
  weird: ['Hollow', 'Veiled', 'Strange', 'Eldritch', 'Sunken'],
  poison: ['Toxic', 'Venom', 'Acid', 'Bitter', 'Witch'],
  clean: ['Quiet', 'Still', 'Plain', 'Lean', 'Pale'],
  brutal: ['Brutal', 'Savage', 'Barren', 'Harsh', 'Flint'],
};

const NOUNS = ['Reach', 'Keep', 'Vigil', 'Grove', 'Hearth', 'Bastion', 'Wanderer', 'Throne', 'March', 'Lantern', 'Wilds', 'Shrine'];

export function generateDirectionName(seed: number, keywords: string[], index = 0): string {
  const families = Object.keys(ADJECTIVES);
  const matched = families.filter((family) => keywords.includes(family));
  const pool = matched.length > 0 ? matched : families;
  const family = pool[index % pool.length];
  const adjectives = ADJECTIVES[family];
  const adjective = adjectives[(seed + index * 3) % adjectives.length];
  const noun = NOUNS[(index * 3 + 2) % NOUNS.length];
  return `${adjective} ${noun}`;
}

export function makeManifesto(dna: StyleDNA, keywords: string[], antiGoals: string[]): string {
  const rng = new RNG(dna.seed + keywords.length * 131);
  const shape = dna.roundness > 0.62
    ? rng.pick(['rounded and generous', 'soft and lived-in', 'cushioned and open'])
    : dna.spikiness > 0.6
      ? rng.pick(['thorned and angular', 'cut and hostile', 'jagged and alert'])
      : rng.pick(['clean and deliberate', 'precise and quiet', 'simple and direct']);
  const color = dna.paletteParams.chroma > 0.54
    ? rng.pick(['color arrives in clipped, saturated accents', 'accents land in small, hot notes', 'color is carried by a few sharp accents'])
    : dna.paletteParams.contrast < 0.45
      ? rng.pick(['color stays soft and close in value', 'values sit close together', 'the palette stays low and humid'])
      : rng.pick(['color stays mineral and low', 'the palette stays dusty and grounded', 'tones are pulled from stone and weather']);
  const material = dna.detail > 0.68
    ? rng.pick(['surfaces carry their history', 'wear is visible at the edges', 'material history is part of the silhouette'])
    : rng.pick(['surfaces stay legible at a glance', 'forms read before texture', 'the finish stays practical']);
  const motion = dna.bounce > 0.6
    ? rng.pick(['motion is springy and readable', 'the body has a quick, elastic rhythm', 'movement lands with a little bounce'])
    : dna.weight > 0.64
      ? rng.pick(['motion has weight and follow-through', 'movement carries mass', 'the body settles into each pose'])
      : rng.pick(['motion stays quiet and exact', 'movement is restrained', 'the body moves without ceremony']);
  const tone = antiGoals.length > 0
    ? ` It refuses ${antiGoals.slice(0, 2).join(' and ')}.`
    : '';
  const key = keywords.slice(0, 2).join(', ');
  return `A ${key || 'grounded'} world where ${material}; silhouettes are ${shape}; ${color}; ${motion}.${tone}`;
}

export function makeDirection(
  dna: StyleDNA,
  id: string,
  keywords: string[],
  antiGoals: string[],
  deltas: string[],
  index: number,
): Direction {
  const name = generateDirectionName(dna.seed, keywords, index);
  const named = { ...dna, name };
  return {
    id,
    name,
    seed: dna.seed,
    dna: named,
    manifesto: makeManifesto(named, keywords, antiGoals),
    keywords,
    antiGoals,
    deltas,
    createdAt: Date.now(),
  };
}

export function directionId(seed: number): string {
  return `dir_${seed.toString(36)}_${hashString(String(seed)).toString(36).slice(0, 5)}`;
}

export const TRAIT_LABELS: Record<TraitKey, string> = {
  palette: 'Palette',
  form: 'Form',
  detail: 'Detail',
  line: 'Line',
  motion: 'Motion',
};

export function hueAfterBlend(hue: number, target: number, amount: number): number {
  return blendHue(hue, target, amount);
}
