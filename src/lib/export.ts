import JSZip from "jszip";
import { GIFEncoder, applyPalette, quantize } from "gifenc";
import { renderFrameToCanvas } from "./render";
import type {
  AnimationDoc,
  AnimationFrame,
  CharacterDoc,
} from "./types";

function slug(value: string): string {
  return (
    value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "character"
  );
}

function godotName(value: string): string {
  return (
    value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "") || "animation"
  );
}

function downloadBlob(name: string, blob: Blob) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = name;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 2_000);
}

function canvasBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error("Could not encode image."));
    }, "image/png");
  });
}

function scaleCanvas(source: HTMLCanvasElement, scale: number): HTMLCanvasElement {
  if (scale === 1) return source;
  const canvas = document.createElement("canvas");
  canvas.width = source.width * scale;
  canvas.height = source.height * scale;
  const context = canvas.getContext("2d");
  if (!context) return source;
  context.imageSmoothingEnabled = false;
  context.drawImage(source, 0, 0, canvas.width, canvas.height);
  return canvas;
}

export async function exportStaticPng(doc: CharacterDoc, scale = 4) {
  const canvas = scaleCanvas(renderFrameToCanvas(doc, null), scale);
  downloadBlob(`${slug(doc.name)}@${scale}x.png`, await canvasBlob(canvas));
}

export async function exportGif(doc: CharacterDoc, animation: AnimationDoc) {
  const gif = GIFEncoder();
  const width = doc.width;
  const height = doc.height;

  for (let index = 0; index < animation.frames.length; index += 1) {
    const frame = animation.frames[index];
    const canvas = renderFrameToCanvas(doc, frame);
    const context = canvas.getContext("2d");
    if (!context) continue;
    const image = context.getImageData(0, 0, width, height);
    const palette = quantize(image.data, 255, {
      format: "rgba4444",
      oneBitAlpha: true,
      clearAlpha: true,
      clearAlphaThreshold: 0,
    });
    const transparentIndex = palette.findIndex((color) => color[3] === 0);
    const indexed = applyPalette(image.data, palette, "rgba4444");
    const delay = Math.max(20, Math.round((1000 * frame.duration) / animation.fps));
    gif.writeFrame(indexed, width, height, {
      palette,
      delay,
      repeat: index === 0 ? (animation.loop ? 0 : -1) : undefined,
      transparent: transparentIndex >= 0,
      transparentIndex: Math.max(0, transparentIndex),
    });
  }

  gif.finish();
  const bytes = gif.bytes();
  downloadBlob(
    `${slug(doc.name)}-${slug(animation.name)}.gif`,
    new Blob([bytes.buffer as ArrayBuffer], { type: "image/gif" }),
  );
}

export async function exportFrameZip(doc: CharacterDoc, animation: AnimationDoc) {
  const zip = new JSZip();
  const folder = zip.folder(`${slug(doc.name)}-${slug(animation.name)}`);
  if (!folder) return;

  for (let index = 0; index < animation.frames.length; index += 1) {
    const frame = animation.frames[index];
    const canvas = renderFrameToCanvas(doc, frame);
    const blob = await canvasBlob(canvas);
    folder.file(
      `${String(index).padStart(3, "0")}.png`,
      await blob.arrayBuffer(),
    );
  }

  folder.file(
    "metadata.json",
    JSON.stringify(
      {
        name: doc.name,
        animation: animation.name,
        fps: animation.fps,
        loop: animation.loop,
        frameSize: { width: doc.width, height: doc.height },
        frames: animation.frames.map((frame, index) => ({
          index,
          file: `${String(index).padStart(3, "0")}.png`,
          duration: frame.duration,
        })),
      },
      null,
      2,
    ),
  );

  const blob = await zip.generateAsync({ type: "blob" });
  downloadBlob(
    `${slug(doc.name)}-${slug(animation.name)}-frames.zip`,
    blob,
  );
}

type FlatFrame = {
  animation: AnimationDoc;
  frame: AnimationFrame;
  index: number;
};

function flattenAnimations(doc: CharacterDoc): {
  animations: Array<{ animation: AnimationDoc; start: number; count: number }>;
  frames: FlatFrame[];
} {
  const animations: Array<{
    animation: AnimationDoc;
    start: number;
    count: number;
  }> = [];
  const frames: FlatFrame[] = [];
  let index = 0;

  for (const animation of doc.animations) {
    animations.push({ animation, start: index, count: animation.frames.length });
    for (const frame of animation.frames) {
      frames.push({ animation, frame, index });
      index += 1;
    }
  }

  return { animations, frames };
}

function buildAtlas(doc: CharacterDoc, frames: FlatFrame[]) {
  const columns = Math.max(1, frames.length);
  const canvas = document.createElement("canvas");
  canvas.width = doc.width * columns;
  canvas.height = doc.height;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Could not create atlas.");
  context.imageSmoothingEnabled = false;

  for (let index = 0; index < frames.length; index += 1) {
    const frameCanvas = renderFrameToCanvas(doc, frames[index].frame);
    context.drawImage(frameCanvas, index * doc.width, 0);
  }

  return {
    canvas,
    regions: frames.map((frame, index) => ({
      frame,
      x: index * doc.width,
      y: 0,
      width: doc.width,
      height: doc.height,
    })),
  };
}

export async function exportSpriteSheet(
  doc: CharacterDoc,
  animation: AnimationDoc,
) {
  const flat = flattenAnimations({
    ...doc,
    animations: [animation],
  });
  const atlas = buildAtlas(doc, flat.frames);
  const blob = await canvasBlob(atlas.canvas);
  const zip = new JSZip();
  zip.file("spritesheet.png", await blob.arrayBuffer());
  zip.file(
    "spritesheet.json",
    JSON.stringify(
      {
        name: doc.name,
        frameSize: { width: doc.width, height: doc.height },
        columns: flat.frames.length,
        frames: atlas.regions.map((region, index) => ({
          index,
          name: `${slug(animation.name)}_${index}`,
          x: region.x,
          y: region.y,
          width: region.width,
          height: region.height,
          duration: region.frame.frame.duration,
        })),
      },
      null,
      2,
    ),
  );
  const zipBlob = await zip.generateAsync({ type: "blob" });
  downloadBlob(`${slug(doc.name)}-${slug(animation.name)}-sheet.zip`, zipBlob);
}

export async function exportGodot(doc: CharacterDoc) {
  const animations =
    doc.animations.length > 0
      ? doc.animations
      : [
          {
            id: "static",
            name: "idle",
            fps: 1,
            loop: true,
            frames: [
              {
                id: "static",
                duration: 1,
                transforms: {},
              },
            ],
          },
        ];
  const flat = flattenAnimations({ ...doc, animations });
  const atlas = buildAtlas(doc, flat.frames);
  const pngBlob = await canvasBlob(atlas.canvas);

  const regionById = new Map(
    atlas.regions.map((region, index) => [index, region]),
  );

  const subResources = atlas.regions
    .map(
      (region, index) =>
        `[sub_resource type="AtlasTexture" id="AtlasTexture_${index}"]\natlas = ExtResource("1_atlas")\nregion = Rect2(${region.x}, ${region.y}, ${region.width}, ${region.height})`,
    )
    .join("\n\n");

  const animationBlocks = flat.animations.map(({ animation, start, count }) => {
    const frameEntries = Array.from({ length: count }, (_, offset) => {
      const frameIndex = start + offset;
      const region = regionById.get(frameIndex);
      const duration = Math.max(
        0.01,
        (region?.frame.frame.duration ?? 1) / Math.max(1, animation.fps),
      );
      return `{\n"duration": ${duration.toFixed(4)},\n"texture": SubResource("AtlasTexture_${frameIndex}")\n}`;
    }).join(", ");
    return `{\n"frames": [${frameEntries}],\n"loop": ${animation.loop},\n"name": &"${godotName(
      animation.name,
    )}",\n"speed": ${animation.fps}.0\n}`;
  });

  const tres = `[gd_resource type="SpriteFrames" load_steps=${atlas.regions.length + 2} format=3]\n\n[ext_resource type="Texture2D" path="res://character_atlas.png" id="1_atlas"]\n\n${subResources}\n\n[resource]\nanimations = [${animationBlocks.join(
    ", ",
  )}]\n`;

  const zip = new JSZip();
  zip.file("character_atlas.png", await pngBlob.arrayBuffer());
  zip.file("character_frames.tres", tres);
  zip.file(
    "character_meta.json",
    JSON.stringify(
      {
        name: doc.name,
        frameSize: { width: doc.width, height: doc.height },
        animations: flat.animations.map(({ animation }) => ({
          name: animation.name,
          fps: animation.fps,
          loop: animation.loop,
          frameCount: animation.frames.length,
        })),
        pivots: Object.fromEntries(
          doc.parts.map((part) => [part.id, part.pivot]),
        ),
      },
      null,
      2,
    ),
  );
  const blob = await zip.generateAsync({ type: "blob" });
  downloadBlob(`${slug(doc.name)}-godot.zip`, blob);
}

export function exportProject(doc: CharacterDoc) {
  downloadBlob(
    `${slug(doc.name)}.spritefoundry.json`,
    new Blob([JSON.stringify(doc, null, 2)], {
      type: "application/json",
    }),
  );
}
