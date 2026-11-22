import type { DrawContext } from '../draw';
import { isoBox, isoDiamond, mat, mossPatch, pebble, shadow, tuft } from '../draw';

export function drawObject(ctx: DrawContext): void {
  const scale = 0.86 + ctx.dna.height * 0.2;
  const hw = (16 + ctx.dna.chunkiness * 6) * scale;
  const hh = hw * 0.5;
  const height = (13 + ctx.dna.height * 9) * scale;
  const baseY = ctx.groundY;
  const topY = baseY - height;

  shadow(ctx, hw * 1.05, hh * 0.6);
  isoBox(ctx, ctx.cx, baseY, hw, hh, height, 'wood', {
    topIndex: 3.0,
    leftIndex: 1.9,
    rightIndex: 0.95,
    line: true,
  });

  if (ctx.detail > 0.22) {
    for (const t of [0.28, 0.58, 0.82]) {
      const y = baseY - height * t;
      ctx.buffer.line(ctx.cx - hw + 1, y, ctx.cx + 1, y + hh - 1, mat(ctx, 'wood', 0.6, 160));
      ctx.buffer.line(ctx.cx + 1, y + hh - 1, ctx.cx + hw - 1, y, mat(ctx, 'wood', 0.45, 130));
    }
    for (const x of [ctx.cx - hw + 2, ctx.cx + hw - 2]) {
      ctx.buffer.line(x, baseY - 2, x, topY + 2, mat(ctx, 'metal', 1.8, 200));
      ctx.buffer.line(x + 1, baseY - 3, x + 1, topY + 3, mat(ctx, 'metal', 3.1, 130));
    }
  }

  isoDiamond(
    ctx,
    ctx.cx,
    topY,
    hw * 0.82,
    hh * 0.78,
    mat(ctx, 'wood', 3.55),
  );
  ctx.buffer.line(ctx.cx - hw * 0.82, topY, ctx.cx + hw * 0.82, topY, mat(ctx, 'wood', 2.1, 160));
  ctx.buffer.line(ctx.cx, topY - hh * 0.78, ctx.cx, topY + hh * 0.78, mat(ctx, 'wood', 2.1, 160));
  ctx.buffer.line(ctx.cx - hw * 0.7, topY - hh * 0.1, ctx.cx, topY - hh * 0.55, mat(ctx, 'wood', 4.0, 170));
  ctx.buffer.line(ctx.cx + hw * 0.2, topY - hh * 0.55, ctx.cx + hw * 0.68, topY - hh * 0.1, mat(ctx, 'wood', 3.7, 150));

  const lockX = Math.round(ctx.cx - hw * 0.4);
  const lockY = Math.round(baseY - height * 0.55);
  ctx.buffer.rect(lockX - 2, lockY - 2, 5, 6, mat(ctx, 'metal', 1.1));
  ctx.buffer.rect(lockX - 1, lockY - 1, 3, 3, mat(ctx, 'metal', 2.5));
  ctx.buffer.rect(lockX, lockY, 1, 2, mat(ctx, 'gold', 3.4));
  if (ctx.detail > 0.46) {
    ctx.buffer.set(lockX - 2, lockY - 2, mat(ctx, 'metal', 4.0, 220));
    ctx.buffer.set(lockX + 2, lockY + 3, mat(ctx, 'metal', 0.4, 160));
  }

  if (ctx.dna.seed % 3 === 0) {
    ctx.buffer.polygon(
      [
        [ctx.cx + hw * 0.76, baseY - 2],
        [ctx.cx + hw * 0.98, baseY - 4],
        [ctx.cx + hw * 0.98, baseY - height * 0.72],
        [ctx.cx + hw * 0.76, baseY - height * 0.66],
      ],
      mat(ctx, 'wood', 1.4),
    );
    ctx.buffer.line(ctx.cx + hw * 0.77, baseY - height * 0.3, ctx.cx + hw * 0.97, baseY - height * 0.35, mat(ctx, 'wood', 2.6, 160));
  }

  if (ctx.detail > 0.34) {
    mossPatch(ctx, ctx.cx - hw * 0.2, topY, hw * 0.35, hh * 0.55, 0.6);
    pebble(ctx, ctx.cx + hw + 5, baseY + 2, 0.8);
  }
  tuft(ctx, ctx.cx - hw - 4, ctx.groundY + 1, 0.7);
}
