import type { DrawContext } from '../draw';
import { crack, mat, mossPatch, pebble, shadow, sparkle, tuft } from '../draw';

function drawRock(
  ctx: DrawContext,
  cx: number,
  baseY: number,
  width: number,
  height: number,
  accent = false,
): void {
  const lean = (ctx.dna.asymmetry - 0.5) * width * 0.18;
  const topY = baseY - height;
  const peak: [number, number] = [cx + lean, topY];
  const leftTop: [number, number] = [cx - width * 0.34, topY + height * 0.12];
  const rightTop: [number, number] = [cx + width * 0.33, topY + height * 0.1];
  const centerTop: [number, number] = [cx + width * 0.06, topY + height * 0.31];
  const midLeft: [number, number] = [cx - width * 0.5, topY + height * 0.52];
  const midRight: [number, number] = [cx + width * 0.48, topY + height * 0.48];
  const bottomLeft: [number, number] = [cx - width * 0.37, baseY];
  const bottomMid: [number, number] = [cx + width * 0.02, baseY + 1];
  const bottomRight: [number, number] = [cx + width * 0.35, baseY];

  ctx.buffer.polygon(
    [peak, rightTop, midRight, bottomRight, bottomMid, bottomLeft, midLeft, leftTop],
    mat(ctx, 'stone', 1.15),
  );
  ctx.buffer.polygon([leftTop, peak, rightTop, centerTop], mat(ctx, 'stone', 3.45));
  ctx.buffer.polygon([leftTop, centerTop, bottomMid, bottomLeft, midLeft], mat(ctx, 'stone', 2.05));
  ctx.buffer.polygon([centerTop, rightTop, midRight, bottomRight, bottomMid], mat(ctx, 'stone', 1.05));

  ctx.buffer.line(leftTop[0], leftTop[1], peak[0], peak[1], mat(ctx, 'stone', 4.2, 200));
  ctx.buffer.line(peak[0], peak[1], rightTop[0], rightTop[1], mat(ctx, 'stone', 3.6, 160));
  ctx.buffer.line(centerTop[0], centerTop[1], bottomMid[0], bottomMid[1], mat(ctx, 'stone', 0.5, 160));
  ctx.buffer.line(leftTop[0], leftTop[1], centerTop[0], centerTop[1], mat(ctx, 'stone', 2.8, 130));
  ctx.buffer.line(rightTop[0], rightTop[1], centerTop[0], centerTop[1], mat(ctx, 'stone', 1.8, 120));

  if (ctx.detail > 0.32) {
    const facets = Math.round(2 + ctx.detail * 4);
    for (let i = 0; i < facets; i += 1) {
      const ax = cx + ctx.rng.float(-width * 0.28, width * 0.26);
      const ay = topY + ctx.rng.float(height * 0.16, height * 0.55);
      const bx = ax + ctx.rng.float(-width * 0.12, width * 0.16);
      const by = ay + ctx.rng.float(2, height * 0.16);
      ctx.buffer.line(Math.round(ax), Math.round(ay), Math.round(bx), Math.round(by), mat(ctx, 'stone', 0.6, 110));
    }
  }

  if (ctx.detail > 0.38) {
    crack(ctx, cx - width * 0.1, topY + height * 0.28, Math.round(4 + height * 0.18), 'stone');
    if (ctx.dna.detail > 0.6) crack(ctx, cx + width * 0.2, topY + height * 0.34, 4, 'stone');
  }

  const mossAmount = ctx.dna.paletteParams.foliageHue > 60 ? 0.9 : 0.55;
  if (ctx.detail > 0.24) {
    mossPatch(ctx, cx - width * 0.16, topY + height * 0.22, width * 0.25, height * 0.18, mossAmount);
  }

  if (accent && ctx.detail > 0.55) {
    const veinX = cx + width * 0.06;
    const veinY = topY + height * 0.4;
    ctx.buffer.line(veinX, veinY, veinX + width * 0.15, veinY + height * 0.18, mat(ctx, 'accent', 3.2, 180));
    sparkle(ctx, veinX + width * 0.08, veinY + height * 0.08, 1, 'accent');
  }
}

export function drawStone(ctx: DrawContext): void {
  const scale = 0.8 + ctx.dna.height * 0.32;
  const width = (25 + ctx.dna.chunkiness * 17) * scale;
  const height = (19 + ctx.dna.chunkiness * 12) * scale;
  shadow(ctx, width * 0.62, height * 0.2);
  drawRock(ctx, ctx.cx, ctx.groundY, width, height, ctx.dna.seed % 3 === 0);

  const small = ctx.dna.chunkiness > 0.38;
  if (small) {
    drawRock(
      ctx,
      ctx.cx + ctx.rng.float(-20, -15),
      ctx.groundY + 1,
      width * ctx.rng.float(0.24, 0.36),
      height * ctx.rng.float(0.2, 0.3),
    );
    drawRock(
      ctx,
      ctx.cx + ctx.rng.float(15, 21),
      ctx.groundY + 1,
      width * ctx.rng.float(0.2, 0.32),
      height * ctx.rng.float(0.16, 0.26),
      ctx.dna.seed % 4 === 0,
    );
  }

  if (ctx.detail > 0.3) {
    tuft(ctx, ctx.cx - width * 0.58, ctx.groundY + 1, 0.9);
    tuft(ctx, ctx.cx + width * 0.54, ctx.groundY + 1, 0.8);
  }
  if (ctx.detail > 0.46) {
    pebble(ctx, ctx.cx - width * 0.24, ctx.groundY + 2, 0.8);
    pebble(ctx, ctx.cx + width * 0.3, ctx.groundY + 2, 0.7);
  }
  if (ctx.detail > 0.58 && ctx.dna.voice.springy > 0.6) {
    const mx = ctx.cx + ctx.rng.float(-10, 10);
    ctx.buffer.rect(Math.round(mx), ctx.groundY - 1, 1, 2, mat(ctx, 'bone', 4));
    ctx.buffer.ellipse(Math.round(mx), ctx.groundY - 2, 2, 1.1, mat(ctx, 'accent', 2.2));
  }
}
