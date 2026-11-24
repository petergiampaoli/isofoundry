import JSZip from "jszip";
import { GIFEncoder, applyPalette, quantize } from "gifenc";
import { renderFrameToCanvas } from "./render";
import {
  TURNTABLE_VIEW_MS,
  VIEW_IDS,
  VIEW_LABELS,
  type AnimationDoc,
  type AnimationFrame,
  type CharacterDoc,
  type ViewId,
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

function viewSlug(view: ViewId): string {
  return godotName(VIEW_LABELS[view]);
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

function composeViewSheet(
  doc: CharacterDoc,
  scale = 4,
  frame: AnimationFrame | null = null,
): HTMLCanvasElement {
  const cell = doc.width * scale;
  const canvas = document.createElement("canvas");
  canvas.width = cell * 2;
  canvas.height = cell * 2;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Could not create view sheet.");
  context.imageSmoothingEnabled = false;
  VIEW_IDS.forEach((view, index) => {
    const cellCanvas = renderFrameToCanvas(doc, view, frame);
    context.drawImage(
      cellCanvas,
      (index % 2) * cell,
      Math.floor(index / 2) * cell,
      cell,
      cell,
    );
  });
  return canvas;
}

function encodeGif(
  doc: CharacterDoc,
  animation: AnimationDoc,
  view: ViewId,
): Uint8Array {
  const gif = GIFEncoder();
  const width = doc.width;
  const height = doc.height;

  for (let index = 0; index < animation.frames.length; index += 1) {
    const frame = animation.frames[index];
    const canvas = renderFrameToCanvas(doc, view, frame);
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
  return gif.bytes();
}

function encodeTurntableGif(doc: CharacterDoc): Uint8Array {
  const gif = GIFEncoder();
  const width = doc.width;
  const height = doc.height;

  VIEW_IDS.forEach((view, index) => {
    const canvas = renderFrameToCanvas(doc, view, null);
    const context = canvas.getContext("2d");
    if (!context) return;
    const image = context.getImageData(0, 0, width, height);
    const palette = quantize(image.data, 255, {
      format: "rgba4444",
      oneBitAlpha: true,
      clearAlpha: true,
      clearAlphaThreshold: 0,
    });
    const transparentIndex = palette.findIndex((color) => color[3] === 0);
    const indexed = applyPalette(image.data, palette, "rgba4444");
    gif.writeFrame(indexed, width, height, {
      palette,
      delay: TURNTABLE_VIEW_MS,
      repeat: index === 0 ? 0 : undefined,
      transparent: transparentIndex >= 0,
      transparentIndex: Math.max(0, transparentIndex),
    });
  });

  gif.finish();
  return gif.bytes();
}

export async function exportStaticPng(
  doc: CharacterDoc,
  view: ViewId = doc.activeView,
  scale = 4,
) {
  const canvas = scaleCanvas(renderFrameToCanvas(doc, view, null), scale);
  downloadBlob(`${slug(doc.name)}-${viewSlug(view)}@${scale}x.png`, await canvasBlob(canvas));
}

export async function exportAllViewPngs(doc: CharacterDoc, scale = 4) {
  const zip = new JSZip();
  for (const view of VIEW_IDS) {
    const canvas = scaleCanvas(renderFrameToCanvas(doc, view, null), scale);
    zip.file(`${viewSlug(view)}.png`, await (await canvasBlob(canvas)).arrayBuffer());
  }
  downloadBlob(`${slug(doc.name)}-views.zip`, await zip.generateAsync({ type: "blob" }));
}

export async function exportViewSheetPng(doc: CharacterDoc, scale = 4) {
  const canvas = composeViewSheet(doc, scale);
  downloadBlob(`${slug(doc.name)}-view-sheet.png`, await canvasBlob(canvas));
}

export async function exportTurntableGif(doc: CharacterDoc) {
  const bytes = encodeTurntableGif(doc);
  downloadBlob(
    `${slug(doc.name)}-turntable.gif`,
    new Blob([bytes.buffer as ArrayBuffer], { type: "image/gif" }),
  );
}

export async function exportGif(
  doc: CharacterDoc,
  animation: AnimationDoc,
  view: ViewId = doc.activeView,
) {
  const bytes = encodeGif(doc, animation, view);
  downloadBlob(
    `${slug(doc.name)}-${slug(animation.name)}-${viewSlug(view)}.gif`,
    new Blob([bytes.buffer as ArrayBuffer], { type: "image/gif" }),
  );
}

export async function exportAllDirectionGifs(
  doc: CharacterDoc,
  animation: AnimationDoc,
) {
  const zip = new JSZip();
  for (const view of VIEW_IDS) {
    const bytes = encodeGif(doc, animation, view);
    zip.file(
      `${slug(animation.name)}-${viewSlug(view)}.gif`,
      bytes.buffer as ArrayBuffer,
    );
  }
  downloadBlob(
    `${slug(doc.name)}-${slug(animation.name)}-directions.zip`,
    await zip.generateAsync({ type: "blob" }),
  );
}

export async function exportFrameZip(doc: CharacterDoc, animation: AnimationDoc) {
  const zip = new JSZip();
  const root = zip.folder(`${slug(doc.name)}-${slug(animation.name)}`);
  if (!root) return;

  for (const view of VIEW_IDS) {
    const folder = root.folder(viewSlug(view));
    if (!folder) continue;
    for (let index = 0; index < animation.frames.length; index += 1) {
      const frame = animation.frames[index];
      const canvas = renderFrameToCanvas(doc, view, frame);
      folder.file(
        `${String(index).padStart(3, "0")}.png`,
        await (await canvasBlob(canvas)).arrayBuffer(),
      );
    }
  }

  root.file(
    "metadata.json",
    JSON.stringify(
      {
        name: doc.name,
        animation: animation.name,
        fps: animation.fps,
        loop: animation.loop,
        frameSize: { width: doc.width, height: doc.height },
        views: VIEW_IDS.map((view) => ({
          view,
          label: VIEW_LABELS[view],
          folder: viewSlug(view),
          frames: animation.frames.map((frame, index) => ({
            index,
            file: `${viewSlug(view)}/${String(index).padStart(3, "0")}.png`,
            duration: frame.duration,
          })),
        })),
      },
      null,
      2,
    ),
  );

  downloadBlob(
    `${slug(doc.name)}-${slug(animation.name)}-frames.zip`,
    await zip.generateAsync({ type: "blob" }),
  );
}

type AtlasRow = {
  animation: AnimationDoc;
  view: ViewId;
  frames: AnimationFrame[];
};

type AtlasRegion = {
  row: AtlasRow;
  frame: AnimationFrame;
  column: number;
  x: number;
  y: number;
  width: number;
  height: number;
};

function buildAtlas(doc: CharacterDoc, rows: AtlasRow[]) {
  const columns = Math.max(1, ...rows.map((row) => row.frames.length));
  const canvas = document.createElement("canvas");
  canvas.width = doc.width * columns;
  canvas.height = doc.height * rows.length;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Could not create atlas.");
  context.imageSmoothingEnabled = false;

  const regions: AtlasRegion[] = [];
  rows.forEach((row, rowIndex) => {
    row.frames.forEach((frame, column) => {
      const frameCanvas = renderFrameToCanvas(doc, row.view, frame);
      const x = column * doc.width;
      const y = rowIndex * doc.height;
      context.drawImage(frameCanvas, x, y);
      regions.push({
        row,
        frame,
        column,
        x,
        y,
        width: doc.width,
        height: doc.height,
      });
    });
  });

  return { canvas, regions, columns };
}

export async function exportSpriteSheet(
  doc: CharacterDoc,
  animation: AnimationDoc,
) {
  const rows: AtlasRow[] = VIEW_IDS.map((view) => ({
    animation,
    view,
    frames: animation.frames,
  }));
  const atlas = buildAtlas(doc, rows);
  const zip = new JSZip();
  zip.file("spritesheet.png", await (await canvasBlob(atlas.canvas)).arrayBuffer());
  zip.file(
    "spritesheet.json",
    JSON.stringify(
      {
        name: doc.name,
        animation: animation.name,
        frameSize: { width: doc.width, height: doc.height },
        columns: atlas.columns,
        rows: rows.length,
        views: VIEW_IDS,
        frames: atlas.regions.map((region) => ({
          name: `${slug(animation.name)}_${viewSlug(region.row.view)}_${region.column}`,
          view: region.row.view,
          viewLabel: VIEW_LABELS[region.row.view],
          index: region.column,
          x: region.x,
          y: region.y,
          width: region.width,
          height: region.height,
          duration: region.frame.duration,
        })),
      },
      null,
      2,
    ),
  );
  downloadBlob(
    `${slug(doc.name)}-${slug(animation.name)}-sheet.zip`,
    await zip.generateAsync({ type: "blob" }),
  );
}

export async function exportGodot(doc: CharacterDoc) {
  const animations: AnimationDoc[] =
    doc.animations.length > 0
      ? doc.animations
      : [
          {
            id: "static",
            name: "idle",
            fps: 1,
            loop: true,
            frames: [{ id: "static", duration: 1, transforms: {} }],
          },
        ];

  const rows: AtlasRow[] = animations.flatMap((animation) =>
    VIEW_IDS.map((view) => ({
      animation,
      view,
      frames: animation.frames,
    })),
  );
  const atlas = buildAtlas(doc, rows);
  const regionById = new Map(
    atlas.regions.map((region, index) => [index, region]),
  );

  const subResources = atlas.regions
    .map(
      (region, index) =>
        `[sub_resource type="AtlasTexture" id="AtlasTexture_${index}"]\natlas = ExtResource("1_atlas")\nregion = Rect2(${region.x}, ${region.y}, ${region.width}, ${region.height})`,
    )
    .join("\n\n");

  const animationBlocks = rows.map((row) => {
    const frameEntries = row.frames
      .map((frame, column) => {
        const regionIndex = atlas.regions.findIndex(
          (region) => region.row === row && region.column === column,
        );
        const duration = Math.max(
          0.01,
          frame.duration / Math.max(1, row.animation.fps),
        );
        return `{\n"duration": ${duration.toFixed(4)},\n"texture": SubResource("AtlasTexture_${regionIndex}")\n}`;
      })
      .join(", ");
    const name = `${godotName(row.animation.name)}_${viewSlug(row.view)}`;
    return `{\n"frames": [${frameEntries}],\n"loop": ${row.animation.loop},\n"name": &"${name}",\n"speed": ${row.animation.fps}.0\n}`;
  });

  const tres = `[gd_resource type="SpriteFrames" load_steps=${atlas.regions.length + 2} format=3]\n\n[ext_resource type="Texture2D" path="res://character_atlas.png" id="1_atlas"]\n\n${subResources}\n\n[resource]\nanimations = [${animationBlocks.join(
    ", ",
  )}]\n`;

  const zip = new JSZip();
  zip.file("character_atlas.png", await (await canvasBlob(atlas.canvas)).arrayBuffer());
  zip.file("character_frames.tres", tres);
  zip.file(
    "character_meta.json",
    JSON.stringify(
      {
        name: doc.name,
        frameSize: { width: doc.width, height: doc.height },
        views: VIEW_IDS.map((view) => ({ id: view, label: VIEW_LABELS[view], slug: viewSlug(view) })),
        animations: rows.map((row) => ({
          name: `${godotName(row.animation.name)}_${viewSlug(row.view)}`,
          source: row.animation.name,
          view: row.view,
          fps: row.animation.fps,
          loop: row.animation.loop,
          frameCount: row.frames.length,
        })),
        pivots: Object.fromEntries(
          VIEW_IDS.map((view) => [
            view,
            Object.fromEntries(
              (doc.views[view] ?? []).map((part) => [part.id, part.pivot]),
            ),
          ]),
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
