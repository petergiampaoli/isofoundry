import { clamp } from './rng';

export type RGBA = [number, number, number, number];

const cache = new Map<string, RGBA>();

export function hexToRgba(hex: string, alpha = 255): RGBA {
  const key = `${hex}:${alpha}`;
  const cached = cache.get(key);
  if (cached) return [...cached] as RGBA;
  const clean = hex.replace('#', '');
  const value = clean.length === 3
    ? clean.split('').map((c) => c + c).join('')
    : clean;
  const r = parseInt(value.slice(0, 2), 16);
  const g = parseInt(value.slice(2, 4), 16);
  const b = parseInt(value.slice(4, 6), 16);
  const result: RGBA = [r, g, b, alpha];
  cache.set(key, result);
  return [...result] as RGBA;
}

export function rgbaToHex(rgba: RGBA): string {
  return `#${rgba.slice(0, 3).map((v) => Math.round(v).toString(16).padStart(2, '0')).join('')}`;
}

export function clamp01(value: number): number {
  return clamp(value, 0, 1);
}

export function blendHue(a: number, b: number, t: number): number {
  const from = ((a % 360) + 360) % 360;
  const to = ((b % 360) + 360) % 360;
  let delta = to - from;
  if (delta > 180) delta -= 360;
  if (delta < -180) delta += 360;
  return (from + delta * clamp01(t) + 360) % 360;
}

export function linearToSrgb(value: number): number {
  if (value <= 0.0031308) return 12.92 * value;
  return 1.055 * Math.pow(value, 1 / 2.4) - 0.055;
}

export function srgbToLinear(value: number): number {
  if (value <= 0.04045) return value / 12.92;
  return Math.pow((value + 0.055) / 1.055, 2.4);
}

export function oklchToRgb(L: number, C: number, H: number): [number, number, number] {
  const hRad = (H * Math.PI) / 180;
  const a = C * Math.cos(hRad);
  const b = C * Math.sin(hRad);

  const l_ = L + 0.3963377774 * a + 0.2158037573 * b;
  const m_ = L - 0.1055613458 * a - 0.0638541728 * b;
  const s_ = L - 0.0894841775 * a - 1.291485548 * b;

  const l = l_ * l_ * l_;
  const m = m_ * m_ * m_;
  const s = s_ * s_ * s_;

  const r = 4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s;
  const g = -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s;
  const blue = -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s;

  return [
    Math.round(clamp01(linearToSrgb(clamp(r, 0, 1))) * 255),
    Math.round(clamp01(linearToSrgb(clamp(g, 0, 1))) * 255),
    Math.round(clamp01(linearToSrgb(clamp(blue, 0, 1))) * 255),
  ];
}

export function oklchToHex(L: number, C: number, H: number): string {
  const [r, g, b] = oklchToRgb(L, C, H);
  return `#${[r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('')}`;
}

export interface Oklch {
  L: number;
  C: number;
  H: number;
}

export function rgbToOklch(r: number, g: number, b: number): Oklch {
  const lr = srgbToLinear(r / 255);
  const lg = srgbToLinear(g / 255);
  const lb = srgbToLinear(b / 255);

  const l = 0.4122214708 * lr + 0.5363325363 * lg + 0.0514459929 * lb;
  const m = 0.2119034982 * lr + 0.6806995451 * lg + 0.1073969566 * lb;
  const s = 0.0883024619 * lr + 0.2817188376 * lg + 0.6299787005 * lb;

  const l_ = Math.cbrt(l);
  const m_ = Math.cbrt(m);
  const s_ = Math.cbrt(s);

  const L = 0.2104542553 * l_ + 0.793617785 * m_ - 0.0040720468 * s_;
  const a = 1.9779984951 * l_ - 2.428592205 * m_ + 0.4505937099 * s_;
  const bb = 0.0259040371 * l_ + 0.7827717662 * m_ - 0.808675766 * s_;

  const C = Math.sqrt(a * a + bb * bb);
  let H = (Math.atan2(bb, a) * 180) / Math.PI;
  if (H < 0) H += 360;
  return { L: clamp(L, 0, 1), C: clamp(C, 0, 0.4), H };
}

export function hexToOklch(hex: string): Oklch {
  const [r, g, b] = hexToRgba(hex);
  return rgbToOklch(r, g, b);
}

export interface RampOptions {
  chroma: number;
  baseL: number;
  contrast: number;
  steps?: number;
  hueShift?: number;
}

export function makeRamp(hue: number, options: RampOptions): string[] {
  const steps = options.steps ?? 5;
  const colors: string[] = [];
  const spread = 0.22 + options.contrast * 0.34;
  for (let i = 0; i < steps; i += 1) {
    const t = i / (steps - 1);
    const L = clamp(options.baseL + (t - 0.42) * spread, 0.1, 0.95);
    const shadowPull = Math.max(0, 0.5 - t) * 2;
    const highlightPull = Math.max(0, t - 0.5) * 2;
    const h = blendHue(
      blendHue(hue, 250, shadowPull * (options.hueShift ?? 0.16)),
      68,
      highlightPull * (options.hueShift ?? 0.12),
    );
    const chromaShape = 0.72 + Math.sin(Math.PI * t) * 0.42;
    const C = options.chroma * chromaShape;
    colors.push(oklchToHex(L, C, h));
  }
  return colors;
}

export function relativeLuminance(hex: string): number {
  const rgba = hexToRgba(hex);
  const [r, g, b] = rgba.map((v) => srgbToLinear(v / 255));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function rgbToHue(r: number, g: number, b: number): number {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const delta = max - min;
  if (delta === 0) return 0;
  let hue = 0;
  if (max === rn) hue = ((gn - bn) / delta) % 6;
  else if (max === gn) hue = (bn - rn) / delta + 2;
  else hue = (rn - gn) / delta + 4;
  return (hue * 60 + 360) % 360;
}

export function colorDistance(a: RGBA, b: RGBA): number {
  return Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]) + Math.abs(a[2] - b[2]);
}

export function alphaBlend(dst: RGBA, src: RGBA): RGBA {
  const sa = src[3] / 255;
  const da = dst[3] / 255;
  const outA = sa + da * (1 - sa);
  if (outA === 0) return [0, 0, 0, 0];
  return [
    Math.round((src[0] * sa + dst[0] * da * (1 - sa)) / outA),
    Math.round((src[1] * sa + dst[1] * da * (1 - sa)) / outA),
    Math.round((src[2] * sa + dst[2] * da * (1 - sa)) / outA),
    Math.round(outA * 255),
  ];
}
