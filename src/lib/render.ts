import type { AssetKind, Stage, StyleDNA } from '../types';
import { PixelBuffer } from './raster';
import { hexToRgba } from './color';
import { makeDrawContext } from './draw';
import { drawTree } from './assets/tree';
import { drawStone } from './assets/stone';
import { drawCharacter } from './assets/character';
import { drawBuilding } from './assets/building';
import { drawCrystal } from './assets/crystal';
import { drawObject } from './assets/object';
import { drawTerrain } from './assets/terrain';

export interface RenderOptions {
  size?: number;
  stage?: Stage;
  phase?: number;
}

export function renderAsset(
  kind: AssetKind,
  dna: StyleDNA,
  seed: number,
  options: RenderOptions = {},
): PixelBuffer {
  const size = options.size ?? 96;
  const stage = options.stage ?? 'final';
  const phase = options.phase ?? 0;
  const buffer = new PixelBuffer(size, size);
  const ctx = makeDrawContext(buffer, dna, seed, stage, phase);

  switch (kind) {
    case 'tree':
      drawTree(ctx);
      break;
    case 'stone':
      drawStone(ctx);
      break;
    case 'character':
      drawCharacter(ctx, seed);
      break;
    case 'enemy':
      drawCharacter(ctx, seed, 3);
      break;
    case 'building':
      drawBuilding(ctx);
      break;
    case 'crystal':
      drawCrystal(ctx);
      break;
    case 'object':
      drawObject(ctx);
      break;
    case 'terrain':
      drawTerrain(ctx);
      break;
  }

  if (ctx.outline > 0.12) {
    buffer.outline(hexToRgba(dna.palette.outline), 180);
  }
  return buffer;
}

export function renderFrames(
  kind: AssetKind,
  dna: StyleDNA,
  seed: number,
  frameCount = 4,
  size = 96,
): PixelBuffer[] {
  return Array.from({ length: frameCount }, (_, index) =>
    renderAsset(kind, dna, seed, { size, stage: 'final', phase: index / frameCount }),
  );
}

export function probeSeed(kind: AssetKind): number {
  switch (kind) {
    case 'tree':
      return 4103;
    case 'stone':
      return 5209;
    case 'character':
      return 6301;
    case 'enemy':
      return 6907;
    case 'building':
      return 7411;
    case 'crystal':
      return 8521;
    case 'object':
      return 9109;
    case 'terrain':
      return 9707;
  }
}
