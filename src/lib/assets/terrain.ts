import type { DrawContext } from '../draw';
import { isoDiamond, mat, mossPatch, pebble, tuft } from '../draw';
import type { Point } from '../raster';

export function drawTerrain(ctx: DrawContext): void {
  const hw = (27 + ctx.dna.chunkiness * 7) * (0.9 + ctx.dna.height * 0.12);
  const hh = hw * 0.5;
  const cy = ctx.groundY - 12;
  const depth = 3 + Math.round(ctx.dna.chunkiness * 3);
  const variant = ctx.dna.seed % 4;
  const material = variant === 1 ? 'wood' : variant === 2 ? 'stone' : 'foliage';
  const topIndex = variant === 1 ? 2.1 : variant === 2 ? 2.4 : 2.2;
  const leftIndex = variant === 1 ? 1.0 : variant === 2 ? 1.2 : 1.15;
  const rightIndex = variant === 1 ? 0.4 : variant === 2 ? 0.55 : 0.5;

  const top: Point = [ctx.cx, cy - hh];
  const right: Point = [ctx.cx + hw, cy];
  const bottom: Point = [ctx.cx, cy + hh];
  const left: Point = [ctx.cx - hw, cy];

  ctx.buffer.polygon([left, bottom, [bottom[0], bottom[1] + depth], [left[0], left[1] + depth]], mat(ctx, material, leftIndex));
  ctx.buffer.polygon([bottom, right, [right[0], right[1] + depth], [bottom[0], bottom[1] + depth]], mat(ctx, material, rightIndex));

  isoDiamond(ctx, ctx.cx, cy, hw, hh, mat(ctx, material, topIndex));
  ctx.buffer.line(left[0], left[1], top[0], top[1], mat(ctx, material, 3.9, 180));
  ctx.buffer.line(top[0], top[1], right[0], right[1], mat(ctx, material, 3.2, 140));
  ctx.buffer.line(left[0], left[1], bottom[0], bottom[1], mat(ctx, material, 0.9, 160));
  ctx.buffer.line(bottom[0], bottom[1], right[0], right[1], mat(ctx, material, 0.6, 180));
  ctx.buffer.line(left[0], left[1], left[0], left[1] + depth, mat(ctx, material, 0.5, 190));
  ctx.buffer.line(bottom[0], bottom[1], bottom[0], bottom[1] + depth, mat(ctx, material, 0.4, 160));

  if (ctx.detail > 0.25) {
    const count = variant === 2 ? 4 : 8;
    for (let i = 0; i < count; i += 1) {
      const x = ctx.cx + ctx.rng.float(-hw * 0.6, hw * 0.6);
      const y = cy + ctx.rng.float(-hh * 0.45, hh * 0.45);
      if (Math.abs(x - ctx.cx) / hw + Math.abs(y - cy) / hh > 0.82) continue;
      if (variant === 2) {
        pebble(ctx, x, y, ctx.rng.float(0.45, 0.8));
      } else {
        ctx.buffer.set(Math.round(x), Math.round(y), mat(ctx, material, ctx.rng.chance(0.5) ? 3.5 : 0.7, 180));
      }
    }
  }

  if (variant === 0) {
    tuft(ctx, ctx.cx - hw * 0.48, cy + 2, 0.6);
    tuft(ctx, ctx.cx + hw * 0.38, cy + 4, 0.55);
    if (ctx.detail > 0.56) {
      const fx = ctx.cx + ctx.rng.float(-hw * 0.35, hw * 0.35);
      const fy = cy + ctx.rng.float(-2, 4);
      ctx.buffer.set(Math.round(fx), Math.round(fy), mat(ctx, 'accent', 3.4));
      ctx.buffer.set(Math.round(fx) + 1, Math.round(fy), mat(ctx, 'accent', 2.2));
    }
  }

  if (variant === 2 && ctx.detail > 0.4) {
    mossPatch(ctx, ctx.cx - hw * 0.16, cy - 2, hw * 0.2, hh * 0.2, 0.5);
  }
  if (variant === 1 && ctx.detail > 0.36) {
    pebble(ctx, ctx.cx + hw * 0.2, cy + 2, 0.75);
    pebble(ctx, ctx.cx - hw * 0.25, cy - 1, 0.6);
  }
}
