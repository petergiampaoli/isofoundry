import { del, get, keys, set } from "idb-keyval";
import type { CharacterDoc, VersionSnapshot } from "./types";

const PREFIX = "isofoundry-character:project:";

export type StoredProject = {
  doc: CharacterDoc;
  versions: VersionSnapshot[];
};

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
  return value ?? null;
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
    if (value?.doc) projects.push(value);
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
