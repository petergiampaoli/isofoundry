import { describe, expect, it } from 'vitest';
import type { Anchor } from '../types';
import { createDNA, driftDNA } from './dna';
import { buildDirections, parsePrompt } from './prompt';
import { renderAsset } from './render';
import { compareSignatures, computeSignature } from './signature';
import { buildGodotSpriteFrames } from './export';

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

describe('Godot export', () => {
  it('writes a SpriteFrames resource with four frames', () => {
    const resource = buildGodotSpriteFrames({ frames: 4 } as unknown as Anchor);
    expect(resource).toContain('type="SpriteFrames"');
    expect(resource).toContain('idle_0.png');
    expect(resource).toContain('idle_3.png');
    expect(resource).toContain('"speed": 6.0');
  });
});
