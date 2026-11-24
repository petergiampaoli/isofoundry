import {
  IDENTITY_TRANSFORM,
  ROLE_INDEX,
  paletteArray,
  type AnimationFrame,
  type CharacterDoc,
  type CharacterSpec,
  type PaletteRole,
  type Part,
} from "./types";

const TRANSPARENT = -1;

function hexToRgba(hex: string): [number, number, number, number] {
  const clean = hex.replace("#", "");
  const value = Number.parseInt(clean, 16);
  return [
    (value >> 16) & 255,
    (value >> 8) & 255,
    value & 255,
    255,
  ];
}

class Raster {
  width: number;
  height: number;
  pixels: number[];

  constructor(width: number, height: number) {
    this.width = width;
    this.height = height;
    this.pixels = new Array(width * height).fill(TRANSPARENT);
  }

  set(x: number, y: number, role: PaletteRole) {
    const px = Math.round(x);
    const py = Math.round(y);
    if (px < 0 || py < 0 || px >= this.width || py >= this.height) return;
    this.pixels[py * this.width + px] = ROLE_INDEX[role];
  }

  setIndex(x: number, y: number, index: number) {
    const px = Math.round(x);
    const py = Math.round(y);
    if (px < 0 || py < 0 || px >= this.width || py >= this.height) return;
    this.pixels[py * this.width + px] = index;
  }

  get(x: number, y: number): number {
    if (x < 0 || y < 0 || x >= this.width || y >= this.height) {
      return TRANSPARENT;
    }
    return this.pixels[y * this.width + x];
  }

  fillEllipse(
    cx: number,
    cy: number,
    rx: number,
    ry: number,
    fill: PaletteRole,
    outline = true,
  ) {
    this.ellipsePass(cx, cy, rx + (outline ? 1 : 0), ry + (outline ? 1 : 0), "outline");
    this.ellipsePass(cx, cy, rx, ry, fill);
  }

  ellipsePass(cx: number, cy: number, rx: number, ry: number, role: PaletteRole) {
    if (rx <= 0 || ry <= 0) return;
    const minX = Math.floor(cx - rx);
    const maxX = Math.ceil(cx + rx);
    const minY = Math.floor(cy - ry);
    const maxY = Math.ceil(cy + ry);
    for (let y = minY; y <= maxY; y += 1) {
      for (let x = minX; x <= maxX; x += 1) {
        const dx = (x - cx) / rx;
        const dy = (y - cy) / ry;
        if (dx * dx + dy * dy <= 1) this.set(x, y, role);
      }
    }
  }

  fillRect(
    x: number,
    y: number,
    width: number,
    height: number,
    fill: PaletteRole,
    outline = true,
  ) {
    if (outline) {
      this.rectPass(x - 1, y - 1, width + 2, height + 2, "outline");
    }
    this.rectPass(x, y, width, height, fill);
  }

  rectPass(x: number, y: number, width: number, height: number, role: PaletteRole) {
    for (let py = Math.round(y); py < Math.round(y + height); py += 1) {
      for (let px = Math.round(x); px < Math.round(x + width); px += 1) {
        this.set(px, py, role);
      }
    }
  }

  line(
    x1: number,
    y1: number,
    x2: number,
    y2: number,
    thickness: number,
    fill: PaletteRole,
    outline = true,
  ) {
    if (outline) {
      this.linePass(x1, y1, x2, y2, thickness + 2, "outline");
    }
    this.linePass(x1, y1, x2, y2, thickness, fill);
  }

  linePass(
    x1: number,
    y1: number,
    x2: number,
    y2: number,
    thickness: number,
    role: PaletteRole,
  ) {
    let x = Math.round(x1);
    let y = Math.round(y1);
    const tx = Math.round(x2);
    const ty = Math.round(y2);
    const dx = Math.abs(tx - x);
    const dy = Math.abs(ty - y);
    const sx = x < tx ? 1 : -1;
    const sy = y < ty ? 1 : -1;
    let error = dx - dy;
    const radius = Math.max(0, Math.floor(thickness / 2));

    while (true) {
      this.stamp(x, y, radius, role);
      if (x === tx && y === ty) break;
      const e2 = 2 * error;
      if (e2 > -dy) {
        error -= dy;
        x += sx;
      }
      if (e2 < dx) {
        error += dx;
        y += sy;
      }
    }
  }

  stamp(x: number, y: number, radius: number, role: PaletteRole) {
    for (let oy = -radius; oy <= radius; oy += 1) {
      for (let ox = -radius; ox <= radius; ox += 1) {
        this.set(x + ox, y + oy, role);
      }
    }
  }

  polygon(points: Array<{ x: number; y: number }>, fill: PaletteRole, outline = true) {
    if (points.length < 3) return;
    const minY = Math.floor(Math.min(...points.map((point) => point.y)));
    const maxY = Math.ceil(Math.max(...points.map((point) => point.y)));

    for (let y = minY; y <= maxY; y += 1) {
      const intersections: number[] = [];
      for (let index = 0; index < points.length; index += 1) {
        const a = points[index];
        const b = points[(index + 1) % points.length];
        if ((a.y <= y && b.y > y) || (b.y <= y && a.y > y)) {
          intersections.push(
            a.x + ((y - a.y) / (b.y - a.y)) * (b.x - a.x),
          );
        }
      }
      intersections.sort((a, b) => a - b);
      for (let index = 0; index < intersections.length; index += 2) {
        const start = Math.ceil(intersections[index]);
        const end = Math.floor(intersections[index + 1] ?? intersections[index]);
        for (let x = start; x <= end; x += 1) this.set(x, y, fill);
      }
    }

    if (outline) {
      for (let index = 0; index < points.length; index += 1) {
        const a = points[index];
        const b = points[(index + 1) % points.length];
        this.linePass(a.x, a.y, b.x, b.y, 1, "outline");
      }
    }
  }

  pattern(base: PaletteRole, accent: PaletteRole, kind: "spots" | "stripes" | "scales") {
    const baseIndex = ROLE_INDEX[base];
    for (let y = 0; y < this.height; y += 1) {
      for (let x = 0; x < this.width; x += 1) {
        if (this.pixels[y * this.width + x] !== baseIndex) continue;
        if (kind === "stripes" && y % 4 === 0) this.set(x, y, accent);
        if (kind === "spots" && (x * 7 + y * 11) % 29 === 0) this.set(x, y, accent);
        if (kind === "scales" && (x + y) % 3 === 0) this.set(x, y, accent);
      }
    }
  }

  toPart(
    id: string,
    name: string,
    pivot: { x: number; y: number },
    z: number,
  ): Part {
    return {
      id,
      name,
      kind: "generated",
      pivot,
      z,
      pixels: this.pixels,
      transform: { ...IDENTITY_TRANSFORM },
      home: { ...IDENTITY_TRANSFORM },
      visible: true,
    };
  }
}

function drawEyes(raster: Raster, cx: number, y: number, count: number) {
  if (count <= 1) {
    raster.fillRect(cx, y, 2, 2, "eye", true);
    return;
  }
  const offset = count >= 3 ? 4 : 3;
  raster.fillRect(cx - offset, y, 2, 2, "eye", true);
  raster.fillRect(cx + offset - 1, y, 2, 2, "eye", true);
  if (count >= 3) raster.fillRect(cx - 1, y - 4, 2, 2, "eye", true);
  if (count >= 4) raster.fillRect(cx - 1, y + 4, 2, 2, "eye", true);
}

function drawHorns(raster: Raster, cx: number, y: number, size: number) {
  if (size <= 0) return;
  const height = 3 + size * 2;
  const width = 2 + size;
  raster.polygon(
    [
      { x: cx - width - 2, y },
      { x: cx - 2, y: y - height },
      { x: cx - 1, y: y - 1 },
    ],
    "accent",
    true,
  );
  raster.polygon(
    [
      { x: cx + width + 1, y },
      { x: cx + 2, y: y - height },
      { x: cx + 1, y: y - 1 },
    ],
    "accent",
    true,
  );
}

function drawWeapon(
  raster: Raster,
  handX: number,
  handY: number,
  weapon: CharacterSpec["features"]["weapon"],
) {
  if (weapon === "none") return;

  if (weapon === "sword") {
    raster.line(handX, handY, handX + 9, handY - 15, 2, "metal", true);
    raster.line(handX - 4, handY - 3, handX + 4, handY + 1, 2, "accent", true);
    raster.fillRect(handX - 1, handY, 3, 4, "primary", true);
  }

  if (weapon === "axe") {
    raster.line(handX, handY, handX + 5, handY - 18, 3, "primary", true);
    raster.polygon(
      [
        { x: handX + 3, y: handY - 18 },
        { x: handX + 14, y: handY - 22 },
        { x: handX + 12, y: handY - 10 },
        { x: handX + 5, y: handY - 8 },
      ],
      "metal",
      true,
    );
  }

  if (weapon === "club") {
    raster.line(handX, handY, handX + 7, handY - 15, 3, "primary", true);
    raster.fillEllipse(handX + 7, handY - 16, 5, 5, "metal", true);
  }

  if (weapon === "staff") {
    raster.line(handX, handY - 3, handX + 2, handY - 20, 2, "primary", true);
    raster.fillEllipse(handX + 2, handY - 22, 4, 4, "accent", true);
    raster.set(handX + 1, handY - 23, "highlight");
  }

  if (weapon === "claws") {
    for (let index = 0; index < 3; index += 1) {
      raster.line(
        handX + index * 2,
        handY,
        handX + 4 + index * 2,
        handY - 5,
        1,
        "highlight",
        true,
      );
    }
  }
}

function drawHumanoid(spec: CharacterSpec, width: number, height: number): Part[] {
  const sx = width / 64;
  const sy = height / 64;
  const unit = Math.min(sx, sy);
  const b = spec.build;
  const f = spec.features;
  const X = (value: number) => value * sx;
  const Y = (value: number) => value * sy;
  const R = (value: number) => Math.max(1, value * unit);
  const parts: Part[] = [];

  const headX = 32;
  const headY = 16;
  const headRx = R(8 * b.head);
  const headRy = R(8 * b.head);
  const torsoY = 34;
  const torsoRx = R(10 * b.width * b.torso);
  const torsoRy = R(10 * b.torso);
  const hipY = 43;
  const footY = 57;

  const hair = new Raster(width, height);
  if (f.hairStyle === "short") {
    hair.fillEllipse(X(headX), Y(headY - 3), headRx + 1, headRy * 0.72, "primary", true);
  } else if (f.hairStyle === "long") {
    hair.fillEllipse(X(headX), Y(headY - 3), headRx + 1, headRy * 0.72, "primary", true);
    hair.fillEllipse(X(headX - headRx + 1), Y(headY + 6), R(3), R(10), "primary", true);
    hair.fillEllipse(X(headX + headRx - 1), Y(headY + 6), R(3), R(10), "primary", true);
  } else if (f.hairStyle === "mohawk") {
    hair.fillRect(X(headX - 2), Y(headY - 10), 5, 9, "primary", true);
    hair.fillRect(X(headX - 1), Y(headY - 13), 3, 4, "primary", true);
  } else if (f.hairStyle === "topknot") {
    hair.fillEllipse(X(headX), Y(headY - 3), headRx + 1, headRy * 0.7, "primary", true);
    hair.fillEllipse(X(headX), Y(headY - headRy - 4), R(3), R(3), "primary", true);
    hair.fillRect(X(headX - 1), Y(headY - headRy - 1), 2, 3, "primary", true);
  } else if (f.hairStyle === "hooded") {
    hair.polygon(
      [
        { x: X(headX - headRx - 3), y: Y(headY + 6) },
        { x: X(headX - headRx - 2), y: Y(headY - headRy) },
        { x: X(headX), y: Y(headY - headRy - 5) },
        { x: X(headX + headRx + 2), y: Y(headY - headRy) },
        { x: X(headX + headRx + 3), y: Y(headY + 6) },
        { x: X(headX + 3), y: Y(headY + 8) },
        { x: X(headX - 3), y: Y(headY + 8) },
      ],
      "primary",
      true,
    );
  }
  if (f.ears >= 2) {
    hair.fillEllipse(X(headX - 7), Y(headY + 1), R(3), R(5), "primary", true);
    hair.fillEllipse(X(headX + 7), Y(headY + 1), R(3), R(5), "primary", true);
  }
  if (f.pattern !== "none") hair.pattern("primary", "primaryShadow", f.pattern === "scales" ? "spots" : f.pattern);
  if (f.hairStyle !== "bald" || f.ears >= 2) {
    parts.push(hair.toPart("hair", "Hair", { x: X(headX), y: Y(headY) }, 2));
  }

  const torso = new Raster(width, height);
  torso.fillEllipse(X(headX), Y(torsoY), torsoRx, torsoRy, "skin", true);
  if (f.pattern !== "none") torso.pattern("skin", "skinShadow", f.pattern);
  parts.push(torso.toPart("torso", "Torso", { x: X(headX), y: Y(torsoY) }, 4));

  const outfit = new Raster(width, height);
  if (f.outfit === "armor") {
    outfit.fillEllipse(X(headX), Y(torsoY - 1), torsoRx - 1, torsoRy - 2, "metal", true);
    outfit.fillRect(X(headX - 1), Y(torsoY - 7), 3, 13, "metalShadow", false);
    outfit.fillRect(X(headX - 8), Y(torsoY + 5), 17, 3, "primary", true);
    outfit.fillEllipse(X(22), Y(27), R(4), R(3), "metal", true);
    outfit.fillEllipse(X(42), Y(27), R(4), R(3), "metal", true);
  } else if (f.outfit === "robe") {
    outfit.polygon(
      [
        { x: X(headX - 8), y: Y(torsoY - 6) },
        { x: X(headX + 8), y: Y(torsoY - 6) },
        { x: X(headX + 11), y: Y(51) },
        { x: X(headX - 11), y: Y(51) },
      ],
      "secondary",
      true,
    );
    outfit.fillRect(X(headX - 1), Y(torsoY - 4), 3, 14, "accent", false);
  } else if (f.outfit === "rags") {
    outfit.fillRect(X(headX - 7), Y(torsoY - 5), 6, 8, "secondary", true);
    outfit.fillRect(X(headX + 2), Y(torsoY + 1), 7, 6, "secondaryShadow", true);
    outfit.fillRect(X(headX - 4), Y(torsoY + 7), 9, 2, "accent", false);
  } else if (f.outfit === "tunic") {
    outfit.polygon(
      [
        { x: X(headX - torsoRx + 1), y: Y(torsoY - 4) },
        { x: X(headX + torsoRx - 1), y: Y(torsoY - 4) },
        { x: X(headX + torsoRx), y: Y(hipY + 3) },
        { x: X(headX - torsoRx), y: Y(hipY + 3) },
      ],
      "secondary",
      true,
    );
    outfit.fillRect(X(headX - 1), Y(torsoY - 3), 3, 11, "secondaryShadow", false);
    outfit.fillRect(X(headX - torsoRx), Y(hipY - 1), torsoRx * 2, 3, "accent", false);
  } else if (f.outfit === "leather") {
    outfit.fillEllipse(X(headX), Y(torsoY), torsoRx - 1, torsoRy - 1, "secondaryShadow", true);
    outfit.fillRect(X(headX - 8), Y(torsoY - 5), 16, 4, "secondary", true);
    outfit.fillRect(X(headX - 1), Y(torsoY - 5), 3, 14, "accent", false);
    outfit.fillRect(X(headX - torsoRx + 1), Y(hipY - 3), torsoRx * 2 - 2, 3, "primaryShadow", false);
  } else if (f.outfit === "cloak") {
    outfit.polygon(
      [
        { x: X(headX - torsoRx + 2), y: Y(torsoY - 6) },
        { x: X(headX + torsoRx - 2), y: Y(torsoY - 6) },
        { x: X(headX + torsoRx + 3), y: Y(51) },
        { x: X(headX - torsoRx - 3), y: Y(51) },
      ],
      "secondary",
      true,
    );
    outfit.fillRect(X(headX - 2), Y(torsoY - 7), 5, 3, "secondaryShadow", false);
    outfit.fillRect(X(headX - 1), Y(torsoY - 4), 2, 18, "accent", false);
  }
  if (f.outfit !== "none") {
    parts.push(
      outfit.toPart(
        "outfit",
        "Outfit",
        { x: X(headX), y: Y(torsoY) },
        f.outfit === "cloak" ? 2 : 5,
      ),
    );
  }

  const armL = new Raster(width, height);
  armL.line(X(24), Y(27), X(18), Y(40), R(3), "skin", true);
  armL.fillEllipse(X(17), Y(41), R(3), R(3), "skin", true);
  if (f.outfit === "armor") {
    armL.fillRect(X(18), Y(34), R(4), R(4), "metal", true);
  }
  parts.push(armL.toPart("armL", "Left arm", { x: X(24), y: Y(27) }, 3));

  const armR = new Raster(width, height);
  armR.line(X(40), Y(27), X(46), Y(40), R(3), "skin", true);
  armR.fillEllipse(X(47), Y(41), R(3), R(3), "skin", true);
  if (f.outfit === "armor") {
    armR.fillRect(X(43), Y(34), R(4), R(4), "metal", true);
  }
  parts.push(armR.toPart("armR", "Right arm", { x: X(40), y: Y(27) }, 3));

  const legL = new Raster(width, height);
  legL.line(X(27), Y(hipY), X(24), Y(footY - 2), R(4), "skin", true);
  legL.fillRect(X(20), Y(footY - 1), 8, 3, f.outfit === "armor" ? "metal" : "primary", true);
  parts.push(legL.toPart("legL", "Left leg", { x: X(27), y: Y(hipY) }, 3));

  const legR = new Raster(width, height);
  legR.line(X(37), Y(hipY), X(40), Y(footY - 2), R(4), "skin", true);
  legR.fillRect(X(40), Y(footY - 1), 8, 3, f.outfit === "armor" ? "metal" : "primary", true);
  parts.push(legR.toPart("legR", "Right leg", { x: X(37), y: Y(hipY) }, 3));

  if (f.wings > 0) {
    const wings = new Raster(width, height);
    const wingHeight = 7 + f.wings * 3;
    wings.polygon(
      [
        { x: X(27), y: Y(31) },
        { x: X(10), y: Y(31 - wingHeight) },
        { x: X(14), y: Y(40) },
        { x: X(24), y: Y(37) },
      ],
      "secondary",
      true,
    );
    wings.polygon(
      [
        { x: X(37), y: Y(31) },
        { x: X(54), y: Y(31 - wingHeight) },
        { x: X(50), y: Y(40) },
        { x: X(40), y: Y(37) },
      ],
      "secondary",
      true,
    );
    parts.push(wings.toPart("wings", "Wings", { x: X(32), y: Y(31) }, 1));
  }

  if (f.tail > 0) {
    const tail = new Raster(width, height);
    tail.line(X(32), Y(43), X(38 + f.tail * 2), Y(49 + f.tail), R(2), "accent", true);
    parts.push(tail.toPart("tail", "Tail", { x: X(32), y: Y(43) }, 1));
  }

  const head = new Raster(width, height);
  head.fillEllipse(X(headX), Y(headY), headRx, headRy, "skin", true);
  drawHorns(head, X(headX), Y(headY - 6), f.horns);
  if (f.ears >= 1) {
    head.fillEllipse(X(headX - headRx), Y(headY - 2), R(2), R(3), "skin", true);
    head.fillEllipse(X(headX + headRx), Y(headY - 2), R(2), R(3), "skin", true);
  }
  drawEyes(head, X(headX), Y(headY - 1), f.eyes);
  if (f.mouth === 1) head.line(X(headX - 3), Y(headY + 5), X(headX + 3), Y(headY + 5), 1, "outline", false);
  if (f.mouth === 2) {
    head.line(X(headX - 3), Y(headY + 5), X(headX + 3), Y(headY + 5), 1, "outline", false);
    head.fillRect(X(headX - 3), Y(headY + 6), 1, 2, "eye", false);
    head.fillRect(X(headX + 3), Y(headY + 6), 1, 2, "eye", false);
  }
  if (f.mouth === 3) {
    head.fillRect(X(headX - 4), Y(headY + 4), 8, 3, "primaryShadow", true);
    head.fillRect(X(headX - 2), Y(headY + 4), 1, 2, "highlight", false);
    head.fillRect(X(headX + 1), Y(headY + 4), 1, 2, "highlight", false);
  }
  if (f.pattern !== "none") head.pattern("skin", "skinShadow", f.pattern);
  parts.push(head.toPart("head", "Head", { x: X(headX), y: Y(headY) }, 6));

  if (f.weapon !== "none") {
    const weapon = new Raster(width, height);
    drawWeapon(weapon, X(47), Y(41), f.weapon);
    parts.push(weapon.toPart("weapon", "Weapon", { x: X(47), y: Y(41) }, 7));
  }

  return parts;
}

function drawQuadruped(spec: CharacterSpec, width: number, height: number): Part[] {
  const sx = width / 64;
  const sy = height / 64;
  const unit = Math.min(sx, sy);
  const b = spec.build;
  const f = spec.features;
  const X = (value: number) => value * sx;
  const Y = (value: number) => value * sy;
  const R = (value: number) => Math.max(1, value * unit);
  const parts: Part[] = [];

  const bodyX = 34;
  const bodyY = 33;
  const bodyRx = R(17 * b.width * b.torso);
  const bodyRy = R(9 * b.torso);
  const headX = 14;
  const headY = 25;
  const headRx = R(7 * b.head);
  const headRy = R(7 * b.head);

  const body = new Raster(width, height);
  body.fillEllipse(X(bodyX), Y(bodyY), bodyRx, bodyRy, "primary", true);
  if (f.pattern !== "none") body.pattern("primary", "primaryShadow", f.pattern);
  parts.push(body.toPart("body", "Body", { x: X(bodyX), y: Y(bodyY) }, 4));

  const outfit = new Raster(width, height);
  if (f.outfit === "armor") {
    outfit.fillEllipse(X(bodyX), Y(bodyY - 1), bodyRx - 2, bodyRy - 2, "metal", true);
    outfit.fillRect(X(bodyX - 1), Y(bodyY - 5), 3, 11, "metalShadow", false);
  } else if (f.outfit === "robe") {
    outfit.fillRect(X(bodyX - 10), Y(bodyY - 5), 20, 11, "secondary", true);
  } else if (f.outfit === "rags") {
    outfit.fillRect(X(bodyX - 8), Y(bodyY - 4), 7, 6, "secondary", true);
    outfit.fillRect(X(bodyX + 2), Y(bodyY - 1), 6, 5, "secondaryShadow", true);
  } else if (f.outfit === "tunic") {
    outfit.fillRect(X(bodyX - 10), Y(bodyY - 4), 20, 9, "secondary", true);
    outfit.fillRect(X(bodyX - 10), Y(bodyY + 4), 20, 2, "accent", false);
  } else if (f.outfit === "leather") {
    outfit.fillEllipse(X(bodyX), Y(bodyY - 1), bodyRx - 3, bodyRy - 3, "secondaryShadow", true);
    outfit.fillRect(X(bodyX - 1), Y(bodyY - 5), 2, 10, "accent", false);
  } else if (f.outfit === "cloak") {
    outfit.fillRect(X(bodyX - 11), Y(bodyY - 5), 22, 11, "secondary", true);
    outfit.fillRect(X(bodyX - 1), Y(bodyY - 4), 2, 12, "accent", false);
  }
  if (f.outfit !== "none") {
    parts.push(outfit.toPart("outfit", "Outfit", { x: X(bodyX), y: Y(bodyY) }, f.outfit === "cloak" ? 3 : 5));
  }

  const legs = [
    { id: "legFL", name: "Front left leg", x: 20, y: 39 },
    { id: "legFR", name: "Front right leg", x: 27, y: 39 },
    { id: "legBL", name: "Back left leg", x: 41, y: 39 },
    { id: "legBR", name: "Back right leg", x: 48, y: 39 },
  ];
  for (const leg of legs) {
    const raster = new Raster(width, height);
    raster.line(X(leg.x), Y(leg.y), X(leg.x), Y(56), R(3), "skin", true);
    raster.fillRect(X(leg.x - 2), Y(56), 5, 2, "primary", true);
    parts.push(raster.toPart(leg.id, leg.name, { x: X(leg.x), y: Y(leg.y) }, 3));
  }

  const tail = new Raster(width, height);
  tail.line(X(50), Y(32), X(58 + f.tail * 2), Y(24 - f.tail * 2), R(2), "accent", true);
  parts.push(tail.toPart("tail", "Tail", { x: X(50), y: Y(32) }, 1));

  if (f.wings > 0) {
    const wings = new Raster(width, height);
    wings.polygon(
      [
        { x: X(bodyX - 2), y: Y(32) },
        { x: X(12), y: Y(21 - f.wings * 2) },
        { x: X(20), y: Y(39) },
      ],
      "secondary",
      true,
    );
    wings.polygon(
      [
        { x: X(bodyX + 2), y: Y(32) },
        { x: X(56), y: Y(21 - f.wings * 2) },
        { x: X(48), y: Y(39) },
      ],
      "secondary",
      true,
    );
    parts.push(wings.toPart("wings", "Wings", { x: X(bodyX), y: Y(32) }, 1));
  }

  const head = new Raster(width, height);
  head.fillEllipse(X(headX), Y(headY), headRx, headRy, "skin", true);
  drawHorns(head, X(headX), Y(headY - 6), f.horns);
  if (f.ears >= 1) {
    head.fillEllipse(X(headX - 4), Y(headY - 5), R(2), R(4), "skin", true);
    head.fillEllipse(X(headX + 4), Y(headY - 5), R(2), R(4), "skin", true);
  }
  drawEyes(head, X(headX), Y(headY - 1), f.eyes);
  if (f.mouth >= 1) head.line(X(headX - 4), Y(headY + 4), X(headX + 4), Y(headY + 4), 1, "outline", false);
  if (f.mouth >= 2) {
    head.fillRect(X(headX - 3), Y(headY + 5), 1, 2, "eye", false);
    head.fillRect(X(headX + 3), Y(headY + 5), 1, 2, "eye", false);
  }
  if (f.pattern !== "none") head.pattern("skin", "skinShadow", f.pattern);
  parts.push(head.toPart("head", "Head", { x: X(headX), y: Y(headY) }, 6));

  if (f.weapon === "claws") {
    const claws = new Raster(width, height);
    for (let index = 0; index < 3; index += 1) {
      claws.line(X(10 + index * 2), Y(31), X(7 + index * 2), Y(27), 1, "highlight", true);
    }
    parts.push(claws.toPart("weapon", "Claws", { x: X(10), y: Y(31) }, 7));
  }

  return parts;
}

function drawBlob(spec: CharacterSpec, width: number, height: number): Part[] {
  const sx = width / 64;
  const sy = height / 64;
  const unit = Math.min(sx, sy);
  const b = spec.build;
  const f = spec.features;
  const X = (value: number) => value * sx;
  const Y = (value: number) => value * sy;
  const R = (value: number) => Math.max(1, value * unit);
  const parts: Part[] = [];

  const bodyX = 32;
  const bodyY = 38;
  const bodyRx = R(16 * b.width * b.torso);
  const bodyRy = R(15 * b.torso);

  const body = new Raster(width, height);
  body.fillEllipse(X(bodyX), Y(bodyY), bodyRx, bodyRy, "primary", true);
  body.fillEllipse(X(bodyX - 10), Y(bodyY + 5), R(7), R(6), "primary", true);
  body.fillEllipse(X(bodyX + 10), Y(bodyY + 4), R(6), R(5), "primary", true);
  if (f.pattern !== "none") body.pattern("primary", "primaryShadow", f.pattern);
  parts.push(body.toPart("body", "Body", { x: X(bodyX), y: Y(bodyY) }, 4));

  const eyes = new Raster(width, height);
  drawEyes(eyes, X(bodyX), Y(bodyY - 6), f.eyes);
  parts.push(eyes.toPart("eyes", "Eyes", { x: X(bodyX), y: Y(bodyY - 6) }, 6));

  const mouth = new Raster(width, height);
  if (f.mouth === 0) {
    mouth.line(X(bodyX - 3), Y(bodyY + 5), X(bodyX + 3), Y(bodyY + 5), 1, "outline", false);
  } else if (f.mouth === 1) {
    mouth.fillRect(X(bodyX - 4), Y(bodyY + 4), 8, 2, "outline", false);
  } else {
    mouth.fillRect(X(bodyX - 5), Y(bodyY + 3), 10, 4, "outline", true);
    mouth.fillRect(X(bodyX - 3), Y(bodyY + 3), 2, 2, "highlight", false);
    mouth.fillRect(X(bodyX + 1), Y(bodyY + 3), 2, 2, "highlight", false);
  }
  parts.push(mouth.toPart("mouth", "Mouth", { x: X(bodyX), y: Y(bodyY + 4) }, 6));

  const armL = new Raster(width, height);
  armL.fillEllipse(X(15), Y(40), R(5), R(4), "primary", true);
  parts.push(armL.toPart("armL", "Left arm", { x: X(15), y: Y(40) }, 3));

  const armR = new Raster(width, height);
  armR.fillEllipse(X(49), Y(40), R(5), R(4), "primary", true);
  parts.push(armR.toPart("armR", "Right arm", { x: X(49), y: Y(40) }, 3));

  if (f.horns > 0) {
    const horns = new Raster(width, height);
    drawHorns(horns, X(bodyX), Y(bodyY - 14), f.horns);
    parts.push(horns.toPart("horns", "Horns", { x: X(bodyX), y: Y(bodyY - 14) }, 5));
  }

  const outfit = new Raster(width, height);
  if (f.outfit === "armor") {
    outfit.fillRect(X(bodyX - 9), Y(bodyY + 7), 18, 4, "metal", true);
  } else if (f.outfit === "robe") {
    outfit.fillRect(X(bodyX - 8), Y(bodyY + 10), 16, 4, "secondary", true);
  } else if (f.outfit === "rags") {
    outfit.fillRect(X(bodyX - 10), Y(bodyY + 9), 6, 4, "secondary", true);
    outfit.fillRect(X(bodyX + 3), Y(bodyY + 8), 5, 3, "secondaryShadow", true);
  } else if (f.outfit === "tunic") {
    outfit.fillRect(X(bodyX - 8), Y(bodyY + 8), 16, 5, "secondary", true);
    outfit.fillRect(X(bodyX - 8), Y(bodyY + 12), 16, 2, "accent", false);
  } else if (f.outfit === "leather") {
    outfit.fillRect(X(bodyX - 10), Y(bodyY + 7), 20, 5, "secondaryShadow", true);
    outfit.fillRect(X(bodyX - 1), Y(bodyY + 5), 2, 9, "accent", false);
  } else if (f.outfit === "cloak") {
    outfit.fillEllipse(X(bodyX), Y(bodyY + 8), bodyRx - 2, bodyRy * 0.55, "secondary", true);
    outfit.fillRect(X(bodyX - 1), Y(bodyY + 4), 2, 12, "accent", false);
  }
  if (f.outfit !== "none") {
    parts.push(outfit.toPart("outfit", "Outfit", { x: X(bodyX), y: Y(bodyY) }, f.outfit === "cloak" ? 3 : 5));
  }

  if (f.tail > 0) {
    const tail = new Raster(width, height);
    tail.line(X(bodyX + 10), Y(bodyY + 6), X(54 + f.tail * 2), Y(bodyY + 1), R(2), "accent", true);
    parts.push(tail.toPart("tail", "Tail", { x: X(bodyX + 10), y: Y(bodyY + 6) }, 1));
  }

  if (f.weapon !== "none") {
    const weapon = new Raster(width, height);
    drawWeapon(weapon, X(49), Y(40), f.weapon);
    parts.push(weapon.toPart("weapon", "Weapon", { x: X(49), y: Y(40) }, 7));
  }

  return parts;
}

export function buildParts(spec: CharacterSpec, width: number, height: number): Part[] {
  if (spec.bodyPlan === "quadruped") return drawQuadruped(spec, width, height);
  if (spec.bodyPlan === "blob") return drawBlob(spec, width, height);
  return drawHumanoid(spec, width, height);
}

export function pixelsToCanvas(
  pixels: number[],
  width: number,
  height: number,
  palette: string[],
): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) return canvas;

  const image = context.createImageData(width, height);
  const colors = palette.map(hexToRgba);
  for (let index = 0; index < width * height; index += 1) {
    const color = colors[pixels[index] ?? -1];
    const offset = index * 4;
    if (!color) {
      image.data[offset + 3] = 0;
      continue;
    }
    image.data[offset] = color[0];
    image.data[offset + 1] = color[1];
    image.data[offset + 2] = color[2];
    image.data[offset + 3] = color[3];
  }
  context.putImageData(image, 0, 0);
  return canvas;
}

export function renderDocumentToCanvas(
  doc: CharacterDoc,
  frame: AnimationFrame | null,
  canvas: HTMLCanvasElement,
  options?: {
    referenceImage?: HTMLImageElement | null;
    showReference?: boolean;
    draftPixels?: Record<string, number[]>;
    onionFrame?: AnimationFrame | null;
  },
) {
  const width = doc.width;
  const height = doc.height;
  if (canvas.width !== width) canvas.width = width;
  if (canvas.height !== height) canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) return;
  context.clearRect(0, 0, width, height);
  context.imageSmoothingEnabled = false;

  if (
    options?.showReference &&
    doc.reference?.visible &&
    options.referenceImage
  ) {
    context.save();
    context.globalAlpha = doc.reference.opacity;
    context.drawImage(options.referenceImage, 0, 0, width, height);
    context.restore();
  }

  if (options?.onionFrame) {
    context.save();
    context.globalAlpha = 0.18;
    drawParts(context, doc, options.onionFrame, options.draftPixels, width, height);
    context.restore();
  }

  drawParts(context, doc, frame, options?.draftPixels, width, height);
}

function drawParts(
  context: CanvasRenderingContext2D,
  doc: CharacterDoc,
  frame: AnimationFrame | null,
  draftPixels: Record<string, number[]> | undefined,
  width: number,
  height: number,
) {
  const palette = paletteArray(doc.spec.palette);
  const parts = [...doc.parts].sort((a, b) => a.z - b.z);

  for (const part of parts) {
    if (!part.visible) continue;
    const pixels = draftPixels?.[part.id] ?? frame?.pixels?.[part.id] ?? part.pixels;
    if (!pixels || pixels.length !== width * height) continue;
    const partCanvas = pixelsToCanvas(pixels, width, height, palette);
    const base = part.transform;
    const delta = frame?.transforms[part.id];
    const x = base.x + (delta?.x ?? 0);
    const y = base.y + (delta?.y ?? 0);
    const scale = base.scale * (delta?.scale ?? 1);
    const rotation = base.rotation + (delta?.rotation ?? 0);
    const opacity = base.opacity * (delta?.opacity ?? 1);

    context.save();
    context.globalAlpha = opacity;
    context.translate(part.pivot.x + x, part.pivot.y + y);
    context.rotate((rotation * Math.PI) / 180);
    context.scale(scale, scale);
    context.translate(-part.pivot.x, -part.pivot.y);
    context.drawImage(partCanvas, 0, 0);
    context.restore();
  }
}

export function renderFrameToCanvas(
  doc: CharacterDoc,
  frame: AnimationFrame | null,
): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = doc.width;
  canvas.height = doc.height;
  renderDocumentToCanvas(doc, frame, canvas);
  return canvas;
}

export function renderFrameToDataUrl(
  doc: CharacterDoc,
  frame: AnimationFrame | null,
): string {
  return renderFrameToCanvas(doc, frame).toDataURL("image/png");
}

export function renderSpecPreview(
  spec: CharacterSpec,
  width = 64,
  height = 64,
): string {
  const parts = buildParts(spec, width, height);
  const doc: CharacterDoc = {
    id: "preview",
    name: spec.name,
    width,
    height,
    spec,
    parts,
    reference: null,
    animations: [],
    currentAnimationId: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  return renderFrameToDataUrl(doc, null);
}

export function resizePixels(
  pixels: number[],
  oldWidth: number,
  oldHeight: number,
  newWidth: number,
  newHeight: number,
  scaleArt: boolean,
): number[] {
  const next = new Array(newWidth * newHeight).fill(TRANSPARENT);
  if (scaleArt) {
    for (let y = 0; y < newHeight; y += 1) {
      for (let x = 0; x < newWidth; x += 1) {
        const sourceX = Math.floor((x / newWidth) * oldWidth);
        const sourceY = Math.floor((y / newHeight) * oldHeight);
        next[y * newWidth + x] = pixels[sourceY * oldWidth + sourceX] ?? TRANSPARENT;
      }
    }
    return next;
  }

  const offsetX = Math.floor((newWidth - oldWidth) / 2);
  const offsetY = Math.floor((newHeight - oldHeight) / 2);
  for (let y = 0; y < oldHeight; y += 1) {
    for (let x = 0; x < oldWidth; x += 1) {
      const targetX = x + offsetX;
      const targetY = y + offsetY;
      if (targetX < 0 || targetY < 0 || targetX >= newWidth || targetY >= newHeight) {
        continue;
      }
      next[targetY * newWidth + targetX] =
        pixels[y * oldWidth + x] ?? TRANSPARENT;
    }
  }
  return next;
}

export function floodFill(
  pixels: number[],
  width: number,
  height: number,
  x: number,
  y: number,
  replacement: number,
): number[] {
  const start = y * width + x;
  const target = pixels[start];
  if (target === replacement) return pixels;
  const next = [...pixels];
  const stack = [[x, y]];
  while (stack.length > 0) {
    const [cx, cy] = stack.pop()!;
    if (cx < 0 || cy < 0 || cx >= width || cy >= height) continue;
    const index = cy * width + cx;
    if (next[index] !== target) continue;
    next[index] = replacement;
    stack.push([cx + 1, cy], [cx - 1, cy], [cx, cy + 1], [cx, cy - 1]);
  }
  return next;
}

export function recolorIndexToTransparent(
  pixels: number[],
  x: number,
  y: number,
  width: number,
  height: number,
): number[] {
  const next = [...pixels];
  if (x >= 0 && y >= 0 && x < width && y < height) {
    next[y * width + x] = TRANSPARENT;
  }
  return next;
}

export { TRANSPARENT };
