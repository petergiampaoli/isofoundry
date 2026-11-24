import { normalizeSpec, uid } from "./schemas";
import {
  type AnimationDoc,
  type AnimationFrame,
  type BodyPlan,
  type Build,
  type CharacterSpec,
  type Features,
  type Palette,
  type Transform,
} from "./types";

const PALETTES: Record<string, Palette> = {
  ember: {
    skin: "#c98b5e",
    skinShadow: "#8f5a3c",
    primary: "#b84a2f",
    primaryShadow: "#7b2e1f",
    secondary: "#e0a23a",
    secondaryShadow: "#9c6a1f",
    accent: "#f2e6c9",
    metal: "#8b8f96",
    metalShadow: "#555a61",
    outline: "#1b1412",
    eye: "#f4d35e",
    highlight: "#fff3d6",
  },
  moss: {
    skin: "#9ab36a",
    skinShadow: "#5e7541",
    primary: "#3f6b3a",
    primaryShadow: "#244a2b",
    secondary: "#c2a85b",
    secondaryShadow: "#806d31",
    accent: "#dce6b0",
    metal: "#7d8478",
    metalShadow: "#4c534c",
    outline: "#111a12",
    eye: "#f7e26b",
    highlight: "#f4f7d2",
  },
  frost: {
    skin: "#9bc4d8",
    skinShadow: "#5c849e",
    primary: "#3d6f91",
    primaryShadow: "#24485f",
    secondary: "#b9d8e8",
    secondaryShadow: "#7796a8",
    accent: "#e7f6ff",
    metal: "#9aa8b4",
    metalShadow: "#5b6671",
    outline: "#0d171e",
    eye: "#73e0ff",
    highlight: "#ffffff",
  },
  bone: {
    skin: "#d8d0b8",
    skinShadow: "#9a9078",
    primary: "#6e6758",
    primaryShadow: "#453f35",
    secondary: "#a89b78",
    secondaryShadow: "#6e6348",
    accent: "#f1ead6",
    metal: "#8f8d84",
    metalShadow: "#5a574f",
    outline: "#181612",
    eye: "#b84030",
    highlight: "#fffaf0",
  },
  void: {
    skin: "#8a6ca8",
    skinShadow: "#543c6d",
    primary: "#38224f",
    primaryShadow: "#211332",
    secondary: "#a64d7a",
    secondaryShadow: "#6d2c50",
    accent: "#e0b6ff",
    metal: "#6f6a7d",
    metalShadow: "#403c4c",
    outline: "#0c0712",
    eye: "#ff4fa3",
    highlight: "#f6ddff",
  },
  gold: {
    skin: "#d2a26a",
    skinShadow: "#96683d",
    primary: "#b1872f",
    primaryShadow: "#74551a",
    secondary: "#6f4f9c",
    secondaryShadow: "#463166",
    accent: "#f7e6a6",
    metal: "#d7b44a",
    metalShadow: "#8f7424",
    outline: "#1a130a",
    eye: "#fff2a8",
    highlight: "#fff8dc",
  },
  rust: {
    skin: "#b98764",
    skinShadow: "#7a5138",
    primary: "#7d4a36",
    primaryShadow: "#4e2b21",
    secondary: "#3d7d78",
    secondaryShadow: "#24524f",
    accent: "#d6b17e",
    metal: "#8d7f70",
    metalShadow: "#574d43",
    outline: "#17100d",
    eye: "#f2c14e",
    highlight: "#f9e7c5",
  },
  teal: {
    skin: "#9bc7b8",
    skinShadow: "#5c877c",
    primary: "#147d73",
    primaryShadow: "#0c514a",
    secondary: "#d8b86a",
    secondaryShadow: "#8c7135",
    accent: "#d9f1e8",
    metal: "#839a95",
    metalShadow: "#4e615d",
    outline: "#071614",
    eye: "#ffe27a",
    highlight: "#f1fff9",
  },
};

const COLOR_HINTS: Array<[RegExp, keyof typeof PALETTES]> = [
  [/\b(teal|verdigris|emerald|sea green|aquamarine)\b/, "teal"],
  [/\b(ice|frost|winter|glacier|blue|crystal)\b/, "frost"],
  [/\b(moss|forest|green|poison|swamp|bog|vine)\b/, "moss"],
  [/\b(bone|skeleton|ghost|spirit|white|ash)\b/, "bone"],
  [/\b(void|shadow|demon|purple|violet|cosmic|abyss)\b/, "void"],
  [/\b(gold|royal|sun|holy|paladin|king|yellow)\b/, "gold"],
  [/\b(rust|iron|steel|forge|industrial)\b/, "rust"],
  [/\b(red|crimson|blood|fire|ember|orange|pumpkin|autumn|flame)\b/, "ember"],
];

export function paletteForPrompt(prompt: string): Palette | null {
  const lower = prompt.toLowerCase();
  const match = COLOR_HINTS.find(([pattern]) => pattern.test(lower));
  return match ? { ...PALETTES[match[1]] } : null;
}

const ROMAN = ["I", "II", "III", "IV"];
const STOP_WORDS = new Set([
  "a",
  "an",
  "the",
  "with",
  "and",
  "of",
  "for",
  "in",
  "on",
  "at",
  "to",
  "from",
  "that",
  "this",
  "is",
  "are",
  "very",
  "huge",
  "large",
  "small",
  "cute",
  "pixel",
  "art",
  "character",
  "enemy",
  "unit",
]);

function keyword(prompt: string, matcher: RegExp): boolean {
  return matcher.test(prompt.toLowerCase());
}

export function suggestBodyPlan(prompt: string): BodyPlan {
  const lower = prompt.toLowerCase();
  if (
    keyword(lower, /\b(slime|blob|ooze|jelly|fungus|mushroom|pudding|goo)\b/)
  ) {
    return "blob";
  }
  if (
    keyword(
      lower,
      /\b(wolf|hound|beast|quadruped|cat|dog|horse|spider|boar|bear|dragon|fox|stag|deer)\b/,
    )
  ) {
    return "quadruped";
  }
  return "humanoid";
}

function pickPalette(prompt: string, index: number): Palette {
  const lower = prompt.toLowerCase();
  let key = "ember";
  if (keyword(lower, /\b(teal|verdigris|emerald|aquamarine)\b/)) key = "teal";
  else if (keyword(lower, /\b(ice|frost|winter|glacier|cold|blue|crystal)\b/)) key = "frost";
  else if (keyword(lower, /\b(moss|forest|green|poison|swamp|bog|vine)\b/)) key = "moss";
  else if (keyword(lower, /\b(bone|skeleton|ghost|spirit|white|ash)\b/)) key = "bone";
  else if (keyword(lower, /\b(void|shadow|demon|purple|cosmic|abyss)\b/)) key = "void";
  else if (keyword(lower, /\b(gold|royal|sun|holy|paladin|king)\b/)) key = "gold";
  else if (keyword(lower, /\b(rust|iron|steel|forge|industrial)\b/)) key = "rust";
  else if (keyword(lower, /\b(pumpkin|autumn|orange|ember|fire|flame)\b/)) key = "ember";

  const base = { ...PALETTES[key] };
  const shifts: Record<string, Palette> = {
    ember: { ...base, primary: index % 2 ? "#8f3d2a" : "#c25a32" },
    moss: { ...base, primary: index % 2 ? "#345c31" : "#4f7a43" },
    frost: { ...base, primary: index % 2 ? "#315c7c" : "#4b7f9f" },
    bone: { ...base, primary: index % 2 ? "#5b5345" : "#7d715e" },
    void: { ...base, primary: index % 2 ? "#2b173f" : "#4a2a66" },
    gold: { ...base, primary: index % 2 ? "#9b7424" : "#c39a3b" },
    rust: { ...base, primary: index % 2 ? "#683b2a" : "#8d5740" },
    teal: { ...base, primary: index % 2 ? "#0f665e" : "#1b8c80" },
  };
  return shifts[key] ?? base;
}

function pickFeatures(prompt: string, plan: BodyPlan, index: number): Features {
  const lower = prompt.toLowerCase();
  const horns = keyword(lower, /\b(horn|horned|demon|devil|dragon|beast|goat|skull)\b/)
    ? 2 + (index % 2)
    : keyword(lower, /\b(knight|helm|armor|paladin)\b/)
      ? 1
      : 0;
  const ears = keyword(lower, /\b(cat|fox|wolf|rabbit|beast|bat)\b/) ? 2 : 0;
  const tail = keyword(lower, /\b(tail|wolf|beast|dragon|cat|fox|demon)\b/)
    ? 1 + (index % 3)
    : 0;
  const wings = keyword(lower, /\b(wings?|dragon|bat|angel|fairy|bird)\b/)
    ? 1 + (index % 3)
    : 0;
  const weapon = keyword(lower, /\b(axe|cleaver)\b/)
    ? "axe"
    : keyword(lower, /\b(sword|blade|knight|paladin|samurai)\b/)
      ? "sword"
      : keyword(lower, /\b(club|hammer|brute|ogre)\b/)
        ? "club"
        : keyword(lower, /\b(staff|mage|wizard|warlock|priest)\b/)
          ? "staff"
          : keyword(lower, /\b(claw|claws|beast|wolf)\b/)
            ? "claws"
            : "none";
  const outfit = keyword(lower, /\b(armor|knight|paladin|guard|soldier|warrior)\b/)
    ? "armor"
    : keyword(lower, /\b(robe|mage|wizard|warlock|cultist|priest)\b/)
      ? "robe"
      : keyword(lower, /\b(rags|zombie|ghoul|skeleton|beggar)\b/)
        ? "rags"
        : keyword(lower, /\b(cloak|hood|ranger|assassin)\b/)
          ? "cloak"
          : keyword(lower, /\b(leather|hunter|scout|rogue)\b/)
            ? "leather"
            : keyword(lower, /\b(tunic|peasant|villager)\b/)
              ? "tunic"
              : "none";
  const hairStyle = keyword(lower, /\b(bald|hairless|smooth)\b/)
    ? "bald"
    : keyword(lower, /\b(mohawk|crest)\b/)
      ? "mohawk"
      : keyword(lower, /\b(topknot|samurai|ronin)\b/)
        ? "topknot"
        : keyword(lower, /\b(hood|hooded|cultist|assassin)\b/)
          ? "hooded"
          : keyword(lower, /\b(long hair|mane|wild hair)\b/)
            ? "long"
            : "short";
  const pattern = keyword(lower, /\b(dragon|reptile|lizard|scale)\b/)
    ? "scales"
    : keyword(lower, /\b(tiger|zebra|striped)\b/)
      ? "stripes"
      : keyword(lower, /\b(spotted|leopard|frog|mushroom)\b/)
        ? "spots"
        : "none";

  const planWeapon =
    plan === "quadruped"
      ? weapon === "claws"
        ? "claws"
        : "none"
      : plan === "blob"
        ? weapon === "none"
          ? "claws"
          : weapon
        : weapon;

  return {
    horns,
    ears,
    tail,
    wings,
    weapon: planWeapon,
    outfit,
    hairStyle,
    eyes: 2,
    mouth: plan === "blob" ? 2 : 1,
    pattern,
  };
}

function buildFor(index: number, plan: BodyPlan): Build {
  const variations = [
    { height: 1, width: 1, head: 1, torso: 1, arms: 1, legs: 1 },
    { height: 0.92, width: 1.08, head: 0.88, torso: 1.12, arms: 0.82, legs: 0.95 },
    { height: 1.08, width: 0.94, head: 1.12, torso: 0.94, arms: 1.06, legs: 1.08 },
    { height: 0.98, width: 1.16, head: 1.06, torso: 1.18, arms: 0.95, legs: 0.88 },
  ];
  const base = variations[index % variations.length];
  if (plan === "blob") {
    return { ...base, height: 0.95, head: 1, torso: 1 + index * 0.06, arms: 0.9, legs: 0.8 };
  }
  if (plan === "quadruped") {
    return { ...base, height: 0.95, head: 0.9 + index * 0.03, torso: 1, arms: 0.8, legs: 1 };
  }
  return base;
}

function nameFor(prompt: string, plan: BodyPlan, index: number): string {
  const words = prompt
    .replace(/[^a-z0-9\s-]/gi, " ")
    .split(/\s+/)
    .filter((word) => word && !STOP_WORDS.has(word.toLowerCase()))
    .slice(0, 3);
  const base = words.length
    ? words.map((word) => word[0].toUpperCase() + word.slice(1).toLowerCase()).join(" ")
    : plan === "blob"
      ? "Mire Blob"
      : plan === "quadruped"
        ? "Iron Hound"
        : "Ash Warden";
  return `${base} ${ROMAN[index]}`;
}

export function fallbackOptions(prompt: string, count = 4): CharacterSpec[] {
  const plan = suggestBodyPlan(prompt);
  return Array.from({ length: count }, (_, index) => {
    const palette = pickPalette(prompt, index);
    return normalizeSpec({
      id: uid(),
      name: nameFor(prompt, plan, index),
      bodyPlan: plan,
      description: prompt,
      palette,
      build: buildFor(index, plan),
      features: pickFeatures(prompt, plan, index),
    });
  });
}

export function fallbackRefine(
  spec: CharacterSpec,
  prompt: string,
  count = 4,
): CharacterSpec[] {
  const lower = prompt.toLowerCase();
  const palette = paletteForPrompt(prompt) ?? spec.palette;
  const base = normalizeSpec({
    ...spec,
    palette: { ...palette },
    features: {
      ...spec.features,
      horns: keyword(lower, /\b(horn|horns|demon|dragon)\b/)
        ? Math.min(3, spec.features.horns + 1)
        : spec.features.horns,
      wings: keyword(lower, /\b(wing|wings|angel|dragon|bat)\b/)
        ? Math.min(3, spec.features.wings + 1)
        : spec.features.wings,
      tail: keyword(lower, /\b(tail|beast|dragon)\b/)
        ? Math.min(3, spec.features.tail + 1)
        : spec.features.tail,
      weapon: keyword(lower, /\b(axe|cleaver)\b/)
        ? "axe"
        : keyword(lower, /\b(sword|blade)\b/)
          ? "sword"
          : keyword(lower, /\b(club|hammer)\b/)
            ? "club"
            : keyword(lower, /\b(staff|mage|wizard)\b/)
              ? "staff"
              : spec.features.weapon,
      outfit: keyword(lower, /\b(armor|knight|paladin)\b/)
        ? "armor"
        : keyword(lower, /\b(robe|mage|wizard)\b/)
          ? "robe"
          : keyword(lower, /\b(rags|zombie|skeleton)\b/)
            ? "rags"
            : keyword(lower, /\b(cloak|hood|ranger|assassin)\b/)
              ? "cloak"
              : keyword(lower, /\b(leather|hunter|scout|rogue)\b/)
                ? "leather"
                : keyword(lower, /\b(tunic|peasant|villager)\b/)
                  ? "tunic"
                  : spec.features.outfit,
      hairStyle: keyword(lower, /\b(bald|hairless)\b/)
        ? "bald"
        : keyword(lower, /\b(mohawk|crest)\b/)
          ? "mohawk"
          : keyword(lower, /\b(topknot|samurai|ronin)\b/)
            ? "topknot"
            : keyword(lower, /\b(hood|hooded|cultist|assassin)\b/)
              ? "hooded"
              : keyword(lower, /\b(long hair|mane)\b/)
                ? "long"
                : spec.features.hairStyle,
      pattern: keyword(lower, /\b(scale|dragon|reptile)\b/)
        ? "scales"
        : keyword(lower, /\b(stripe|tiger)\b/)
          ? "stripes"
          : keyword(lower, /\b(spot|leopard|frog)\b/)
            ? "spots"
            : spec.features.pattern,
    },
  });

  return Array.from({ length: count }, (_, index) =>
    normalizeSpec({
      ...base,
      id: uid(),
      name: `${base.name.replace(/\s+(I|II|III|IV)$/, "")} ${ROMAN[index]}`,
      build: {
        ...base.build,
        height: Math.max(0.7, Math.min(1.3, base.build.height + (index - 1.5) * 0.035)),
        torso: Math.max(0.7, Math.min(1.4, base.build.torso + (index % 2 ? 0.05 : -0.04))),
        head: Math.max(0.7, Math.min(1.4, base.build.head + (index % 3 === 0 ? 0.05 : -0.02))),
      },
    }),
  );
}

function emptyFrame(): AnimationFrame {
  return { id: uid(), duration: 1, transforms: {} };
}

function frameWith(
  transforms: Record<string, Partial<Transform>>,
): AnimationFrame {
  return { id: uid(), duration: 1, transforms };
}

function humanoidRig(spec: CharacterSpec) {
  return spec.bodyPlan === "humanoid"
    ? { head: "head", torso: "torso", armL: "armL", armR: "armR", legL: "legL", legR: "legR" }
    : spec.bodyPlan === "quadruped"
      ? { head: "head", torso: "body", armL: "legFL", armR: "legFR", legL: "legBL", legR: "legBR", tail: "tail" }
      : { head: "eyes", torso: "body", armL: "armL", armR: "armR", legL: "mouth", legR: "tail", tail: "tail" };
}

export function presetAnimation(
  spec: CharacterSpec,
  prompt: string,
  preset?: string,
): AnimationDoc {
  const lower = `${prompt} ${preset ?? ""}`.toLowerCase();
  const rig = humanoidRig(spec);
  const name = keyword(lower, /run|walk|sprint/)
    ? "Run"
    : keyword(lower, /jump|leap|hop/)
      ? "Jump"
      : keyword(lower, /attack|slash|strike|cleave|hit/)
        ? "Attack"
        : keyword(lower, /death|die|collapse|defeat/)
          ? "Death"
          : "Idle";

  if (name === "Run") {
    return {
      id: uid(),
      name: "Run",
      fps: 8,
      loop: true,
      frames: Array.from({ length: 6 }, (_, index) => {
        const swing = index % 2 === 0 ? 1 : -1;
        return frameWith({
          [rig.torso]: { y: index % 3 === 0 ? -1 : 0 },
          [rig.head]: { y: index % 3 === 0 ? -1 : 0 },
          [rig.armL]: { rotation: -18 * swing },
          [rig.armR]: { rotation: 18 * swing },
          [rig.legL]: { rotation: 20 * swing },
          [rig.legR]: { rotation: -20 * swing },
          ...(rig.tail ? { [rig.tail]: { rotation: 6 * swing } } : {}),
        });
      }),
    };
  }

  if (name === "Jump") {
    const poses: Array<Record<string, Partial<Transform>>> = [
      { [rig.torso]: { y: 2 }, [rig.head]: { y: 1 }, [rig.legL]: { scale: 0.85 }, [rig.legR]: { scale: 0.85 } },
      { [rig.torso]: { y: -8 }, [rig.head]: { y: -2 }, [rig.armL]: { rotation: -20 }, [rig.armR]: { rotation: 20 }, [rig.legL]: { rotation: -12 }, [rig.legR]: { rotation: 12 } },
      { [rig.torso]: { y: -12 }, [rig.head]: { y: -2 }, [rig.armL]: { rotation: -28 }, [rig.armR]: { rotation: 28 }, [rig.legL]: { rotation: -18 }, [rig.legR]: { rotation: 18 } },
      { [rig.torso]: { y: -6 }, [rig.head]: { y: -1 }, [rig.armL]: { rotation: -12 }, [rig.armR]: { rotation: 12 } },
      { [rig.torso]: { y: 4 }, [rig.head]: { y: 2 }, [rig.legL]: { scale: 0.88 }, [rig.legR]: { scale: 0.88 } },
      { [rig.torso]: { y: 0 }, [rig.head]: { y: 0 } },
    ];
    return { id: uid(), name: "Jump", fps: 9, loop: false, frames: poses.map(frameWith) };
  }

  if (name === "Attack") {
    const poses: Array<Record<string, Partial<Transform>>> = [
      { [rig.torso]: { rotation: -4 }, [rig.armR]: { rotation: -30 }, [rig.armL]: { rotation: 12 } },
      { [rig.torso]: { rotation: -8 }, [rig.armR]: { rotation: -55 }, [rig.armL]: { rotation: 18 } },
      { [rig.torso]: { rotation: 8 }, [rig.armR]: { rotation: 45 }, [rig.armL]: { rotation: -16 } },
      { [rig.torso]: { rotation: 10 }, [rig.armR]: { rotation: 55 }, [rig.armL]: { rotation: -18 } },
      { [rig.torso]: { rotation: 4 }, [rig.armR]: { rotation: 25 }, [rig.armL]: { rotation: -6 } },
      { [rig.torso]: { rotation: 0 }, [rig.armR]: { rotation: 0 }, [rig.armL]: { rotation: 0 } },
    ];
    return { id: uid(), name: "Attack", fps: 10, loop: false, frames: poses.map(frameWith) };
  }

  if (name === "Death") {
    const poses: Array<Record<string, Partial<Transform>>> = [
      { [rig.torso]: { rotation: -6 }, [rig.head]: { rotation: -8 }, [rig.armL]: { rotation: -15 }, [rig.armR]: { rotation: 15 } },
      { [rig.torso]: { rotation: 12, y: 3 }, [rig.head]: { rotation: 18 }, [rig.armL]: { rotation: -35 }, [rig.armR]: { rotation: 35 } },
      { [rig.torso]: { rotation: 28, y: 8 }, [rig.head]: { rotation: 30 }, [rig.legL]: { rotation: 25 }, [rig.legR]: { rotation: -20 } },
      { [rig.torso]: { rotation: 55, y: 14 }, [rig.head]: { rotation: 55 }, [rig.armL]: { rotation: -50 }, [rig.armR]: { rotation: 50 } },
      { [rig.torso]: { rotation: 78, y: 20, opacity: 0.85 }, [rig.head]: { rotation: 78 }, [rig.armL]: { rotation: -65 }, [rig.armR]: { rotation: 65 } },
      { [rig.torso]: { rotation: 88, y: 23, opacity: 0.7 }, [rig.head]: { rotation: 88 } },
    ];
    return { id: uid(), name: "Death", fps: 7, loop: false, frames: poses.map(frameWith) };
  }

  return {
    id: uid(),
    name: "Idle",
    fps: 4,
    loop: true,
    frames: Array.from({ length: 4 }, (_, index) =>
      frameWith({
        [rig.torso]: { y: index === 1 ? -1 : index === 3 ? 1 : 0 },
        [rig.head]: { y: index === 1 ? -1 : index === 3 ? 1 : 0 },
        [rig.armL]: { rotation: index === 1 ? 2 : index === 3 ? -2 : 0 },
        [rig.armR]: { rotation: index === 1 ? -2 : index === 3 ? 2 : 0 },
        ...(rig.tail ? { [rig.tail]: { rotation: index === 1 ? 4 : index === 3 ? -4 : 0 } } : {}),
      }),
    ),
  };
}

export function emptyAnimation(): AnimationDoc {
  return { id: uid(), name: "Idle", fps: 6, loop: true, frames: [emptyFrame()] };
}
