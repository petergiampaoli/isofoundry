import { describe, expect, it } from 'vitest';
import { fallbackOptions, presetAnimation } from './generator';
import { buildParts, TRANSPARENT } from './render';
import { animationSpecSchema, normalizePalette, normalizeSpec } from './schemas';
import { normalizeDoc } from './storage';
import {
  PALETTE_ROLES,
  ROLE_INDEX,
  TURNTABLE_LOOP_MS,
  TURNTABLE_VIEW_MS,
  VIEW_IDS,
  paletteArray,
} from './types';

describe('character generation', () => {
  it('produces four editable character options', () => {
    const options = fallbackOptions('A moss-covered goblin brute with a cleaver', 4);
    expect(options).toHaveLength(4);
    expect(options.every((option) => option.bodyPlan === 'humanoid')).toBe(true);
    expect(options.every((option) => option.features.hairStyle)).toBe(true);
  });

  it('supports all three body plans', () => {
    const humanoid = fallbackOptions('a goblin knight', 1)[0];
    const quadruped = fallbackOptions('a frost wolf hound', 1)[0];
    const blob = fallbackOptions('a toxic slime', 1)[0];
    expect(humanoid.bodyPlan).toBe('humanoid');
    expect(quadruped.bodyPlan).toBe('quadruped');
    expect(blob.bodyPlan).toBe('blob');
    expect(buildParts(humanoid, 64, 64).length).toBeGreaterThan(5);
    expect(buildParts(quadruped, 64, 64).length).toBeGreaterThan(5);
    expect(buildParts(blob, 64, 64).length).toBeGreaterThan(3);
  });

  it('builds a hair part for a long-haired humanoid', () => {
    const character = normalizeSpec({
      ...fallbackOptions('a goblin', 1)[0],
      features: { ...fallbackOptions('a goblin', 1)[0].features, hairStyle: 'long' },
    });
    const parts = buildParts(character, 64, 64);
    const hair = parts.find((part) => part.id === 'hair');
    expect(hair).toBeTruthy();
    expect(hair?.pixels.some((value) => value >= 0)).toBe(true);
  });

  it('creates editable first-pass animation frames', () => {
    const character = fallbackOptions('a heavy goblin brute', 1)[0];
    const animation = presetAnimation(character, 'heavy run', 'run');
    expect(animation.frames.length).toBeGreaterThanOrEqual(4);
    expect(animation.name).toBe('Run');
    expect(animation.loop).toBe(true);
    expect(Object.keys(animation.frames[0].transforms).length).toBeGreaterThan(0);
  });
});

describe('palette and animation schemas', () => {
  it('keeps named colors and custom color slots', () => {
    const palette = normalizeSpec({
      ...fallbackOptions('a goblin', 1)[0],
      palette: {
        ...fallbackOptions('a goblin', 1)[0].palette,
        extra: ['#112233', '#aabbcc'],
      },
    }).palette;
    expect(paletteArray(palette)).toHaveLength(PALETTE_ROLES.length + 2);
    expect(paletteArray(palette).slice(-2)).toEqual(['#112233', '#aabbcc']);
  });

  it('normalizes a multi-frame animation spec', () => {
    const parsed = animationSpecSchema.parse({
      name: 'Death',
      fps: 7,
      loop: false,
      frames: [
        { duration: 1, transforms: { torso: { rotation: 10 } } },
        { duration: 1.4, transforms: { torso: { rotation: 40 } } },
      ],
    });
    expect(parsed.name).toBe('Death');
    expect(parsed.fps).toBe(7);
    expect(parsed.frames).toHaveLength(2);
  });

  it('falls back to short hair when the agent omits hair style', () => {
    const option = fallbackOptions('a goblin', 1)[0];
    const raw = JSON.parse(JSON.stringify(option)) as Record<string, unknown>;
    const features = raw.features as Record<string, unknown>;
    delete features.hairStyle;
    const normalized = normalizeSpec(raw);
    expect(normalized.features.hairStyle).toBe('short');
  });
});

describe('four isometric views', () => {
  it('renders four distinct views with no face on the back views', () => {
    const spec = fallbackOptions('a goblin brute with a cleaver', 1)[0];
    const views = Object.fromEntries(
      VIEW_IDS.map((view) => [view, buildParts(spec, 64, 64, view)]),
    );
    expect(VIEW_IDS).toEqual([
      'frontRight',
      'frontLeft',
      'backLeft',
      'backRight',
    ]);
    expect(views.frontRight).not.toEqual(views.frontLeft);
    expect(views.backLeft).not.toEqual(views.backRight);

    for (const view of ['backLeft', 'backRight'] as const) {
      const head = views[view].find((part) => part.id === 'head');
      expect(
        head?.pixels.filter((value) => value === ROLE_INDEX.eye).length,
      ).toBe(0);
    }
    const frontHead = views.frontRight.find((part) => part.id === 'head');
    expect(
      frontHead?.pixels.filter((value) => value === ROLE_INDEX.eye).length,
    ).toBeGreaterThan(0);
  });

  it('keeps a 3 second per-view turntable on a 12 second loop', () => {
    expect(TURNTABLE_VIEW_MS).toBe(3000);
    expect(TURNTABLE_LOOP_MS).toBe(12000);
    expect(TURNTABLE_LOOP_MS).toBe(TURNTABLE_VIEW_MS * VIEW_IDS.length);
  });
});

describe('legacy single-view migration', () => {
  it('moves legacy pixels to the front-right view and fills the other three', () => {
    const spec = fallbackOptions('a moss goblin', 1)[0];
    const legacyParts = buildParts(spec, 64, 64, 'frontRight');
    const framePixels = new Array(64 * 64).fill(TRANSPARENT);
    framePixels[10] = 3;
    const legacy = {
      id: 'legacy',
      name: spec.name,
      width: 64,
      height: 64,
      spec,
      parts: legacyParts,
      reference: null,
      animations: [
        {
          id: 'run',
          name: 'Run',
          fps: 8,
          loop: true,
          frames: [
            {
              id: 'frame',
              duration: 1,
              transforms: {},
              pixels: { torso: framePixels },
            },
          ],
        },
      ],
      currentAnimationId: 'run',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const normalized = normalizeDoc(legacy as never);
    expect(normalized.views.frontRight).toEqual(legacyParts);
    expect(normalized.views.frontLeft.length).toBeGreaterThan(0);
    expect(normalized.views.backLeft.length).toBeGreaterThan(0);
    expect(normalized.views.backRight.length).toBeGreaterThan(0);
    expect(normalized.activeView).toBe('frontRight');
    expect(normalized.animations[0].frames[0].pixels?.frontRight?.torso).toEqual(
      framePixels,
    );
  });
});
