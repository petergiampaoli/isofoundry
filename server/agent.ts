import { execFile } from "node:child_process";
import { promisify } from "node:util";
import {
  animationSpecSchema,
  normalizeAnimation,
  normalizeSpec,
} from "../src/lib/schemas";
import {
  fallbackOptions,
  fallbackRefine,
  paletteForPrompt,
  presetAnimation,
} from "../src/lib/generator";
import type { CharacterSpec } from "../src/lib/types";
import { z } from "zod";

const execFileAsync = promisify(execFile);
const MODEL = process.env.OPENCODE_MODEL ?? "deepseek-v4.1-flash";
const PROVIDER = process.env.OPENCODE_PROVIDER ?? "opencode-go";

const MODEL_REF = { id: MODEL, providerID: PROVIDER };

function extractJson(text: string): string {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced ? fenced[1] : text;
  const objectStart = candidate.indexOf("{");
  const arrayStart = candidate.indexOf("[");
  const start =
    objectStart === -1
      ? arrayStart
      : arrayStart === -1
        ? objectStart
        : Math.min(objectStart, arrayStart);
  const objectEnd = candidate.lastIndexOf("}");
  const arrayEnd = candidate.lastIndexOf("]");
  const end = Math.max(objectEnd, arrayEnd);
  if (start === -1 || end <= start) {
    throw new Error("Model response did not contain JSON.");
  }
  return candidate.slice(start, end + 1);
}

async function textGeneration(prompt: string): Promise<string> {
  const payload = JSON.stringify({
    prompt,
    model: MODEL_REF,
  });
  const { stdout } = await execFileAsync(
    "opencode",
    ["api", "post", "/api/experimental/generate/text", "--data", payload],
    { timeout: 240_000, maxBuffer: 20 * 1024 * 1024 },
  );
  const response = JSON.parse(stdout) as { data?: { text?: string } };
  const text = response.data?.text;
  if (!text) throw new Error("OpenCode returned an empty response.");
  return text;
}

async function visionGeneration(
  prompt: string,
  imageDataUrl: string,
): Promise<string> {
  const sessionPayload = JSON.stringify({
    title: "isofoundry-character-vision",
    model: MODEL_REF,
  });
  const { stdout: sessionStdout } = await execFileAsync(
    "opencode",
    ["api", "post", "/api/session", "--data", sessionPayload],
    { timeout: 30_000, maxBuffer: 4 * 1024 * 1024 },
  );
  const session = JSON.parse(sessionStdout) as {
    data?: { id?: string };
  };
  const sessionId = session.data?.id;
  if (!sessionId) throw new Error("Could not create an OpenCode session.");

  const promptPayload = JSON.stringify({
    text: `${prompt}\n\nDo not use tools. Return only the requested JSON.`,
    files: [{ uri: imageDataUrl, name: "current-character.png" }],
  });
  await execFileAsync(
    "opencode",
    [
      "api",
      "post",
      `/api/session/${sessionId}/prompt`,
      "--data",
      promptPayload,
    ],
    { timeout: 240_000, maxBuffer: 20 * 1024 * 1024 },
  );

  await execFileAsync(
    "opencode",
    ["api", "post", `/api/experimental/session/${sessionId}/wait`],
    { timeout: 240_000, maxBuffer: 4 * 1024 * 1024 },
  );

  const { stdout: messagesStdout } = await execFileAsync(
    "opencode",
    [
      "api",
      "get",
      `/api/session/${sessionId}/message?type=assistant`,
    ],
    { timeout: 30_000, maxBuffer: 20 * 1024 * 1024 },
  );
  const messages = JSON.parse(messagesStdout) as {
    data?: Array<{
      type?: string;
      content?: Array<{ type?: string; text?: string }>;
    }>;
  };
  const assistant = [...(messages.data ?? [])]
    .reverse()
    .find((message) => message.type === "assistant");
  const text = assistant?.content
    ?.filter((part) => part.type === "text")
    .map((part) => part.text ?? "")
    .join("\n")
    .trim();
  if (!text) throw new Error("Vision model returned an empty response.");
  return text;
}

function safeOptions(text: string): CharacterSpec[] {
  const raw = JSON.parse(extractJson(text)) as unknown;
  const list = Array.isArray(raw)
    ? raw
    : raw && typeof raw === "object" && Array.isArray((raw as { options?: unknown }).options)
      ? (raw as { options: unknown[] }).options
      : [];
  const options: CharacterSpec[] = [];
  for (const item of list) {
    try {
      options.push(normalizeSpec(item));
    } catch {
      // Skip an invalid option and fill from the deterministic fallback.
    }
  }
  return options;
}

function applyPaletteHint(options: CharacterSpec[], prompt: string): CharacterSpec[] {
  const palette = paletteForPrompt(prompt);
  if (!palette) return options;
  return options.map((option) =>
    normalizeSpec({
      ...option,
      palette,
    }),
  );
}

const SPEC_JSON = `{
  "name": "Ember Warden",
  "bodyPlan": "humanoid | quadruped | blob",
  "description": "one sentence",
  "palette": {
    "skin": "#c98b5e", "skinShadow": "#8f5a3c",
    "primary": "#b84a2f", "primaryShadow": "#7b2e1f",
    "secondary": "#e0a23a", "secondaryShadow": "#9c6a1f",
    "accent": "#f2e6c9", "metal": "#8b8f96",
    "metalShadow": "#555a61", "outline": "#1b1412",
    "eye": "#f4d35e", "highlight": "#fff3d6"
  },
  "build": { "height": 1, "width": 1, "head": 1, "torso": 1, "arms": 1, "legs": 1 },
  "features": {
    "horns": 0, "ears": 0, "tail": 0, "wings": 0,
    "weapon": "none | sword | axe | club | staff | claws",
    "outfit": "none | tunic | leather | armor | robe | rags | cloak",
    "hairStyle": "bald | short | long | mohawk | topknot | hooded",
    "eyes": 2, "mouth": 1,
    "pattern": "none | spots | stripes | scales"
  }
}`;

const CHARACTER_PROMPT = `You are a limited art director for a pixel-art character builder.
The app renders your output using a fixed part grammar. You do not generate images or code.
The initial prompt has the broadest creative influence; later refinement is constrained and preserves the current character.
Return exactly 4 distinct character options as JSON: {"options":[...]}.

Rules:
- Each option must use the exact schema below.
- bodyPlan must be humanoid, quadruped, or blob.
- build values are relative multipliers, normally 0.7 to 1.3.
- features.horns, ears, tail, wings are integers 0-3.
- features.eyes is 1-4, mouth is 0-3.
- Palette values must be 6-digit hex colors.
- Keep silhouettes readable at 64x64. Favor strong, contrasting palettes.
Hair style applies to humanoids; use short or bald for creatures unless a mane fits.
- Make the four options meaningfully different in silhouette, gear, and palette.
- Do not include markdown fences or commentary.

Schema:
${SPEC_JSON}`;

export async function generateCharacterOptions(
  prompt: string,
  bodyPlan?: CharacterSpec["bodyPlan"],
): Promise<{ options: CharacterSpec[]; source: "agent" | "fallback"; warning?: string }> {
  const fallback = fallbackOptions(prompt, 4);
  if (bodyPlan) {
    for (const option of fallback) option.bodyPlan = bodyPlan;
  }
  try {
    const text = await textGeneration(
      `${CHARACTER_PROMPT}\n\nINITIAL PROMPT:\n${prompt}${bodyPlan ? `\nREQUIRED BODY PLAN: ${bodyPlan}` : ""}`,
    );
    const options = safeOptions(text);
    if (options.length === 0) throw new Error("No valid options.");
    if (bodyPlan) {
      options.forEach((option) => {
        option.bodyPlan = bodyPlan;
      });
    }
    while (options.length < 4) {
      options.push(fallback[options.length]);
    }
    return { options: options.slice(0, 4), source: "agent" };
  } catch (error) {
    console.error("Character agent failed:", error);
    return {
      options: fallback,
      source: "fallback",
      warning:
        "The character agent was unavailable, so four deterministic concepts were generated.",
    };
  }
}

const REFINE_PROMPT = `You are a limited art director for a pixel-art character builder.
The user has chosen and edited a character. Return exactly 4 revised character options.
Preserve the current body plan and recognizable identity unless the user explicitly asks to change it.
Use the current character spec and the rendered PNG as inspiration.
Do not generate images or code. Return JSON only: {"options":[...]}.

Schema:
${SPEC_JSON}`;

export async function refineCharacterOptions(
  prompt: string,
  current: CharacterSpec,
  renderDataUrl?: string | null,
): Promise<{ options: CharacterSpec[]; source: "agent" | "fallback"; warning?: string }> {
  const fallback = fallbackRefine(current, prompt, 4);
  try {
    const request = `${REFINE_PROMPT}\n\nCURRENT SPEC:\n${JSON.stringify(
      current,
    )}\n\nREFINEMENT PROMPT:\n${prompt}`;
    const text = renderDataUrl
      ? await visionGeneration(request, renderDataUrl)
      : await textGeneration(request);
    const options = safeOptions(text);
    if (options.length === 0) throw new Error("No valid refined options.");
    while (options.length < 4) {
      options.push(fallback[options.length]);
    }
    return {
      options: applyPaletteHint(options.slice(0, 4), prompt),
      source: "agent",
    };
  } catch (error) {
    console.error("Refinement agent failed:", error);
    return {
      options: fallback,
      source: "fallback",
      warning:
        "The refinement agent was unavailable, so four deterministic revisions were generated.",
    };
  }
}

const ANIMATION_PROMPT = `You are a limited animation director for a pixel-art character builder.
Return one animation as JSON. The app renders the frames from part transforms.
Do not generate images or code. Return JSON only.

Rules:
- Use only the part ids listed below.
- Each frame is a pose applied on top of the current part transforms.
- x and y are pixel offsets, scale is a multiplier, rotation is in degrees, opacity is 0-1.
- Idle and run should loop. Jump, attack, and death should not loop.
- Keep the timing readable: 4-10 frames, 6-12 fps.
- The first pass should be expressive but clean.

Schema:
{
  "name": "Idle",
  "fps": 6,
  "loop": true,
  "frames": [
    { "duration": 1, "transforms": { "partId": { "x": 0, "y": 0, "rotation": 0, "scale": 1 } } }
  ]
}`;

export async function generateAnimation(
  prompt: string,
  spec: CharacterSpec,
  preset?: string,
): Promise<{ animation: ReturnType<typeof normalizeAnimation>; source: "agent" | "fallback"; warning?: string }> {
  const fallback = presetAnimation(spec, prompt, preset);
  const partIds =
    spec.bodyPlan === "humanoid"
      ? ["head", "torso", "armL", "armR", "legL", "legR", "hair", "outfit", "weapon", "wings", "tail"]
      : spec.bodyPlan === "quadruped"
        ? ["head", "body", "legFL", "legFR", "legBL", "legBR", "tail", "wings", "outfit", "weapon"]
        : ["body", "eyes", "mouth", "armL", "armR", "horns", "outfit", "tail", "weapon"];
  try {
    const text = await textGeneration(
      `${ANIMATION_PROMPT}\n\nPART IDS: ${partIds.join(", ")}\nBODY PLAN: ${
        spec.bodyPlan
      }\nCHARACTER: ${JSON.stringify(
        spec,
      )}\n\nANIMATION REQUEST:\n${prompt}${
        preset ? `\nPRESET: ${preset}` : ""
      }`,
    );
    const parsed = animationSpecSchema.parse(JSON.parse(extractJson(text)));
    const animation = normalizeAnimation(parsed);
    // Ignore unknown part ids rather than letting a hallucinated track break rendering.
    for (const frame of animation.frames) {
      frame.transforms = Object.fromEntries(
        Object.entries(frame.transforms).filter(([partId]) =>
          partIds.includes(partId),
        ),
      );
    }
    return { animation, source: "agent" };
  } catch (error) {
    console.error("Animation agent failed:", error);
    return {
      animation: fallback,
      source: "fallback",
      warning:
        "The animation agent was unavailable, so a tuned preset was used.",
    };
  }
}

const analysisSchema = z.object({
  bodyPlan: z.enum(["humanoid", "quadruped", "blob"]).optional().default("humanoid"),
  description: z.string().optional().default(""),
});

export async function analyzeReferenceImage(
  imageDataUrl: string,
): Promise<{
  bodyPlan: "humanoid" | "quadruped" | "blob";
  description: string;
  source: "agent" | "fallback";
}> {
  try {
    const text = await visionGeneration(
      `Classify the full character image for a pixel-art builder.
Return JSON only: {"bodyPlan":"humanoid"|"quadruped"|"blob","description":"one short sentence"}.
Choose quadruped for four-legged creatures, blob for slimes/amorphous creatures, humanoid for bipeds and human-like creatures.`,
      imageDataUrl,
    );
    const result = analysisSchema.parse(JSON.parse(extractJson(text)));
    return { ...result, source: "agent" };
  } catch (error) {
    console.error("Reference analysis failed:", error);
    return {
      bodyPlan: "humanoid",
      description: "Body plan could not be inferred; defaulted to humanoid.",
      source: "fallback",
    };
  }
}


