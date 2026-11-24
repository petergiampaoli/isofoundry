export const PALETTE_ROLES = [
  "skin",
  "skinShadow",
  "primary",
  "primaryShadow",
  "secondary",
  "secondaryShadow",
  "accent",
  "metal",
  "metalShadow",
  "outline",
  "eye",
  "highlight",
] as const;

export type PaletteRole = (typeof PALETTE_ROLES)[number];

export type Palette = Record<PaletteRole, string> & {
  extra?: string[];
};

export const ROLE_INDEX: Record<PaletteRole, number> = Object.fromEntries(
  PALETTE_ROLES.map((role, index) => [role, index]),
) as Record<PaletteRole, number>;

export const ROLE_LABELS: Record<PaletteRole, string> = {
  skin: "Skin",
  skinShadow: "Skin shade",
  primary: "Primary",
  primaryShadow: "Primary shade",
  secondary: "Secondary",
  secondaryShadow: "Secondary shade",
  accent: "Accent",
  metal: "Metal",
  metalShadow: "Metal shade",
  outline: "Outline",
  eye: "Eye",
  highlight: "Highlight",
};

export type BodyPlan = "humanoid" | "quadruped" | "blob";

export const VIEW_IDS = [
  "frontRight",
  "frontLeft",
  "backLeft",
  "backRight",
] as const;

export type ViewId = (typeof VIEW_IDS)[number];

export const VIEW_LABELS: Record<ViewId, string> = {
  frontRight: "Front-Right",
  frontLeft: "Front-Left",
  backLeft: "Back-Left",
  backRight: "Back-Right",
};

export const VIEW_SHORT_LABELS: Record<ViewId, string> = {
  frontRight: "FR",
  frontLeft: "FL",
  backLeft: "BL",
  backRight: "BR",
};

export const VIEW_COMPASS: Record<ViewId, string> = {
  frontRight: "SE",
  frontLeft: "SW",
  backLeft: "NW",
  backRight: "NE",
};

export const TURNTABLE_VIEW_MS = 3000;
export const TURNTABLE_LOOP_MS = TURNTABLE_VIEW_MS * VIEW_IDS.length;

export type Build = {
  height: number;
  width: number;
  head: number;
  torso: number;
  arms: number;
  legs: number;
};

export type Weapon = "none" | "sword" | "axe" | "club" | "staff" | "claws";
export type Outfit =
  | "none"
  | "tunic"
  | "leather"
  | "armor"
  | "robe"
  | "rags"
  | "cloak";
export type Pattern = "none" | "spots" | "stripes" | "scales";
export type HairStyle =
  | "bald"
  | "short"
  | "long"
  | "mohawk"
  | "topknot"
  | "hooded";

export type Features = {
  horns: number;
  ears: number;
  tail: number;
  wings: number;
  weapon: Weapon;
  outfit: Outfit;
  hairStyle: HairStyle;
  eyes: number;
  mouth: number;
  pattern: Pattern;
};

export type CharacterSpec = {
  id: string;
  name: string;
  bodyPlan: BodyPlan;
  description: string;
  palette: Palette;
  build: Build;
  features: Features;
};

export type Transform = {
  x: number;
  y: number;
  scale: number;
  rotation: number;
  opacity: number;
};

export type Part = {
  id: string;
  name: string;
  kind: "generated" | "imported";
  pivot: { x: number; y: number };
  z: number;
  pixels: number[];
  transform: Transform;
  home: Transform;
  visible: boolean;
  edited?: boolean;
};

export type ReferenceImage = {
  dataUrl: string;
  opacity: number;
  visible: boolean;
  bodyPlan: BodyPlan | null;
  name: string;
};

export type AnimationFrame = {
  id: string;
  duration: number;
  transforms: Record<string, Partial<Transform>>;
  pixels?: Partial<Record<ViewId, Record<string, number[]>>>;
};

export type AnimationDoc = {
  id: string;
  name: string;
  fps: number;
  loop: boolean;
  frames: AnimationFrame[];
};

export type CharacterDoc = {
  id: string;
  name: string;
  width: number;
  height: number;
  spec: CharacterSpec;
  views: Record<ViewId, Part[]>;
  activeView: ViewId;
  reference: ReferenceImage | null;
  referenceView?: ViewId;
  animations: AnimationDoc[];
  currentAnimationId: string | null;
  createdAt: string;
  updatedAt: string;
};

export function activeParts(doc: CharacterDoc): Part[] {
  return doc.views[doc.activeView] ?? doc.views.frontRight ?? [];
}

export type VersionSnapshot = {
  id: string;
  label: string;
  prompt: string;
  doc: CharacterDoc;
  createdAt: string;
};

export type Tool =
  | "select"
  | "pencil"
  | "eraser"
  | "fill"
  | "eyedropper"
  | "slice-rect"
  | "slice-lasso";

export type Point = { x: number; y: number };

export const IDENTITY_TRANSFORM: Transform = {
  x: 0,
  y: 0,
  scale: 1,
  rotation: 0,
  opacity: 1,
};

export const BODY_PLAN_LABELS: Record<BodyPlan, string> = {
  humanoid: "Humanoid",
  quadruped: "Quadruped",
  blob: "Blob",
};

export const WEAPONS: Weapon[] = [
  "none",
  "sword",
  "axe",
  "club",
  "staff",
  "claws",
];

export const OUTFITS: Outfit[] = [
  "none",
  "tunic",
  "leather",
  "armor",
  "robe",
  "rags",
  "cloak",
];

export const HAIR_STYLES: HairStyle[] = [
  "bald",
  "short",
  "long",
  "mohawk",
  "topknot",
  "hooded",
];

export const PATTERNS: Pattern[] = ["none", "spots", "stripes", "scales"];

export function paletteArray(palette: Palette): string[] {
  return [...PALETTE_ROLES.map((role) => palette[role]), ...(palette.extra ?? [])];
}

export function cloneTransform(transform: Transform): Transform {
  return { ...transform };
}

export function mergeTransform(
  base: Transform,
  delta?: Partial<Transform>,
): Transform {
  return {
    x: base.x + (delta?.x ?? 0),
    y: base.y + (delta?.y ?? 0),
    scale: base.scale * (delta?.scale ?? 1),
    rotation: base.rotation + (delta?.rotation ?? 0),
    opacity: base.opacity * (delta?.opacity ?? 1),
  };
}
