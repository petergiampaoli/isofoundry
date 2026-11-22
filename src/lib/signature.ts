import type { FitResult, FitSubscores, StyleSignature } from '../types';
import type { PixelBuffer } from './raster';
import { colorDistance, hexToRgba, relativeLuminance, rgbToHue, type RGBA } from './color';

const BINS_PER_CHANNEL = 8;
const BIN_COUNT = BINS_PER_CHANNEL ** 3;

function rgbHex(r: number, g: number, b: number): string {
  return `#${[r, g, b].map((value) => value.toString(16).padStart(2, '0')).join('')}`;
}

function rgbaToHex(rgba: RGBA): string {
  return `#${rgba.slice(0, 3).map((value) => value.toString(16).padStart(2, '0')).join('')}`;
}

export function computeSignature(buffer: PixelBuffer, outlineHex?: string): StyleSignature {
  const outlineRgba = outlineHex ? hexToRgba(outlineHex) : null;
  const counts = new Map<string, number>();
  const histogram = new Array<number>(BIN_COUNT).fill(0);
  let visiblePixels = 0;
  let minX = buffer.width;
  let minY = buffer.height;
  let maxX = -1;
  let maxY = -1;
  let sumL = 0;
  let sumL2 = 0;
  let outlinePixels = 0;
  let isolated = 0;
  let perimeter = 0;

  const isVisible = (x: number, y: number): boolean => buffer.get(x, y)[3] >= 180;

  for (let y = 0; y < buffer.height; y += 1) {
    for (let x = 0; x < buffer.width; x += 1) {
      const rgba = buffer.get(x, y);
      if (rgba[3] < 180) continue;
      visiblePixels += 1;
      if (x < minX) minX = x;
      if (y < minY) minY = y;
      if (x > maxX) maxX = x;
      if (y > maxY) maxY = y;

      const hex = rgbaToHex(rgba);
      counts.set(hex, (counts.get(hex) ?? 0) + 1);
      const bin = (Math.floor(rgba[0] / (256 / BINS_PER_CHANNEL)) * BINS_PER_CHANNEL * BINS_PER_CHANNEL)
        + (Math.floor(rgba[1] / (256 / BINS_PER_CHANNEL)) * BINS_PER_CHANNEL)
        + Math.floor(rgba[2] / (256 / BINS_PER_CHANNEL));
      histogram[bin] += 1;

      const l = relativeLuminance(hex);
      sumL += l;
      sumL2 += l * l;
      if (outlineRgba ? colorDistance(rgba, outlineRgba) < 28 : l < 0.22) outlinePixels += 1;

      let neighborsVisible = 0;
      let sameNeighbor = false;
      const neighborCoords: Array<[number, number]> = [[x - 1, y], [x + 1, y], [x, y - 1], [x, y + 1]];
      for (const [nx, ny] of neighborCoords) {
        if (nx < 0 || ny < 0 || nx >= buffer.width || ny >= buffer.height) continue;
        const neighbor = buffer.get(nx, ny);
        if (neighbor[3] < 180) continue;
        neighborsVisible += 1;
        if (colorDistance(rgba, neighbor) < 18) sameNeighbor = true;
      }
      if (neighborsVisible < 4) {
        perimeter += 1;
      }
      if (!sameNeighbor) isolated += 1;
    }
  }

  if (visiblePixels === 0) {
    return {
      version: 1,
      topColors: [],
      paletteHistogram: histogram,
      colorCount: 0,
      meanL: 0,
      stdL: 0,
      edgeDensity: 0,
      outlineRatio: 0,
      isolatedRatio: 0,
      detailEntropy: 0,
      fillRatio: 0,
      symmetry: 0,
      silhouetteComplexity: 0,
      dominantHue: 0,
      visiblePixels: 0,
    };
  }

  for (let i = 0; i < histogram.length; i += 1) histogram[i] /= visiblePixels;

  let edgePixels = 0;
  for (let y = 0; y < buffer.height; y += 1) {
    for (let x = 0; x < buffer.width; x += 1) {
      const rgba = buffer.get(x, y);
      if (rgba[3] < 180) continue;
      const right = buffer.get(x + 1, y);
      const down = buffer.get(x, y + 1);
      if ((right[3] >= 180 && colorDistance(rgba, right) > 52) || (down[3] >= 180 && colorDistance(rgba, down) > 52)) {
        edgePixels += 1;
      }
    }
  }

  const bboxW = maxX - minX + 1;
  const bboxH = maxY - minY + 1;
  const fillRatio = visiblePixels / Math.max(1, bboxW * bboxH);

  let symmetryMatches = 0;
  let symmetryTotal = 0;
  for (let y = minY; y <= maxY; y += 1) {
    for (let x = minX; x <= Math.floor((minX + maxX) / 2); x += 1) {
      const mirrorX = maxX - (x - minX);
      const a = buffer.get(x, y);
      const b = buffer.get(mirrorX, y);
      if (a[3] < 180 && b[3] < 180) continue;
      symmetryTotal += 1;
      if (a[3] >= 180 && b[3] >= 180 && colorDistance(a, b) < 72) symmetryMatches += 1;
    }
  }
  const symmetry = symmetryTotal > 0 ? symmetryMatches / symmetryTotal : 0;

  let entropy = 0;
  for (const count of counts.values()) {
    const p = count / visiblePixels;
    entropy -= p * Math.log2(p);
  }
  const maxEntropy = Math.log2(Math.max(2, counts.size));
  const detailEntropy = maxEntropy > 0 ? entropy / maxEntropy : 0;

  let hueX = 0;
  let hueY = 0;
  for (const [hex, count] of counts) {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const sat = max === 0 ? 0 : (max - min) / max;
    const weight = (count / visiblePixels) * (0.25 + sat);
    const hue = (rgbToHue(r, g, b) * Math.PI) / 180;
    hueX += Math.cos(hue) * weight;
    hueY += Math.sin(hue) * weight;
  }
  const dominantHue = ((Math.atan2(hueY, hueX) * 180) / Math.PI + 360) % 360;

  const meanL = sumL / visiblePixels;
  const variance = Math.max(0, sumL2 / visiblePixels - meanL * meanL);

  const topColors = [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([hex]) => hex);

  return {
    version: 1,
    topColors,
    paletteHistogram: histogram,
    colorCount: counts.size,
    meanL,
    stdL: Math.sqrt(variance),
    edgeDensity: edgePixels / visiblePixels,
    outlineRatio: outlinePixels / visiblePixels,
    isolatedRatio: isolated / visiblePixels,
    detailEntropy,
    fillRatio,
    symmetry,
    silhouetteComplexity: perimeter / visiblePixels,
    dominantHue,
    visiblePixels,
  };
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

export function compareSignatures(anchor: StyleSignature, candidate: StyleSignature): FitResult {
  let palette = 0;
  for (let i = 0; i < anchor.paletteHistogram.length; i += 1) {
    palette += Math.min(anchor.paletteHistogram[i] ?? 0, candidate.paletteHistogram[i] ?? 0);
  }

  const subscores: FitSubscores = {
    palette: clamp01(palette),
    luminance: clamp01(1 - Math.abs(anchor.meanL - candidate.meanL) / 0.35),
    contrast: clamp01(1 - Math.abs(anchor.stdL - candidate.stdL) / 0.28),
    edge: clamp01(1 - Math.abs(anchor.edgeDensity - candidate.edgeDensity) / 0.34),
    detail: clamp01(1 - Math.abs(anchor.detailEntropy - candidate.detailEntropy) / 0.75),
    silhouette: clamp01(1 - Math.abs(anchor.silhouetteComplexity - candidate.silhouetteComplexity) / 0.45),
    outline: clamp01(1 - Math.abs(anchor.outlineRatio - candidate.outlineRatio) / 0.32),
    fill: clamp01(1 - Math.abs(anchor.fillRatio - candidate.fillRatio) / 0.42),
    symmetry: clamp01(1 - Math.abs(anchor.symmetry - candidate.symmetry) / 0.55),
    hue: clamp01(1 - Math.min(
      Math.abs(anchor.dominantHue - candidate.dominantHue),
      360 - Math.abs(anchor.dominantHue - candidate.dominantHue),
    ) / 150),
  };

  const weights: Record<keyof FitSubscores, number> = {
    palette: 0.24,
    luminance: 0.11,
    contrast: 0.12,
    edge: 0.1,
    detail: 0.1,
    silhouette: 0.12,
    outline: 0.08,
    fill: 0.05,
    symmetry: 0.05,
    hue: 0.03,
  };

  let score = 0;
  for (const key of Object.keys(subscores) as Array<keyof FitSubscores>) {
    score += subscores[key] * weights[key];
  }

  return {
    score: Math.round(clamp01(score) * 100),
    subscores,
    candidate,
    drift: false,
  };
}

export function signatureColors(signature: StyleSignature): Array<{ hex: string; share: number }> {
  return signature.topColors.slice(0, 8).map((hex) => {
    let share = 0;
    for (const [binIndex, value] of signature.paletteHistogram.entries()) {
      const candidate = signature.paletteHistogram[binIndex];
      const r = parseInt(hex.slice(1, 3), 16);
      const g = parseInt(hex.slice(3, 5), 16);
      const b = parseInt(hex.slice(5, 7), 16);
      const bin = (Math.floor(r / (256 / BINS_PER_CHANNEL)) * BINS_PER_CHANNEL * BINS_PER_CHANNEL)
        + (Math.floor(g / (256 / BINS_PER_CHANNEL)) * BINS_PER_CHANNEL)
        + Math.floor(b / (256 / BINS_PER_CHANNEL));
      if (bin === binIndex) share = Math.max(share, value);
    }
    return { hex, share };
  });
}

export { rgbHex };
