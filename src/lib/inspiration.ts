import type {
  CombinedInspirationRead,
  InspirationAsset,
  InspirationFeature,
  InspirationMode,
  InspirationRead,
  InspirationSettings,
  StyleDNA,
  TraitKey,
  VisionRead,
  VoiceAxes,
} from '../types';
import { DEFAULT_INSPIRATION_SETTINGS } from '../types';
import { blendHue, hexToOklch, oklchToHex, rgbToOklch, type Oklch } from './color';
import { clamp, hashString, lerp } from './rng';
import { refreshDNA } from './dna';

const MAX_ANALYSIS_EDGE = 256;
const MAX_THUMB_EDGE = 128;
const MAX_FILE_BYTES = 15 * 1024 * 1024;

function channelHex(value: number): string {
  return Math.round(value).toString(16).padStart(2, '0');
}

function rgbHex(r: number, g: number, b: number): string {
  return `#${channelHex(r)}${channelHex(g)}${channelHex(b)}`;
}

function quantizedKey(r: number, g: number, b: number): string {
  return `${r >> 3},${g >> 3},${b >> 3}`;
}

function oklabDistance(a: Oklch, b: Oklch): number {
  const ax = a.C * Math.cos((a.H * Math.PI) / 180);
  const ay = a.C * Math.sin((a.H * Math.PI) / 180);
  const bx = b.C * Math.cos((b.H * Math.PI) / 180);
  const by = b.C * Math.sin((b.H * Math.PI) / 180);
  return Math.sqrt((a.L - b.L) ** 2 + (ax - bx) ** 2 + (ay - by) ** 2);
}

function weightedHue(items: Array<{ hue: number; weight: number }>): number {
  let x = 0;
  let y = 0;
  for (const item of items) {
    const angle = (item.hue * Math.PI) / 180;
    x += Math.cos(angle) * item.weight;
    y += Math.sin(angle) * item.weight;
  }
  if (Math.abs(x) + Math.abs(y) < 0.0001) return 120;
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}

function emptyRead(): InspirationRead {
  return {
    palette: ['#686c65', '#a9a694', '#332f2b', '#d8c9aa', '#6e4b37'],
    paletteShares: [0.28, 0.24, 0.18, 0.16, 0.14],
    hue: 120,
    accentHue: 160,
    foliageHue: 120,
    chroma: 0.25,
    contrast: 0.45,
    warmth: 0,
    meanL: 0.45,
    stdL: 0.12,
    edgeDensity: 0.2,
    detailEntropy: 0.4,
    texture: 0.3,
    flatness: 0.8,
    angularity: 0.4,
    symmetry: 0.45,
    keywords: ['neutral', 'readable'],
    confidence: { palette: 0.1, form: 0.1, finish: 0.1, line: 0.1, voice: 0.1 },
    suggestedVoice: { grounded: 0.5, ornate: 0.45, brutal: 0.4, springy: 0.5, vivid: 0.35, gritty: 0.45 },
  };
}

export function analyzePixels(
  data: Uint8ClampedArray,
  width: number,
  height: number,
): InspirationRead {
  if (width === 0 || height === 0) return emptyRead();

  // Find the most common border tone. A dominant border is usually the
  // presentation background, not part of the style read.
  const borderCounts = new Map<string, { count: number; r: number; g: number; b: number }>();
  const addBorder = (x: number, y: number) => {
    const index = (y * width + x) * 4;
    if (data[index + 3] < 128) return;
    const r = data[index];
    const g = data[index + 1];
    const b = data[index + 2];
    const key = quantizedKey(r, g, b);
    const current = borderCounts.get(key) ?? { count: 0, r: 0, g: 0, b: 0 };
    current.count += 1;
    current.r += r;
    current.g += g;
    current.b += b;
    borderCounts.set(key, current);
  };
  for (let x = 0; x < width; x += 2) {
    addBorder(x, 0);
    addBorder(x, height - 1);
  }
  for (let y = 0; y < height; y += 2) {
    addBorder(0, y);
    addBorder(width - 1, y);
  }
  const borderClusters: Array<{ count: number; r: number; g: number; b: number }> = [];
  for (const entry of borderCounts.values()) {
    const r = entry.r / entry.count;
    const g = entry.g / entry.count;
    const b = entry.b / entry.count;
    const cluster = borderClusters.find((item) =>
      Math.abs(item.r / item.count - r) + Math.abs(item.g / item.count - g) + Math.abs(item.b / item.count - b) < 46,
    );
    if (cluster) {
      cluster.r += entry.r;
      cluster.g += entry.g;
      cluster.b += entry.b;
      cluster.count += entry.count;
    } else {
      borderClusters.push({ count: entry.count, r: entry.r, g: entry.g, b: entry.b });
    }
  }
  const borderTotal = borderClusters.reduce((sum, item) => sum + item.count, 0);
  const dominantBorder = [...borderClusters].sort((a, b) => b.count - a.count)[0];
  const background = dominantBorder && borderTotal > 0 && dominantBorder.count / borderTotal > 0.5
    ? {
        r: dominantBorder.r / dominantBorder.count,
        g: dominantBorder.g / dominantBorder.count,
        b: dominantBorder.b / dominantBorder.count,
      }
    : null;

  const colorCounts = new Map<string, { count: number; oklch: Oklch }>();
  const lumaGrid = new Float32Array(width * height).fill(-1);
  let valid = 0;
  let sumL = 0;
  let sumL2 = 0;

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const index = (y * width + x) * 4;
      if (data[index + 3] < 128) continue;
      const r = data[index];
      const g = data[index + 1];
      const b = data[index + 2];
      if (background) {
        const distance = Math.abs(r - background.r) + Math.abs(g - background.g) + Math.abs(b - background.b);
        if (distance < 42) continue;
      }
      const oklch = rgbToOklch(r, g, b);
      const luma = 0.2126 * (r / 255) + 0.7152 * (g / 255) + 0.0722 * (b / 255);
      lumaGrid[y * width + x] = luma;
      valid += 1;
      sumL += luma;
      sumL2 += luma * luma;
      const key = quantizedKey(r, g, b);
      const current = colorCounts.get(key);
      if (current) current.count += 1;
      else colorCounts.set(key, { count: 1, oklch });
    }
  }

  if (valid < 32) return emptyRead();

  const meanL = sumL / valid;
  const stdL = Math.sqrt(Math.max(0, sumL2 / valid - meanL * meanL));

  const paletteClusters: Array<{ color: string; count: number; oklch: Oklch }> = [];
  const sortedColors = [...colorCounts.values()].sort((a, b) => b.count - a.count);
  for (const entry of sortedColors) {
    const existing = paletteClusters.find((cluster) => oklabDistance(cluster.oklch, entry.oklch) < 0.075);
    if (existing) {
      existing.count += entry.count;
    } else if (paletteClusters.length < 10) {
      paletteClusters.push({
        color: oklchToHex(entry.oklch.L, entry.oklch.C, entry.oklch.H),
        count: entry.count,
        oklch: entry.oklch,
      });
    }
    if (paletteClusters.length >= 10) break;
  }
  paletteClusters.sort((a, b) => b.count - a.count);
  const totalClusterCount = paletteClusters.reduce((sum, item) => sum + item.count, 0) || 1;
  const palette = paletteClusters.map((cluster) => cluster.color);
  const paletteShares = paletteClusters.map((cluster) => cluster.count / totalClusterCount);

  const chromatic = paletteClusters
    .map((cluster, index) => ({ ...cluster, share: paletteShares[index] }))
    .filter((cluster) => cluster.share > 0.015 && cluster.oklch.C > 0.018);
  const hue = chromatic.length
    ? weightedHue(chromatic.map((cluster) => ({ hue: cluster.oklch.H, weight: cluster.share * (0.4 + cluster.oklch.C) })))
    : 120;
  const accentCandidate = chromatic
    .map((cluster) => ({
      ...cluster,
      distance: Math.min(
        Math.abs(cluster.oklch.H - hue),
        360 - Math.abs(cluster.oklch.H - hue),
      ),
    }))
    .filter((cluster) => cluster.distance > 24)
    .sort((a, b) => b.share - a.share)[0];
  const accentHue = accentCandidate?.oklch.H ?? (hue + 90) % 360;
  const foliageCandidates = chromatic.filter((cluster) => cluster.oklch.H >= 65 && cluster.oklch.H <= 180);
  const foliageHue = foliageCandidates.length
    ? weightedHue(foliageCandidates.map((cluster) => ({ hue: cluster.oklch.H, weight: cluster.share })))
    : hue;

  const meanC = chromatic.reduce((sum, cluster) => sum + cluster.oklch.C * cluster.share, 0);
  const chroma = clamp((meanC - 0.012) / 0.15);
  const contrast = clamp((stdL - 0.02) / 0.23, 0.18, 0.95);
  const warmth = clamp(
    chromatic.reduce((sum, cluster) => sum + Math.cos(((cluster.oklch.H - 30) * Math.PI) / 180) * cluster.share, 0),
    -1,
    1,
  );

  let edgeCount = 0;
  let edgePairs = 0;
  let highFrequency = 0;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const luma = lumaGrid[y * width + x];
      if (luma < 0) continue;
      if (x + 1 < width) {
        const right = lumaGrid[y * width + x + 1];
        if (right >= 0) {
          edgePairs += 1;
          const diff = Math.abs(luma - right);
          if (diff > 0.075) edgeCount += 1;
          if (diff > 0.025) highFrequency += 1;
        }
      }
      if (y + 1 < height) {
        const down = lumaGrid[(y + 1) * width + x];
        if (down >= 0) {
          edgePairs += 1;
          const diff = Math.abs(luma - down);
          if (diff > 0.075) edgeCount += 1;
          if (diff > 0.025) highFrequency += 1;
        }
      }
    }
  }
  const edgeDensity = edgePairs > 0 ? edgeCount / edgePairs : 0;
  const texture = edgePairs > 0 ? highFrequency / edgePairs : 0;
  const flatness = clamp(1 - texture * 1.6);

  let entropy = 0;
  for (const cluster of paletteClusters) {
    const p = cluster.count / totalClusterCount;
    entropy -= p * Math.log2(p);
  }
  const detailEntropy = clamp(entropy / Math.log2(Math.max(2, paletteClusters.length)));

  const step = Math.max(1, Math.floor(Math.max(width, height) / 80));
  let symmetryTotal = 0;
  let symmetryDiff = 0;
  for (let y = 0; y < height; y += step) {
    for (let x = 0; x < Math.floor(width / 2); x += step) {
      const left = lumaGrid[y * width + x];
      const right = lumaGrid[y * width + (width - 1 - x)];
      if (left < 0 && right < 0) continue;
      symmetryTotal += 1;
      if (left < 0 || right < 0) symmetryDiff += 1;
      else symmetryDiff += Math.abs(left - right);
    }
  }
  const symmetry = symmetryTotal > 0 ? clamp(1 - symmetryDiff / symmetryTotal / 0.4) : 0.4;

  const angularity = clamp(0.34 + edgeDensity * 0.32 + (1 - symmetry) * 0.18 + texture * 0.16);

  const keywords: string[] = [];
  if (chroma > 0.55) keywords.push('vivid');
  else if (chroma < 0.3) keywords.push('muted');
  if (warmth > 0.2) keywords.push('warm');
  else if (warmth < -0.2) keywords.push('cool');
  if (meanL < 0.36) keywords.push('dark');
  else if (meanL > 0.7) keywords.push('light');
  if (contrast > 0.62) keywords.push('high-contrast');
  else if (contrast < 0.4) keywords.push('low-contrast');
  if (edgeDensity > 0.3) keywords.push('dense');
  else if (edgeDensity < 0.12) keywords.push('clean');
  if (texture > 0.32) keywords.push('textured');
  else keywords.push('flat');
  if (angularity > 0.62) keywords.push('angular');
  else if (angularity < 0.42) keywords.push('soft');
  if (symmetry > 0.68) keywords.push('symmetric');
  else if (symmetry < 0.35) keywords.push('asymmetric');
  if (paletteClusters.length > 6) keywords.push('color-rich');

  const confidence = {
    palette: clamp(0.7 + Math.min(0.25, valid / 24000)),
    form: clamp(0.35 + symmetry * 0.25),
    finish: clamp(0.58 + Math.min(0.3, valid / 22000)),
    line: 0.42,
    voice: 0.5,
  };
  const suggestedVoice: VoiceAxes = {
    grounded: 0.5,
    ornate: clamp(detailEntropy * 0.75 + edgeDensity * 0.15),
    brutal: clamp(angularity * 0.85),
    springy: 0.5,
    vivid: clamp(chroma),
    gritty: clamp(detailEntropy * 0.6 + texture * 0.35),
  };

  return {
    palette,
    paletteShares,
    hue,
    accentHue,
    foliageHue,
    chroma,
    contrast,
    warmth,
    meanL,
    stdL,
    edgeDensity,
    detailEntropy,
    texture,
    flatness,
    angularity,
    symmetry,
    keywords,
    confidence,
    suggestedVoice,
  };
}

function weightedNumber(values: Array<{ value: number; weight: number }>): number {
  const total = values.reduce((sum, item) => sum + item.weight, 0);
  if (total <= 0) return 0;
  return values.reduce((sum, item) => sum + item.value * item.weight, 0) / total;
}

export function combineInspirations(
  assets: InspirationAsset[],
  primaryId: string | null,
  settings: InspirationSettings = DEFAULT_INSPIRATION_SETTINGS,
): CombinedInspirationRead | null {
  if (assets.length === 0) return null;
  const primary = assets.find((asset) => asset.id === primaryId) ?? assets[0];
  const weighted = assets.map((asset) => ({
    asset,
    weight: asset.id === primary.id ? 1 : Math.max(0.1, asset.weight),
    primary: asset.id === primary.id,
  }));
  const totalWeight = weighted.reduce((sum, item) => sum + item.weight, 0);

  const paletteMap = new Map<string, number>();
  for (const { asset, weight } of weighted) {
    asset.read.palette.forEach((color, index) => {
      const share = (asset.read.paletteShares[index] ?? 0) * weight;
      paletteMap.set(color, (paletteMap.get(color) ?? 0) + share);
    });
  }
  const paletteEntries = [...paletteMap.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10);
  const paletteTotal = paletteEntries.reduce((sum, [, share]) => sum + share, 0) || 1;
  const palette = paletteEntries.map(([color]) => color);
  const paletteShares = paletteEntries.map(([, share]) => share / paletteTotal);

  const readHue = weightedNumber(weighted.map(({ asset, weight }) => ({ value: asset.read.hue, weight })));
  const readAccent = weightedHue(weighted.map(({ asset, weight }) => ({ hue: asset.read.accentHue, weight })));
  const readFoliage = weightedHue(weighted.map(({ asset, weight }) => ({ hue: asset.read.foliageHue, weight })));
  const keywordWeights = new Map<string, number>();
  for (const { asset, weight } of weighted) {
    for (const keyword of asset.read.keywords) {
      keywordWeights.set(keyword, (keywordWeights.get(keyword) ?? 0) + weight);
    }
  }
  const keywords = [...keywordWeights.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([keyword]) => keyword);

  return {
    palette,
    paletteShares,
    hue: readHue,
    accentHue: readAccent,
    foliageHue: readFoliage,
    chroma: weightedNumber(weighted.map(({ asset, weight }) => ({ value: asset.read.chroma, weight }))),
    contrast: weightedNumber(weighted.map(({ asset, weight }) => ({ value: asset.read.contrast, weight }))),
    warmth: weightedNumber(weighted.map(({ asset, weight }) => ({ value: asset.read.warmth, weight }))),
    meanL: weightedNumber(weighted.map(({ asset, weight }) => ({ value: asset.read.meanL, weight }))),
    stdL: weightedNumber(weighted.map(({ asset, weight }) => ({ value: asset.read.stdL, weight }))),
    edgeDensity: weightedNumber(weighted.map(({ asset, weight }) => ({ value: asset.read.edgeDensity, weight }))),
    detailEntropy: weightedNumber(weighted.map(({ asset, weight }) => ({ value: asset.read.detailEntropy, weight }))),
    texture: weightedNumber(weighted.map(({ asset, weight }) => ({ value: asset.read.texture, weight }))),
    flatness: weightedNumber(weighted.map(({ asset, weight }) => ({ value: asset.read.flatness, weight }))),
    angularity: weightedNumber(weighted.map(({ asset, weight }) => ({ value: asset.read.angularity, weight }))),
    symmetry: weightedNumber(weighted.map(({ asset, weight }) => ({ value: asset.read.symmetry, weight }))),
    keywords,
    confidence: {
      palette: weightedNumber(weighted.map(({ asset, weight }) => ({ value: asset.read.confidence.palette, weight }))),
      form: weightedNumber(weighted.map(({ asset, weight }) => ({ value: asset.read.confidence.form, weight }))),
      finish: weightedNumber(weighted.map(({ asset, weight }) => ({ value: asset.read.confidence.finish, weight }))),
      line: weightedNumber(weighted.map(({ asset, weight }) => ({ value: asset.read.confidence.line, weight }))),
      voice: weightedNumber(weighted.map(({ asset, weight }) => ({ value: asset.read.confidence.voice, weight }))),
    },
    suggestedVoice: {
      grounded: weightedNumber(weighted.map(({ asset, weight }) => ({ value: asset.read.suggestedVoice.grounded, weight }))),
      ornate: weightedNumber(weighted.map(({ asset, weight }) => ({ value: asset.read.suggestedVoice.ornate, weight }))),
      brutal: weightedNumber(weighted.map(({ asset, weight }) => ({ value: asset.read.suggestedVoice.brutal, weight }))),
      springy: weightedNumber(weighted.map(({ asset, weight }) => ({ value: asset.read.suggestedVoice.springy, weight }))),
      vivid: weightedNumber(weighted.map(({ asset, weight }) => ({ value: asset.read.suggestedVoice.vivid, weight }))),
      gritty: weightedNumber(weighted.map(({ asset, weight }) => ({ value: asset.read.suggestedVoice.gritty, weight }))),
    },
    notes: settings.notes,
    sources: weighted.map(({ asset, weight, primary: isPrimary }) => ({
      id: asset.id,
      name: asset.name,
      weight: weight / totalWeight,
      primary: isPrimary,
    })),
  };
}

interface InspirationApplication {
  dna: StyleDNA;
  combined: CombinedInspirationRead;
  settings: InspirationSettings;
  mode: InspirationMode;
  locks: TraitKey[];
  vision?: VisionRead | null;
}

export function applyInspirationToDNA({
  dna,
  combined,
  settings,
  mode,
  locks,
  vision,
}: InspirationApplication): StyleDNA {
  const next: StyleDNA = {
    ...dna,
    paletteParams: { ...dna.paletteParams },
  };
  const influence = clamp(settings.influence);
  const weights: Record<InspirationMode, Record<InspirationFeature, number>> = {
    palette: { palette: 1, form: 0.35, finish: 0.2, line: 0.2 },
    form: { palette: 0.4, form: 1, finish: 0.35, line: 0.3 },
    finish: { palette: 0.35, form: 0.4, finish: 1, line: 0.85 },
    prompt: { palette: 0.2, form: 0.2, finish: 0.2, line: 0.2 },
  };
  const featureWeight = (feature: InspirationFeature) =>
    settings.features[feature] ? influence * weights[mode][feature] : 0;

  const paletteWeight = featureWeight('palette');
  if (!settings.features.palette && !locks.includes('palette')) {
    next.referencePalette = undefined;
    next.paletteFidelity = 0;
  }
  if (paletteWeight > 0.001 && !locks.includes('palette')) {
    next.paletteParams.hue = blendHue(next.paletteParams.hue, combined.hue, paletteWeight * 0.8);
    next.paletteParams.accentHue = blendHue(next.paletteParams.accentHue, combined.accentHue, paletteWeight * 0.8);
    next.paletteParams.foliageHue = blendHue(next.paletteParams.foliageHue, combined.foliageHue, paletteWeight * 0.7);
    next.paletteParams.chroma = lerp(next.paletteParams.chroma, combined.chroma, paletteWeight * 0.8);
    next.paletteParams.contrast = lerp(next.paletteParams.contrast, combined.contrast, paletteWeight * 0.8);
    next.paletteParams.warmth = lerp(next.paletteParams.warmth, combined.warmth, paletteWeight * 0.7);
    next.referencePalette = [...combined.palette];
    next.paletteFidelity = clamp(settings.paletteFidelity * weights[mode].palette);
  }

  const formWeight = featureWeight('form');
  if (formWeight > 0.001 && !locks.includes('form')) {
    next.roundness = lerp(next.roundness, 1 - combined.angularity, formWeight * 0.65);
    next.spikiness = lerp(next.spikiness, combined.angularity * 0.85, formWeight * 0.65);
    next.asymmetry = lerp(next.asymmetry, 1 - combined.symmetry, formWeight * 0.35);
    next.golden = lerp(next.golden ?? 0.618, 0.5 + combined.symmetry * 0.2, formWeight * 0.25);
  }

  const finishWeight = featureWeight('finish');
  if (finishWeight > 0.001 && !locks.includes('detail')) {
    next.detail = lerp(next.detail, clamp(combined.detailEntropy * 0.6 + combined.edgeDensity * 0.7), finishWeight * 0.7);
    next.dither = lerp(next.dither, combined.texture, finishWeight * 0.55);
  }

  const lineWeight = featureWeight('line');
  if (lineWeight > 0.001 && !locks.includes('line')) {
    next.outline = lerp(next.outline, clamp(0.3 + combined.edgeDensity * 0.8 + combined.contrast * 0.3), lineWeight * 0.5);
  }

  if (vision?.accepted) {
    if (!locks.includes('motion')) {
      next.bounce = lerp(next.bounce, clamp(vision.suggestedMotion.bounce), influence * 0.65);
      next.weight = lerp(next.weight, clamp(vision.suggestedMotion.weight), influence * 0.65);
      next.sway = lerp(next.sway, clamp(vision.suggestedMotion.sway), influence * 0.65);
    }
    const voiceBlend = influence * 0.7;
    const existing = next.voiceOverride ? { ...next.voice, ...next.voiceOverride } : next.voice;
    next.voiceOverride = {
      grounded: lerp(existing.grounded, clamp(vision.voice.grounded), voiceBlend),
      ornate: lerp(existing.ornate, clamp(vision.voice.ornate), voiceBlend),
      brutal: lerp(existing.brutal, clamp(vision.voice.brutal), voiceBlend),
      springy: lerp(existing.springy, clamp(vision.voice.springy), voiceBlend),
      vivid: lerp(existing.vivid, clamp(vision.voice.vivid), voiceBlend),
      gritty: lerp(existing.gritty, clamp(vision.voice.gritty), voiceBlend),
    };
  }

  return refreshDNA(next);
}

export function referenceMatch(
  dna: StyleDNA,
  combined: CombinedInspirationRead,
  settings: InspirationSettings,
): number {
  const hueDistance = Math.min(
    Math.abs(dna.paletteParams.hue - combined.hue),
    360 - Math.abs(dna.paletteParams.hue - combined.hue),
  );
  const hueScore = 1 - hueDistance / 180;
  const chromaScore = 1 - Math.min(1, Math.abs(dna.paletteParams.chroma - combined.chroma));
  const contrastScore = 1 - Math.min(1, Math.abs(dna.paletteParams.contrast - combined.contrast));
  const warmthScore = 1 - Math.min(1, Math.abs(dna.paletteParams.warmth - combined.warmth) / 2);
  const detailScore = 1 - Math.min(1, Math.abs(dna.detail - combined.detailEntropy) / 0.6);
  const formScore = 1 - Math.min(1, Math.abs(dna.roundness - (1 - combined.angularity)) / 0.7);
  const fidelityBonus = settings.features.palette ? (dna.paletteFidelity ?? 0) * 0.1 : 0;
  return Math.round(clamp(
    hueScore * 0.22
      + chromaScore * 0.15
      + contrastScore * 0.13
      + warmthScore * 0.1
      + detailScore * 0.12
      + formScore * 0.12
      + fidelityBonus
      + (settings.influence * 0.06),
  ) * 100);
}

export function inspirationKeywords(read: CombinedInspirationRead | null): string[] {
  return read?.keywords ?? [];
}

export function featureLabel(feature: InspirationFeature): string {
  return feature === 'palette' ? 'Palette' : feature === 'form' ? 'Form' : feature === 'finish' ? 'Finish' : 'Line';
}

export async function readInspirationFile(file: File): Promise<InspirationAsset> {
  if (!file.type.startsWith('image/') && !/\.(png|jpe?g|webp|gif|avif)$/i.test(file.name)) {
    throw new Error('Choose a PNG, JPG, or WebP image.');
  }
  if (file.size > MAX_FILE_BYTES) {
    throw new Error('That image is larger than 15 MB.');
  }
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
  } catch {
    bitmap = await createImageBitmap(file);
  }
  const ratio = Math.min(1, MAX_ANALYSIS_EDGE / Math.max(bitmap.width, bitmap.height));
  const width = Math.max(1, Math.round(bitmap.width * ratio));
  const height = Math.max(1, Math.round(bitmap.height * ratio));

  const analysis = document.createElement('canvas');
  analysis.width = width;
  analysis.height = height;
  const analysisCtx = analysis.getContext('2d', { willReadFrequently: true });
  if (!analysisCtx) throw new Error('Image analysis is unavailable in this browser.');
  analysisCtx.drawImage(bitmap, 0, 0, width, height);
  const imageData = analysisCtx.getImageData(0, 0, width, height);
  const read = analyzePixels(imageData.data, width, height);

  const makePreview = (maxEdge: number, quality: number): string => {
    const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const ctx = canvas.getContext('2d');
    if (!ctx) return '';
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const webp = canvas.toDataURL('image/webp', quality);
    return webp.startsWith('data:image/webp') ? webp : canvas.toDataURL('image/png');
  };

  const thumbnail = makePreview(MAX_THUMB_EDGE, 0.72);
  const preview = makePreview(MAX_ANALYSIS_EDGE, 0.68);
  const sample: string[] = [];
  for (let i = 0; i < imageData.data.length; i += 97) sample.push(String(imageData.data[i]));
  const hash = hashString(sample.join(',')).toString(16);
  const id = `ref_${hash}_${Date.now().toString(36)}`;
  const originalWidth = bitmap.width;
  const originalHeight = bitmap.height;
  bitmap.close();

  return {
    id,
    name: file.name || 'Pasted reference',
    hash,
    width: originalWidth,
    height: originalHeight,
    thumbnail,
    preview,
    read,
    weight: 0.4,
    createdAt: Date.now(),
  };
}

export const INSPIRATION_FEATURES: InspirationFeature[] = ['palette', 'form', 'finish', 'line'];
