import type { DrawContext } from '../draw';
import { mat, pebble, shadow, sparkle, tuft } from '../draw';

function crystal(
  ctx: DrawContext,
  cx: number,
  baseY: number,
  width: number,
  height: number,
  lean: number,
  hueShift = 0,
): void {
  const tipX = cx + lean;
  const tipY = baseY - height;
  const midY = baseY - height * 0.42;
  const left = cx - width / 2;
  const right = cx + width / 2;
  const ridge = cx + width * 0.08;

  ctx.buffer.polygon(
    [
      [left, midY],
      [tipX, tipY],
      [ridge, midY + height * 0.12],
      [left + 1, baseY],
    ],
    mat(ctx, 'accent', 1.4 + hueShift),
  );
  ctx.buffer.polygon(
    [
      [ridge, midY + height * 0.12],
      [tipX, tipY],
      [right, midY],
      [right - 1, baseY],
      [left + 1, baseY],
    ],
    mat(ctx, 'accent', 0.8 + hueShift),
  );
  ctx.buffer.polygon(
    [
      [left, midY],
      [tipX, tipY],
      [ridge, midY + height * 0.12],
    ],
    mat(ctx, 'accent', 2.9 + hueShift),
  );
  ctx.buffer.line(tipX, tipY + 1, ridge, midY + height * 0.12, mat(ctx, 'bone', 4.1, 180));
  ctx.buffer.line(left, midY, left + 1, baseY - 1, mat(ctx, 'accent', 3.0, 140));
  ctx.buffer.line(right, midY, right - 1, baseY - 1, mat(ctx, 'accent', 1.8, 120));

  if (ctx.detail > 0.45) {
    ctx.buffer.set(Math.round(left + width * 0.2), Math.round(midY + height * 0.12), mat(ctx, 'bone', 4.3, 200));
    ctx.buffer.set(Math.round(ridge + 1), Math.round(midY + height * 0.3), mat(ctx, 'accent', 4.1, 160));
  }
}

export function drawCrystal(ctx: DrawContext): void {
  const scale = 0.85 + ctx.dna.height * 0.32;
  const width = (7 + ctx.dna.chunkiness * 6) * scale;
  const height = (28 + ctx.dna.height * 18) * scale;
  const phase = ctx.phase;
  const pulse = 0.5 + 0.5 * Math.sin(phase * Math.PI * 2);

  shadow(ctx, 15 + width, 5.5 + width * 0.2);
  const glow = mat(ctx, 'accent', 3.2, Math.round(24 + pulse * 26));
  ctx.buffer.ellipse(ctx.cx, ctx.groundY - height * 0.35, width * 1.8, height * 0.55, glow);
  ctx.buffer.ellipse(ctx.cx, ctx.groundY + 1, 17, 4.5, mat(ctx, 'stone', 1.4));
  ctx.buffer.ellipse(ctx.cx, ctx.groundY + 1, 12, 2.8, mat(ctx, 'stone', 1.9));

  crystal(ctx, ctx.cx - width * 0.9, ctx.groundY, width * 0.7, height * 0.58, -2, -0.2);
  crystal(ctx, ctx.cx + width * 0.95, ctx.groundY, width * 0.62, height * 0.46, 1.5, 0.1);
  crystal(ctx, ctx.cx, ctx.groundY + 1, width, height, Math.round(ctx.dna.asymmetry * 4 - 2), 0);
  crystal(ctx, ctx.cx + width * 0.3, ctx.groundY + 2, width * 0.42, height * 0.34, 2, 0.2);

  if (ctx.detail > 0.3) {
    sparkle(ctx, ctx.cx - width, ctx.groundY - height * 0.6, 1, 'accent');
    sparkle(ctx, ctx.cx + width * 0.8, ctx.groundY - height * 0.34, 1, 'accent');
    pebble(ctx, ctx.cx - width * 1.4, ctx.groundY + 2, 0.8);
    pebble(ctx, ctx.cx + width * 1.5, ctx.groundY + 1, 0.7);
  }
  tuft(ctx, ctx.cx - 15, ctx.groundY + 1, 0.8);
  tuft(ctx, ctx.cx + 14, ctx.groundY + 1, 0.7);
}
