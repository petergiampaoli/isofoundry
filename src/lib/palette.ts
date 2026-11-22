import { RNG, clamp } from './rng';
import { blendHue, makeRamp, oklchToHex } from './color';
import type { Material, Palette, PaletteParams } from '../types';

function materialRamp(
  hue: number,
  chroma: number,
  baseL: number,
  contrast: number,
): string[] {
  return makeRamp(hue, {
    chroma,
    baseL,
    contrast,
    steps: 5,
  });
}

export function defaultPaletteParams(seed: number): PaletteParams {
  const rng = new RNG(seed);
  const hue = rng.float(82, 255);
  const accentHue = (hue + rng.pick([55, 115, 165, 195])) % 360;
  return {
    hue,
    accentHue,
    foliageHue: rng.chance(0.72) ? rng.float(88, 148) : (hue + 20) % 360,
    chroma: rng.float(0.3, 0.62),
    contrast: rng.float(0.45, 0.72),
    warmth: rng.float(-0.35, 0.45),
  };
}

export function paletteFromParams(params: PaletteParams): Palette {
  const chroma = 0.016 + params.chroma * 0.15;
  const contrast = clamp(params.contrast, 0.2, 0.95);
  const warm = params.warmth;

  const stoneHue = blendHue(params.hue, 224, 0.52);
  const metalHue = blendHue(params.hue, 222, 0.7);
  const woodHue = blendHue(29, params.hue, 0.12 + Math.max(0, warm) * 0.04);
  const skinHue = blendHue(27, params.hue, 0.08 + Math.max(0, warm) * 0.04);
  const boneHue = blendHue(46, params.hue, 0.16);

  const ramps: Record<Material, string[]> = {
    foliage: materialRamp(params.foliageHue, chroma * 1.06, 0.48 + warm * 0.015, contrast * 1.02),
    wood: materialRamp(woodHue, chroma * 0.5, 0.38, contrast * 0.9),
    stone: materialRamp(stoneHue, chroma * 0.25, 0.5, contrast * 0.96),
    metal: materialRamp(metalHue, chroma * 0.2, 0.57, contrast * 1.12),
    cloth: materialRamp(params.accentHue, chroma * 1.05, 0.43, contrast * 0.92),
    skin: materialRamp(skinHue, 0.035 + chroma * 0.16, 0.66, contrast * 0.52),
    accent: materialRamp(params.accentHue, chroma * 1.28, 0.55, contrast * 1.04),
    bone: materialRamp(boneHue, 0.028 + chroma * 0.08, 0.75, contrast * 0.55),
    gold: materialRamp(74, 0.095 + chroma * 0.12, 0.62, contrast * 0.92),
  };

  return {
    ramps,
    outline: oklchToHex(0.115, 0.014, params.hue),
    shadow: oklchToHex(0.1, 0.012, params.hue),
    accent: ramps.accent[3],
  };
}

export function paletteToRows(palette: Palette): Array<{ name: string; colors: string[] }> {
  return (Object.keys(palette.ramps) as Material[]).map((name) => ({
    name,
    colors: palette.ramps[name],
  }));
}

export function quantizedPalette(palette: Palette): string[] {
  return [
    palette.outline,
    ...Object.values(palette.ramps).flat(),
  ];
}
