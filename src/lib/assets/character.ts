import type { DrawContext } from '../draw';
import { bodyBob, mat, shadow, sparkle } from '../draw';

function drawCloak(
  ctx: DrawContext,
  cx: number,
  shoulderY: number,
  hipY: number,
  bodyW: number,
  sway: number,
): void {
  const topL = cx - bodyW * 0.46;
  const topR = cx + bodyW * 0.46;
  const hemY = ctx.groundY - 1;
  const left = cx - bodyW * 0.78;
  const right = cx + bodyW * 0.72;
  const points: [number, number][] = [
    [topL, shoulderY + 1],
    [topR, shoulderY + 1],
    [right, hipY + 4],
    [right - 1, hemY + sway],
    [cx + bodyW * 0.28, hemY - 2 + sway * 0.5],
    [cx, hemY + 1],
    [cx - bodyW * 0.32, hemY - 2 - sway * 0.4],
    [left + 1, hemY + sway],
    [left, hipY + 3],
  ];
  ctx.buffer.polygon(points, mat(ctx, 'cloth', 1.1));
  ctx.buffer.polygon(
    [
      [topL, shoulderY + 2],
      [cx, shoulderY + 2],
      [cx - bodyW * 0.12, hemY - 1],
      [left + 1, hemY - 1 + sway],
      [left, hipY + 3],
    ],
    mat(ctx, 'cloth', 1.75),
  );
  ctx.buffer.line(left + 2, shoulderY + 5, left + 1, hemY - 2, mat(ctx, 'cloth', 0.5, 160));
}

function drawLegs(ctx: DrawContext, cx: number, hipY: number, bodyW: number): void {
  const legW = Math.max(3, Math.round(bodyW * 0.25));
  const bootH = 3;
  const legY = ctx.groundY - bootH;
  const gap = Math.round(bodyW * 0.18);
  const leftX = cx - gap - legW + 1;
  const rightX = cx + gap;
  for (const [x, forward] of [[leftX, 0], [rightX, 2]] as const) {
    ctx.buffer.polygon(
      [
        [x, hipY],
        [x + legW, hipY],
        [x + legW - 1, legY],
        [x + 1, legY],
      ],
      mat(ctx, 'wood', 1.3),
    );
    ctx.buffer.rect(x - 0.5 + forward, legY, legW + 1.5, bootH, mat(ctx, 'wood', 0.65));
    ctx.buffer.rect(x - 0.5 + forward, legY, legW + 1.5, 1, mat(ctx, 'wood', 1.4, 180));
    if (ctx.detail > 0.34) {
      ctx.buffer.line(x + 1, hipY + 2, x + legW - 2, hipY + 2, mat(ctx, 'wood', 2.1, 180));
    }
  }
}

function drawTorso(
  ctx: DrawContext,
  cx: number,
  shoulderY: number,
  hipY: number,
  bodyW: number,
  archetype: number,
): void {
  const topW = bodyW * 0.86;
  const points: [number, number][] = [
    [cx - topW / 2, shoulderY],
    [cx + topW / 2, shoulderY],
    [cx + bodyW / 2, hipY],
    [cx - bodyW / 2, hipY],
  ];
  const base = archetype === 1 ? mat(ctx, 'wood', 1.75) : mat(ctx, 'cloth', 2.15);
  ctx.buffer.polygon(points, base);
  ctx.buffer.polygon(
    [
      [cx - topW / 2, shoulderY],
      [cx - bodyW * 0.08, shoulderY],
      [cx - bodyW * 0.02, hipY],
      [cx - bodyW / 2, hipY],
    ],
    archetype === 1 ? mat(ctx, 'wood', 2.35) : mat(ctx, 'cloth', 2.8),
  );
  ctx.buffer.polygon(
    [
      [cx + bodyW * 0.08, shoulderY],
      [cx + topW / 2, shoulderY],
      [cx + bodyW / 2, hipY],
      [cx + bodyW * 0.02, hipY],
    ],
    archetype === 1 ? mat(ctx, 'wood', 1.05) : mat(ctx, 'cloth', 1.25),
  );

  if (archetype === 0 && ctx.detail > 0.18) {
    ctx.buffer.polygon(
      [
        [cx - bodyW * 0.3, shoulderY + 2],
        [cx + bodyW * 0.3, shoulderY + 2],
        [cx + bodyW * 0.22, hipY - 3],
        [cx - bodyW * 0.22, hipY - 3],
      ],
      mat(ctx, 'metal', 2.1),
    );
    ctx.buffer.line(cx - bodyW * 0.26, shoulderY + 3, cx - bodyW * 0.2, hipY - 4, mat(ctx, 'metal', 3.8, 180));
    ctx.buffer.polygon(
      [
        [cx, shoulderY + 4],
        [cx + 2, shoulderY + 6],
        [cx, shoulderY + 8],
        [cx - 2, shoulderY + 6],
      ],
      mat(ctx, 'accent', 2.6),
    );
  }

  if (archetype === 2 && ctx.detail > 0.3) {
    ctx.buffer.line(cx - bodyW * 0.28, shoulderY + 1, cx + bodyW * 0.26, hipY - 1, mat(ctx, 'accent', 2.8, 180));
    ctx.buffer.line(cx + bodyW * 0.15, shoulderY + 3, cx + bodyW * 0.1, hipY - 2, mat(ctx, 'bone', 2.4, 130));
  }

  if (archetype === 3 && ctx.detail > 0.28) {
    ctx.buffer.ellipse(cx, shoulderY + 1, bodyW * 0.42, 2.3, mat(ctx, 'bone', 0.8));
    for (let i = -2; i <= 2; i += 1) {
      ctx.buffer.line(cx + i * 3, shoulderY - 1, cx + i * 3 + 1, shoulderY + 2, mat(ctx, 'bone', 2.4, 170));
    }
  }

  if (archetype !== 1) {
    ctx.buffer.line(cx - bodyW * 0.3, shoulderY + 3, cx + bodyW * 0.22, hipY - 2, mat(ctx, 'wood', 1.2, 190));
  } else if (ctx.detail > 0.3) {
    ctx.buffer.rect(cx + bodyW * 0.1, hipY - 5, 4, 4, mat(ctx, 'wood', 1.2));
    ctx.buffer.rect(cx + bodyW * 0.1 + 1, hipY - 4, 1, 1, mat(ctx, 'gold', 3.3));
  }

  const beltY = hipY - 2;
  ctx.buffer.rect(cx - bodyW / 2, beltY, bodyW, 2, mat(ctx, 'wood', 0.8));
  ctx.buffer.rect(cx - 1.5, beltY, 3, 2, mat(ctx, 'gold', 3.1));
  if (ctx.detail > 0.3) {
    ctx.buffer.set(Math.round(cx), beltY, mat(ctx, 'gold', 4.1));
    ctx.buffer.rect(cx - bodyW / 2 + 1, beltY + 2, bodyW - 2, 1, mat(ctx, 'cloth', 1.0, 170));
  }
}

function drawArms(
  ctx: DrawContext,
  cx: number,
  shoulderY: number,
  hipY: number,
  bodyW: number,
  armSwing: number,
  archetype: number,
): { leftHand: [number, number]; rightHand: [number, number] } {
  const leftShoulder: [number, number] = [cx - bodyW * 0.46, shoulderY + 2];
  const rightShoulder: [number, number] = [cx + bodyW * 0.46, shoulderY + 2];
  const leftHand: [number, number] = [cx - bodyW * 0.55, hipY - 2 + armSwing];
  const rightHand: [number, number] = [cx + bodyW * 0.62, hipY - 3 - armSwing];

  ctx.buffer.line(leftShoulder[0], leftShoulder[1], leftHand[0], leftHand[1], mat(ctx, 'cloth', 1.8), 3);
  ctx.buffer.line(rightShoulder[0], rightShoulder[1], rightHand[0], rightHand[1], mat(ctx, 'cloth', 1.45), 3);
  ctx.buffer.rect(Math.round(leftHand[0]) - 1, Math.round(leftHand[1]) - 1, 3, 3, mat(ctx, 'skin', 2.7));
  ctx.buffer.rect(Math.round(rightHand[0]) - 1, Math.round(rightHand[1]) - 1, 3, 3, mat(ctx, 'skin', 2.7));

  if (archetype === 0) {
    ctx.buffer.ellipse(leftShoulder[0], leftShoulder[1] - 1, 4, 3, mat(ctx, 'metal', 2.2));
    ctx.buffer.ellipse(rightShoulder[0], rightShoulder[1] - 1, 4, 3, mat(ctx, 'metal', 2.2));
    ctx.buffer.line(leftShoulder[0] - 2, leftShoulder[1] - 2, leftShoulder[0] + 2, leftShoulder[1] - 2, mat(ctx, 'metal', 4.0, 190));
  }

  if (ctx.detail > 0.4) {
    ctx.buffer.rect(Math.round(leftHand[0]) - 2, Math.round(leftHand[1]) - 2, 4, 2, mat(ctx, 'wood', 1.1));
    ctx.buffer.rect(Math.round(rightHand[0]) - 2, Math.round(rightHand[1]) - 2, 4, 2, mat(ctx, 'wood', 1.1));
  }

  return { leftHand, rightHand };
}

function drawHead(
  ctx: DrawContext,
  cx: number,
  headCY: number,
  headR: number,
  archetype: number,
  bodyDy: number,
): void {
  const hx = cx + 1;
  const hy = headCY + bodyDy;
  const detail = ctx.detail;

  if (archetype === 0) {
    ctx.buffer.ellipse(hx, hy - 1, headR + 1.1, headR * 0.95, mat(ctx, 'metal', 2.2));
    ctx.buffer.ellipse(hx + 0.6, hy + 1.2, headR * 0.78, headR * 0.58, mat(ctx, 'skin', 2.9));
    ctx.buffer.line(hx - headR, hy + 0.5, hx + headR, hy + 0.5, mat(ctx, 'metal', 3.8, 210));
    ctx.buffer.line(hx + 2, hy - headR + 1, hx + 2, hy + headR - 1, mat(ctx, 'metal', 1.4, 180));
    ctx.buffer.polygon(
      [
        [hx - 1, hy - headR - 1],
        [hx - 2, hy - headR - 5],
        [hx + 3, hy - headR - 3],
        [hx + 2, hy - headR + 1],
      ],
      mat(ctx, 'accent', 2.4),
    );
    if (detail > 0.44) {
      ctx.buffer.set(hx - headR + 1, hy - 1, mat(ctx, 'metal', 4.3, 220));
      ctx.buffer.line(hx - headR + 1, hy + 2, hx + 2, hy + 2, mat(ctx, 'metal', 1.0, 120));
    }
  } else if (archetype === 1 || archetype === 2) {
    const hoodR = headR + 1.8;
    ctx.buffer.polygon(
      [
        [hx - hoodR, hy + 1],
        [hx - hoodR * 0.5, hy - hoodR * 1.2],
        [hx + 2, hy - hoodR * 1.4],
        [hx + hoodR * 0.9, hy - hoodR * 0.3],
        [hx + hoodR * 0.6, hy + headR * 0.7],
        [hx - hoodR * 0.3, hy + headR * 0.8],
      ],
      mat(ctx, 'cloth', 1.35),
    );
    ctx.buffer.ellipse(hx + 0.8, hy + 1, headR * 0.8, headR * 0.69, mat(ctx, 'skin', 2.9));
    ctx.buffer.polygon(
      [
        [hx - hoodR * 0.75, hy - 1],
        [hx - hoodR * 0.1, hy - headR * 0.6],
        [hx + hoodR * 0.55, hy - headR * 0.25],
        [hx + hoodR * 0.3, hy + 1],
        [hx - 1, hy + 2],
      ],
      mat(ctx, 'cloth', 2.1),
    );
    if (archetype === 2) {
      ctx.buffer.line(hx - 3, hy - headR * 0.4, hx + 4, hy - headR * 0.5, mat(ctx, 'gold', 2.6, 180));
      if (detail > 0.42) {
        const beard = Math.round(headR * 0.8);
        ctx.buffer.polygon(
          [
            [hx - 2, hy + headR * 0.45],
            [hx + 3, hy + headR * 0.45],
            [hx + 1, hy + headR * 0.45 + beard],
            [hx - 1, hy + headR * 0.45 + beard],
          ],
          mat(ctx, 'bone', 1.3),
        );
      }
    }
  } else {
    ctx.buffer.ellipse(hx, hy, headR, headR * 1.02, mat(ctx, 'skin', 2.8));
    ctx.buffer.ellipse(hx - 1, hy - headR * 0.45, headR * 0.85, headR * 0.5, mat(ctx, 'wood', 0.9));
    ctx.buffer.polygon(
      [
        [hx - headR * 0.8, hy - headR * 0.4],
        [hx - headR * 0.95, hy - headR * 1.3],
        [hx - headR * 0.45, hy - headR * 0.65],
      ],
      mat(ctx, 'bone', 2.1),
    );
    ctx.buffer.polygon(
      [
        [hx + headR * 0.15, hy - headR * 0.6],
        [hx + headR * 0.35, hy - headR * 1.3],
        [hx + headR * 0.7, hy - headR * 0.5],
      ],
      mat(ctx, 'bone', 2.1),
    );
    if (detail > 0.38) {
      ctx.buffer.polygon(
        [
          [hx - 1, hy + headR * 0.4],
          [hx + 3, hy + headR * 0.4],
          [hx + 1, hy + headR * 0.95],
        ],
        mat(ctx, 'wood', 0.7),
      );
    }
  }

  if (archetype !== 2 || detail < 0.42) {
    const eyeY = Math.round(hy + (archetype === 3 ? 0.5 : 1));
    ctx.buffer.set(Math.round(hx + headR * 0.23), eyeY, mat(ctx, 'wood', 0.15));
    ctx.buffer.set(Math.round(hx + headR * 0.52), eyeY, mat(ctx, 'wood', 0.15));
    if (detail > 0.5) {
      ctx.buffer.set(Math.round(hx + headR * 0.52), eyeY, mat(ctx, 'bone', 4.0, 180));
    }
  }
  ctx.buffer.rect(hx + 1, hy + headR * 0.38, 2, 1, mat(ctx, 'skin', 1.6));
  ctx.buffer.set(Math.round(hx - headR * 0.55), Math.round(hy + 1), mat(ctx, 'skin', 2.0));
}

function drawSword(ctx: DrawContext, hand: [number, number], shoulderY: number): void {
  const [hx, hy] = hand;
  const tipY = shoulderY - 10;
  ctx.buffer.line(hx + 2, hy, hx + 3, tipY, mat(ctx, 'metal', 3.6), 2);
  ctx.buffer.line(hx + 3, hy, hx + 4, tipY, mat(ctx, 'metal', 2.2), 1);
  ctx.buffer.line(hx + 1, hy - 5, hx + 5, hy - 5, mat(ctx, 'gold', 3.1), 1);
  ctx.buffer.set(hx + 2, tipY - 1, mat(ctx, 'metal', 4.5));
  ctx.buffer.rect(hx + 1, hy + 1, 3, 2, mat(ctx, 'gold', 2.6));
  if (ctx.detail > 0.4) ctx.buffer.set(hx + 3, hy - 8, mat(ctx, 'metal', 4.5, 210));
}

function drawStaff(ctx: DrawContext, hand: [number, number], headCY: number): void {
  const x = hand[0] + 4;
  const top = headCY - 8;
  ctx.buffer.line(x, ctx.groundY - 1, x, top + 2, mat(ctx, 'wood', 1.7), 2);
  ctx.buffer.line(x + 1, ctx.groundY - 4, x + 1, top + 5, mat(ctx, 'wood', 0.8), 1);
  ctx.buffer.polygon(
    [
      [x, top - 4],
      [x + 3, top],
      [x, top + 4],
      [x - 2, top],
    ],
    mat(ctx, 'accent', 2.8),
  );
  ctx.buffer.line(x, top - 4, x - 1, top, mat(ctx, 'accent', 4.2, 220));
  ctx.buffer.set(x, top - 1, mat(ctx, 'bone', 4.2, 220));
  sparkle(ctx, x - 3, top - 2, 1, 'accent');
  ctx.buffer.rect(x - 2, Math.round(hand[1]) - 1, 4, 3, mat(ctx, 'skin', 2.8));
}

function drawAxe(ctx: DrawContext, hand: [number, number], headCY: number): void {
  const x = hand[0] + 4;
  const top = headCY - 6;
  ctx.buffer.line(x, ctx.groundY - 2, x, top - 2, mat(ctx, 'wood', 1.6), 2);
  ctx.buffer.polygon(
    [
      [x - 1, top - 1],
      [x - 6, top - 3],
      [x - 7, top + 2],
      [x - 1, top + 4],
    ],
    mat(ctx, 'metal', 2.0),
  );
  ctx.buffer.line(x - 6, top - 2, x - 7, top + 2, mat(ctx, 'metal', 4.2, 220));
  ctx.buffer.rect(x - 2, Math.round(hand[1]) - 1, 4, 3, mat(ctx, 'skin', 2.8));
}

function drawBow(ctx: DrawContext, cx: number, shoulderY: number, hipY: number, bodyW: number): void {
  const x = cx - bodyW * 0.72;
  const top = shoulderY - 4;
  const bottom = hipY + 4;
  ctx.buffer.line(x, top, x - 4, (top + bottom) / 2, mat(ctx, 'wood', 1.8), 1);
  ctx.buffer.line(x - 4, (top + bottom) / 2, x, bottom, mat(ctx, 'wood', 1.8), 1);
  ctx.buffer.line(x, top, x, bottom, mat(ctx, 'bone', 3.2, 170), 1);
  if (ctx.detail > 0.32) {
    ctx.buffer.set(x - 3, Math.round((top + bottom) / 2), mat(ctx, 'accent', 2.6));
  }
}

export function drawCharacter(ctx: DrawContext, seed: number, forcedArchetype?: number): void {
  const scale = 0.88 + ctx.dna.height * 0.26;
  const widthVar = 0.92 + ((seed >>> 3) % 17) / 100;
  const heightVar = 0.95 + ((seed >>> 7) % 11) / 100;
  const H = (41 + ctx.dna.height * 12) * scale * heightVar;
  const golden = ctx.dna.golden ?? 0.618;
  const headBase = (4.9 + ctx.dna.headScale * 3.1) * scale;
  const headR = headBase * 0.68 + H * (0.12 + (1 - golden) * 0.055) * 0.32;
  const bodyW = (8.5 + ctx.dna.chunkiness * 8) * scale * widthVar;
  const headCY = ctx.groundY - H + headR + 2;
  const shoulderY = headCY + headR + 2;
  const bodyLen = ctx.groundY - shoulderY;
  const baseHip = ctx.groundY - 11 - ctx.dna.height * 5;
  const goldenHip = ctx.groundY - bodyLen * (0.34 + golden * 0.16);
  const hipY = Math.round(goldenHip * 0.55 + baseHip * 0.45);
  const bodyDy = -Math.round((Math.sin(ctx.phase * Math.PI * 2 + 0.2) + 1) * 0.5 * (0.5 + ctx.dna.bounce * 1.6));
  const armSwing = Math.round(Math.sin(ctx.phase * Math.PI * 2) * (0.8 + ctx.dna.bounce * 1.4));
  const cloakSway = Math.round(Math.sin(ctx.phase * Math.PI * 2 + 0.8) * ctx.dna.sway * 2.4);
  const archetype = forcedArchetype ?? ((seed % 4) + 4) % 4;

  shadow(ctx, 11 + bodyW * 0.28, 4.2 + bodyW * 0.1);

  if (archetype !== 3) drawCloak(ctx, ctx.cx, shoulderY, hipY, bodyW, cloakSway);
  else {
    ctx.buffer.polygon(
      [
        [ctx.cx - bodyW * 0.4, shoulderY],
        [ctx.cx + bodyW * 0.4, shoulderY],
        [ctx.cx + bodyW * 0.5, hipY + 3],
        [ctx.cx - bodyW * 0.5, hipY + 3],
      ],
      mat(ctx, 'bone', 0.75),
    );
  }

  if (archetype === 1) drawBow(ctx, ctx.cx, shoulderY, hipY, bodyW);
  drawLegs(ctx, ctx.cx, hipY, bodyW);
  drawTorso(ctx, ctx.cx, shoulderY, hipY, bodyW, archetype);
  const hands = drawArms(ctx, ctx.cx, shoulderY, hipY, bodyW, armSwing, archetype);

  if (archetype === 0) {
    ctx.buffer.ellipse(ctx.cx - bodyW * 0.55, hipY - 3, 5, 7.2, mat(ctx, 'wood', 1.6));
    ctx.buffer.ellipse(ctx.cx - bodyW * 0.55, hipY - 3, 4.2, 6.4, mat(ctx, 'metal', 2.3));
    ctx.buffer.ellipse(ctx.cx - bodyW * 0.55, hipY - 3, 2.5, 4.7, mat(ctx, 'wood', 1.2));
    ctx.buffer.line(ctx.cx - bodyW * 0.55, hipY - 6, ctx.cx - bodyW * 0.55, hipY, mat(ctx, 'accent', 2.5));
  }

  const neckY = headCY + headR + bodyDy;
  ctx.buffer.rect(ctx.cx - 1, neckY - 2, 3, 3, mat(ctx, 'skin', 2.2));
  drawHead(ctx, ctx.cx, headCY, headR, archetype, bodyDy);

  if (archetype === 0) drawSword(ctx, hands.rightHand, shoulderY);
  else if (archetype === 2) drawStaff(ctx, hands.rightHand, headCY);
  else if (archetype === 3) drawAxe(ctx, hands.rightHand, headCY);
  else if (ctx.detail > 0.3) {
    ctx.buffer.line(hands.rightHand[0], hands.rightHand[1] - 3, hands.rightHand[0] + 2, hands.rightHand[1] - 8, mat(ctx, 'metal', 3.0), 1);
    ctx.buffer.set(hands.rightHand[0] + 2, hands.rightHand[1] - 9, mat(ctx, 'metal', 4.2));
    ctx.buffer.line(hands.rightHand[0] - 2, hands.rightHand[1] - 4, hands.rightHand[0] + 2, hands.rightHand[1] - 4, mat(ctx, 'gold', 3.0, 200));
  }

  if (ctx.detail > 0.55) {
    ctx.buffer.set(Math.round(ctx.cx - bodyW * 0.6), Math.round(hipY - 5), mat(ctx, 'gold', 3.4));
    ctx.buffer.set(Math.round(ctx.cx + bodyW * 0.4), Math.round(shoulderY + 4), mat(ctx, 'bone', 3.8, 200));
  }
}
