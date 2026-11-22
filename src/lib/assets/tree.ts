import type { DrawContext } from '../draw';
import {
  canopyCluster,
  crack,
  mat,
  mossPatch,
  pebble,
  shadow,
  swayOffset,
  taperedTrunk,
  tuft,
} from '../draw';

function broadleaf(ctx: DrawContext): void {
  const scale = 0.86 + ctx.dna.height * 0.32;
  const trunkH = (19 + ctx.dna.chunkiness * 7) * scale;
  const trunkW = 4.2 + ctx.dna.chunkiness * 3.8;
  const sway = swayOffset(ctx, 0.75);
  const lean = Math.round(ctx.dna.asymmetry * 4 - 2);

  shadow(ctx, 16 + ctx.dna.chunkiness * 8, 5.5 + ctx.dna.chunkiness * 2);
  taperedTrunk(ctx, ctx.cx, ctx.groundY, trunkH, trunkW, lean);

  const canopyY = ctx.groundY - trunkH - 8 * scale;
  const spread = (11 + ctx.dna.chunkiness * 8) * scale;
  const mainR = (13 + ctx.dna.roundness * 5) * scale;
  const blobs = [
    { x: ctx.cx + lean + sway, y: canopyY - 7 * scale, rx: mainR, ry: mainR * 0.78 },
    { x: ctx.cx + lean - spread + sway * 0.8, y: canopyY + 2 * scale, rx: mainR * 0.84, ry: mainR * 0.68 },
    { x: ctx.cx + lean + spread + sway * 1.1, y: canopyY + 1 * scale, rx: mainR * 0.8, ry: mainR * 0.65 },
    { x: ctx.cx + lean + sway, y: canopyY + 9 * scale, rx: mainR * 0.92, ry: mainR * 0.58 },
    { x: ctx.cx + lean - spread * 0.55 + sway, y: canopyY - 13 * scale, rx: mainR * 0.62, ry: mainR * 0.55 },
  ];

  if (ctx.dna.asymmetry > 0.46) {
    blobs.push({
      x: ctx.cx + lean + spread * 0.7 + sway * 1.2,
      y: canopyY - 15 * scale,
      rx: mainR * 0.48,
      ry: mainR * 0.45,
    });
  }

  canopyCluster(ctx, blobs);

  if (ctx.detail > 0.24) {
    const branches = 3;
    for (let i = 0; i < branches; i += 1) {
      const t = 0.25 + i * 0.22;
      const bx = ctx.cx + lean * t + (i - 1) * 6;
      const by = ctx.groundY - trunkH * (0.62 + i * 0.1);
      ctx.buffer.line(ctx.cx + lean * 0.3, by + 5, bx, canopyY + 4, mat(ctx, 'wood', 1.6, 190));
    }
  }

  if (ctx.detail > 0.58 && ctx.dna.voice.gritty > 0.5) {
    mossPatch(ctx, ctx.cx - 2, canopyY + mainR * 0.75, mainR * 0.65, mainR * 0.3, 0.8);
  }

  if (ctx.detail > 0.62 && ctx.dna.voice.springy > 0.48) {
    const vineCount = 2 + Math.round(ctx.dna.detail * 2);
    for (let i = 0; i < vineCount; i += 1) {
      const x = ctx.cx + ctx.rng.float(-spread * 0.8, spread * 0.8);
      const y = canopyY + mainR * 0.4;
      const length = ctx.rng.int(5, 12);
      for (let j = 0; j < length; j += 1) {
        ctx.buffer.set(Math.round(x + Math.sin(j * 0.8) * 1.2), Math.round(y + j), mat(ctx, 'foliage', 1.2, 190));
        if (j === length - 1) ctx.buffer.set(Math.round(x + Math.sin(j * 0.8) * 1.2), Math.round(y + j + 1), mat(ctx, 'accent', 2.4, 220));
      }
    }
  }

  tuft(ctx, ctx.cx - 13, ctx.groundY + 1, 0.9);
  tuft(ctx, ctx.cx + 12, ctx.groundY + 1, 0.8);
  if (ctx.detail > 0.36) {
    pebble(ctx, ctx.cx - 16, ctx.groundY + 1, 0.9);
    pebble(ctx, ctx.cx + 17, ctx.groundY, 0.7);
  }
  if (ctx.detail > 0.62 && ctx.dna.voice.springy > 0.62) {
    const mx = ctx.cx + ctx.rng.float(-13, 13);
    ctx.buffer.rect(mx, ctx.groundY - 2, 1, 3, mat(ctx, 'bone', 4));
    ctx.buffer.ellipse(mx, ctx.groundY - 3, 2, 1.2, mat(ctx, 'accent', 2));
  }
}

function pine(ctx: DrawContext): void {
  const scale = 0.88 + ctx.dna.height * 0.32;
  const totalH = (39 + ctx.dna.chunkiness * 7) * scale;
  const trunkW = 4 + ctx.dna.chunkiness * 2.4;
  const sway = swayOffset(ctx, 0.5);
  shadow(ctx, 13 + ctx.dna.chunkiness * 6, 5 + ctx.dna.chunkiness * 1.8);
  taperedTrunk(ctx, ctx.cx, ctx.groundY, totalH * 0.68, trunkW, 0);

  const layers = 4 + (ctx.dna.chunkiness > 0.62 ? 1 : 0);
  for (let layer = 0; layer < layers; layer += 1) {
    const t = layer / (layers - 1);
    const y = ctx.groundY - 8 * scale - t * totalH * 0.7;
    const halfW = (17 - t * 9 + ctx.dna.chunkiness * 4) * scale;
    const layerH = (15 - t * 3) * scale;
    const apexX = ctx.cx + sway * (0.35 + t * 0.6) + Math.round(ctx.dna.asymmetry * 2 - 1) * t;
    const apex: [number, number] = [apexX, y - layerH];
    const left: [number, number] = [ctx.cx - halfW + sway * 0.3, y + 2];
    const right: [number, number] = [ctx.cx + halfW + sway * 0.3, y + 2];
    const bottomMid: [number, number] = [ctx.cx + sway * 0.4, y + 4];

    const jag = 2 + Math.round(ctx.dna.spikiness * 3);
    const bottom: [number, number][] = [];
    for (let i = 0; i < 5; i += 1) {
      const bx = left[0] + ((right[0] - left[0]) * i) / 4;
      bottom.push([bx, y + 2 + (i % 2 === 0 ? 0 : jag)]);
    }

    ctx.buffer.polygon([apex, left, ...bottom, right], mat(ctx, 'foliage', 0.8));
    ctx.buffer.polygon([apex, left, bottom[1], bottomMid], mat(ctx, 'foliage', 2.4));
    ctx.buffer.polygon([apex, bottomMid, bottom[3], right], mat(ctx, 'foliage', 1.25));
    ctx.buffer.line(apex[0] - 1, apex[1] + 2, left[0] + 2, left[1] - 1, mat(ctx, 'foliage', 3.8, 190));
    ctx.buffer.line(apex[0], apex[1] + 1, right[0] - 3, right[1] - 1, mat(ctx, 'foliage', 2.1, 130));
    if (ctx.dna.voice.gritty > 0.52 && layer % 2 === 0) {
      ctx.buffer.set(apexX - 3, apex[1] + 6, mat(ctx, 'foliage', 4.2, 220));
    }
  }

  if (ctx.detail > 0.4) {
    const snow = ctx.dna.paletteParams.contrast > 0.55 && ctx.dna.paletteParams.warmth < 0;
    for (let i = 0; i < 5; i += 1) {
      const x = ctx.cx + ctx.rng.float(-12, 12);
      const y = ctx.groundY - ctx.rng.float(12, 34);
      ctx.buffer.set(Math.round(x), Math.round(y), snow ? mat(ctx, 'bone', 4.2, 220) : mat(ctx, 'foliage', 3.9, 200));
    }
  }

  tuft(ctx, ctx.cx - 12, ctx.groundY + 1, 0.8);
  tuft(ctx, ctx.cx + 11, ctx.groundY + 1, 0.7);
  if (ctx.detail > 0.56) {
    crack(ctx, ctx.cx - 2, ctx.groundY - 7, 4, 'wood');
    pebble(ctx, ctx.cx + 15, ctx.groundY + 1, 0.8);
  }
}

export function drawTree(ctx: DrawContext): void {
  const pineChance = ctx.dna.spikiness * 0.7 + ctx.dna.voice.brutal * 0.15;
  if (ctx.dna.seed % 5 === 0 ? pineChance > 0.4 : pineChance > 0.62) pine(ctx);
  else broadleaf(ctx);
}
