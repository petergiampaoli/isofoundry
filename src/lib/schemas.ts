import { z } from "zod";
import {
  BODY_PLAN_LABELS,
  HAIR_STYLES,
  OUTFITS,
  PALETTE_ROLES,
  PATTERNS,
  WEAPONS,
  type AnimationDoc,
  type AnimationFrame,
  type BodyPlan,
  type Build,
  type CharacterSpec,
  type Features,
  type Palette,
} from "./types";

export function uid(): string {
  return crypto.randomUUID();
}

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

const numberish = z.preprocess((value) => {
  const number = Number(value);
  return Number.isFinite(number) ? number : 1;
}, z.number());

const hex = z.preprocess((value) => {
  const string = String(value ?? "").trim();
  if (/^#[0-9a-f]{6}$/i.test(string)) return string.toLowerCase();
  if (/^#[0-9a-f]{3}$/i.test(string)) {
    return `#${string[1]}${string[1]}${string[2]}${string[2]}${string[3]}${string[3]}`.toLowerCase();
  }
  if (/^[0-9a-f]{6}$/i.test(string)) return `#${string.toLowerCase()}`;
  return "#777777";
}, z.string());

const paletteSchema = z.object(
  Object.fromEntries(PALETTE_ROLES.map((role) => [role, hex])) as Record<
    (typeof PALETTE_ROLES)[number],
    typeof hex
  >,
).passthrough();

const bodyPlanSchema = z.preprocess((value) => {
  const string = String(value ?? "").toLowerCase();
  if (string.includes("quad") || string.includes("beast")) return "quadruped";
  if (string.includes("blob") || string.includes("slime")) return "blob";
  return "humanoid";
}, z.enum(["humanoid", "quadruped", "blob"]));

const buildSchema = z.object({
  height: numberish.optional().default(1),
  width: numberish.optional().default(1),
  head: numberish.optional().default(1),
  torso: numberish.optional().default(1),
  arms: numberish.optional().default(1),
  legs: numberish.optional().default(1),
});

const featuresSchema = z.object({
  horns: numberish.optional().default(0),
  ears: numberish.optional().default(0),
  tail: numberish.optional().default(0),
  wings: numberish.optional().default(0),
  weapon: z.preprocess((value) => {
    const string = String(value ?? "none").toLowerCase();
    return WEAPONS.includes(string as never) ? string : "none";
  }, z.enum(["none", "sword", "axe", "club", "staff", "claws"])),
  outfit: z.preprocess((value) => {
    const string = String(value ?? "none").toLowerCase();
    return OUTFITS.includes(string as never) ? string : "none";
  }, z.enum(["none", "tunic", "leather", "armor", "robe", "rags", "cloak"])),
  hairStyle: z.preprocess((value) => {
    const string = String(value ?? "short").toLowerCase();
    return HAIR_STYLES.includes(string as never) ? string : "short";
  }, z.enum(["bald", "short", "long", "mohawk", "topknot", "hooded"])),
  eyes: numberish.optional().default(2),
  mouth: numberish.optional().default(1),
  pattern: z.preprocess((value) => {
    const string = String(value ?? "none").toLowerCase();
    return PATTERNS.includes(string as never) ? string : "none";
  }, z.enum(["none", "spots", "stripes", "scales"])),
});

export const characterSpecSchema = z.object({
  id: z.string().optional(),
  name: z.string().optional().default("Untitled character"),
  bodyPlan: bodyPlanSchema.optional().default("humanoid"),
  description: z.string().optional().default(""),
  palette: paletteSchema,
  build: buildSchema
    .optional()
    .default({ height: 1, width: 1, head: 1, torso: 1, arms: 1, legs: 1 }),
  features: featuresSchema.optional().default({
    horns: 0,
    ears: 0,
    tail: 0,
    wings: 0,
    weapon: "none",
    outfit: "none",
    hairStyle: "short",
    eyes: 2,
    mouth: 1,
    pattern: "none",
  }),
});

export const characterOptionsSchema = z.union([
  z.object({ options: z.array(characterSpecSchema).min(1).max(8) }),
  z.array(characterSpecSchema).min(1).max(8),
]);

const frameSchema = z.object({
  id: z.string().optional(),
  duration: numberish.optional().default(1),
  transforms: z
    .record(
      z.string(),
      z.object({
        x: numberish.optional(),
        y: numberish.optional(),
        scale: numberish.optional(),
        rotation: numberish.optional(),
        opacity: numberish.optional(),
      }),
    )
    .optional()
    .default({}),
});

export const animationSpecSchema = z.object({
  id: z.string().optional(),
  name: z.string().optional().default("Animation"),
  fps: numberish.optional().default(8),
  loop: z.boolean().optional().default(true),
  frames: z.array(frameSchema).min(1).max(32),
});

export function normalizePalette(palette: Palette): Palette {
  const base = Object.fromEntries(
    PALETTE_ROLES.map((role) => [
      role,
      /^#[0-9a-f]{6}$/i.test(palette[role]) ? palette[role].toLowerCase() : "#777777",
    ]),
  ) as Record<(typeof PALETTE_ROLES)[number], string>;
  const extra = Array.isArray(palette.extra)
    ? palette.extra
        .filter((color) => /^#[0-9a-f]{6}$/i.test(color))
        .slice(0, 32)
        .map((color) => color.toLowerCase())
    : [];
  return { ...base, extra };
}

export function normalizeSpec(input: unknown): CharacterSpec {
  const parsed = characterSpecSchema.parse(input);
  const build: Build = {
    height: clamp(parsed.build.height, 0.6, 1.5),
    width: clamp(parsed.build.width, 0.6, 1.5),
    head: clamp(parsed.build.head, 0.6, 1.6),
    torso: clamp(parsed.build.torso, 0.6, 1.6),
    arms: clamp(parsed.build.arms, 0.5, 1.6),
    legs: clamp(parsed.build.legs, 0.5, 1.6),
  };
  const features: Features = {
    horns: Math.round(clamp(parsed.features.horns, 0, 3)),
    ears: Math.round(clamp(parsed.features.ears, 0, 3)),
    tail: Math.round(clamp(parsed.features.tail, 0, 3)),
    wings: Math.round(clamp(parsed.features.wings, 0, 3)),
    weapon: parsed.features.weapon,
    outfit: parsed.features.outfit,
    hairStyle: parsed.features.hairStyle,
    eyes: Math.round(clamp(parsed.features.eyes, 1, 4)),
    mouth: Math.round(clamp(parsed.features.mouth, 0, 3)),
    pattern: parsed.features.pattern,
  };
  return {
    id: parsed.id || uid(),
    name: parsed.name.trim() || "Untitled character",
    bodyPlan: parsed.bodyPlan as BodyPlan,
    description: parsed.description,
    palette: normalizePalette(parsed.palette),
    build,
    features,
  };
}

export function normalizeOptions(input: unknown): CharacterSpec[] {
  const parsed = characterOptionsSchema.parse(input);
  const options = Array.isArray(parsed) ? parsed : parsed.options;
  return options.slice(0, 4).map(normalizeSpec);
}

export function normalizeAnimation(input: unknown): AnimationDoc {
  const parsed = animationSpecSchema.parse(input);
  const frames: AnimationFrame[] = parsed.frames.map((frame) => ({
    id: frame.id || uid(),
    duration: Math.max(0.2, frame.duration),
    transforms: frame.transforms,
  }));
  return {
    id: parsed.id || uid(),
    name: parsed.name.trim() || "Animation",
    fps: Math.round(clamp(parsed.fps, 1, 30)),
    loop: parsed.loop,
    frames,
  };
}

export function describeBodyPlan(plan: BodyPlan): string {
  return BODY_PLAN_LABELS[plan];
}
