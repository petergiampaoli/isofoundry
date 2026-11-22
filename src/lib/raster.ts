import type { RGBA } from './color';
import { alphaBlend } from './color';

export type Point = [number, number];

export class PixelBuffer {
  readonly width: number;
  readonly height: number;
  readonly data: Uint8ClampedArray;

  constructor(width: number, height: number) {
    this.width = width;
    this.height = height;
    this.data = new Uint8ClampedArray(width * height * 4);
  }

  index(x: number, y: number): number {
    return (y * this.width + x) * 4;
  }

  inside(x: number, y: number): boolean {
    return x >= 0 && y >= 0 && x < this.width && y < this.height;
  }

  set(x: number, y: number, color: RGBA): void {
    if (!this.inside(x, y)) return;
    const i = this.index(x, y);
    this.data[i] = color[0];
    this.data[i + 1] = color[1];
    this.data[i + 2] = color[2];
    this.data[i + 3] = color[3];
  }

  blend(x: number, y: number, color: RGBA): void {
    if (!this.inside(x, y)) return;
    const i = this.index(x, y);
    const dst: RGBA = [this.data[i], this.data[i + 1], this.data[i + 2], this.data[i + 3]];
    const out = alphaBlend(dst, color);
    this.data[i] = out[0];
    this.data[i + 1] = out[1];
    this.data[i + 2] = out[2];
    this.data[i + 3] = out[3];
  }

  get(x: number, y: number): RGBA {
    if (!this.inside(x, y)) return [0, 0, 0, 0];
    const i = this.index(x, y);
    return [this.data[i], this.data[i + 1], this.data[i + 2], this.data[i + 3]];
  }

  clear(): void {
    this.data.fill(0);
  }

  fill(color: RGBA): void {
    for (let y = 0; y < this.height; y += 1) {
      for (let x = 0; x < this.width; x += 1) this.set(x, y, color);
    }
  }

  rect(x: number, y: number, width: number, height: number, color: RGBA): void {
    const x0 = Math.round(x);
    const y0 = Math.round(y);
    for (let yy = y0; yy < y0 + Math.round(height); yy += 1) {
      for (let xx = x0; xx < x0 + Math.round(width); xx += 1) this.set(xx, yy, color);
    }
  }

  ellipse(cx: number, cy: number, rx: number, ry: number, color: RGBA): void {
    if (rx <= 0 || ry <= 0) return;
    const x0 = Math.floor(cx - rx);
    const x1 = Math.ceil(cx + rx);
    const y0 = Math.floor(cy - ry);
    const y1 = Math.ceil(cy + ry);
    for (let y = y0; y <= y1; y += 1) {
      for (let x = x0; x <= x1; x += 1) {
        const dx = (x - cx) / rx;
        const dy = (y - cy) / ry;
        if (dx * dx + dy * dy <= 1.02) this.set(x, y, color);
      }
    }
  }

  polygon(points: Point[], color: RGBA): void {
    if (points.length < 3) return;
    let minY = Infinity;
    let maxY = -Infinity;
    for (const [, y] of points) {
      minY = Math.min(minY, y);
      maxY = Math.max(maxY, y);
    }
    const yStart = Math.floor(minY);
    const yEnd = Math.ceil(maxY);
    for (let y = yStart; y <= yEnd; y += 1) {
      const scanY = y + 0.5;
      const xs: number[] = [];
      for (let i = 0; i < points.length; i += 1) {
        const [x1, y1] = points[i];
        const [x2, y2] = points[(i + 1) % points.length];
        if ((y1 <= scanY && y2 > scanY) || (y2 <= scanY && y1 > scanY)) {
          const t = (scanY - y1) / (y2 - y1);
          xs.push(x1 + t * (x2 - x1));
        }
      }
      xs.sort((a, b) => a - b);
      for (let i = 0; i + 1 < xs.length; i += 2) {
        const start = Math.round(xs[i]);
        const end = Math.round(xs[i + 1]);
        for (let x = start; x < end; x += 1) this.set(x, y, color);
      }
    }
  }

  line(x0: number, y0: number, x1: number, y1: number, color: RGBA, width = 1): void {
    let x = Math.round(x0);
    let y = Math.round(y0);
    const tx = Math.round(x1);
    const ty = Math.round(y1);
    const dx = Math.abs(tx - x);
    const dy = Math.abs(ty - y);
    const sx = x < tx ? 1 : -1;
    const sy = y < ty ? 1 : -1;
    let err = dx - dy;
    for (let guard = 0; guard < 10000; guard += 1) {
      if (width <= 1) {
        this.set(x, y, color);
      } else {
        const half = Math.floor(width / 2);
        for (let oy = -half; oy <= half; oy += 1) {
          for (let ox = -half; ox <= half; ox += 1) this.set(x + ox, y + oy, color);
        }
      }
      if (x === tx && y === ty) break;
      const e2 = 2 * err;
      if (e2 > -dy) {
        err -= dy;
        x += sx;
      }
      if (e2 < dx) {
        err += dx;
        y += sy;
      }
    }
  }

  outline(color: RGBA, minAlpha = 180): void {
    const snapshot = new Uint8ClampedArray(this.data);
    const alphaAt = (x: number, y: number): number => {
      if (!this.inside(x, y)) return 0;
      return snapshot[this.index(x, y) + 3];
    };
    for (let y = 0; y < this.height; y += 1) {
      for (let x = 0; x < this.width; x += 1) {
        if (alphaAt(x, y) >= minAlpha) continue;
        let touches = false;
        for (let oy = -1; oy <= 1 && !touches; oy += 1) {
          for (let ox = -1; ox <= 1; ox += 1) {
            if (ox === 0 && oy === 0) continue;
            if (alphaAt(x + ox, y + oy) >= minAlpha) {
              touches = true;
              break;
            }
          }
        }
        if (touches) this.set(x, y, color);
      }
    }
  }

  visibleBounds(): { x: number; y: number; width: number; height: number; count: number } {
    let minX = this.width;
    let minY = this.height;
    let maxX = -1;
    let maxY = -1;
    let count = 0;
    for (let y = 0; y < this.height; y += 1) {
      for (let x = 0; x < this.width; x += 1) {
        if (this.data[this.index(x, y) + 3] > 8) {
          count += 1;
          if (x < minX) minX = x;
          if (y < minY) minY = y;
          if (x > maxX) maxX = x;
          if (y > maxY) maxY = y;
        }
      }
    }
    if (count === 0) return { x: 0, y: 0, width: 0, height: 0, count };
    return { x: minX, y: minY, width: maxX - minX + 1, height: maxY - minY + 1, count };
  }

  clone(): PixelBuffer {
    const copy = new PixelBuffer(this.width, this.height);
    copy.data.set(this.data);
    return copy;
  }

  toImageData(): ImageData {
    return new ImageData(new Uint8ClampedArray(this.data), this.width, this.height);
  }
}

export function bufferToCanvas(buffer: PixelBuffer, scale = 1): HTMLCanvasElement {
  const source = document.createElement('canvas');
  source.width = buffer.width;
  source.height = buffer.height;
  const sourceCtx = source.getContext('2d');
  if (!sourceCtx) throw new Error('Canvas 2D context is unavailable');
  sourceCtx.putImageData(buffer.toImageData(), 0, 0);
  if (scale === 1) return source;

  const output = document.createElement('canvas');
  output.width = buffer.width * scale;
  output.height = buffer.height * scale;
  const ctx = output.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D context is unavailable');
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(source, 0, 0, output.width, output.height);
  return output;
}

export function bufferToPngUrl(buffer: PixelBuffer, scale = 1): string {
  return bufferToCanvas(buffer, scale).toDataURL('image/png');
}
