import { paletteArray, type Palette } from "./types";

export function loadImage(dataUrl: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Could not load image."));
    image.src = dataUrl;
  });
}

function rgb(hex: string): [number, number, number] {
  const value = Number.parseInt(hex.replace("#", ""), 16);
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255];
}

export function nearestPaletteIndex(
  r: number,
  g: number,
  b: number,
  palette: Palette,
): number {
  return nearestIndex(r, g, b, paletteArray(palette).map(rgb));
}

function nearestIndex(
  r: number,
  g: number,
  b: number,
  colors: Array<[number, number, number]>,
): number {
  let best = 0;
  let bestDistance = Number.POSITIVE_INFINITY;
  colors.forEach(([cr, cg, cb], index) => {
    const distance = (r - cr) ** 2 + (g - cg) ** 2 + (b - cb) ** 2;
    if (distance < bestDistance) {
      bestDistance = distance;
      best = index;
    }
  });
  return best;
}

export function quantizeImageData(
  image: ImageData,
  palette: Palette,
): number[] {
  const colors = paletteArray(palette).map(rgb);
  const pixels = new Array(image.width * image.height).fill(-1);
  for (let index = 0; index < image.width * image.height; index += 1) {
    const offset = index * 4;
    if (image.data[offset + 3] < 24) continue;
    pixels[index] = nearestIndex(
      image.data[offset],
      image.data[offset + 1],
      image.data[offset + 2],
      colors,
    );
  }
  return pixels;
}

export async function resizeImageDataUrl(
  dataUrl: string,
  width: number,
  height: number,
): Promise<string> {
  const image = await loadImage(dataUrl);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) return dataUrl;
  context.imageSmoothingEnabled = false;
  context.drawImage(image, 0, 0, width, height);
  return canvas.toDataURL("image/png");
}

export async function sliceReference(
  referenceDataUrl: string,
  points: Array<{ x: number; y: number }>,
  width: number,
  height: number,
  palette: Palette,
  name: string,
): Promise<{
  id: string;
  name: string;
  pixels: number[];
  pivot: { x: number; y: number };
} | null> {
  if (points.length < 3) return null;
  const image = await loadImage(referenceDataUrl);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) return null;

  context.drawImage(image, 0, 0, width, height);
  context.globalCompositeOperation = "destination-in";
  context.beginPath();
  context.moveTo(points[0].x, points[0].y);
  for (const point of points.slice(1)) {
    context.lineTo(point.x, point.y);
  }
  context.closePath();
  context.fillStyle = "#ffffff";
  context.fill();

  const imageData = context.getImageData(0, 0, width, height);
  const pixels = quantizeImageData(imageData, palette);
  if (!pixels.some((pixel) => pixel >= 0)) return null;

  let minX = width;
  let minY = height;
  let maxX = 0;
  let maxY = 0;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (pixels[y * width + x] < 0) continue;
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
    }
  }

  return {
    id: crypto.randomUUID(),
    name,
    pixels,
    pivot: {
      x: Math.round((minX + maxX) / 2),
      y: Math.round((minY + maxY) / 2),
    },
  };
}
