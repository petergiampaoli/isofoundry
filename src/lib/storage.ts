import { del, get, keys, set } from "idb-keyval";
import { buildParts } from "./render";
import { normalizeSpec } from "./schemas";
import {
  VIEW_IDS,
  type CharacterDoc,
  type VersionSnapshot,
  type ViewId,
} from "./types";

const PREFIX = "isofoundry-character:project:";

export type StoredProject = {
  doc: CharacterDoc;
  versions: VersionSnapshot[];
};

export function normalizeDoc(input: CharacterDoc): CharacterDoc {
  const legacy = input as CharacterDoc & { parts?: CharacterDoc["views"]["frontRight"] };
  const spec = normalizeSpec(input.spec);
  const width = input.width ?? 64;
  const height = input.height ?? 64;
  const views = { ...(input.views ?? {}) } as Partial<CharacterDoc["views"]>;
  if (!views.frontRight && legacy.parts) {
    views.frontRight = legacy.parts;
  }
  for (const view of VIEW_IDS) {
    if (!views[view]) {
      views[view] = buildParts(spec, width, height, view);
    }
  }
  const activeView = VIEW_IDS.includes(input.activeView) ? input.activeView : "frontRight";
  const referenceView = VIEW_IDS.includes(input.referenceView as ViewId)
    ? (input.referenceView as ViewId)
    : input.reference
      ? activeView
      : undefined;
  const animations = (input.animations ?? []).map((animation) => ({
    ...animation,
    frames: animation.frames.map((frame) => {
      const rawPixels = frame.pixels as unknown;
      let pixels = frame.pixels;
      if (rawPixels && !Array.isArray(rawPixels)) {
        const keys = Object.keys(rawPixels as Record<string, unknown>);
        if (keys.length > 0 && Array.isArray((rawPixels as Record<string, unknown>)[keys[0]])) {
          pixels = { frontRight: rawPixels as Record<string, number[]> };
        }
      }
      return { ...frame, pixels };
    }),
  }));
  return {
    ...input,
    spec,
    width,
    height,
    views: views as Record<ViewId, CharacterDoc["views"]["frontRight"]>,
    activeView,
    reference: input.reference ?? null,
    referenceView,
    animations,
  };
}

export async function saveProjectState(
  doc: CharacterDoc,
  versions: VersionSnapshot[],
): Promise<void> {
  await set(`${PREFIX}${doc.id}`, {
    doc,
    versions: versions.slice(0, 20),
  } satisfies StoredProject);
}

export async function loadProjectState(
  id: string,
): Promise<StoredProject | null> {
  const value = await get<StoredProject>(`${PREFIX}${id}`);
  if (!value?.doc) return null;
  return {
    doc: normalizeDoc(value.doc),
    versions: (value.versions ?? []).map((version) => ({
      ...version,
      doc: normalizeDoc(version.doc),
    })),
  };
}

export async function listProjectStates(): Promise<StoredProject[]> {
  const allKeys = await keys();
  const projectKeys = allKeys.filter(
    (key): key is string =>
      typeof key === "string" && key.startsWith(PREFIX),
  );
  const projects: StoredProject[] = [];
  for (const key of projectKeys) {
    const value = await get<StoredProject>(key);
    if (value?.doc) {
      projects.push({
        doc: normalizeDoc(value.doc),
        versions: (value.versions ?? []).map((version) => ({
          ...version,
          doc: normalizeDoc(version.doc),
        })),
      });
    }
  }
  return projects.sort(
    (a, b) =>
      new Date(b.doc.updatedAt).getTime() -
      new Date(a.doc.updatedAt).getTime(),
  );
}

export async function deleteProjectState(id: string): Promise<void> {
  await del(`${PREFIX}${id}`);
}
