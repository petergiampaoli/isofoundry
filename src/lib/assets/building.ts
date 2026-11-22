import type { DrawContext } from '../draw';
import {
  drawPyramidRoof,
  isoBox,
  mat,
  mossPatch,
  pebble,
  shadow,
  tuft,
} from '../draw';

function drawWindow(ctx: DrawContext, x: number, y: number, lit: boolean): void {
  ctx.buffer.rect(x - 1, y - 1, 5, 7, mat(ctx, 'wood', 0.6));
  ctx.buffer.rect(x, y, 3, 5, lit ? mat(ctx, 'accent', 3.5) : mat(ctx, 'stone', 0.6));
  ctx.buffer.line(x + 1, y, x + 1, y + 4, mat(ctx, 'wood', 0.5, 180));
  ctx.buffer.line(x, y + 2, x + 2, y + 2, mat(ctx, 'wood', 0.5, 180));
  if (lit) {
    ctx.buffer.set(x, y, mat(ctx, 'gold', 4.2, 220));
    ctx.buffer.set(x + 2, y + 4, mat(ctx, 'accent', 2.2, 180));
  }
}

function drawBanner(ctx: DrawContext, x: number, top: number, bottom: number, phase: number): void {
  ctx.buffer.line(x, bottom, x, top - 5, mat(ctx, 'wood', 0.8), 1);
  const wave = Math.round(Math.sin(phase * Math.PI * 2) * 1.4);
  const wave2 = Math.round(Math.sin(phase * Math.PI * 2 + 1.3) * 1.2);
  ctx.buffer.polygon(
    [
      [x + 1, top - 5],
      [x + 11, top - 3 + wave],
      [x + 8, top + 2 + wave2],
      [x + 10, top + 7 + wave],
      [x + 1, top + 5],
    ],
    mat(ctx, 'accent', 2.25),
  );
  ctx.buffer.line(x + 1, top - 4, x + 8, top - 2 + wave, mat(ctx, 'accent', 3.6, 200));
  ctx.buffer.set(x + 3, top, mat(ctx, 'gold', 3.2, 220));
}

export function drawBuilding(ctx: DrawContext): void {
  const scale = 0.9 + ctx.dna.height * 0.18;
  const hw = (21 + ctx.dna.chunkiness * 9) * scale;
  const hh = hw * 0.5;
  const wallH = (14 + ctx.dna.height * 10) * scale;
  const golden = ctx.dna.golden ?? 0.618;
  const roofH = wallH * (0.36 + golden * 0.28) * (0.9 + ctx.dna.spikiness * 0.2);
  const baseY = ctx.groundY;
  const wallBaseY = baseY - 2;
  const roofBaseY = wallBaseY - wallH;
  const phase = ctx.phase;

  shadow(ctx, hw * 0.92, hh * 0.62);
  isoBox(ctx, ctx.cx, baseY - 1, hw + 2, hh + 1, 2, 'stone', {
    topIndex: 2.4,
    leftIndex: 1.6,
    rightIndex: 0.7,
    bevel: false,
  });

  isoBox(ctx, ctx.cx, wallBaseY, hw, hh, wallH, 'stone', {
    topIndex: 2.7,
    leftIndex: 2.1,
    rightIndex: 1.1,
    line: false,
  });

  if (ctx.detail > 0.2) {
    const left = ctx.cx - hw;
    const bottom = ctx.cx;
    const topY = roofBaseY;
    const bottomY = wallBaseY + hh;
    for (const t of [0.22, 0.78]) {
      const x = left + (bottom - left) * t;
      const by = wallBaseY + (bottomY - wallBaseY) * t;
      ctx.buffer.line(x, by - 2, x, topY + 4, mat(ctx, 'wood', 0.95, 210));
    }
    ctx.buffer.line(left + 4, topY + 4, bottom - 3, topY + 4, mat(ctx, 'wood', 0.8, 180));
    ctx.buffer.line(left + 6, wallBaseY - 2, bottom - 5, wallBaseY - 2, mat(ctx, 'wood', 0.8, 160));
    const right = ctx.cx + hw;
    for (const t of [0.3, 0.74]) {
      const x = bottom + (right - bottom) * t;
      const by = bottomY - (bottomY - wallBaseY) * t;
      ctx.buffer.line(x, by - 2, x, topY + 5, mat(ctx, 'wood', 0.95, 190));
    }
  }

  const doorX = Math.round(ctx.cx - hw * 0.52);
  const doorY = Math.round(baseY - 9);
  ctx.buffer.rect(doorX - 3, doorY - 1, 7, 10, mat(ctx, 'wood', 0.55));
  ctx.buffer.polygon(
    [
      [doorX - 3, doorY + 1],
      [doorX - 2, doorY - 3],
      [doorX + 2, doorY - 3],
      [doorX + 3, doorY + 1],
    ],
    mat(ctx, 'wood', 1.1),
  );
  ctx.buffer.rect(doorX - 2, doorY + 1, 4, 8, mat(ctx, 'wood', 0.82));
  ctx.buffer.line(doorX, doorY + 2, doorX, doorY + 7, mat(ctx, 'wood', 1.8, 160));
  ctx.buffer.set(doorX + 1, doorY + 5, mat(ctx, 'gold', 3.2));
  ctx.buffer.rect(doorX - 4, doorY + 8, 9, 2, mat(ctx, 'stone', 1.2));
  ctx.buffer.line(doorX - 4, doorY + 8, doorX + 4, doorY + 8, mat(ctx, 'stone', 3.0, 150));

  const windowY = Math.round(baseY - wallH * 0.6);
  drawWindow(ctx, Math.round(ctx.cx + hw * 0.32), windowY, true);
  if (ctx.detail > 0.4) drawWindow(ctx, Math.round(ctx.cx + hw * 0.68), windowY - 3, false);

  if (ctx.detail > 0.34) {
    ctx.buffer.rect(doorX - 6, doorY - 4, 2, 3, mat(ctx, 'metal', 1.4));
    ctx.buffer.rect(doorX - 6, doorY - 4, 2, 1, mat(ctx, 'accent', 3.2));
    ctx.buffer.set(doorX - 5, doorY - 3, mat(ctx, 'gold', 4.0, 220));
  }

  drawPyramidRoof(ctx, ctx.cx, roofBaseY, hw + 2.5, hh + 1.2, roofH, 'stone');

  const chimneyX = Math.round(ctx.cx + hw * 0.4);
  const chimneyBase = roofBaseY - roofH * 0.55;
  ctx.buffer.polygon(
    [
      [chimneyX - 3, chimneyBase],
      [chimneyX + 3, chimneyBase],
      [chimneyX + 3, chimneyBase - 8],
      [chimneyX - 3, chimneyBase - 8],
    ],
    mat(ctx, 'stone', 1.8),
  );
  ctx.buffer.polygon(
    [
      [chimneyX - 3, chimneyBase],
      [chimneyX, chimneyBase - 2],
      [chimneyX + 3, chimneyBase],
      [chimneyX, chimneyBase + 1],
    ],
    mat(ctx, 'stone', 2.8),
  );
  ctx.buffer.rect(chimneyX - 4, chimneyBase - 9, 8, 2, mat(ctx, 'stone', 2.4));
  ctx.buffer.rect(chimneyX - 2, chimneyBase - 12, 4, 3, mat(ctx, 'stone', 1.2));

  for (let i = 0; i < 3; i += 1) {
    const t = (phase + i / 3) % 1;
    const sx = chimneyX + Math.round(Math.sin(t * Math.PI * 2 + i) * 3);
    const sy = chimneyBase - 14 - Math.round(t * 11);
    const alpha = Math.round(70 * (1 - t) + 18);
    ctx.buffer.ellipse(sx, sy, 2 + t * 2.2, 1.3 + t * 1.4, mat(ctx, 'stone', 3.2, alpha));
  }

  drawBanner(
    ctx,
    Math.round(ctx.cx - hw * 0.82),
    Math.round(roofBaseY - roofH * 0.12),
    Math.round(baseY - 5),
    phase,
  );

  if (ctx.detail > 0.3) {
    ctx.buffer.rect(Math.round(ctx.cx + hw * 0.62), Math.round(baseY - 7), 3, 5, mat(ctx, 'wood', 0.7));
    ctx.buffer.rect(Math.round(ctx.cx + hw * 0.62) + 1, Math.round(baseY - 6), 1, 3, mat(ctx, 'accent', 2.8));
  }

  if (ctx.detail > 0.44) {
    mossPatch(ctx, ctx.cx - hw * 0.55, wallBaseY + hh * 0.4, hw * 0.22, 2.2, 0.9);
    mossPatch(ctx, ctx.cx + hw * 0.2, roofBaseY + 2, hw * 0.2, 2, 0.6);
  }

  tuft(ctx, ctx.cx - hw - 4, ctx.groundY + 1, 0.9);
  tuft(ctx, ctx.cx + hw + 4, ctx.groundY + 1, 0.8);
  if (ctx.detail > 0.4) {
    pebble(ctx, ctx.cx + hw + 7, ctx.groundY + 1, 0.8);
    pebble(ctx, ctx.cx - hw - 7, ctx.groundY + 1, 0.7);
  }
}
