"use client";

import { current as immerCurrent } from "immer";
import { create } from "zustand";
import { immer } from "zustand/middleware/immer";
import {
  fallbackOptions,
  fallbackRefine,
  presetAnimation,
} from "@/lib/generator";
import { buildParts, resizePixels } from "@/lib/render";
import { normalizeSpec, uid } from "@/lib/schemas";
import { loadProjectState, normalizeDoc, saveProjectState } from "@/lib/storage";
import {
  IDENTITY_TRANSFORM,
  PALETTE_ROLES,
  VIEW_IDS,
  activeParts,
  type AnimationDoc,
  type CharacterDoc,
  type CharacterSpec,
  type PaletteRole,
  type Part,
  type Tool,
  type Transform,
  type VersionSnapshot,
  type ViewId,
} from "@/lib/types";

type View = "start" | "studio";

type StudioState = {
  view: View;
  prompt: string;
  options: CharacterSpec[];
  refineOptions: CharacterSpec[];
  generating: boolean;
  refining: boolean;
  animating: boolean;
  status: string | null;
  warning: string | null;
  error: string | null;

  doc: CharacterDoc | null;
  versions: VersionSnapshot[];
  history: CharacterDoc[];
  future: CharacterDoc[];

  selectedPartId: string | null;
  tool: Tool;
  colorIndex: number;
  brushSize: number;
  frameIndex: number;
  playing: boolean;
  onionSkin: boolean;
  framePaint: boolean;
  showReference: boolean;

  setPrompt: (prompt: string) => void;
  setStatus: (status: string | null) => void;
  setWarning: (warning: string | null) => void;
  setError: (error: string | null) => void;
  generateOptions: (prompt: string, bodyPlan?: CharacterSpec["bodyPlan"]) => Promise<void>;
  chooseOption: (spec: CharacterSpec) => void;
  openProject: (doc: CharacterDoc) => void;
  newProject: () => void;
  refine: (prompt: string, renderDataUrl: string) => Promise<void>;
  applyRefinement: (spec: CharacterSpec) => void;
  clearRefineOptions: () => void;
  revertVersion: (id: string) => void;
  loadLastProject: () => Promise<void>;

  selectPart: (id: string | null) => void;
  setActiveView: (view: ViewId) => void;
  setTool: (tool: Tool) => void;
  setColorIndex: (index: number) => void;
  setBrushSize: (size: number) => void;
  setPartPixels: (id: string, pixels: number[]) => void;
  updatePartTransform: (id: string, patch: Partial<Transform>) => void;
  resetPartTransform: (id: string) => void;
  detachPart: (id: string) => void;
  attachPart: (id: string) => void;
  explodeParts: () => void;
  assembleParts: () => void;
  togglePartVisible: (id: string) => void;
  updatePartName: (id: string, name: string) => void;
  deletePart: (id: string) => void;

  updateSpec: (patch: Partial<CharacterSpec>) => void;
  setPaletteColor: (role: PaletteRole, color: string) => void;
  setPaletteColorAtIndex: (index: number, color: string) => void;
  addPaletteColor: (color?: string) => void;
  removePaletteColor: (index: number) => void;
  setCanvasSize: (width: number, height: number, scaleArt: boolean) => void;
  addImportedPart: (part: {
    id?: string;
    name: string;
    pixels: number[];
    pivot: { x: number; y: number };
  }) => void;
  setReference: (
    dataUrl: string,
    name: string,
    bodyPlan: CharacterSpec["bodyPlan"] | null,
    view?: ViewId,
  ) => void;
  setReferenceOpacity: (opacity: number) => void;
  toggleReference: () => void;
  setShowReference: (visible: boolean) => void;

  addAnimation: (animation: AnimationDoc) => void;
  generateAnimation: (prompt: string, preset?: string) => Promise<void>;
  setCurrentAnimation: (id: string) => void;
  updateAnimationMeta: (patch: Partial<AnimationDoc>) => void;
  setFrameIndex: (index: number) => void;
  setFramePaint: (enabled: boolean) => void;
  setFramePartPixels: (partId: string, pixels: number[]) => void;
  clearFramePartPixels: (partId?: string) => void;
  updateFrameTransform: (
    partId: string,
    patch: Partial<Transform>,
  ) => void;
  addFrame: () => void;
  duplicateFrame: () => void;
  deleteFrame: () => void;
  setPlaying: (playing: boolean) => void;
  setOnionSkin: (enabled: boolean) => void;
  undo: () => void;
  redo: () => void;
};

function clone<T>(value: T): T {
  return structuredClone(value);
}

function createDoc(
  spec: CharacterSpec,
  width = 64,
  height = 64,
): CharacterDoc {
  const now = new Date().toISOString();
  return {
    id: uid(),
    name: spec.name,
    width,
    height,
    spec,
    views: Object.fromEntries(
      VIEW_IDS.map((view) => [view, buildParts(spec, width, height, view)]),
    ) as CharacterDoc["views"],
    activeView: "frontRight",
    reference: null,
    animations: [],
    currentAnimationId: null,
    createdAt: now,
    updatedAt: now,
  };
}

function pushHistory(state: StudioState) {
  if (!state.doc) return;
  state.history.push(structuredClone(immerCurrent(state.doc)));
  if (state.history.length > 40) state.history.shift();
  state.future = [];
}

function touch(doc: CharacterDoc) {
  doc.updatedAt = new Date().toISOString();
}

function applySpecToDoc(
  doc: CharacterDoc,
  nextSpec: CharacterSpec,
  preserve: boolean,
): CharacterDoc {
  const next = clone(doc);
  const samePlan = doc.spec.bodyPlan === nextSpec.bodyPlan;
  const views = {} as CharacterDoc["views"];

  for (const view of VIEW_IDS) {
    const oldById = new Map((doc.views[view] ?? []).map((part) => [part.id, part]));
    const parts = buildParts(nextSpec, doc.width, doc.height, view).map((part) => {
      const old = oldById.get(part.id);
      if (old && preserve && samePlan) {
        if (old.edited) {
          part.pixels = [...old.pixels];
          part.edited = true;
        }
        part.transform = { ...old.transform };
        part.home = { ...old.home };
        part.visible = old.visible;
      }
      return part;
    });
    const imported = (doc.views[view] ?? [])
      .filter((part) => part.kind === "imported")
      .map((part) => clone(part));
    views[view] = [...parts, ...imported];
  }

  next.spec = nextSpec;
  next.name = nextSpec.name;
  next.views = views;
  touch(next);
  return next;
}

function currentAnimation(doc: CharacterDoc | null): AnimationDoc | null {
  if (!doc) return null;
  return (
    doc.animations.find((animation) => animation.id === doc.currentAnimationId) ??
    doc.animations[0] ??
    null
  );
}

function defaultPartId(doc: CharacterDoc): string | null {
  const preferred = ["torso", "body", "head", "eyes"];
  const parts = activeParts(doc);
  for (const id of preferred) {
    const part = parts.find((entry) => entry.id === id);
    if (part) return part.id;
  }
  return parts[0]?.id ?? null;
}

async function postJson<T>(url: string, body: unknown): Promise<T> {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const payload = (await response.json()) as T & { error?: string };
  if (!response.ok) {
    throw new Error(payload.error || "The agent request failed.");
  }
  return payload;
}

export const useStudio = create<StudioState>()(
  immer((set, get) => ({
    view: "start",
    prompt: "",
    options: [],
    refineOptions: [],
    generating: false,
    refining: false,
    animating: false,
    status: null,
    warning: null,
    error: null,

    doc: null,
    versions: [],
    history: [],
    future: [],

    selectedPartId: null,
    tool: "select",
    colorIndex: 0,
    brushSize: 1,
    frameIndex: 0,
    playing: false,
    onionSkin: false,
    framePaint: false,
    showReference: true,

    setPrompt: (prompt) => set({ prompt }),
    setStatus: (status) => set({ status }),
    setWarning: (warning) => set({ warning }),
    setError: (error) => set({ error }),

    generateOptions: async (prompt, bodyPlan) => {
      set({
        generating: true,
        error: null,
        warning: null,
        status: "Summoning four concepts…",
      });
      try {
        const result = await postJson<{
          options: CharacterSpec[];
          source: "agent" | "fallback";
          warning?: string;
        }>("/api/agent/character", { prompt, bodyPlan });
        set({
          options: result.options,
          generating: false,
          status: null,
          warning:
            result.warning ??
            (result.source === "fallback"
              ? "The agent was unavailable, so deterministic concepts were used."
              : null),
        });
      } catch (error) {
        const fallback = fallbackOptions(prompt, 4);
        if (bodyPlan) {
          for (const option of fallback) option.bodyPlan = bodyPlan;
        }
        set({
          options: fallback,
          generating: false,
          status: null,
          warning:
            "The agent could not be reached. Four deterministic concepts were generated instead.",
        });
        console.error(error);
      }
    },

    chooseOption: (spec) => {
      const doc = createDoc(spec);
      const version: VersionSnapshot = {
        id: uid(),
        label: "Initial prompt",
        prompt: get().prompt,
        doc: clone(doc),
        createdAt: new Date().toISOString(),
      };
      set({
        doc,
        view: "studio",
        options: [],
        refineOptions: [],
        versions: [version],
        history: [],
        future: [],
        selectedPartId: defaultPartId(doc),
        frameIndex: 0,
        tool: "select",
      });
      void saveProjectState(doc, [version]);
    },

    openProject: (doc) => {
      if (!doc || !doc.spec) {
        set({ error: "That file is not an Isofoundry character project." });
        return;
      }
      const legacy = doc as CharacterDoc & { parts?: Part[] };
      if (!doc.views && !Array.isArray(legacy.parts)) {
        set({ error: "That file is not an Isofoundry character project." });
        return;
      }
      const next = normalizeDoc(structuredClone(doc));
      set({
        doc: next,
        view: "studio",
        versions: [],
        history: [],
        future: [],
        selectedPartId: defaultPartId(next),
        frameIndex: 0,
        playing: false,
        warning: null,
        error: null,
        status: null,
      });
      void saveProjectState(next, []);
    },

    newProject: () => {
      set({
        view: "start",
        prompt: "",
        options: [],
        refineOptions: [],
        doc: null,
        versions: [],
        history: [],
        future: [],
        selectedPartId: null,
        frameIndex: 0,
        playing: false,
        warning: null,
        error: null,
        status: null,
      });
      if (typeof window !== "undefined") {
        window.localStorage.removeItem("isofoundry-character:last-project");
      }
    },

    refine: async (prompt, renderDataUrl) => {
      const doc = get().doc;
      if (!doc) return;
      set({
        refining: true,
        error: null,
        warning: null,
        status: "Reworking four revisions…",
      });
      try {
        const result = await postJson<{
          options: CharacterSpec[];
          source: "agent" | "fallback";
          warning?: string;
        }>("/api/agent/refine", {
          prompt,
          spec: doc.spec,
          renderDataUrl,
        });
        set({
          refineOptions: result.options,
          refining: false,
          status: null,
          warning:
            result.warning ??
            (result.source === "fallback"
              ? "The agent was unavailable, so deterministic revisions were used."
              : null),
        });
      } catch (error) {
        set({
          refineOptions: fallbackRefine(doc.spec, prompt, 4),
          refining: false,
          status: null,
          warning:
            "The agent could not be reached. Four deterministic revisions were generated instead.",
        });
        console.error(error);
      }
    },

    applyRefinement: (spec) => {
      const doc = get().doc;
      if (!doc) return;
      const version: VersionSnapshot = {
        id: uid(),
        label: "Before refinement",
        prompt: get().prompt,
        doc: clone(doc),
        createdAt: new Date().toISOString(),
      };
      const next = applySpecToDoc(doc, spec, true);
      const versions = [version, ...get().versions].slice(0, 20);
      set({
        doc: next,
        versions,
        refineOptions: [],
        history: [],
        future: [],
        selectedPartId:
          activeParts(next).find((part) => part.id === get().selectedPartId)?.id ??
          defaultPartId(next),
        warning: null,
      });
      void saveProjectState(next, versions);
    },

    clearRefineOptions: () => set({ refineOptions: [] }),

    revertVersion: (id) => {
      const version = get().versions.find((entry) => entry.id === id);
      if (!version) return;
      const doc = normalizeDoc(clone(version.doc));
      set({
        doc,
        view: "studio",
        selectedPartId: defaultPartId(doc),
        history: [],
        future: [],
        frameIndex: 0,
        warning: `Reverted to ${version.label}.`,
      });
      void saveProjectState(doc, get().versions);
    },

    loadLastProject: async () => {
      if (typeof window === "undefined") return;
      const id = window.localStorage.getItem("isofoundry-character:last-project");
      if (!id) return;
      const stored = await loadProjectState(id);
      if (!stored?.doc) return;
      set({
        doc: stored.doc,
        versions: stored.versions ?? [],
        view: "studio",
        selectedPartId: defaultPartId(stored.doc),
      });
    },

    selectPart: (id) => set({ selectedPartId: id }),

    setActiveView: (view) =>
      set((state) => {
        if (!state.doc) return;
        state.doc.activeView = view;
        const parts = state.doc.views[view] ?? [];
        if (!parts.some((part) => part.id === state.selectedPartId)) {
          state.selectedPartId = defaultPartId(state.doc);
        }
        state.playing = false;
      }),

    setTool: (tool) => set({ tool }),
    setColorIndex: (index) => set({ colorIndex: index }),
    setBrushSize: (size) => set({ brushSize: Math.max(1, Math.min(6, size)) }),

    setPartPixels: (id, pixels) =>
      set((state) => {
        if (!state.doc) return;
        pushHistory(state);
        const part = activeParts(state.doc).find((entry) => entry.id === id);
        if (!part) return;
        part.pixels = pixels;
        part.edited = true;
        touch(state.doc);
      }),

    updatePartTransform: (id, patch) =>
      set((state) => {
        if (!state.doc) return;
        pushHistory(state);
        const part = activeParts(state.doc).find((entry) => entry.id === id);
        if (!part) return;
        part.transform = { ...part.transform, ...patch };
        touch(state.doc);
      }),

    resetPartTransform: (id) =>
      set((state) => {
        if (!state.doc) return;
        pushHistory(state);
        const part = activeParts(state.doc).find((entry) => entry.id === id);
        if (!part) return;
        part.transform = { ...part.home };
        touch(state.doc);
      }),

    detachPart: (id) =>
      set((state) => {
        if (!state.doc) return;
        const parts = activeParts(state.doc);
        const part = parts.find((entry) => entry.id === id);
        if (!part) return;
        pushHistory(state);
        const index = parts.findIndex((entry) => entry.id === id);
        const angle = (index / Math.max(1, parts.length)) * Math.PI * 2;
        part.transform = {
          ...part.transform,
          x: part.home.x + Math.cos(angle) * 7,
          y: part.home.y + Math.sin(angle) * 6,
        };
        touch(state.doc);
      }),

    attachPart: (id) =>
      set((state) => {
        if (!state.doc) return;
        const part = activeParts(state.doc).find((entry) => entry.id === id);
        if (!part) return;
        pushHistory(state);
        part.transform = { ...part.home };
        touch(state.doc);
      }),

    explodeParts: () =>
      set((state) => {
        if (!state.doc) return;
        pushHistory(state);
        const parts = activeParts(state.doc);
        const count = Math.max(1, parts.length);
        parts.forEach((part, index) => {
          const angle = (index / count) * Math.PI * 2 - Math.PI / 2;
          const radius = 6 + (index % 2) * 2;
          part.transform = {
            ...part.transform,
            x: part.home.x + Math.cos(angle) * radius,
            y: part.home.y + Math.sin(angle) * radius,
            scale: Math.min(part.transform.scale, 0.88),
          };
        });
        touch(state.doc);
      }),

    assembleParts: () =>
      set((state) => {
        if (!state.doc) return;
        pushHistory(state);
        activeParts(state.doc).forEach((part) => {
          part.transform = { ...part.home };
        });
        touch(state.doc);
      }),

    togglePartVisible: (id) =>
      set((state) => {
        if (!state.doc) return;
        pushHistory(state);
        const part = activeParts(state.doc).find((entry) => entry.id === id);
        if (!part) return;
        part.visible = !part.visible;
        touch(state.doc);
      }),

    updatePartName: (id, name) =>
      set((state) => {
        if (!state.doc) return;
        const part = activeParts(state.doc).find((entry) => entry.id === id);
        if (!part) return;
        part.name = name;
        touch(state.doc);
      }),

    deletePart: (id) =>
      set((state) => {
        if (!state.doc) return;
        pushHistory(state);
        const view = state.doc.activeView;
        state.doc.views[view] = (state.doc.views[view] ?? []).filter(
          (part) => part.id !== id,
        );
        if (state.selectedPartId === id) {
          state.selectedPartId = defaultPartId(state.doc);
        }
        touch(state.doc);
      }),

    updateSpec: (patch) =>
      set((state) => {
        if (!state.doc) return;
        pushHistory(state);
        const currentDoc = immerCurrent(state.doc);
        const nextSpec = normalizeSpec({
          ...currentDoc.spec,
          ...patch,
          palette: { ...currentDoc.spec.palette, ...(patch.palette ?? {}) },
          build: { ...currentDoc.spec.build, ...(patch.build ?? {}) },
          features: { ...currentDoc.spec.features, ...(patch.features ?? {}) },
        });
        state.doc = applySpecToDoc(currentDoc, nextSpec, true);
      }),

    setPaletteColor: (role, color) =>
      set((state) => {
        if (!state.doc) return;
        pushHistory(state);
        state.doc.spec.palette[role] = color;
        touch(state.doc);
      }),

    setPaletteColorAtIndex: (index, color) =>
      set((state) => {
        if (!state.doc) return;
        pushHistory(state);
        const palette = state.doc.spec.palette;
        if (index < PALETTE_ROLES.length) {
          palette[PALETTE_ROLES[index]] = color;
        } else {
          const extraIndex = index - PALETTE_ROLES.length;
          palette.extra = [...(palette.extra ?? [])];
          palette.extra[extraIndex] = color;
        }
        touch(state.doc);
      }),

    addPaletteColor: (color) =>
      set((state) => {
        if (!state.doc) return;
        pushHistory(state);
        const palette = state.doc.spec.palette;
        palette.extra = [...(palette.extra ?? []), color ?? "#d6cbb0"];
        state.colorIndex = PALETTE_ROLES.length + palette.extra.length - 1;
        touch(state.doc);
      }),

    removePaletteColor: (index) =>
      set((state) => {
        if (!state.doc) return;
        const extraIndex = index - PALETTE_ROLES.length;
        const palette = state.doc.spec.palette;
        const extra = palette.extra ?? [];
        if (extraIndex < 0 || extraIndex >= extra.length) return;
        const used = VIEW_IDS.some((view) =>
            (state.doc?.views[view] ?? []).some((part) => part.pixels.includes(index)),
          ) || state.doc.animations.some((animation) =>
            animation.frames.some((frame) =>
              VIEW_IDS.some((view) =>
                Object.values(frame.pixels?.[view] ?? {}).some((pixels) =>
                  pixels.includes(index),
                ),
              ),
            ),
          );
        if (used) {
          state.error = "Recolor or erase the pixels using this color before removing it.";
          return;
        }
        pushHistory(state);
        palette.extra = extra.filter((_, entryIndex) => entryIndex !== extraIndex);
        if (state.colorIndex === index) state.colorIndex = 0;
        else if (state.colorIndex > index) state.colorIndex -= 1;
        for (const view of VIEW_IDS) {
          for (const part of state.doc.views[view] ?? []) {
            part.pixels = part.pixels.map((value) => (value > index ? value - 1 : value));
          }
        }
        for (const animation of state.doc.animations) {
          for (const frame of animation.frames) {
            if (!frame.pixels) continue;
            for (const view of VIEW_IDS) {
              const viewPixels = frame.pixels[view];
              if (!viewPixels) continue;
              for (const [partId, pixels] of Object.entries(viewPixels)) {
                viewPixels[partId] = pixels.map((value) => (value > index ? value - 1 : value));
              }
            }
          }
        }
        touch(state.doc);
      }),

    setCanvasSize: (width, height, scaleArt) =>
      set((state) => {
        if (!state.doc) return;
        pushHistory(state);
        const doc = state.doc;
        const oldWidth = doc.width;
        const oldHeight = doc.height;
        const offsetX = (width - oldWidth) / 2;
        const offsetY = (height - oldHeight) / 2;
        for (const view of VIEW_IDS) {
          doc.views[view] = (doc.views[view] ?? []).map((part) => {
            const factorX = width / oldWidth;
            const factorY = height / oldHeight;
            return {
              ...part,
              pixels: resizePixels(
                part.pixels,
                oldWidth,
                oldHeight,
                width,
                height,
                scaleArt,
              ),
              pivot: scaleArt
                ? {
                    x: part.pivot.x * factorX,
                    y: part.pivot.y * factorY,
                  }
                : {
                    x: part.pivot.x + offsetX,
                    y: part.pivot.y + offsetY,
                  },
            };
          });
        }
        for (const animation of doc.animations) {
          for (const frame of animation.frames) {
            if (!frame.pixels) continue;
            for (const view of VIEW_IDS) {
              const viewPixels = frame.pixels[view];
              if (!viewPixels) continue;
              for (const [partId, pixels] of Object.entries(viewPixels)) {
                viewPixels[partId] = resizePixels(
                  pixels,
                  oldWidth,
                  oldHeight,
                  width,
                  height,
                  scaleArt,
                );
              }
            }
          }
        }
        doc.width = width;
        doc.height = height;
        touch(doc);
      }),

    addImportedPart: (input) =>
      set((state) => {
        if (!state.doc) return;
        pushHistory(state);
        const part: Part = {
          id: input.id ?? uid(),
          name: input.name,
          kind: "imported",
          pivot: input.pivot,
          z: 100 + activeParts(state.doc).length,
          pixels: input.pixels,
          transform: { ...IDENTITY_TRANSFORM },
          home: { ...IDENTITY_TRANSFORM },
          visible: true,
          edited: true,
        };
        state.doc.views[state.doc.activeView].push(part);
        state.selectedPartId = part.id;
        touch(state.doc);
      }),

    setReference: (dataUrl, name, bodyPlan, view) =>
      set((state) => {
        if (!state.doc) return;
        pushHistory(state);
        const targetView = view ?? state.doc.activeView;
        state.doc.reference = {
          dataUrl,
          name,
          bodyPlan,
          opacity: 0.45,
          visible: true,
        };
        state.doc.referenceView = targetView;
        state.doc.activeView = targetView;
        state.selectedPartId = defaultPartId(state.doc);
        state.showReference = true;
        touch(state.doc);
      }),

    setReferenceOpacity: (opacity) =>
      set((state) => {
        if (!state.doc?.reference) return;
        state.doc.reference.opacity = Math.max(0, Math.min(1, opacity));
        touch(state.doc);
      }),

    toggleReference: () =>
      set((state) => {
        if (!state.doc?.reference) return;
        state.doc.reference.visible = !state.doc.reference.visible;
        touch(state.doc);
      }),

    setShowReference: (visible) => set({ showReference: visible }),

    addAnimation: (animation) =>
      set((state) => {
        if (!state.doc) return;
        pushHistory(state);
        state.doc.animations.push(animation);
        state.doc.currentAnimationId = animation.id;
        state.frameIndex = 0;
        touch(state.doc);
      }),

    generateAnimation: async (prompt, preset) => {
      const doc = get().doc;
      if (!doc) return;
      set({
        animating: true,
        error: null,
        warning: null,
        status: "Blocking out the first animation pass…",
      });
      try {
        const result = await postJson<{
          animation: AnimationDoc;
          source: "agent" | "fallback";
          warning?: string;
        }>("/api/agent/animation", {
          prompt,
          preset,
          spec: doc.spec,
        });
        set({
          animating: false,
          status: null,
          warning:
            result.warning ??
            (result.source === "fallback"
              ? "The animation agent was unavailable, so a tuned preset was used."
              : null),
        });
        get().addAnimation(result.animation);
      } catch (error) {
        set({
          animating: false,
          status: null,
          warning:
            "The animation agent could not be reached. A tuned preset was used.",
        });
        get().addAnimation(presetAnimation(doc.spec, prompt, preset));
        console.error(error);
      }
    },

    setCurrentAnimation: (id) =>
      set((state) => {
        if (!state.doc) return;
        state.doc.currentAnimationId = id;
        state.frameIndex = 0;
        state.playing = false;
      }),

    updateAnimationMeta: (patch) =>
      set((state) => {
        if (!state.doc) return;
        const animation = currentAnimation(state.doc);
        if (!animation) return;
        pushHistory(state);
        Object.assign(animation, patch);
        touch(state.doc);
      }),

    setFrameIndex: (index) => set({ frameIndex: Math.max(0, index) }),
    setFramePaint: (enabled) => set({ framePaint: enabled }),

    setFramePartPixels: (partId, pixels) =>
      set((state) => {
        if (!state.doc) return;
        const animation = currentAnimation(state.doc);
        const frame = animation?.frames[state.frameIndex];
        if (!frame) return;
        pushHistory(state);
        const view = state.doc.activeView;
        frame.pixels = {
          ...(frame.pixels ?? {}),
          [view]: { ...(frame.pixels?.[view] ?? {}), [partId]: pixels },
        };
        touch(state.doc);
      }),

    clearFramePartPixels: (partId) =>
      set((state) => {
        if (!state.doc) return;
        const animation = currentAnimation(state.doc);
        const frame = animation?.frames[state.frameIndex];
        if (!frame?.pixels) return;
        pushHistory(state);
        const view = state.doc.activeView;
        if (partId) {
          const viewPixels = frame.pixels[view];
          if (!viewPixels) return;
          delete viewPixels[partId];
          if (Object.keys(viewPixels).length === 0) delete frame.pixels[view];
        } else {
          delete frame.pixels[view];
        }
        touch(state.doc);
      }),

    updateFrameTransform: (partId, patch) =>
      set((state) => {
        if (!state.doc) return;
        const animation = currentAnimation(state.doc);
        if (!animation) return;
        pushHistory(state);
        const frame = animation.frames[state.frameIndex];
        if (!frame) return;
        frame.transforms[partId] = {
          ...(frame.transforms[partId] ?? {}),
          ...patch,
        };
        touch(state.doc);
      }),

    addFrame: () =>
      set((state) => {
        if (!state.doc) return;
        const animation = currentAnimation(state.doc);
        if (!animation) return;
        pushHistory(state);
        const currentFrame = animation.frames[state.frameIndex];
        const plainFrame = currentFrame ? immerCurrent(currentFrame) : null;
        animation.frames.splice(state.frameIndex + 1, 0, {
          id: uid(),
          duration: plainFrame?.duration ?? 1,
          transforms: structuredClone(plainFrame?.transforms ?? {}),
        });
        state.frameIndex += 1;
        touch(state.doc);
      }),

    duplicateFrame: () =>
      set((state) => {
        if (!state.doc) return;
        const animation = currentAnimation(state.doc);
        if (!animation) return;
        pushHistory(state);
        const currentFrame = animation.frames[state.frameIndex];
        if (!currentFrame) return;
        const plainFrame = immerCurrent(currentFrame);
        animation.frames.splice(state.frameIndex + 1, 0, {
          id: uid(),
          duration: plainFrame.duration,
          transforms: structuredClone(plainFrame.transforms),
          pixels: plainFrame.pixels ? structuredClone(plainFrame.pixels) : undefined,
        });
        state.frameIndex += 1;
        touch(state.doc);
      }),

    deleteFrame: () =>
      set((state) => {
        if (!state.doc) return;
        const animation = currentAnimation(state.doc);
        if (!animation || animation.frames.length <= 1) return;
        pushHistory(state);
        animation.frames.splice(state.frameIndex, 1);
        state.frameIndex = Math.max(0, state.frameIndex - 1);
        touch(state.doc);
      }),

    setPlaying: (playing) => set({ playing }),
    setOnionSkin: (enabled) => set({ onionSkin: enabled }),

    undo: () =>
      set((state) => {
        if (!state.doc || state.history.length === 0) return;
        const previous = state.history.pop();
        if (!previous) return;
        state.future.push(structuredClone(immerCurrent(state.doc)));
        state.doc = previous;
        state.selectedPartId =
          activeParts(previous).find((part) => part.id === state.selectedPartId)?.id ??
          defaultPartId(previous);
      }),

    redo: () =>
      set((state) => {
        if (!state.doc || state.future.length === 0) return;
        const next = state.future.pop();
        if (!next) return;
        state.history.push(structuredClone(immerCurrent(state.doc)));
        state.doc = next;
        state.selectedPartId =
          activeParts(next).find((part) => part.id === state.selectedPartId)?.id ??
          defaultPartId(next);
      }),
  })),
);

export function selectCurrentAnimation(state: StudioState): AnimationDoc | null {
  return currentAnimation(state.doc);
}

export function selectCurrentFrame(state: StudioState) {
  const animation = currentAnimation(state.doc);
  return animation?.frames[state.frameIndex] ?? null;
}
