import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Anchor, CombinedInspirationRead, InspirationAsset, InspirationSettings } from '../types';
import { DEFAULT_INSPIRATION_SETTINGS } from '../types';
import { createDNA, driftDNA } from './dna';
import { buildDirections, parsePrompt } from './prompt';
import { renderAsset } from './render';
import { compareSignatures, computeSignature } from './signature';
import { buildGodotSpriteFrames } from './export';
import { analyzePixels, applyInspirationToDNA, combineInspirations } from './inspiration';
import { paletteFromParams } from './palette';
import { readWithVision } from './vision';

afterEach(() => {
  vi.unstubAllGlobals();
});

function pixelsFor(width: number, height: number, colorAt: (x: number, y: number) => [number, number, number, number]): Uint8ClampedArray {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const [r, g, b, a] = colorAt(x, y);
      const index = (y * width + x) * 4;
      data[index] = r;
      data[index + 1] = g;
      data[index + 2] = b;
      data[index + 3] = a;
    }
  }
  return data;
}

function testAsset(id: string, name: string, palette: string[]): InspirationAsset {
  const read = analyzePixels(
    pixelsFor(64, 64, (x, y) => {
      const color = palette[Math.min(palette.length - 1, Math.floor((x / 64) * palette.length))];
      const r = parseInt(color.slice(1, 3), 16);
      const g = parseInt(color.slice(3, 5), 16);
      const b = parseInt(color.slice(5, 7), 16);
      return [r, g, b, y % 4 === 0 ? 180 : 255];
    }),
    64,
    64,
  );
  return {
    id,
    name,
    hash: id,
    width: 64,
    height: 64,
    thumbnail: 'data:image/png;base64,AA==',
    preview: 'data:image/png;base64,AA==',
    read,
    weight: 0.5,
    createdAt: Date.now(),
  };
}

describe('deterministic renderer', () => {
  const dna = createDNA(1234, 'moss, iron, wind-worn cloth');

  it('produces identical pixels for the same DNA and seed', () => {
    const first = renderAsset('character', dna, 9001, { phase: 0.25 });
    const second = renderAsset('character', dna, 9001, { phase: 0.25 });
    expect(Array.from(first.data)).toEqual(Array.from(second.data));
  });

  it('changes pixels when the seed changes', () => {
    const first = renderAsset('character', dna, 9001, { phase: 0.25 });
    const second = renderAsset('character', dna, 9002, { phase: 0.25 });
    expect(Array.from(first.data)).not.toEqual(Array.from(second.data));
  });

  it('renders every supported asset kind without empty output', () => {
    for (const kind of ['tree', 'stone', 'character', 'enemy', 'building', 'crystal', 'object', 'terrain'] as const) {
      const buffer = renderAsset(kind, dna, 42, { phase: 0.5 });
      expect(buffer.visibleBounds().count).toBeGreaterThan(80);
    }
  });

  it('keeps palette ramps at five stops', () => {
    for (const ramp of Object.values(dna.palette.ramps)) {
      expect(ramp).toHaveLength(5);
      expect(ramp.every((color) => /^#[0-9a-f]{6}$/i.test(color))).toBe(true);
    }
  });
});

describe('style signature', () => {
  const dna = createDNA(2468, 'damp stone, old iron');
  const anchorBuffer = renderAsset('character', dna, 101, { phase: 0.15 });
  const anchorSignature = computeSignature(anchorBuffer, dna.palette.outline);

  it('extracts a usable signature', () => {
    expect(anchorSignature.visiblePixels).toBeGreaterThan(100);
    expect(anchorSignature.colorCount).toBeGreaterThan(3);
    expect(anchorSignature.outlineRatio).toBeGreaterThan(0);
    expect(anchorSignature.outlineRatio).toBeLessThan(0.6);
    expect(anchorSignature.detailEntropy).toBeGreaterThan(0);
  });

  it('scores an identical signature at 100', () => {
    expect(compareSignatures(anchorSignature, anchorSignature).score).toBe(100);
  });

  it('scores a deliberate drift below the anchor', () => {
    const drift = driftDNA(dna, 777);
    const driftSignature = computeSignature(
      renderAsset('character', drift, 777, { phase: 0.15 }),
      drift.palette.outline,
    );
    const result = compareSignatures(anchorSignature, driftSignature);
    expect(result.score).toBeLessThan(100);
    expect(result.subscores.palette).toBeLessThan(1);
  });
});

describe('prompt grammar', () => {
  it('creates four unique direction names', () => {
    const { directions } = buildDirections('moss-eaten stone and practical iron', null, [], 314, 4);
    expect(directions).toHaveLength(4);
    expect(new Set(directions.map((direction) => direction.name)).size).toBe(4);
  });

  it('respects a locked palette while allowing form changes', () => {
    const base = createDNA(77, 'moss and iron');
    const { dna } = parsePrompt('colder palette, rounder forms, spikier silhouette', base, ['palette']);
    expect(dna.paletteParams.hue).toBeCloseTo(base.paletteParams.hue);
    expect(dna.paletteParams.chroma).toBeCloseTo(base.paletteParams.chroma);
    expect(dna.spikiness).not.toBeCloseTo(base.spikiness);
  });

  it('captures anti-goals and removes them from positive matches', () => {
    const base = createDNA(88, '');
    const { dna, insight } = parsePrompt('warm ember light, no neon, not cute', base, []);
    expect(insight.antiGoals).toContain('neon');
    expect(insight.antiGoals).toContain('cute');
    expect(dna.paletteParams.chroma).toBeLessThan(0.9);
  });
});

describe('inspiration analysis', () => {
  it('reads palette and value structure from a synthetic image', () => {
    const data = pixelsFor(80, 80, (x) => (x % 20 < 10 ? [36, 60, 34, 255] : [210, 180, 112, 255]));
    const read = analyzePixels(data, 80, 80);
    expect(read.palette.length).toBeGreaterThanOrEqual(2);
    expect(read.contrast).toBeGreaterThan(0.4);
    expect(read.edgeDensity).toBeGreaterThan(0.02);
    expect(read.detailEntropy).toBeGreaterThan(0);
  });

  it('ignores a dominant presentation border', () => {
    const data = pixelsFor(100, 100, (x, y) => {
      if (x < 12 || y < 12 || x >= 88 || y >= 88) return [255, 255, 255, 255];
      return [124, 48, 42, 255];
    });
    const read = analyzePixels(data, 100, 100);
    expect(read.palette.every((color) => color !== '#ffffff')).toBe(true);
  });

  it('combines a primary and supporting reference', () => {
    const primary = testAsset('ref_a', 'Primary', ['#202820', '#738650', '#d8c9aa']);
    const support = testAsset('ref_b', 'Support', ['#37241b', '#a35d42', '#efd391']);
    const combined = combineInspirations([primary, support], primary.id, DEFAULT_INSPIRATION_SETTINGS);
    expect(combined).not.toBeNull();
    expect(combined?.sources).toHaveLength(2);
    expect(combined?.sources[0].primary).toBe(true);
    expect(combined?.palette.length).toBeGreaterThan(2);
  });

  it('applies reference traits and respects a locked palette', () => {
    const asset = testAsset('ref_c', 'Palette', ['#18251a', '#6d8f4d', '#e1c98d', '#8a4f33']);
    const combined = combineInspirations([asset], asset.id, DEFAULT_INSPIRATION_SETTINGS) as CombinedInspirationRead;
    const settings: InspirationSettings = {
      ...DEFAULT_INSPIRATION_SETTINGS,
      influence: 1,
      features: { palette: true, form: true, finish: true, line: true },
    };
    const base = createDNA(321, 'moss and iron');
    const applied = applyInspirationToDNA({
      dna: base,
      combined,
      settings,
      mode: 'palette',
      locks: [],
      vision: null,
    });
    expect(applied.referencePalette).toEqual(combined.palette);
    expect(applied.paletteFidelity).toBeGreaterThan(0);

    const locked = applyInspirationToDNA({
      dna: base,
      combined,
      settings,
      mode: 'palette',
      locks: ['palette'],
      vision: null,
    });
    expect(locked.referencePalette).toBeUndefined();
  });

  it('builds four reference-led directions with distinct modes', () => {
    const asset = testAsset('ref_d', 'Mood', ['#202820', '#738650', '#d8c9aa', '#8a4f33']);
    const combined = combineInspirations([asset], asset.id, DEFAULT_INSPIRATION_SETTINGS) as CombinedInspirationRead;
    const { directions } = buildDirections('moss and iron', null, [], 99, 4, {
      read: combined,
      settings: { ...DEFAULT_INSPIRATION_SETTINGS, influence: 0.85 },
      vision: null,
    });
    expect(directions.map((direction) => direction.inspiration?.mode)).toEqual(['palette', 'form', 'finish', 'prompt']);
    expect(directions.every((direction) => (direction.inspiration?.match ?? 0) > 0)).toBe(true);
    expect(directions.every((direction) => (direction.inspiration?.match ?? 0) < 101)).toBe(true);
  });

  it('rebuilds material ramps from a reference palette at high fidelity', () => {
    const generated = paletteFromParams({ hue: 120, accentHue: 200, foliageHue: 110, chroma: 0.4, contrast: 0.55, warmth: -0.1 });
    const referenced = paletteFromParams(
      { hue: 120, accentHue: 200, foliageHue: 110, chroma: 0.4, contrast: 0.55, warmth: -0.1 },
      { colors: ['#18251a', '#6d8f4d', '#d8c9aa', '#8a4f33'], fidelity: 1 },
    );
    expect(referenced.ramps.foliage).not.toEqual(generated.ramps.foliage);
    expect(referenced.ramps.foliage).toHaveLength(5);
  });
});

describe('vision adapter', () => {
  it('parses an OpenAI-compatible vision response', async () => {
    const asset = testAsset('ref_e', 'Lantern', ['#202820', '#738650', '#d8c9aa']);
    asset.preview = 'data:image/webp;base64,AAAA';
    const combined = combineInspirations([asset], asset.id, DEFAULT_INSPIRATION_SETTINGS) as CombinedInspirationRead;
    const mock = vi.fn(async () => new Response(JSON.stringify({
      choices: [{
        message: {
          content: JSON.stringify({
            theme: 'Lanterns in the ash',
            motifs: ['watchfires', 'ruined walls'],
            materials: ['soot-stained iron'],
            mood: 'Watchful and tired.',
            shapeLanguage: 'Angular masses, soft light.',
            narrativeVoice: 'Stoic survivors.',
            motionDescription: 'Deliberate and heavy.',
            suggestedMotion: { weight: 0.8, bounce: 0.2, sway: 0.3 },
            voice: { grounded: 0.85, ornate: 0.35, brutal: 0.6, springy: 0.2, vivid: 0.35, gritty: 0.7 },
            keywords: ['soot', 'lantern'],
            antiGoals: ['gloss'],
            manifesto: 'A watchful world with a small light.',
            confidence: 0.8,
          }),
        },
      }],
    }), { status: 200, headers: { 'Content-Type': 'application/json' } }));
    vi.stubGlobal('fetch', mock);
    const read = await readWithVision({
      assets: [asset],
      prompt: 'moss and iron',
      combined,
      config: { baseUrl: 'https://mock.example/v1', model: 'mock-vision', consent: true },
      apiKey: 'test',
    });
    expect(read.accepted).toBe(false);
    expect(read.theme).toBe('Lanterns in the ash');
    expect(read.voice.grounded).toBeCloseTo(0.85);
    expect(read.suggestedMotion.weight).toBeCloseTo(0.8);
    expect(mock).toHaveBeenCalledTimes(1);
  });

  it('refuses a vision request without consent', async () => {
    const asset = testAsset('ref_f', 'No consent', ['#202820', '#738650', '#d8c9aa']);
    const combined = combineInspirations([asset], asset.id, DEFAULT_INSPIRATION_SETTINGS) as CombinedInspirationRead;
    await expect(readWithVision({
      assets: [asset],
      prompt: '',
      combined,
      config: { baseUrl: 'https://mock.example/v1', model: 'mock-vision', consent: false },
      apiKey: '',
    })).rejects.toThrow(/Confirm/);
  });
});

describe('Godot export', () => {
  it('writes a SpriteFrames resource with four frames', () => {
    const resource = buildGodotSpriteFrames({ frames: 4 } as unknown as Anchor);
    expect(resource).toContain('type="SpriteFrames"');
    expect(resource).toContain('idle_0.png');
    expect(resource).toContain('idle_3.png');
    expect(resource).toContain('"speed": 6.0');
  });
});
