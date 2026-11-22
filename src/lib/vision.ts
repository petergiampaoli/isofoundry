import type { CombinedInspirationRead, InspirationAsset, VisionRead, VoiceAxes } from '../types';
import { clamp } from './rng';

export interface VisionConfig {
  baseUrl: string;
  model: string;
  consent: boolean;
}

export const DEFAULT_VISION_CONFIG: VisionConfig = {
  baseUrl: 'https://api.openai.com/v1',
  model: '',
  consent: false,
};

const CONFIG_KEY = 'isofoundry.vision.config.v1';
const KEY_SESSION = 'isofoundry.vision.key.session';
const KEY_LOCAL = 'isofoundry.vision.key.local';
const REMEMBER_KEY = 'isofoundry.vision.remember.v1';

export function loadVisionConfig(): VisionConfig {
  try {
    const raw = localStorage.getItem(CONFIG_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<VisionConfig>;
      return {
        baseUrl: parsed.baseUrl || DEFAULT_VISION_CONFIG.baseUrl,
        model: parsed.model || '',
        consent: Boolean(parsed.consent),
      };
    }
  } catch {
    // Fall through to the default provider config.
  }
  return { ...DEFAULT_VISION_CONFIG };
}

export function saveVisionConfig(config: VisionConfig): void {
  try {
    localStorage.setItem(CONFIG_KEY, JSON.stringify(config));
  } catch {
    // The config remains in component state for this session.
  }
}

export function loadVisionKey(): { key: string; remember: boolean } {
  try {
    const remember = localStorage.getItem(REMEMBER_KEY) === '1';
    const key = (remember ? localStorage.getItem(KEY_LOCAL) : sessionStorage.getItem(KEY_SESSION)) ?? '';
    return { key, remember };
  } catch {
    return { key: '', remember: false };
  }
}

export function saveVisionKey(key: string, remember: boolean): void {
  try {
    sessionStorage.removeItem(KEY_SESSION);
    localStorage.removeItem(KEY_LOCAL);
    localStorage.setItem(REMEMBER_KEY, remember ? '1' : '0');
    if (!key) return;
    if (remember) localStorage.setItem(KEY_LOCAL, key);
    else sessionStorage.setItem(KEY_SESSION, key);
  } catch {
    // Keys stay in memory if storage is unavailable.
  }
}

export function hasVisionKey(): boolean {
  return Boolean(loadVisionKey().key);
}

function endpointFor(baseUrl: string): string {
  const trimmed = baseUrl.trim().replace(/\/+$/, '');
  if (!trimmed) throw new Error('Add a vision provider base URL first.');
  if (/\/chat\/completions$/i.test(trimmed)) return trimmed;
  return `${trimmed}/chat/completions`;
}

function providerName(baseUrl: string): string {
  try {
    return new URL(baseUrl).host;
  } catch {
    return baseUrl;
  }
}

function asString(value: unknown, fallback = ''): string {
  return typeof value === 'string' && value.trim() ? value.trim() : fallback;
}

function asStringArray(value: unknown, limit = 8): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
    .map((item) => item.trim())
    .slice(0, limit);
}

function asUnit(value: unknown, fallback = 0.5): number {
  return typeof value === 'number' && Number.isFinite(value) ? clamp(value) : fallback;
}

function parseVoice(value: unknown, fallback: VoiceAxes): VoiceAxes {
  const source = value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
  return {
    grounded: asUnit(source.grounded, fallback.grounded),
    ornate: asUnit(source.ornate, fallback.ornate),
    brutal: asUnit(source.brutal, fallback.brutal),
    springy: asUnit(source.springy, fallback.springy),
    vivid: asUnit(source.vivid, fallback.vivid),
    gritty: asUnit(source.gritty, fallback.gritty),
  };
}

function localSummary(assets: InspirationAsset[], combined: CombinedInspirationRead): string {
  const primaryId = combined.sources.find((source) => source.primary)?.id;
  return assets
    .map((asset) => {
      const read = asset.read;
      return [
        `${asset.id === primaryId ? 'PRIMARY' : 'SUPPORT'} ${asset.name}:`,
        `palette ${read.palette.slice(0, 6).join(', ')};`,
        `hue ${Math.round(read.hue)}°, accent ${Math.round(read.accentHue)}°, warmth ${read.warmth.toFixed(2)};`,
        `chroma ${read.chroma.toFixed(2)}, contrast ${read.contrast.toFixed(2)};`,
        `edge ${read.edgeDensity.toFixed(2)}, detail ${read.detailEntropy.toFixed(2)}, texture ${read.texture.toFixed(2)};`,
        `angularity ${read.angularity.toFixed(2)}, symmetry ${read.symmetry.toFixed(2)};`,
        `keywords ${read.keywords.join(', ')}.`,
      ].join(' ');
    })
    .join('\n');
}

function cleanJson(content: string): string {
  const fenced = content.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const raw = fenced ? fenced[1] : content;
  const start = raw.indexOf('{');
  const end = raw.lastIndexOf('}');
  if (start >= 0 && end > start) return raw.slice(start, end + 1);
  return raw.trim();
}

function parseVisionRead(
  raw: unknown,
  config: VisionConfig,
  fallbackVoice: VoiceAxes,
): Omit<VisionRead, 'accepted' | 'createdAt'> {
  if (!raw || typeof raw !== 'object') throw new Error('The vision provider returned an empty read.');
  const data = raw as Record<string, unknown>;
  const motion = data.suggestedMotion && typeof data.suggestedMotion === 'object'
    ? (data.suggestedMotion as Record<string, unknown>)
    : {};
  return {
    provider: providerName(config.baseUrl),
    model: config.model,
    theme: asString(data.theme, 'Untitled visual world'),
    motifs: asStringArray(data.motifs),
    materials: asStringArray(data.materials),
    mood: asString(data.mood, 'No mood read returned.'),
    shapeLanguage: asString(data.shapeLanguage, 'No shape-language read returned.'),
    narrativeVoice: asString(data.narrativeVoice, 'No narrative voice returned.'),
    motionDescription: asString(data.motionDescription, 'No motion suggestion returned.'),
    suggestedMotion: {
      weight: asUnit(motion.weight, 0.55),
      bounce: asUnit(motion.bounce, 0.4),
      sway: asUnit(motion.sway, 0.4),
    },
    voice: parseVoice(data.voice, fallbackVoice),
    keywords: asStringArray(data.keywords),
    antiGoals: asStringArray(data.antiGoals),
    manifesto: asString(data.manifesto, ''),
    confidence: asUnit(data.confidence, 0.55),
  };
}

async function requestVision(
  assets: InspirationAsset[],
  prompt: string,
  combined: CombinedInspirationRead,
  config: VisionConfig,
  apiKey: string,
  withJsonFormat: boolean,
): Promise<Response> {
  const system = [
    'You are an art director reading a moodboard for an isometric pixel-art game.',
    'You only interpret the references. You never generate or describe an image to trace.',
    'Return one JSON object and no prose. Use this shape:',
    '{"theme":string,"motifs":string[],"materials":string[],"mood":string,"shapeLanguage":string,"narrativeVoice":string,"motionDescription":string,"suggestedMotion":{"weight":0-1,"bounce":0-1,"sway":0-1},"voice":{"grounded":0-1,"ornate":0-1,"brutal":0-1,"springy":0-1,"vivid":0-1,"gritty":0-1},"keywords":string[],"antiGoals":string[],"manifesto":string,"confidence":0-1}',
    'Palette, value, edge, and detail measurements are supplied by a local analyzer. Trust those numbers over guesses.',
    'Motion can only be suggested from mood and genre cues; say so in motionDescription.',
  ].join(' ');
  const text = [
    `Game prompt: ${prompt.trim() || '(none yet)'}`,
    `Reference notes: ${combined.notes || '(none)'}`,
    'Local computer-vision read:',
    localSummary(assets, combined),
    `Combined local palette: ${combined.palette.join(', ')}`,
    'Images follow. Use the primary reference for the visual voice; supporting references add mood and material support.',
  ].join('\n');

  const content: Array<Record<string, unknown>> = [{ type: 'text', text }];
  assets.forEach((asset) => {
    content.push({
      type: 'image_url',
      image_url: { url: asset.preview, detail: 'low' },
    });
  });

  const body: Record<string, unknown> = {
    model: config.model,
    temperature: 0.2,
    max_tokens: 1100,
    messages: [
      { role: 'system', content: system },
      { role: 'user', content },
    ],
  };
  if (withJsonFormat) body.response_format = { type: 'json_object' };

  const controller = new AbortController();
  const timeout = globalThis.setTimeout(() => controller.abort(), 60000);
  try {
    return await fetch(endpointFor(config.baseUrl), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
  } finally {
    globalThis.clearTimeout(timeout);
  }
}

export async function readWithVision(args: {
  assets: InspirationAsset[];
  prompt: string;
  combined: CombinedInspirationRead;
  config: VisionConfig;
  apiKey: string;
}): Promise<VisionRead> {
  const { assets, prompt, combined, config, apiKey } = args;
  if (!config.model.trim()) throw new Error('Add a vision model name in AI settings first.');
  if (!config.consent) throw new Error('Confirm that references may be sent to the configured provider first.');
  if (assets.length === 0) throw new Error('Add at least one reference first.');

  let response = await requestVision(assets, prompt, combined, config, apiKey, true);
  if (response.status === 400) {
    response = await requestVision(assets, prompt, combined, config, apiKey, false);
  }
  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new Error(`Vision request failed (${response.status}). ${body.slice(0, 220)}`);
  }
  const payload = await response.json() as {
    choices?: Array<{ message?: { content?: unknown } }>;
  };
  const content = payload.choices?.[0]?.message?.content;
  const text = typeof content === 'string'
    ? content
    : Array.isArray(content)
      ? content.map((part) => (typeof part === 'string' ? part : (part as { text?: string })?.text ?? '')).join('\n')
      : '';
  if (!text.trim()) throw new Error('The vision provider returned no text.');
  let parsed: unknown;
  try {
    parsed = JSON.parse(cleanJson(text));
  } catch {
    throw new Error('The vision provider did not return valid JSON.');
  }
  const read = parseVisionRead(parsed, config, combined.suggestedVoice);
  return {
    ...read,
    createdAt: Date.now(),
    accepted: false,
  };
}
