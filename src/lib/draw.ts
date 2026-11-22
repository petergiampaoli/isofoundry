import type { Material, Stage, StyleDNA } from '../types';
import type { PixelBuffer, Point } from './raster';
import { hexToRgba, type RGBA } from './color';
import { RNG, clamp } from './rng';

export interface DrawContext {
  buffer: PixelBuffer;
  dna: StyleDNA;
  rng: RNG;
  cx: number;
  groundY: number;
  stage: Stage;
  phase: number;
  detail: number;
  outline: number;
}

export function stageDetail(stage: Stage): number {
  return stage === 'sketch' ? 0.18 : stage === 'refine' ? 0.58 : 1;
}

export function stageOutline(stage: Stage, dna: StyleDNA): number {
  return stage === 'sketch' ? 0 : stage === 'refine' ? dna.outline * 0.62 : dna.outline;
}

export function makeDrawContext(
  buffer: PixelBuffer,
  dna: StyleDNA,
  seed: number,
  stage: Stage,
  phase = 0,
): DrawContext {
  return {
    buffer,
    dna,
    rng: new RNG(seed ^ 0x9e3779b9),
    cx: Math.floor(buffer.width / 2),
    groundY: Math.floor(buffer.height * 0.79),
    stage,
    phase,
    detail: dna.detail * stageDetail(stage),
    outline: stageOutline(stage, dna),
  };
}

export function mat(ctx: DrawContext, material: Material, index: number, alpha = 255): RGBA {
  const ramp = ctx.dna.palette.ramps[material];
  const i = Math.max(0, Math.min(ramp.length - 1, Math.round(index)));
  return hexToRgba(ramp[i], alpha);
}

export function outlineColor(ctx: DrawContext, alpha = 255): RGBA {
  return hexToRgba(ctx.dna.palette.outline, alpha);
}

export function shadow(ctx: DrawContext, rx = 16, ry = 6): void {
  const color = hexToRgba(ctx.dna.palette.shadow, 92);
  const inner = hexToRgba(ctx.dna.palette.shadow, 64);
  ctx.buffer.ellipse(ctx.cx, ctx.groundY + 2, rx, ry, color);
  ctx.buffer.ellipse(ctx.cx, ctx.groundY + 2, rx * 0.64, ry * 0.58, inner);
}

export interface IsoBoxOptions {
  topIndex?: number;
  leftIndex?: number;
  rightIndex?: number;
  bevel?: boolean;
  line?: boolean;
}

export function isoBox(
  ctx: DrawContext,
  cx: number,
  baseY: number,
  hw: number,
  hh: number,
  height: number,
  material: Material,
  options: IsoBoxOptions = {},
): void {
  const topIndex = options.topIndex ?? 3.4;
  const leftIndex = options.leftIndex ?? 2.2;
  const rightIndex = options.rightIndex ?? 1.25;
  const topY = baseY - height;
  const left: Point = [cx - hw, baseY];
  const bottom: Point = [cx, baseY + hh];
  const right: Point = [cx + hw, baseY];
  const leftTop: Point = [cx - hw, topY];
  const bottomTop: Point = [cx, topY + hh];
  const rightTop: Point = [cx + hw, topY];
  const top: Point = [cx, topY - hh];

  ctx.buffer.polygon([left, bottom, bottomTop, leftTop], mat(ctx, material, leftIndex));
  ctx.buffer.polygon([bottom, right, rightTop, bottomTop], mat(ctx, material, rightIndex));
  ctx.buffer.polygon([top, rightTop, bottomTop, leftTop], mat(ctx, material, topIndex));

  if (options.bevel !== false) {
    ctx.buffer.line(top[0], top[1], rightTop[0], rightTop[1], mat(ctx, material, 4, 180));
    ctx.buffer.line(top[0], top[1], leftTop[0], leftTop[1], mat(ctx, material, 4, 150));
    ctx.buffer.line(left[0], left[1], leftTop[0], leftTop[1], mat(ctx, material, 0, 150));
    ctx.buffer.line(right[0], right[1], rightTop[0], rightTop[1], mat(ctx, material, 0, 150));
  }
  if (options.line) {
    ctx.buffer.line(leftTop[0], leftTop[1], bottomTop[0], bottomTop[1], outlineColor(ctx, 180));
    ctx.buffer.line(bottomTop[0], bottomTop[1], rightTop[0], rightTop[1], outlineColor(ctx, 140));
  }
}

export function isoDiamond(
  ctx: DrawContext,
  cx: number,
  cy: number,
  hw: number,
  hh: number,
  color: RGBA,
): void {
  ctx.buffer.polygon(
    [
      [cx, cy - hh],
      [cx + hw, cy],
      [cx, cy + hh],
      [cx - hw, cy],
    ],
    color,
  );
}

export function taperedTrunk(
  ctx: DrawContext,
  cx: number,
  baseY: number,
  height: number,
  width: number,
  lean = 0,
): void {
  const topY = baseY - height;
  const topX = cx + lean;
  const halfBottom = width / 2;
  const halfTop = Math.max(1.2, width * 0.28);
  ctx.buffer.polygon(
    [
      [cx - halfBottom, baseY],
      [topX - halfTop, topY],
      [topX, topY],
      [cx, baseY],
    ],
    mat(ctx, 'wood', 2.2),
  );
  ctx.buffer.polygon(
    [
      [cx, baseY],
      [topX, topY],
      [topX + halfTop, topY],
      [cx + halfBottom, baseY],
    ],
    mat(ctx, 'wood', 0.9),
  );
  ctx.buffer.ellipse(topX, topY + 0.5, halfTop, Math.max(1, halfTop * 0.45), mat(ctx, 'wood', 2.7));

  const roots = ctx.rng.int(2, 4);
  for (let i = 0; i < roots; i += 1) {
    const side = i % 2 === 0 ? -1 : 1;
    const rootX = cx + side * ctx.rng.float(width * 0.3, width * 0.9);
    const rootY = baseY + ctx.rng.float(-1, 1);
    ctx.buffer.polygon(
      [
        [cx + side * halfBottom * 0.7, baseY - 2],
        [rootX, rootY + 1],
        [cx + side * halfBottom * 0.6, baseY + 2],
      ],
      mat(ctx, 'wood', 1.1),
    );
  }

  if (ctx.detail > 0.24) {
    const barkLines = Math.round(2 + ctx.detail * 4);
    for (let i = 0; i < barkLines; i += 1) {
      const t = ctx.rng.float(0.1, 0.85);
      const y = baseY - height * t;
      const lx = cx + lean * t - halfBottom * (1 - t) - halfTop * t + 1;
      const rx = cx + lean * t + halfBottom * (1 - t) + halfTop * t - 1;
      ctx.buffer.line(lx, y, Math.min(rx, lx + ctx.rng.int(2, 5)), y, mat(ctx, 'wood', 0.5, 150));
    }
  }
}

export interface CanopyBlob {
  x: number;
  y: number;
  rx: number;
  ry: number;
}

export function canopyCluster(ctx: DrawContext, blobs: CanopyBlob[], material: Material = 'foliage'): void {
  for (const blob of blobs) {
    ctx.buffer.ellipse(blob.x, blob.y + 1, blob.rx + 1, blob.ry + 1, mat(ctx, material, 0.7));
  }
  for (const blob of blobs) {
    ctx.buffer.ellipse(blob.x, blob.y, blob.rx, blob.ry, mat(ctx, material, 1.8));
  }
  for (const blob of blobs) {
    ctx.buffer.ellipse(blob.x - 1, blob.y - 1, blob.rx * 0.78, blob.ry * 0.76, mat(ctx, material, 2.85));
  }
  for (const blob of blobs) {
    if (blob.rx < 5) continue;
    ctx.buffer.ellipse(blob.x - blob.rx * 0.38, blob.y - blob.ry * 0.38, blob.rx * 0.3, blob.ry * 0.28, mat(ctx, material, 3.7, 220));
  }

  if (ctx.detail > 0.3) {
    const points = Math.round(8 + ctx.detail * 20);
    for (let i = 0; i < points; i += 1) {
      const blob = ctx.rng.pick(blobs);
      const angle = ctx.rng.float(0, Math.PI * 2);
      const radius = Math.sqrt(ctx.rng.float(0, 1));
      const x = Math.round(blob.x + Math.cos(angle) * blob.rx * radius);
      const y = Math.round(blob.y + Math.sin(angle) * blob.ry * radius);
      if (ctx.buffer.get(x, y)[3] < 80) continue;
      const light = ctx.rng.chance(0.5);
      ctx.buffer.set(x, y, mat(ctx, material, light ? 3.8 : 0.9, light ? 190 : 160));
    }
  }

  if (ctx.detail > 0.58) {
    const notches = Math.round(2 + ctx.detail * 3);
    for (let i = 0; i < notches; i += 1) {
      const blob = ctx.rng.pick(blobs);
      const x = blob.x + ctx.rng.float(-blob.rx * 0.5, blob.rx * 0.5);
      const y = blob.y + ctx.rng.float(blob.ry * 0.2, blob.ry * 0.75);
      ctx.buffer.ellipse(x, y, ctx.rng.float(1.2, 2.6), ctx.rng.float(1, 2), mat(ctx, material, 0.45, 190));
    }
  }
}

export function tuft(ctx: DrawContext, x: number, y: number, size = 1): void {
  if (ctx.detail < 0.18) return;
  const count = Math.max(2, Math.round((2 + ctx.detail * 3) * size));
  for (let i = 0; i < count; i += 1) {
    const bx = Math.round(x + ctx.rng.float(-3, 3) * size);
    const height = ctx.rng.float(2, 5) * size;
    const lean = ctx.rng.float(-1.5, 1.5);
    ctx.buffer.line(bx, y, bx + lean, y - height, mat(ctx, 'foliage', ctx.rng.float(1.5, 3.2), 230));
  }
}

export function pebble(ctx: DrawContext, x: number, y: number, size = 1): void {
  if (ctx.detail < 0.25) return;
  ctx.buffer.ellipse(x, y, size * 1.6, size, mat(ctx, 'stone', 2.2));
  ctx.buffer.ellipse(x - size * 0.4, y - size * 0.3, size * 0.8, size * 0.45, mat(ctx, 'stone', 3.2, 190));
}

export function sparkle(ctx: DrawContext, x: number, y: number, size = 2, material: Material = 'accent'): void {
  const color = mat(ctx, material, 4.3, 240);
  ctx.buffer.set(x, y, color);
  for (let i = 1; i <= size; i += 1) {
    const alpha = Math.max(80, 220 - i * 45);
    ctx.buffer.set(x - i, y, mat(ctx, material, 4, alpha));
    ctx.buffer.set(x + i, y, mat(ctx, material, 4, alpha));
    ctx.buffer.set(x, y - i, mat(ctx, material, 4, alpha));
    ctx.buffer.set(x, y + i, mat(ctx, material, 4, alpha));
  }
}

export function crack(ctx: DrawContext, x: number, y: number, length: number, material: Material = 'stone'): void {
  let cx = x;
  let cy = y;
  for (let i = 0; i < length; i += 1) {
    ctx.buffer.set(cx, cy, mat(ctx, material, 0.3, 180));
    const roll = ctx.rng.float(0, 1);
    if (roll < 0.4) cx += ctx.rng.chance(0.5) ? 1 : -1;
    else if (roll < 0.7) cy += 1;
    else cx += ctx.rng.chance(0.5) ? 1 : -1;
  }
}

export function mossPatch(ctx: DrawContext, cx: number, cy: number, rx: number, ry: number, density = 1): void {
  if (ctx.detail < 0.22) return;
  const count = Math.round((6 + ctx.detail * 18) * density);
  for (let i = 0; i < count; i += 1) {
    const angle = ctx.rng.float(0, Math.PI * 2);
    const radius = Math.sqrt(ctx.rng.float(0, 1));
    const x = Math.round(cx + Math.cos(angle) * rx * radius);
    const y = Math.round(cy + Math.sin(angle) * ry * radius);
    ctx.buffer.set(x, y, mat(ctx, 'foliage', ctx.rng.chance(0.55) ? 2.4 : 1.4, 220));
  }
}

export function drawPyramidRoof(
  ctx: DrawContext,
  cx: number,
  baseY: number,
  hw: number,
  hh: number,
  height: number,
  material: Material = 'stone',
): void {
  const apex: Point = [cx, baseY - height];
  const left: Point = [cx - hw, baseY];
  const bottom: Point = [cx, baseY + hh];
  const right: Point = [cx + hw, baseY];
  ctx.buffer.polygon([left, bottom, apex], mat(ctx, material, 2.2));
  ctx.buffer.polygon([bottom, right, apex], mat(ctx, material, 1.0));
  ctx.buffer.line(apex[0], apex[1], left[0], left[1], mat(ctx, material, 3.4, 180));
  ctx.buffer.line(apex[0], apex[1], right[0], right[1], mat(ctx, material, 1.8, 170));
  ctx.buffer.line(apex[0], apex[1], bottom[0], bottom[1], mat(ctx, material, 0.6, 150));

  if (ctx.detail > 0.28) {
    const rows = 3;
    for (let row = 1; row < rows; row += 1) {
      const t = row / rows;
      const y = baseY - height * t;
      const leftX = cx - hw * (1 - t);
      const rightX = cx + hw * (1 - t);
      ctx.buffer.line(leftX, y + hh * (1 - t) * 0.15, cx, y + hh * 0.2, mat(ctx, material, 0.5, 130));
      ctx.buffer.line(cx, y + hh * 0.2, rightX, y + hh * (1 - t) * 0.15, mat(ctx, material, 0.4, 130));
    }
  }
}

export function lerpPoint(a: Point, b: Point, t: number): Point {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
}

export function bodyBob(ctx: DrawContext, strength = 1): number {
  return Math.round(Math.sin(ctx.phase * Math.PI * 2) * (0.7 + ctx.dna.bounce * 1.4) * strength);
}

export function swayOffset(ctx: DrawContext, strength = 1): number {
  return Math.sin(ctx.phase * Math.PI * 2 + Math.PI * 0.35) * ctx.dna.sway * 2.2 * strength;
}

export function detailStep(detail: number, steps = 3): number {
  return 1 + Math.floor(clamp(detail, 0, 1) * steps);
}
