import {
  IDENTITY_TRANSFORM,
  ROLE_INDEX,
  paletteArray,
  type AnimationFrame,
  type CharacterDoc,
  type CharacterSpec,
  type PaletteRole,
  PALETTE_ROLES,
  VIEW_IDS,
  VIEW_LABELS,
  type Part,
  type ViewId,
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

type ViewBasis = {
  id: ViewId;
  front: boolean;
  side: 1 | -1;
};

const VIEW_BASIS: Record<ViewId, ViewBasis> = {
  frontRight: { id: "frontRight", front: true, side: 1 },
  frontLeft: { id: "frontLeft", front: true, side: -1 },
  backLeft: { id: "backLeft", front: false, side: -1 },
  backRight: { id: "backRight", front: false, side: 1 },
};

function drawEyes(
  raster: Raster,
  cx: number,
  y: number,
  count: number,
  side: 1 | -1,
  scale = 1,
) {
  const step = Math.max(1, Math.round(scale * 2.4));
  const near = cx + side * step;
  const far = cx - side * step;
  const w = Math.max(1, Math.round(scale * 1.2));
  const h = Math.max(1, Math.round(scale * 1.5));
  if (count <= 1) {
    raster.fillRect(cx + side * Math.max(1, Math.round(scale)), y, w, h, "eye", false);
    return;
  }
  raster.fillRect(near, y, w, h, "eye", false);
  raster.fillRect(far, y, Math.max(1, w - 1), h, "eye", false);
  raster.fillRect(far, y + h, Math.max(1, w - 1), Math.max(1, Math.round(scale)), "skinShadow", false);
  if (count >= 3) {
    raster.fillRect(cx - side * step, y - Math.max(2, Math.round(scale * 3.2)), w, w, "eye", false);
  }
  if (count >= 4) {
    raster.fillRect(cx + side * step, y + Math.max(2, Math.round(scale * 3.2)), w, w, "eye", false);
  }
}

function drawHorns(
  raster: Raster,
  cx: number,
  y: number,
  size: number,
  scale = 1,
  side: 1 | -1 = 1,
) {
  if (size <= 0) return;
  const u = Math.max(1, scale);
  const height = (3 + size * 2) * u;
  const width = (2 + size) * u;
  raster.polygon(
    [
      { x: cx - width - 2 * u, y },
      { x: cx - 2 * u, y: y - height },
      { x: cx - u, y: y - u },
    ],
    "accent",
    true,
  );
  raster.polygon(
    [
      { x: cx + width + u, y },
      { x: cx + 2 * u, y: y - height },
      { x: cx + u, y: y - u },
    ],
    "accent",
    true,
  );
  if (side < 0) {
    raster.fillRect(cx - width - 2 * u, y - height * 0.35, Math.max(1, u), Math.max(1, u), "highlight", false);
  }
}

function drawWeapon(
  raster: Raster,
  handX: number,
  handY: number,
  weapon: CharacterSpec["features"]["weapon"],
  side: 1 | -1 = 1,
  scale = 1,
) {
  if (weapon === "none") return;
  const u = Math.max(1, scale);
  const dx = (value: number) => handX + value * side * u;
  const dy = (value: number) => handY + value * u;

  if (weapon === "sword") {
    raster.line(dx(0), dy(0), dx(8), dy(-15), Math.max(1, u * 1.6), "metal", true);
    raster.line(dx(-4), dy(-3), dx(4), dy(1), Math.max(1, u * 1.4), "accent", true);
    raster.fillRect(dx(-1), dy(0), Math.max(1, u * 2.4), Math.max(1, u * 3.4), "primary", true);
  }

  if (weapon === "axe") {
    raster.line(dx(0), dy(0), dx(4), dy(-17), Math.max(1, u * 2.2), "primary", true);
    raster.polygon(
      [
        { x: dx(2), y: dy(-18) },
        { x: dx(12), y: dy(-21) },
        { x: dx(11), y: dy(-10) },
        { x: dx(4), y: dy(-8) },
      ],
      "metal",
      true,
    );
  }

  if (weapon === "club") {
    raster.line(dx(0), dy(0), dx(6), dy(-14), Math.max(1, u * 2.4), "primary", true);
    raster.fillEllipse(dx(6), dy(-16), Math.max(1, u * 4), Math.max(1, u * 4), "metal", true);
  }

  if (weapon === "staff") {
    raster.line(dx(0), dy(-3), dx(2), dy(-20), Math.max(1, u * 1.5), "primary", true);
    raster.fillEllipse(dx(2), dy(-22), Math.max(1, u * 3.2), Math.max(1, u * 3.2), "accent", true);
    raster.set(dx(1), dy(-23), "highlight");
  }

  if (weapon === "claws") {
    for (let index = 0; index < 3; index += 1) {
      raster.line(
        dx(index * 1.8),
        dy(0),
        dx(4 + index * 1.8),
        dy(-5),
        Math.max(1, u),
        "highlight",
        true,
      );
    }
  }
}

function drawHumanoid(
  spec: CharacterSpec,
  width: number,
  height: number,
  basis: ViewBasis,
): Part[] {
  const sx = width / 64;
  const sy = height / 64;
  const unit = Math.min(sx, sy);
  const b = spec.build;
  const f = spec.features;
  const S = basis.side;
  const front = basis.front;
  const X = (value: number) => value * sx;
  const Y = (value: number) => value * sy;
  const R = (value: number) => Math.max(1, value * unit);
  const parts: Part[] = [];

  const cx = 32 + S * 1.1;
  const headY = 15.5;
  const headRx = R(7.3 * b.head);
  const headRy = R(7.5 * b.head);
  const torsoY = 34.5;
  const torsoRx = R(8.3 * b.width * b.torso);
  const torsoRy = R(9.2 * b.torso);
  const hipY = 44;
  const footY = 57.5;

  const hair = new Raster(width, height);
  const capX = X(cx - S * 1.2);
  const capY = Y(headY - 2.4);
  if (f.hairStyle === "short") {
    if (front) {
      hair.fillEllipse(capX, capY, headRx * 0.95, headRy * 0.58, "primary", true);
      hair.fillRect(
        X(cx + S * 3.2),
        Y(headY - 3.2),
        R(2.1),
        R(4.2),
        "primary",
        true,
      );
    } else {
      hair.fillEllipse(X(cx), Y(headY + 0.8), headRx * 1.03, headRy * 0.95, "primary", true);
      hair.fillEllipse(X(cx - S * 1), Y(headY + 4.4), headRx * 0.72, R(3.2), "primary", true);
    }
  } else if (f.hairStyle === "long") {
    if (front) {
      hair.fillEllipse(capX, capY, headRx * 0.98, headRy * 0.6, "primary", true);
      hair.fillEllipse(
        X(cx - S * 4.8),
        Y(headY + 7),
        R(3.2),
        R(9.4),
        "primary",
        true,
      );
      hair.fillEllipse(
        X(cx + S * 3.8),
        Y(headY + 5),
        R(2.2),
        R(7),
        "primary",
        true,
      );
    } else {
      hair.fillEllipse(X(cx), Y(headY + 0.6), headRx * 1.05, headRy, "primary", true);
      hair.fillEllipse(X(cx - S * 2.2), Y(headY + 8.4), R(4.4), R(9.6), "primary", true);
      hair.fillEllipse(X(cx + S * 2.2), Y(headY + 7.4), R(3.4), R(8.4), "primary", true);
    }
  } else if (f.hairStyle === "mohawk") {
    const crestX = X(cx - S * 0.8 - 1.6);
    hair.fillRect(crestX, Y(headY - 11), R(3.4), R(10.4), "primary", true);
    hair.fillRect(X(cx - S * 0.8 - 1), Y(headY - 14), R(2.2), R(4), "primary", true);
    if (front) {
      hair.fillRect(X(cx + S * 3.2), Y(headY - 4), R(1.8), R(3), "primary", true);
    }
  } else if (f.hairStyle === "topknot") {
    hair.fillEllipse(capX, capY, headRx * 0.96, headRy * 0.56, "primary", true);
    hair.fillEllipse(
      X(cx - S * 1.2),
      Y(headY - headRy / unit - 3.6),
      R(3),
      R(3),
      "primary",
      true,
    );
    hair.fillRect(
      X(cx - S * 1.2 - 0.7),
      Y(headY - headRy / unit - 1.5),
      R(1.4),
      R(2.4),
      "accent",
      false,
    );
    if (!front) {
      hair.fillEllipse(
        X(cx - S * 0.6),
        Y(headY + 3.6),
        headRx * 0.72,
        R(3.2),
        "primary",
        true,
      );
    }
  } else if (f.hairStyle === "hooded") {
    if (front) {
      hair.polygon(
        [
          { x: X(cx - headRx / unit - 3.4), y: Y(headY + 7) },
          { x: X(cx - headRx / unit - 3.2), y: Y(headY - headRy / unit + 0.5) },
          { x: X(cx - S * 1), y: Y(headY - headRy / unit - 5.4) },
          { x: X(cx + headRx / unit + 3.2), y: Y(headY - headRy / unit + 0.5) },
          { x: X(cx + headRx / unit + 3.6), y: Y(headY + 7) },
          { x: X(cx + S * 2.6), y: Y(headY + 9.2) },
          { x: X(cx - S * 2.6), y: Y(headY + 9.2) },
        ],
        "primary",
        true,
      );
    } else {
      hair.fillEllipse(X(cx), Y(headY + 0.4), headRx * 1.18, headRy * 1.1, "primary", true);
      hair.fillEllipse(X(cx - S * 1.4), Y(headY + 4.8), headRx * 0.8, R(5), "primaryShadow", false);
    }
  }
  if (f.pattern !== "none") {
    hair.pattern("primary", "primaryShadow", f.pattern === "scales" ? "spots" : f.pattern);
  }
  if (f.hairStyle !== "bald" || f.ears >= 2) {
    parts.push(
      hair.toPart(
        "hair",
        "Hair",
        { x: X(cx), y: Y(headY) },
        front && f.hairStyle !== "topknot" ? 2 : 7,
      ),
    );
  }

  const torso = new Raster(width, height);
  torso.fillRect(
    X(cx - 2.3),
    Y(headY + headRy / unit - 1.8),
    R(4.6),
    R(4.8),
    "skin",
    true,
  );
  torso.fillRect(
    X(cx - 2.3),
    Y(headY + headRy / unit - 1.8),
    R(4.6),
    R(1.4),
    "skinShadow",
    false,
  );
  torso.fillEllipse(
    X(cx - S * 2.2),
    Y(torsoY + 0.7),
    torsoRx * 0.95,
    torsoRy * 0.98,
    "skinShadow",
    true,
  );
  torso.fillEllipse(X(cx), Y(torsoY), torsoRx, torsoRy, "skin", true);
  torso.fillEllipse(
    X(cx - S * 4.7),
    Y(torsoY - 6.1),
    R(3.7),
    R(2.9),
    "skinShadow",
    true,
  );
  torso.fillEllipse(
    X(cx + S * 4.7),
    Y(torsoY - 8.1),
    R(4),
    R(3.1),
    "skin",
    true,
  );
  torso.fillRect(
    X(cx - torsoRx * 0.7),
    Y(hipY - 2.2),
    torsoRx * 1.4,
    R(1.8),
    "skinShadow",
    false,
  );
  torso.fillEllipse(
    X(cx + S * 2.2),
    Y(torsoY + 1.6),
    torsoRx * 0.58,
    torsoRy * 0.48,
    "skin",
    false,
  );
  torso.fillEllipse(
    X(cx - S * 3.2),
    Y(torsoY + 4.2),
    torsoRx * 0.52,
    torsoRy * 0.38,
    "skinShadow",
    false,
  );
  if (f.pattern !== "none") torso.pattern("skin", "skinShadow", f.pattern);
  parts.push(torso.toPart("torso", "Torso", { x: X(cx), y: Y(torsoY) }, 4));

  const outfit = new Raster(width, height);
  if (f.outfit === "armor") {
    outfit.fillEllipse(
      X(cx - S * 2),
      Y(torsoY - 0.4),
      torsoRx * 0.94,
      torsoRy * 0.95,
      "metalShadow",
      true,
    );
    outfit.fillEllipse(
      X(cx + S * 0.5),
      Y(torsoY - 1),
      torsoRx * 0.86,
      torsoRy * 0.88,
      "metal",
      true,
    );
    outfit.fillRect(X(cx - R(0.7)), Y(torsoY - 6), R(1.5), R(12), "metalShadow", false);
    outfit.fillRect(
      X(cx - torsoRx * 0.82),
      Y(torsoY + 5.2),
      torsoRx * 1.64,
      R(2.3),
      "primary",
      true,
    );
    outfit.fillEllipse(
      X(cx + S * 6.7),
      Y(torsoY - 6.4),
      R(3.5),
      R(2.7),
      "metal",
      true,
    );
    outfit.fillEllipse(
      X(cx - S * 7.1),
      Y(torsoY - 5.6),
      R(2.9),
      R(2.1),
      "metalShadow",
      true,
    );
  } else if (f.outfit === "robe") {
    outfit.polygon(
      [
        { x: X(cx - torsoRx / unit + 1), y: Y(torsoY - 6) },
        { x: X(cx + torsoRx / unit - 1), y: Y(torsoY - 6) },
        { x: X(cx + torsoRx / unit + S * 3.4), y: Y(52.5) },
        { x: X(cx - torsoRx / unit + S * 3.4), y: Y(52.5) },
      ],
      "secondary",
      true,
    );
    outfit.fillRect(X(cx - R(0.6)), Y(torsoY - 4.2), R(1.5), R(15), "accent", false);
    outfit.fillRect(
      X(cx - torsoRx * 0.8),
      Y(50.6),
      torsoRx * 1.6,
      R(1.8),
      "secondaryShadow",
      false,
    );
  } else if (f.outfit === "rags") {
    outfit.fillRect(X(cx - S * 7.2), Y(torsoY - 5), R(5.6), R(8), "secondary", true);
    outfit.fillRect(X(cx + S * 1.6), Y(torsoY + 0.4), R(6.2), R(6), "secondaryShadow", true);
    outfit.fillRect(X(cx - S * 3.4), Y(torsoY + 7), R(8), R(1.8), "accent", false);
    outfit.fillRect(X(cx + S * 4.2), Y(torsoY - 3), R(1.6), R(4), "secondaryShadow", false);
  } else if (f.outfit === "tunic") {
    outfit.polygon(
      [
        { x: X(cx - torsoRx / unit + 1), y: Y(torsoY - 4.4) },
        { x: X(cx + torsoRx / unit - 1), y: Y(torsoY - 4.4) },
        { x: X(cx + torsoRx / unit + S * 1.6), y: Y(hipY + 3.5) },
        { x: X(cx - torsoRx / unit + S * 1.6), y: Y(hipY + 3.5) },
      ],
      "secondary",
      true,
    );
    outfit.fillRect(X(cx - R(0.6)), Y(torsoY - 3.4), R(1.4), R(11), "secondaryShadow", false);
    outfit.fillRect(
      X(cx - torsoRx * 0.92),
      Y(hipY - 1),
      torsoRx * 1.84,
      R(2.4),
      "accent",
      false,
    );
  } else if (f.outfit === "leather") {
    outfit.fillEllipse(
      X(cx - S * 1.4),
      Y(torsoY - 0.4),
      torsoRx * 0.9,
      torsoRy * 0.9,
      "secondaryShadow",
      true,
    );
    outfit.fillEllipse(
      X(cx + S * 1.2),
      Y(torsoY - 1),
      torsoRx * 0.74,
      torsoRy * 0.76,
      "secondary",
      true,
    );
    if (front) {
      outfit.line(
        X(cx + S * 4.6),
        Y(torsoY - 5.2),
        X(cx - S * 4.2),
        Y(torsoY + 5.2),
        R(1.5),
        "accent",
        false,
      );
    }
    outfit.fillRect(
      X(cx - torsoRx * 0.9),
      Y(hipY - 2.2),
      torsoRx * 1.8,
      R(2.4),
      "primaryShadow",
      false,
    );
  } else if (f.outfit === "cloak") {
    outfit.polygon(
      [
        { x: X(cx - torsoRx / unit + 2), y: Y(torsoY - 6) },
        { x: X(cx + torsoRx / unit - 1), y: Y(torsoY - 6.6) },
        { x: X(cx + torsoRx / unit + S * 4.6 + 3), y: Y(52) },
        { x: X(cx - torsoRx / unit + S * 4.6 - 3), y: Y(52) },
      ],
      "secondary",
      true,
    );
    outfit.fillRect(X(cx - S * 1.6), Y(torsoY - 7), R(4.4), R(2.8), "secondaryShadow", false);
    outfit.fillEllipse(X(cx + S * 1.4), Y(torsoY - 5), R(1.6), R(1.6), "accent", true);
    outfit.fillRect(X(cx - R(0.5)), Y(torsoY - 4), R(1.2), R(19), "accent", false);
  }
  if (f.outfit !== "none") {
    if (!front) {
      const seam = f.outfit === "armor" ? "metalShadow" : "secondaryShadow";
      outfit.fillRect(X(cx - R(0.7)), Y(torsoY - 4.4), R(1.4), R(12), seam, false);
      if (f.outfit === "leather") {
        for (let index = 0; index < 4; index += 1) {
          outfit.fillRect(
            X(cx - 2.2),
            Y(torsoY - 3 + index * 2.6),
            R(4.4),
            R(0.7),
            "accent",
            false,
          );
        }
      }
      if (f.outfit === "armor") {
        outfit.fillRect(X(cx - 4), Y(torsoY - 5.4), R(8), R(1.2), "metal", false);
      }
    }
    parts.push(
      outfit.toPart(
        "outfit",
        "Outfit",
        { x: X(cx), y: Y(torsoY) },
        f.outfit === "cloak" ? (front ? 2 : 5) : 5,
      ),
    );
  }

  const farShoulder = { x: cx - S * 6.4, y: torsoY - 6.2 };
  const farHand = { x: cx - S * 8.8, y: torsoY + 6.4 };
  const farArm = new Raster(width, height);
  farArm.line(
    X(farShoulder.x),
    Y(farShoulder.y),
    X(farHand.x),
    Y(farHand.y),
    R(2.7),
    "skinShadow",
    true,
  );
  farArm.fillEllipse(X(farHand.x), Y(farHand.y), R(2.4), R(2.4), "skinShadow", true);
  if (f.outfit === "armor") {
    farArm.fillRect(X(farHand.x - 0.8), Y(farHand.y - 3), R(2), R(2.6), "metalShadow", true);
  }
  parts.push(
    farArm.toPart("armL", "Far arm", { x: X(farShoulder.x), y: Y(farShoulder.y) }, 2),
  );

  const nearShoulder = { x: cx + S * 6.4, y: torsoY - 8.4 };
  const nearHand = { x: cx + S * 9.2, y: torsoY + 6.2 };
  const nearArm = new Raster(width, height);
  nearArm.line(
    X(nearShoulder.x),
    Y(nearShoulder.y),
    X(nearHand.x),
    Y(nearHand.y),
    R(3.1),
    "skin",
    true,
  );
  nearArm.fillEllipse(X(nearHand.x), Y(nearHand.y), R(2.6), R(2.6), "skin", true);
  if (f.outfit === "armor") {
    nearArm.fillRect(X(nearHand.x - 1), Y(nearHand.y - 3.2), R(2.3), R(3), "metal", true);
  }
  parts.push(
    nearArm.toPart("armR", "Near arm", { x: X(nearShoulder.x), y: Y(nearShoulder.y) }, 5),
  );

  const farHip = { x: cx - S * 2.6, y: hipY - 2.2 };
  const farFoot = { x: cx - S * 4.8, y: footY - 2.4 };
  const farLeg = new Raster(width, height);
  farLeg.line(
    X(farHip.x),
    Y(farHip.y),
    X(farFoot.x),
    Y(farFoot.y - 2),
    R(3.3),
    "skinShadow",
    true,
  );
  farLeg.fillRect(
    X(farFoot.x - 3.1),
    Y(farFoot.y - 1.1),
    R(6.4),
    R(2.4),
    f.outfit === "armor" ? "metalShadow" : "primaryShadow",
    true,
  );
  parts.push(
    farLeg.toPart("legL", "Far leg", { x: X(farHip.x), y: Y(farHip.y) }, 2),
  );

  const nearHip = { x: cx + S * 2.8, y: hipY + 0.4 };
  const nearFoot = { x: cx + S * 5.1, y: footY };
  const nearLeg = new Raster(width, height);
  nearLeg.line(
    X(nearHip.x),
    Y(nearHip.y),
    X(nearFoot.x),
    Y(nearFoot.y - 2),
    R(3.7),
    "skin",
    true,
  );
  nearLeg.fillRect(
    X(nearFoot.x - 3.5),
    Y(nearFoot.y - 1),
    R(7),
    R(2.5),
    f.outfit === "armor" ? "metal" : "primary",
    true,
  );
  nearLeg.fillRect(X(nearFoot.x - 2.4), Y(nearFoot.y - 0.4), R(1.6), R(1), "highlight", false);
  parts.push(
    nearLeg.toPart("legR", "Near leg", { x: X(nearHip.x), y: Y(nearHip.y) }, 5),
  );

  if (f.wings > 0) {
    const wings = new Raster(width, height);
    const spread = 7 + f.wings * 2.6;
    wings.polygon(
      [
        { x: X(cx - S * 1.4), y: Y(torsoY - 6.4) },
        { x: X(cx - S * spread - 8), y: Y(torsoY - 11 - spread * 0.5) },
        { x: X(cx - S * spread - 3), y: Y(torsoY + 3) },
        { x: X(cx - S * 2.6), y: Y(torsoY + 1.2) },
      ],
      "secondary",
      true,
    );
    wings.polygon(
      [
        { x: X(cx + S * 1.4), y: Y(torsoY - 6.8) },
        { x: X(cx + S * spread + 2), y: Y(torsoY - 10 - spread * 0.4) },
        { x: X(cx + S * spread - 1), y: Y(torsoY + 1) },
        { x: X(cx + S * 2.2), y: Y(torsoY + 0.6) },
      ],
      "secondaryShadow",
      true,
    );
    wings.line(
      X(cx - S * 2),
      Y(torsoY - 5.6),
      X(cx - S * spread - 5),
      Y(torsoY - 9),
      R(1.1),
      "secondaryShadow",
      false,
    );
    parts.push(wings.toPart("wings", "Wings", { x: X(cx), y: Y(torsoY - 6) }, 1));
  }

  if (f.tail > 0) {
    const tail = new Raster(width, height);
    tail.line(
      X(cx - S * 2.4),
      Y(hipY - 1),
      X(cx - S * (8 + f.tail * 1.4)),
      Y(hipY + 3 + f.tail),
      R(2.1),
      "accent",
      true,
    );
    tail.fillEllipse(
      X(cx - S * (9 + f.tail * 1.4)),
      Y(hipY + 3.4 + f.tail),
      R(1.4),
      R(1.4),
      "accent",
      true,
    );
    parts.push(tail.toPart("tail", "Tail", { x: X(cx), y: Y(hipY) }, 1));
  }

  const head = new Raster(width, height);
  head.fillEllipse(
    X(cx - S * 2.4),
    Y(headY + 0.9),
    headRx * 0.92,
    headRy * 0.96,
    "skinShadow",
    true,
  );
  head.fillEllipse(X(cx), Y(headY), headRx, headRy, "skin", true);
  head.fillEllipse(
    X(cx + S * 2.6),
    Y(headY + 3.8),
    headRx * 0.58,
    headRy * 0.42,
    "skin",
    false,
  );
  if (f.ears >= 1) {
    head.fillEllipse(
      X(cx + S * headRx / unit * 0.86),
      Y(headY - 1.6),
      R(2.2),
      R(3.6),
      "skin",
      true,
    );
    head.fillEllipse(
      X(cx - S * headRx / unit * 0.9),
      Y(headY - 2.4),
      R(1.9),
      R(3.2),
      "skinShadow",
      true,
    );
  }
  drawHorns(head, X(cx), Y(headY - headRy / unit * 0.72), f.horns, unit, S);
  if (front) {
    drawEyes(head, X(cx + S * 0.8), Y(headY - 1.1), f.eyes, S, unit);
    head.fillRect(X(cx + S * 4.1), Y(headY + 1.7), R(1), R(1.9), "skinShadow", false);
    if (f.mouth === 1) {
      head.line(
        X(cx + S * 0.5 - 2.4),
        Y(headY + 4.9),
        X(cx + S * 0.5 + 2.4),
        Y(headY + 4.9),
        1,
        "outline",
        false,
      );
    }
    if (f.mouth === 2) {
      head.line(
        X(cx + S * 0.5 - 3),
        Y(headY + 4.9),
        X(cx + S * 0.5 + 3),
        Y(headY + 4.9),
        1,
        "outline",
        false,
      );
      head.fillRect(X(cx + S * 0.5 - 2.2), Y(headY + 5.7), R(1), R(1.5), "eye", false);
      head.fillRect(X(cx + S * 0.5 + 2.2), Y(headY + 5.7), R(1), R(1.5), "eye", false);
    }
    if (f.mouth === 3) {
      head.fillRect(X(cx + S * 0.5 - 3.5), Y(headY + 3.9), R(7), R(2.5), "primaryShadow", true);
      head.fillRect(X(cx + S * 0.5 - 2), Y(headY + 3.9), R(1), R(1.4), "highlight", false);
      head.fillRect(X(cx + S * 0.5 + 1.4), Y(headY + 3.9), R(1), R(1.4), "highlight", false);
    }
  } else {
    head.fillRect(
      X(cx - headRx / unit * 0.6),
      Y(headY + 5.4),
      R(1.4),
      R(1.2),
      "skinShadow",
      false,
    );
  }
  if (f.pattern !== "none") head.pattern("skin", "skinShadow", f.pattern);
  parts.push(head.toPart("head", "Head", { x: X(cx), y: Y(headY) }, 6));

  if (f.weapon !== "none") {
    const weapon = new Raster(width, height);
    drawWeapon(
      weapon,
      X(nearHand.x + S * 0.6),
      Y(nearHand.y),
      f.weapon,
      S,
      unit,
    );
    parts.push(
      weapon.toPart("weapon", "Weapon", { x: X(nearHand.x), y: Y(nearHand.y) }, 8),
    );
  }

  return parts;
}

function drawQuadruped(
  spec: CharacterSpec,
  width: number,
  height: number,
  basis: ViewBasis,
): Part[] {
  const sx = width / 64;
  const sy = height / 64;
  const unit = Math.min(sx, sy);
  const b = spec.build;
  const f = spec.features;
  const S = basis.side;
  const front = basis.front;
  const X = (value: number) => value * sx;
  const Y = (value: number) => value * sy;
  const R = (value: number) => Math.max(1, value * unit);
  const parts: Part[] = [];

  const bodyX = 34;
  const bodyY = 32.5;
  const bodyRx = R(14.6 * b.width * b.torso);
  const bodyRy = R(8.2 * b.torso);
  const headX = bodyX - S * (front ? 19 : 15.4);
  const headY = bodyY - (front ? 6.5 : 4.1);
  const headRx = R((front ? 6.3 : 5.5) * b.head);
  const headRy = R((front ? 6.1 : 5.4) * b.head);
  const haunchX = bodyX + S * (front ? 10 : 11);
  const haunchRx = R(front ? 6.2 : 7.6);
  const haunchRy = R(front ? 6.6 : 7.8);

  const body = new Raster(width, height);
  body.fillEllipse(
    X(bodyX + S * 2.4),
    Y(bodyY + 0.6),
    bodyRx * 0.95,
    bodyRy * 0.98,
    "primaryShadow",
    true,
  );
  body.fillEllipse(X(bodyX), Y(bodyY), bodyRx, bodyRy, "primary", true);
  body.fillEllipse(
    X(haunchX),
    Y(bodyY + (front ? 0.6 : 1.2)),
    haunchRx,
    haunchRy,
    "primary",
    true,
  );
  body.fillEllipse(
    X(bodyX + S * 1.2),
    Y(bodyY + 3.6),
    bodyRx * 0.78,
    bodyRy * 0.34,
    "primaryShadow",
    false,
  );
  body.line(
    X(bodyX - S * 10.5),
    Y(bodyY - 0.4),
    X(headX + S * 3.4),
    Y(headY + 1.4),
    R(4.4),
    "skin",
    true,
  );
  if (f.pattern !== "none") body.pattern("primary", "primaryShadow", f.pattern);
  parts.push(body.toPart("body", "Body", { x: X(bodyX), y: Y(bodyY) }, 4));

  const outfit = new Raster(width, height);
  if (f.outfit === "armor") {
    outfit.fillEllipse(
      X(bodyX + S * 2),
      Y(bodyY - 0.4),
      bodyRx * 0.9,
      bodyRy * 0.86,
      "metalShadow",
      true,
    );
    outfit.fillEllipse(
      X(bodyX + S * 0.4),
      Y(bodyY - 1),
      bodyRx * 0.78,
      bodyRy * 0.74,
      "metal",
      true,
    );
    outfit.fillRect(X(bodyX - R(0.7)), Y(bodyY - 5), R(1.4), R(10), "metalShadow", false);
    outfit.fillRect(X(bodyX - bodyRx * 0.7), Y(bodyY + 4.4), bodyRx * 1.4, R(1.8), "primary", false);
  } else if (f.outfit === "robe" || f.outfit === "tunic" || f.outfit === "cloak") {
    const drape = f.outfit === "cloak" ? 4.4 : 2;
    outfit.polygon(
      [
        { x: X(bodyX - S * 9), y: Y(bodyY - 4.6) },
        { x: X(bodyX + S * 9), y: Y(bodyY - 4.8) },
        { x: X(bodyX + S * (10 + drape)), y: Y(bodyY + 5.4) },
        { x: X(bodyX - S * (9 + drape)), y: Y(bodyY + 5.6) },
      ],
      "secondary",
      true,
    );
    outfit.fillRect(X(bodyX - S * 10), Y(bodyY + 3.6), bodyRx * 0.7, R(1.8), "accent", false);
    if (f.outfit === "cloak") {
      outfit.fillRect(X(bodyX - R(0.5)), Y(bodyY - 4), R(1.2), R(11), "accent", false);
    }
  } else if (f.outfit === "leather") {
    outfit.fillEllipse(
      X(bodyX + S * 1),
      Y(bodyY - 1),
      bodyRx * 0.82,
      bodyRy * 0.72,
      "secondaryShadow",
      true,
    );
    outfit.line(
      X(bodyX - S * 6),
      Y(bodyY - 2),
      X(bodyX + S * 7),
      Y(bodyY - 3.6),
      R(1.5),
      "accent",
      false,
    );
  } else if (f.outfit === "rags") {
    outfit.fillRect(X(bodyX - S * 7), Y(bodyY - 3.4), R(6), R(4.8), "secondary", true);
    outfit.fillRect(X(bodyX + S * 3), Y(bodyY - 1.4), R(5), R(3.6), "secondaryShadow", true);
  }
  if (f.outfit !== "none") {
    parts.push(
      outfit.toPart(
        "outfit",
        "Outfit",
        { x: X(bodyX), y: Y(bodyY) },
        f.outfit === "cloak" ? (front ? 2 : 5) : 5,
      ),
    );
  }

  const legPairs: Array<{
    id: string;
    name: string;
    x: number;
    frontLeg: boolean;
  }> = [
    { id: "legFL", name: "Front outer leg", x: bodyX - S * 8.6, frontLeg: true },
    { id: "legFR", name: "Front inner leg", x: bodyX - S * 6.2, frontLeg: true },
    { id: "legBL", name: "Back inner leg", x: bodyX + S * 6.8, frontLeg: false },
    { id: "legBR", name: "Back outer leg", x: bodyX + S * 9.4, frontLeg: false },
  ];
  for (const leg of legPairs) {
    const near = front ? leg.frontLeg : !leg.frontLeg;
    const raster = new Raster(width, height);
    const topY = bodyY + (near ? 4.2 : 2.4);
    const bottomY = near ? 57 : 54.8;
    raster.line(
      X(leg.x),
      Y(topY),
      X(leg.x + S * (near ? 1.1 : -0.6)),
      Y(bottomY - 1.8),
      R(near ? 2.8 : 2.4),
      near ? "skin" : "skinShadow",
      true,
    );
    raster.fillRect(
      X(leg.x + S * (near ? 0.5 : -1.1) - 2.4),
      Y(bottomY - 1.2),
      R(5.2),
      R(2.1),
      near ? "primary" : "primaryShadow",
      true,
    );
    if (near) {
      raster.fillRect(X(leg.x + S * 1.1 - 1.4), Y(bottomY - 0.6), R(1.4), R(0.9), "highlight", false);
    }
    parts.push(
      raster.toPart(
        leg.id,
        leg.name,
        { x: X(leg.x), y: Y(topY) },
        near ? 5 : 2,
      ),
    );
  }

  const tail = new Raster(width, height);
  const tailBase = { x: bodyX + S * 14, y: bodyY - 1 };
  const tailTip = {
    x: bodyX + S * (20 + f.tail * 1.8),
    y: bodyY - 5 - f.tail * 1.4,
  };
  tail.line(
    X(tailBase.x),
    Y(tailBase.y),
    X(tailTip.x),
    Y(tailTip.y),
    R(front ? 2.1 : 2.7),
    "accent",
    true,
  );
  tail.fillEllipse(
    X(tailTip.x),
    Y(tailTip.y),
    R(front ? 1.8 : 2.3),
    R(front ? 1.8 : 2.3),
    "accent",
    true,
  );
  parts.push(tail.toPart("tail", "Tail", { x: X(tailBase.x), y: Y(tailBase.y) }, 1));

  if (f.wings > 0) {
    const wings = new Raster(width, height);
    wings.polygon(
      [
        { x: X(bodyX - S * 2), y: Y(bodyY - 5) },
        { x: X(bodyX - S * 14 - 2), y: Y(bodyY - 13 - f.wings * 2) },
        { x: X(bodyX - S * 7), y: Y(bodyY + 2) },
      ],
      "secondary",
      true,
    );
    wings.polygon(
      [
        { x: X(bodyX + S * 2), y: Y(bodyY - 5) },
        { x: X(bodyX + S * 15 + 2), y: Y(bodyY - 12 - f.wings * 2) },
        { x: X(bodyX + S * 8), y: Y(bodyY + 2) },
      ],
      "secondaryShadow",
      true,
    );
    parts.push(wings.toPart("wings", "Wings", { x: X(bodyX), y: Y(bodyY - 5) }, 1));
  }

  const head = new Raster(width, height);
  head.fillEllipse(
    X(headX - S * 1.4),
    Y(headY + 0.7),
    headRx * 0.94,
    headRy * 0.96,
    "skinShadow",
    true,
  );
  head.fillEllipse(X(headX), Y(headY), headRx, headRy, "skin", true);
  head.fillEllipse(
    X(headX - S * 4.4),
    Y(headY + 1.8),
    R(4.2),
    R(3.1),
    "skin",
    true,
  );
  head.fillRect(X(headX - S * 7.5), Y(headY + 1.2), R(1.2), R(1.2), "outline", false);
  if (f.ears >= 1) {
    head.fillEllipse(
      X(headX + S * 3.2),
      Y(headY - 5.2),
      R(2.1),
      R(3.4),
      "skin",
      true,
    );
    head.fillEllipse(
      X(headX - S * 2.8),
      Y(headY - 5.6),
      R(1.8),
      R(3),
      "skinShadow",
      true,
    );
  }
  drawHorns(head, X(headX), Y(headY - headRy / unit * 0.62), f.horns, unit, S);
  if (front) {
    drawEyes(head, X(headX + S * 0.2), Y(headY - 0.6), Math.min(2, f.eyes), S, unit);
    if (f.mouth >= 1) {
      head.line(
        X(headX - S * 6.8),
        Y(headY + 3.2),
        X(headX - S * 3.6),
        Y(headY + 3.6),
        1,
        "outline",
        false,
      );
    }
    if (f.mouth >= 2) {
      head.fillRect(X(headX - S * 5.8), Y(headY + 4.2), R(1), R(1.2), "eye", false);
    }
  }
  if (f.pattern !== "none") head.pattern("skin", "skinShadow", f.pattern);
  parts.push(head.toPart("head", "Head", { x: X(headX), y: Y(headY) }, 6));

  if (f.weapon !== "none") {
    const weapon = new Raster(width, height);
    const handX = bodyX - S * 7.4;
    const handY = bodyY + 7.4;
    drawWeapon(weapon, X(handX), Y(handY), f.weapon, S, unit);
    parts.push(weapon.toPart("weapon", "Weapon", { x: X(handX), y: Y(handY) }, 8));
  }

  return parts;
}

function drawBlob(
  spec: CharacterSpec,
  width: number,
  height: number,
  basis: ViewBasis,
): Part[] {
  const sx = width / 64;
  const sy = height / 64;
  const unit = Math.min(sx, sy);
  const b = spec.build;
  const f = spec.features;
  const S = basis.side;
  const front = basis.front;
  const X = (value: number) => value * sx;
  const Y = (value: number) => value * sy;
  const R = (value: number) => Math.max(1, value * unit);
  const parts: Part[] = [];

  const bodyX = 32 + S * 1.2;
  const bodyY = 37.5;
  const bodyRx = R(14.2 * b.width * b.torso);
  const bodyRy = R(13.4 * b.torso);

  const body = new Raster(width, height);
  body.fillEllipse(
    X(bodyX - S * 2.6),
    Y(bodyY + 0.8),
    bodyRx * 0.96,
    bodyRy * 0.96,
    "primaryShadow",
    true,
  );
  body.fillEllipse(X(bodyX), Y(bodyY), bodyRx, bodyRy, "primary", true);
  body.fillEllipse(
    X(bodyX + S * 9.4),
    Y(bodyY + 4.6),
    R(5.8),
    R(5),
    "primary",
    true,
  );
  body.fillEllipse(
    X(bodyX - S * 9.6),
    Y(bodyY + 3.8),
    R(4.8),
    R(4.2),
    "primaryShadow",
    true,
  );
  body.fillEllipse(
    X(bodyX + S * 1.2),
    Y(bodyY + 6.2),
    bodyRx * 0.7,
    bodyRy * 0.28,
    "primaryShadow",
    false,
  );
  if (f.pattern !== "none") body.pattern("primary", "primaryShadow", f.pattern);
  body.fillRect(X(bodyX + S * 2.2), Y(bodyY - bodyRy / unit * 0.55), R(1.4), R(1.2), "highlight", false);
  body.fillRect(X(bodyX + S * 4), Y(bodyY - bodyRy / unit * 0.55 + 1.4), R(1), R(1), "highlight", false);
  parts.push(body.toPart("body", "Body", { x: X(bodyX), y: Y(bodyY) }, 4));

  if (front) {
    const eyes = new Raster(width, height);
    const eyeY = Y(bodyY - 4.8);
    const eyeX = X(bodyX + S * 2.2);
    if (f.eyes <= 1) {
      eyes.fillRect(eyeX, eyeY, R(2), R(2), "eye", true);
      eyes.fillRect(eyeX + R(0.7), eyeY + R(0.6), R(0.7), R(0.8), "outline", false);
    } else {
      eyes.fillRect(eyeX + S * R(2.1), eyeY, R(1.9), R(1.9), "eye", true);
      eyes.fillRect(eyeX - S * R(2.3), eyeY, R(1.6), R(1.8), "eye", true);
      eyes.fillRect(eyeX + S * R(2.7), eyeY + R(0.6), R(0.7), R(0.8), "outline", false);
      eyes.fillRect(eyeX - S * R(1.9), eyeY + R(0.6), R(0.6), R(0.8), "outline", false);
      if (f.eyes >= 3) {
        eyes.fillRect(X(bodyX - S * 0.4), Y(bodyY - 9.4), R(1.5), R(1.6), "eye", true);
        eyes.fillRect(X(bodyX - S * 0.4) + R(0.5), Y(bodyY - 9.4) + R(0.5), R(0.6), R(0.7), "outline", false);
      }
      if (f.eyes >= 4) {
        eyes.fillRect(X(bodyX + S * 4.2), Y(bodyY - 8.4), R(1.3), R(1.4), "eye", true);
      }
    }
    parts.push(eyes.toPart("eyes", "Eyes", { x: X(bodyX), y: eyeY }, 6));

    const mouth = new Raster(width, height);
    if (f.mouth === 0) {
      mouth.line(X(bodyX + S * 1 - 2.6), Y(bodyY + 2.8), X(bodyX + S * 1 + 2.6), Y(bodyY + 2.8), 1, "outline", false);
    } else if (f.mouth === 1) {
      mouth.fillRect(X(bodyX + S * 1 - 3.4), Y(bodyY + 2.2), R(6.8), R(1.7), "outline", false);
    } else {
      mouth.fillRect(X(bodyX + S * 1 - 4.2), Y(bodyY + 1.6), R(8.4), R(3), "outline", true);
      mouth.fillRect(X(bodyX + S * 1 - 2.6), Y(bodyY + 1.6), R(1.8), R(1.5), "highlight", false);
      mouth.fillRect(X(bodyX + S * 1 + 0.8), Y(bodyY + 1.6), R(1.8), R(1.5), "highlight", false);
    }
    parts.push(mouth.toPart("mouth", "Mouth", { x: X(bodyX), y: Y(bodyY + 1.8) }, 6));
  }

  const farArm = new Raster(width, height);
  farArm.fillEllipse(X(bodyX - S * 12), Y(bodyY + 4.4), R(4.4), R(3.8), "primaryShadow", true);
  parts.push(farArm.toPart("armL", "Far arm", { x: X(bodyX - S * 12), y: Y(bodyY + 4.4) }, 2));

  const nearArm = new Raster(width, height);
  nearArm.fillEllipse(X(bodyX + S * 12.6), Y(bodyY + 5.2), R(4.8), R(4.2), "primary", true);
  nearArm.fillRect(X(bodyX + S * 12.2), Y(bodyY + 4.2), R(1.2), R(1), "highlight", false);
  parts.push(nearArm.toPart("armR", "Near arm", { x: X(bodyX + S * 12.6), y: Y(bodyY + 5.2) }, 5));

  if (f.horns > 0) {
    const horns = new Raster(width, height);
    drawHorns(horns, X(bodyX), Y(bodyY - bodyRy / unit * 0.92), f.horns, unit, S);
    parts.push(horns.toPart("horns", "Horns", { x: X(bodyX), y: Y(bodyY - bodyRy / unit * 0.92) }, 5));
  }

  const outfit = new Raster(width, height);
  if (f.outfit !== "none") {
    const bandY = bodyY + 8.2;
    const bandRx = bodyRx * (f.outfit === "robe" || f.outfit === "cloak" ? 0.66 : 0.58);
    outfit.fillEllipse(
      X(bodyX - S * 1.2),
      Y(bandY + 0.6),
      bandRx,
      R(2.3),
      "secondaryShadow",
      true,
    );
    outfit.fillEllipse(X(bodyX + S * 0.6), Y(bandY), bandRx * 0.9, R(2), "secondary", true);
    outfit.fillRect(
      X(bodyX + S * 1.6),
      Y(bandY - 1.6),
      R(2.2),
      R(2.4),
      f.outfit === "armor" ? "metal" : "accent",
      true,
    );
    if (f.outfit === "robe" || f.outfit === "cloak") {
      outfit.fillRect(X(bodyX - S * 1.2), Y(bandY + 1.2), R(1.2), R(5.4), "accent", false);
      outfit.fillRect(X(bodyX + S * 4.2), Y(bandY + 0.4), R(1), R(4.4), "secondaryShadow", false);
    } else if (f.outfit === "rags") {
      outfit.fillRect(X(bodyX + S * 4.2), Y(bandY - 2.8), R(3.2), R(2), "secondaryShadow", false);
    }
    parts.push(
      outfit.toPart(
        "outfit",
        "Outfit",
        { x: X(bodyX), y: Y(bandY) },
        5,
      ),
    );
  }

  if (f.tail > 0) {
    const tail = new Raster(width, height);
    tail.line(
      X(bodyX - S * 8.6),
      Y(bodyY + 6),
      X(bodyX - S * (14 + f.tail * 2)),
      Y(bodyY + 2 + f.tail),
      R(1.9),
      "accent",
      true,
    );
    tail.fillEllipse(
      X(bodyX - S * (14.6 + f.tail * 2)),
      Y(bodyY + 1.6 + f.tail),
      R(1.5),
      R(1.5),
      "accent",
      true,
    );
    parts.push(tail.toPart("tail", "Tail", { x: X(bodyX), y: Y(bodyY + 6) }, 1));
  }

  if (f.weapon !== "none") {
    const weapon = new Raster(width, height);
    const handX = bodyX + S * 13.4;
    const handY = bodyY + 6;
    drawWeapon(weapon, X(handX), Y(handY), f.weapon, S, unit);
    parts.push(weapon.toPart("weapon", "Weapon", { x: X(handX), y: Y(handY) }, 8));
  }

  return parts;
}

export function buildParts(
  spec: CharacterSpec,
  width: number,
  height: number,
  view: ViewId = "frontRight",
): Part[] {
  const basis = VIEW_BASIS[view];
  if (spec.bodyPlan === "quadruped") return drawQuadruped(spec, width, height, basis);
  if (spec.bodyPlan === "blob") return drawBlob(spec, width, height, basis);
  return drawHumanoid(spec, width, height, basis);
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
  view: ViewId,
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
    options.referenceImage &&
    (!doc.referenceView || doc.referenceView === view)
  ) {
    context.save();
    context.globalAlpha = doc.reference.opacity;
    context.drawImage(options.referenceImage, 0, 0, width, height);
    context.restore();
  }

  if (options?.onionFrame) {
    context.save();
    context.globalAlpha = 0.18;
    drawParts(context, doc, view, options.onionFrame, options.draftPixels, width, height);
    context.restore();
  }

  drawParts(context, doc, view, frame, options?.draftPixels, width, height);
}

function drawParts(
  context: CanvasRenderingContext2D,
  doc: CharacterDoc,
  view: ViewId,
  frame: AnimationFrame | null,
  draftPixels: Record<string, number[]> | undefined,
  width: number,
  height: number,
) {
  const palette = paletteArray(doc.spec.palette);
  const parts = [...(doc.views[view] ?? doc.views.frontRight ?? [])].sort((a, b) => a.z - b.z);

  for (const part of parts) {
    if (!part.visible) continue;
    const pixels = draftPixels?.[part.id] ?? frame?.pixels?.[view]?.[part.id] ?? part.pixels;
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
  view: ViewId,
  frame: AnimationFrame | null,
): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = doc.width;
  canvas.height = doc.height;
  renderDocumentToCanvas(doc, view, frame, canvas);
  return canvas;
}

export function renderFrameToDataUrl(
  doc: CharacterDoc,
  view: ViewId,
  frame: AnimationFrame | null,
): string {
  return renderFrameToCanvas(doc, view, frame).toDataURL("image/png");
}

export function renderSpecPreview(
  spec: CharacterSpec,
  view: ViewId = "frontRight",
  width = 64,
  height = 64,
): string {
  const views = Object.fromEntries(
    VIEW_IDS.map((id) => [
      id,
      id === view ? buildParts(spec, width, height, id) : [],
    ]),
  ) as CharacterDoc["views"];
  const doc: CharacterDoc = {
    id: "preview",
    name: spec.name,
    width,
    height,
    spec,
    views,
    activeView: view,
    reference: null,
    animations: [],
    currentAnimationId: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  return renderFrameToDataUrl(doc, view, null);
}

export function renderViewSheetDataUrl(
  doc: CharacterDoc,
  scale = 3,
  frame: AnimationFrame | null = null,
): string {
  const cell = doc.width * scale;
  const gap = Math.max(4, Math.round(scale * 2));
  const label = Math.max(10, Math.round(scale * 4));
  const width = cell * 2 + gap;
  const height = cell * 2 + gap + label;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) return "";
  context.imageSmoothingEnabled = false;
  context.fillStyle = "#111512";
  context.fillRect(0, 0, width, height);
  const [frontRight, frontLeft, backLeft, backRight] = VIEW_IDS;
  const cells: Array<[ViewId, number, number]> = [
    [frontRight, 0, 0],
    [frontLeft, cell + gap, 0],
    [backLeft, 0, cell + gap],
    [backRight, cell + gap, cell + gap],
  ];
  for (const [view, x, y] of cells) {
    const viewCanvas = renderFrameToCanvas(doc, view, frame);
    context.drawImage(viewCanvas, x, y, cell, cell);
    context.fillStyle = "rgba(255,255,255,0.08)";
    context.fillRect(x, y + cell - 1, cell, 1);
    context.fillRect(x + cell - 1, y, 1, cell);
  }
  context.fillStyle = "#d9e8b0";
  context.font = `${Math.max(9, Math.round(scale * 3))}px monospace`;
  context.textBaseline = "bottom";
  const labels: Array<[ViewId, number, number]> = [
    [frontRight, 0, cell],
    [frontLeft, cell + gap, cell],
    [backLeft, 0, height],
    [backRight, cell + gap, height],
  ];
  for (const [view, x, y] of labels) {
    context.fillText(VIEW_LABELS[view], x + 2, y - 2);
  }
  return canvas.toDataURL("image/png");
}

export function renderTurntableFrame(
  doc: CharacterDoc,
  view: ViewId,
): HTMLCanvasElement {
  return renderFrameToCanvas(doc, view, null);
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
