import JSZip from 'jszip';
import type { Anchor, ProjectState, StyleSignature } from '../types';
import { ASSET_LABELS } from '../types';
import { bufferToCanvas } from './raster';
import { renderAsset, renderFrames } from './render';

export function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64) || 'style';
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function downloadCanvas(canvas: HTMLCanvasElement, filename: string): void {
  canvas.toBlob((blob) => {
    if (blob) downloadBlob(blob, filename);
  }, 'image/png');
}

function drawRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
  fill: string,
  stroke?: string,
): void {
  ctx.beginPath();
  ctx.roundRect(x, y, width, height, radius);
  ctx.fillStyle = fill;
  ctx.fill();
  if (stroke) {
    ctx.strokeStyle = stroke;
    ctx.lineWidth = 1;
    ctx.stroke();
  }
}

function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight: number,
  maxLines = 6,
): number {
  const words = text.split(/\s+/);
  let line = '';
  let lines = 0;
  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width > maxWidth && line) {
      ctx.fillText(line, x, y + lines * lineHeight);
      line = word;
      lines += 1;
      if (lines >= maxLines) return y + lines * lineHeight;
    } else {
      line = test;
    }
  }
  if (line && lines < maxLines) {
    ctx.fillText(line, x, y + lines * lineHeight);
    lines += 1;
  }
  return y + lines * lineHeight;
}

function drawMetric(
  ctx: CanvasRenderingContext2D,
  label: string,
  value: number,
  x: number,
  y: number,
  width: number,
): void {
  const clamped = Math.max(0, Math.min(1, value));
  ctx.font = '11px ui-monospace, SFMono-Regular, Menlo, monospace';
  ctx.fillStyle = '#8f9893';
  ctx.textAlign = 'left';
  ctx.fillText(label.toUpperCase(), x, y);
  ctx.fillStyle = '#d8dfd9';
  ctx.textAlign = 'right';
  ctx.fillText(`${Math.round(clamped * 100)}`, x + width, y);
  ctx.textAlign = 'left';
  ctx.fillStyle = '#20262b';
  ctx.fillRect(x, y + 7, width, 4);
  ctx.fillStyle = '#c8ef6b';
  ctx.fillRect(x, y + 7, width * clamped, 4);
}

export function buildStyleBoard(project: ProjectState, anchor: Anchor, signature: StyleSignature): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = 1440;
  canvas.height = 1020;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas is unavailable');

  ctx.fillStyle = '#0a0d10';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const glow = ctx.createRadialGradient(320, 300, 20, 320, 300, 520);
  glow.addColorStop(0, 'rgba(200,239,107,0.075)');
  glow.addColorStop(1, 'rgba(200,239,107,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = '#c8ef6b';
  ctx.font = '11px ui-monospace, SFMono-Regular, Menlo, monospace';
  ctx.fillText('ISOFOUNDRY / STYLE GUIDE', 64, 54);
  ctx.fillStyle = '#6f7873';
  ctx.textAlign = 'right';
  ctx.fillText(new Date(anchor.createdAt).toISOString().slice(0, 10), 1376, 54);
  ctx.textAlign = 'left';

  ctx.fillStyle = '#f0eee6';
  ctx.font = '52px "Iowan Old Style", "Palatino Linotype", Georgia, serif';
  ctx.fillText(anchor.name, 64, 108);
  ctx.fillStyle = '#8f9893';
  ctx.font = '13px ui-monospace, SFMono-Regular, Menlo, monospace';
  ctx.fillText(`${anchor.directionName.toUpperCase()}  /  ${ASSET_LABELS[anchor.kind].toUpperCase()}  /  PRIMARY VIEW SE`, 64, 134);

  drawRoundedRect(ctx, 64, 160, 520, 568, 18, '#0f1317', '#222a2e');
  ctx.strokeStyle = 'rgba(120,140,130,0.10)';
  ctx.lineWidth = 1;
  for (let x = 74; x < 584; x += 18) {
    ctx.beginPath();
    ctx.moveTo(x, 180);
    ctx.lineTo(x + 160, 700);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x, 700);
    ctx.lineTo(x + 160, 180);
    ctx.stroke();
  }
  const anchorBuffer = renderAsset(anchor.kind, anchor.dna, anchor.seed, { stage: 'final', phase: 0.15 });
  const anchorCanvas = bufferToCanvas(anchorBuffer, 5);
  const ax = 64 + (520 - anchorCanvas.width) / 2;
  const ay = 160 + (568 - anchorCanvas.height) / 2 - 12;
  ctx.drawImage(anchorCanvas, ax, ay);
  ctx.fillStyle = '#c8ef6b';
  ctx.font = '10px ui-monospace, SFMono-Regular, Menlo, monospace';
  ctx.fillText('NORTH STAR / ANCHOR', 88, 692);
  ctx.fillStyle = '#65706b';
  ctx.textAlign = 'right';
  ctx.fillText(`SEED ${anchor.seed}`, 560, 692);
  ctx.textAlign = 'left';

  drawRoundedRect(ctx, 612, 160, 764, 238, 18, '#0f1317', '#222a2e');
  ctx.fillStyle = '#c8ef6b';
  ctx.font = '10px ui-monospace, SFMono-Regular, Menlo, monospace';
  ctx.fillText('VOICE', 640, 192);
  ctx.fillStyle = '#e9e6dc';
  ctx.font = '20px "Iowan Old Style", "Palatino Linotype", Georgia, serif';
  wrapText(ctx, anchor.dna.prompt || project.prompt, 640, 222, 640, 27, 3);

  const direction = project.directions.find((item) => item.id === anchor.directionId);
  ctx.fillStyle = '#8f9893';
  ctx.font = '11px ui-monospace, SFMono-Regular, Menlo, monospace';
  const keywordLine = `KEYWORDS  ${direction?.keywords.length ? direction.keywords.join(' / ') : 'open'}`;
  ctx.fillText(keywordLine.toUpperCase().slice(0, 108), 640, 306);
  const anti = direction?.antiGoals ?? [];
  ctx.fillStyle = anti.length ? '#e6a17d' : '#65706b';
  ctx.fillText(`ANTI-GOALS  ${anti.length ? anti.join(' / ') : 'none declared'}`.toUpperCase().slice(0, 92), 640, 326);

  const axes: Array<[string, number]> = [
    ['Grounded', anchor.dna.voice.grounded],
    ['Ornate', anchor.dna.voice.ornate],
    ['Brutal', anchor.dna.voice.brutal],
    ['Springy', anchor.dna.voice.springy],
    ['Vivid', anchor.dna.voice.vivid],
    ['Gritty', anchor.dna.voice.gritty],
  ];
  axes.forEach(([label, value], index) => {
    const x = 640 + (index % 3) * 235;
    const y = 354 + Math.floor(index / 3) * 26;
    ctx.fillStyle = '#77817c';
    ctx.font = '9px ui-monospace, SFMono-Regular, Menlo, monospace';
    ctx.fillText(label.toUpperCase(), x, y);
    ctx.fillStyle = '#20262b';
    ctx.fillRect(x + 72, y - 6, 135, 4);
    ctx.fillStyle = '#c8ef6b';
    ctx.fillRect(x + 72, y - 6, 135 * value, 4);
  });

  drawRoundedRect(ctx, 612, 416, 764, 312, 18, '#0f1317', '#222a2e');
  ctx.fillStyle = '#c8ef6b';
  ctx.font = '10px ui-monospace, SFMono-Regular, Menlo, monospace';
  ctx.fillText('MATERIAL RAMPS', 640, 448);

  const rampEntries = Object.entries(anchor.dna.palette.ramps);
  rampEntries.forEach(([name, colors], index) => {
    const col = Math.floor(index / 5);
    const row = index % 5;
    const x = 640 + col * 358;
    const y = 476 + row * 46;
    ctx.fillStyle = '#7d8781';
    ctx.font = '9px ui-monospace, SFMono-Regular, Menlo, monospace';
    ctx.fillText(name.toUpperCase(), x, y + 12);
    colors.forEach((color, colorIndex) => {
      ctx.fillStyle = color;
      ctx.fillRect(x + 82 + colorIndex * 42, y, 40, 20);
    });
  });
  ctx.fillStyle = '#65706b';
  ctx.font = '9px ui-monospace, SFMono-Regular, Menlo, monospace';
  ctx.fillText(`OUTLINE ${anchor.dna.palette.outline.toUpperCase()}   /   MAX RAMPS 5   /   LIGHT TOP-LEFT   /   φ ${Math.round((anchor.dna.golden ?? 0.618) * 100)}`, 640, 708);

  drawRoundedRect(ctx, 64, 748, 520, 202, 18, '#0f1317', '#222a2e');
  ctx.fillStyle = '#c8ef6b';
  ctx.font = '10px ui-monospace, SFMono-Regular, Menlo, monospace';
  ctx.fillText('STYLE SIGNATURE', 88, 780);
  const metrics: Array<[string, number]> = [
    ['Value contrast', signature.stdL / 0.32],
    ['Edge density', signature.edgeDensity],
    ['Detail entropy', signature.detailEntropy],
    ['Silhouette', signature.silhouetteComplexity],
    ['Outline weight', signature.outlineRatio],
    ['Symmetry', signature.symmetry],
  ];
  metrics.forEach(([label, value], index) => {
    drawMetric(ctx, label, value, 88, 808 + index * 22, 200);
  });
  ctx.fillStyle = '#65706b';
  ctx.font = '9px ui-monospace, SFMono-Regular, Menlo, monospace';
  ctx.fillText(`${signature.colorCount} COLORS`, 360, 808);
  ctx.fillText(`${signature.visiblePixels} PX`, 360, 826);
  ctx.fillText(`HUE ${Math.round(signature.dominantHue)}°`, 360, 844);

  drawRoundedRect(ctx, 612, 748, 764, 202, 18, '#0f1317', '#222a2e');
  ctx.fillStyle = '#c8ef6b';
  ctx.font = '10px ui-monospace, SFMono-Regular, Menlo, monospace';
  ctx.fillText('MOTION STUDY / 4 FRAMES', 640, 780);
  const frames = renderFrames(anchor.kind, anchor.dna, anchor.seed, 4, 96);
  frames.forEach((frame, index) => {
    const frameCanvas = bufferToCanvas(frame, 2);
    const fx = 664 + index * 172;
    const fy = 806;
    ctx.fillStyle = index % 2 === 0 ? '#14191e' : '#11161a';
    ctx.fillRect(fx - 8, fy - 8, 160, 118);
    ctx.drawImage(frameCanvas, fx, fy + 6);
    ctx.fillStyle = '#65706b';
    ctx.font = '9px ui-monospace, SFMono-Regular, Menlo, monospace';
    ctx.fillText(`FRAME ${index + 1}`, fx, fy + 105);
  });

  ctx.fillStyle = '#65706b';
  ctx.font = '10px ui-monospace, SFMono-Regular, Menlo, monospace';
  ctx.fillText('GENERATED BY ISOFOUNDRY  /  STYLE DNA v1  /  ALL VIEWS DERIVE FROM THE ANCHOR', 64, 990);
  ctx.textAlign = 'right';
  ctx.fillText(project.name.toUpperCase().slice(0, 60), 1376, 990);
  ctx.textAlign = 'left';

  return canvas;
}

export function buildMotionSheet(anchor: Anchor): HTMLCanvasElement {
  const frames = renderFrames(anchor.kind, anchor.dna, anchor.seed, 4, 96);
  const canvas = document.createElement('canvas');
  canvas.width = 96 * frames.length;
  canvas.height = 96;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas is unavailable');
  ctx.imageSmoothingEnabled = false;
  frames.forEach((frame, index) => {
    ctx.drawImage(bufferToCanvas(frame, 1), index * 96, 0);
  });
  return canvas;
}

export function paletteGpl(project: ProjectState, anchor: Anchor): string {
  const lines = [
    'GIMP Palette',
    `Name: ${project.name} / ${anchor.name}`,
    'Columns: 5',
    '#',
  ];
  for (const [name, colors] of Object.entries(anchor.dna.palette.ramps)) {
    colors.forEach((hex, index) => {
      const r = parseInt(hex.slice(1, 3), 16);
      const g = parseInt(hex.slice(3, 5), 16);
      const b = parseInt(hex.slice(5, 7), 16);
      lines.push(`${r.toString().padStart(3, ' ')} ${g.toString().padStart(3, ' ')} ${b.toString().padStart(3, ' ')}\t${name}_${index}`);
    });
  }
  const o = anchor.dna.palette.outline;
  lines.push(`${parseInt(o.slice(1, 3), 16)} ${parseInt(o.slice(3, 5), 16)} ${parseInt(o.slice(5, 7), 16)}\toutline`);
  return lines.join('\n');
}

export function styleGuideJson(project: ProjectState, anchor: Anchor, signature: StyleSignature): string {
  const direction = project.directions.find((item) => item.id === anchor.directionId);
  return JSON.stringify(
    {
      format: 'isofoundry/style-guide@1',
      generatedAt: new Date().toISOString(),
      project: {
        name: project.name,
        prompt: project.prompt,
        createdAt: project.createdAt,
      },
      anchor: {
        name: anchor.name,
        kind: anchor.kind,
        seed: anchor.seed,
        direction: anchor.directionName,
        createdAt: anchor.createdAt,
        motionFrames: anchor.frames,
      },
      direction: direction
        ? {
            name: direction.name,
            manifesto: direction.manifesto,
            keywords: direction.keywords,
            antiGoals: direction.antiGoals,
            inspiration: direction.inspiration ?? null,
          }
        : null,
      style: anchor.dna,
      signature,
      palette: {
        ramps: anchor.dna.palette.ramps,
        outline: anchor.dna.palette.outline,
        shadow: anchor.dna.palette.shadow,
        accent: anchor.dna.palette.accent,
      },
      motion: {
        clip: 'idle',
        frames: anchor.frames,
        fps: 6,
        loop: true,
        frameSize: [96, 96],
        pivot: [48, 75],
        view: 'SE',
      },
      inspiration: project.inspirations.length > 0
        ? {
            settings: project.inspirationSettings,
            references: project.inspirations.map(({ thumbnail, preview, ...meta }) => meta),
            vision: project.inspirationVision,
          }
        : null,
      tests: project.tests,
      journey: project.events,
    },
    null,
    2,
  );
}

export function projectJson(project: ProjectState): string {
  return JSON.stringify({ format: 'isofoundry/project@1', project }, null, 2);
}

export function buildGodotSpriteFrames(anchor: Anchor): string {
  const count = anchor.frames;
  const ext = Array.from({ length: count }, (_, index) =>
    `[ext_resource type="Texture2D" path="res://motion/idle_${index}.png" id="${index + 1}"]`,
  ).join('\n');
  const frames = Array.from({ length: count }, (_, index) =>
    `{\n"duration": 1.0,\n"texture": ExtResource("${index + 1}")\n}`,
  ).join(', ');
  return `[gd_resource type="SpriteFrames" load_steps=${count + 1} format=3]

${ext}

[resource]
animations = [{
"frames": [${frames}],
"loop": true,
"name": &"idle",
"speed": 6.0
}]
`;
}

export async function exportStylePack(project: ProjectState, anchor: Anchor, signature: StyleSignature): Promise<void> {
  const zip = new JSZip();
  const slug = slugify(anchor.name);
  const anchorBuffer = renderAsset(anchor.kind, anchor.dna, anchor.seed, { stage: 'final', phase: 0.15 });
  const frames = renderFrames(anchor.kind, anchor.dna, anchor.seed, anchor.frames, 96);

  const anchorCanvas = bufferToCanvas(anchorBuffer, 4);
  const png = await new Promise<Blob>((resolve, reject) => {
    anchorCanvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('PNG export failed'))), 'image/png');
  });
  zip.file(`anchor/${slug}@4x.png`, png);
  zip.file(`anchor/${slug}@1x.png`, bufferToCanvas(anchorBuffer, 1).toDataURL('image/png').split(',')[1], { base64: true });

  frames.forEach((frame, index) => {
    zip.file(`motion/idle_${index}.png`, bufferToCanvas(frame, 1).toDataURL('image/png').split(',')[1], { base64: true });
  });

  const board = buildStyleBoard(project, anchor, signature);
  const boardBlob = await new Promise<Blob>((resolve, reject) => {
    board.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('Board export failed'))), 'image/png');
  });
  zip.file('style-guide.png', boardBlob);
  zip.file('style-guide.json', styleGuideJson(project, anchor, signature));
  zip.file('palette.gpl', paletteGpl(project, anchor));
  zip.file('project.json', projectJson(project));
  zip.file('godot/motion_frames.tres', buildGodotSpriteFrames(anchor));
  zip.file('godot/README.txt', 'Copy the motion/ folder and godot/motion_frames.tres into your Godot project.\nThe SpriteFrames resource expects res://motion/idle_*.png.\n');

  if (project.inspirations.length > 0) {
    const inspirationMeta = {
      settings: project.inspirationSettings,
      references: project.inspirations.map(({ thumbnail, preview, ...meta }) => meta),
      vision: project.inspirationVision,
      note: project.inspirationSettings.includeInExport
        ? 'Reference previews are included in references/. The original files were never stored.'
        : 'Reference previews were excluded from this export by the project setting.',
    };
    zip.file('inspiration.json', JSON.stringify(inspirationMeta, null, 2));
    if (project.inspirationVision) {
      zip.file('vision-read.json', JSON.stringify(project.inspirationVision, null, 2));
    }
    if (project.inspirationSettings.includeInExport) {
      project.inspirations.forEach((asset, index) => {
        const data = asset.preview.split(',')[1];
        const extension = asset.preview.startsWith('data:image/png') ? 'png' : 'webp';
        if (data) zip.file(`references/${String(index + 1).padStart(2, '0')}-${slugify(asset.name)}.${extension}`, data, { base64: true });
      });
      zip.file('references/README.txt', 'Small reference previews extracted from the creation journey. Originals remain on the user’s device.\n');
    }
  }

  zip.file('README.md', `# ${project.name} — style pack\n\nAnchor: ${anchor.name}\nKind: ${ASSET_LABELS[anchor.kind]}\nSeed: ${anchor.seed}\n\nContains the 1x and 4x anchor, four motion frames, a Style Guide board, palette, full creation journey, and a Godot SpriteFrames resource.\n${project.inspirations.length ? `\nInfluences: ${project.inspirations.length} reference(s); see inspiration.json${project.inspirationSettings.includeInExport ? ' and references/' : ''}.\n` : ''}\nAll images are generated from the saved Style DNA and seed; the project.json is the source of truth.\n`);

  const blob = await zip.generateAsync({ type: 'blob' });
  downloadBlob(blob, `${slug}-style-pack.zip`);
}
