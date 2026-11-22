import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type {
  Anchor,
  AssetKind,
  Direction,
  FitResult,
  FitTest,
  InspirationAsset,
  InspirationSettings,
  JourneyEvent,
  JourneyEventType,
  PaletteParams,
  ProjectState,
  StyleDNA,
  TraitKey,
  VisionRead,
  VoiceAxes,
} from '../types';
import { ASSET_LABELS, DEFAULT_INSPIRATION_SETTINGS } from '../types';
import { buildDirections, parsePrompt } from '../lib/prompt';
import { combineInspirations } from '../lib/inspiration';
import { createDNA, driftDNA, generateDirectionName, makeManifesto, mutateDNA, refreshDNA } from '../lib/dna';
import { hashString } from '../lib/rng';
import { renderAsset } from '../lib/render';
import { compareSignatures, computeSignature } from '../lib/signature';

const STORAGE_KEY = 'isofoundry.project.v1';
const INITIAL_PROMPT = 'Moss-eaten stone, practical iron, wind-worn cloth. Grounded and tactile, with a quiet strangeness. No glossy armor.';

export type DNAPatch = Partial<Omit<StyleDNA, 'palette' | 'voice' | 'name' | 'paletteParams'>> & {
  paletteParams?: Partial<PaletteParams>;
  voice?: VoiceAxes;
};

function event(type: JourneyEventType, label: string, detail?: string, data?: unknown): JourneyEvent {
  return {
    id: `evt_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
    type,
    label,
    detail,
    at: Date.now(),
    data,
  };
}

function pushEvent(project: ProjectState, next: JourneyEvent): ProjectState {
  return {
    ...project,
    events: [next, ...project.events].slice(0, 160),
    updatedAt: Date.now(),
  };
}

export function createInitialProject(): ProjectState {
  const now = Date.now();
  const salt = hashString('isofoundry-initial-voice');
  const { directions } = buildDirections(INITIAL_PROMPT, null, [], salt, 4);
  const project: ProjectState = {
    version: 1,
    id: `project_${now.toString(36)}`,
    name: 'Isofoundry Study 01',
    prompt: INITIAL_PROMPT,
    directions,
    selectedDirectionId: directions[0]?.id ?? null,
    lockedTraits: [],
    anchor: null,
    tests: [],
    events: [
      event('project', 'Style session opened', 'A starter prompt is loaded. Replace it with your own.'),
      event('prompt', 'Seed prompt explored', INITIAL_PROMPT),
    ],
    inspirations: [],
    primaryInspirationId: null,
    inspirationSettings: { ...DEFAULT_INSPIRATION_SETTINGS },
    inspirationVision: null,
    createdAt: now,
    updatedAt: now,
    shuffle: salt,
  };
  return project;
}

export function createEmptyProject(): ProjectState {
  const now = Date.now();
  return {
    version: 1,
    id: `project_${now.toString(36)}`,
    name: 'Untitled World',
    prompt: '',
    directions: [],
    selectedDirectionId: null,
    lockedTraits: [],
    anchor: null,
    tests: [],
    events: [event('project', 'New session opened', 'The style conversation starts here.')],
    inspirations: [],
    primaryInspirationId: null,
    inspirationSettings: { ...DEFAULT_INSPIRATION_SETTINGS },
    inspirationVision: null,
    createdAt: now,
    updatedAt: now,
    shuffle: hashString(`new-${now}`),
  };
}

export function normalizeProject(project: ProjectState): ProjectState {
  return {
    ...project,
    inspirations: Array.isArray(project.inspirations) ? project.inspirations : [],
    primaryInspirationId: project.primaryInspirationId ?? project.inspirations?.[0]?.id ?? null,
    inspirationSettings: {
      ...DEFAULT_INSPIRATION_SETTINGS,
      ...(project.inspirationSettings ?? {}),
      features: {
        ...DEFAULT_INSPIRATION_SETTINGS.features,
        ...(project.inspirationSettings?.features ?? {}),
      },
    },
    inspirationVision: project.inspirationVision ?? null,
  };
}

export function loadStoredProject(): ProjectState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as ProjectState;
      if (parsed?.version === 1 && Array.isArray(parsed.directions)) return normalizeProject(parsed);
    }
  } catch {
    // Ignore a corrupted local session and start clean.
  }
  return createInitialProject();
}

export interface ProjectActions {
  project: ProjectState;
  selected: Direction | null;
  explore: (prompt: string) => void;
  selectDirection: (id: string) => void;
  refine: (prompt: string) => void;
  updateDNA: (patch: DNAPatch) => void;
  toggleLock: (trait: TraitKey) => void;
  reroll: () => void;
  lockAnchor: (kind: AssetKind, seed: number) => Anchor | null;
  testFit: (kind: AssetKind, drift: boolean, seedOverride?: number) => FitResult | null;
  editAnchor: () => void;
  newSession: () => void;
  resetDemo: () => void;
  renameProject: (name: string) => void;
  importProject: (project: ProjectState) => void;
  setSelectedDirection: (id: string | null) => void;
  logEvent: (type: JourneyEventType, label: string, detail?: string) => void;
  addInspiration: (asset: InspirationAsset) => void;
  removeInspiration: (id: string) => void;
  clearInspirations: () => void;
  setPrimaryInspiration: (id: string) => void;
  updateInspiration: (id: string, patch: Partial<Pick<InspirationAsset, 'weight'>>) => void;
  updateInspirationSettings: (patch: Partial<InspirationSettings>) => void;
  setInspirationVision: (vision: VisionRead | null) => void;
}

export function useProject(): ProjectActions {
  const [project, setProject] = useState<ProjectState>(() => loadStoredProject());
  const saveTimer = useRef<number | null>(null);

  useEffect(() => {
    if (saveTimer.current) window.clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(() => {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(project));
      } catch {
        // Storage can be full or unavailable; the in-memory session still works.
      }
    }, 180);
    return () => {
      if (saveTimer.current) window.clearTimeout(saveTimer.current);
    };
  }, [project]);

  const selected = useMemo(
    () => project.directions.find((direction) => direction.id === project.selectedDirectionId) ?? null,
    [project.directions, project.selectedDirectionId],
  );

  const explore = useCallback((prompt: string) => {
    const trimmed = prompt.trim();
    setProject((current) => {
      if (!trimmed && current.inspirations.length === 0) return current;
      const base = current.directions.find((direction) => direction.id === current.selectedDirectionId)?.dna ?? null;
      const combined = combineInspirations(current.inspirations, current.primaryInspirationId, current.inspirationSettings);
      const vision = current.inspirationVision?.accepted ? current.inspirationVision : null;
      const inspirationSalt = current.inspirations.map((asset) => asset.hash).join(',');
      const salt = hashString(`${trimmed}|${current.shuffle}|${current.directions.length}|${inspirationSalt}|${current.inspirationSettings.influence.toFixed(2)}`);
      const { directions } = buildDirections(
        trimmed,
        base,
        current.lockedTraits,
        salt,
        4,
        combined ? { read: combined, settings: current.inspirationSettings, vision } : null,
      );
      if (directions.length === 0) return current;
      const next: ProjectState = {
        ...current,
        prompt: trimmed,
        directions,
        selectedDirectionId: directions[0].id,
        anchor: current.anchor,
        shuffle: salt,
        updatedAt: Date.now(),
      };
      return pushEvent(
        next,
        event(
          'prompt',
          combined ? 'Explored with inspiration art' : 'Explored a new prompt',
          trimmed || 'Reference-led exploration',
        ),
      );
    });
  }, []);

  const selectDirection = useCallback((id: string) => {
    setProject((current) => {
      const direction = current.directions.find((item) => item.id === id);
      if (!direction) return current;
      return pushEvent(
        {
          ...current,
          selectedDirectionId: id,
          updatedAt: Date.now(),
        },
        event('select', `Selected ${direction.name}`, direction.manifesto),
      );
    });
  }, []);

  const refine = useCallback((prompt: string) => {
    const trimmed = prompt.trim();
    if (!trimmed) return;
    setProject((current) => {
      const currentDirection = current.directions.find((direction) => direction.id === current.selectedDirectionId);
      if (!currentDirection) return current;
      const parsed = parsePrompt(trimmed, currentDirection.dna, current.lockedTraits, hashString(`${trimmed}|${current.shuffle}`));
      const dna = { ...parsed.dna, name: currentDirection.name };
      const nextDirection: Direction = {
        ...currentDirection,
        dna,
        seed: dna.seed,
        manifesto: makeManifesto(dna, parsed.insight.keywords.length ? parsed.insight.keywords : currentDirection.keywords, parsed.insight.antiGoals.length ? parsed.insight.antiGoals : currentDirection.antiGoals),
        keywords: parsed.insight.keywords.length ? parsed.insight.keywords : currentDirection.keywords,
        antiGoals: parsed.insight.antiGoals.length ? parsed.insight.antiGoals : currentDirection.antiGoals,
        deltas: parsed.insight.summary,
      };
      const next: ProjectState = {
        ...current,
        prompt: trimmed,
        directions: current.directions.map((direction) => (direction.id === nextDirection.id ? nextDirection : direction)),
        updatedAt: Date.now(),
      };
      return pushEvent(
        next,
        event('refine', `Refined ${nextDirection.name}`, parsed.insight.summary.join(' '), {
          previousDNA: currentDirection.dna,
          prompt: trimmed,
        }),
      );
    });
  }, []);

  const updateDNA = useCallback((patch: DNAPatch) => {
    setProject((current) => {
      const currentDirection = current.directions.find((direction) => direction.id === current.selectedDirectionId);
      if (!currentDirection) return current;
      const merged: StyleDNA = {
        ...currentDirection.dna,
        ...patch,
        paletteParams: patch.paletteParams
          ? { ...currentDirection.dna.paletteParams, ...patch.paletteParams }
          : currentDirection.dna.paletteParams,
        name: currentDirection.name,
      };
      const dna = refreshDNA(merged);
      const nextDirection: Direction = {
        ...currentDirection,
        dna,
        manifesto: makeManifesto(dna, currentDirection.keywords, currentDirection.antiGoals),
      };
      return {
        ...current,
        directions: current.directions.map((direction) => (direction.id === nextDirection.id ? nextDirection : direction)),
        updatedAt: Date.now(),
      };
    });
  }, []);

  const toggleLock = useCallback((trait: TraitKey) => {
    setProject((current) => {
      const locked = current.lockedTraits.includes(trait);
      const lockedTraits = locked
        ? current.lockedTraits.filter((item) => item !== trait)
        : [...current.lockedTraits, trait];
      return pushEvent(
        { ...current, lockedTraits, updatedAt: Date.now() },
        event('lock', `${locked ? 'Unlocked' : 'Locked'} ${trait}`, locked ? 'Prompt changes can move this trait again.' : 'Future prompts will preserve this trait.'),
      );
    });
  }, []);

  const reroll = useCallback(() => {
    setProject((current) => {
      const currentDirection = current.directions.find((direction) => direction.id === current.selectedDirectionId);
      if (!currentDirection) return current;
      const dna = mutateDNA(currentDirection.dna, hashString(`reroll-${Date.now()}-${currentDirection.seed}`), 0.55);
      const nextDirection: Direction = {
        ...currentDirection,
        seed: dna.seed,
        dna: { ...dna, name: generateDirectionName(dna.seed, currentDirection.keywords, current.shuffle % 7) },
        name: generateDirectionName(dna.seed, currentDirection.keywords, current.shuffle % 7),
      };
      return pushEvent(
        {
          ...current,
          directions: current.directions.map((direction) => (direction.id === nextDirection.id ? nextDirection : direction)),
          shuffle: hashString(`shuffle-${Date.now()}`),
          updatedAt: Date.now(),
        },
        event('select', 'Rerolled the direction', nextDirection.name),
      );
    });
  }, []);

  const lockAnchor = useCallback((kind: AssetKind, seed: number): Anchor | null => {
    const currentDirection = project.directions.find((direction) => direction.id === project.selectedDirectionId);
    if (!currentDirection) return null;
    const buffer = renderAsset(kind, currentDirection.dna, seed, { stage: 'final', phase: 0.15 });
    const signature = computeSignature(buffer, currentDirection.dna.palette.outline);
    const anchorName = `The ${currentDirection.name.split(' ')[0]} ${ASSET_LABELS[kind]}`;
    const anchor: Anchor = {
      id: `anchor_${Date.now().toString(36)}`,
      name: anchorName,
      directionId: currentDirection.id,
      directionName: currentDirection.name,
      kind,
      seed,
      dna: currentDirection.dna,
      signature,
      createdAt: Date.now(),
      frames: 4,
    };
    setProject((current) =>
      pushEvent(
        {
          ...current,
          anchor,
          tests: [],
          updatedAt: Date.now(),
        },
        event('anchor', `North Star locked: ${anchor.name}`, `${ASSET_LABELS[kind]} / seed ${seed} / Style DNA v1`, {
          anchorId: anchor.id,
          anchor,
          previousAnchor: current.anchor,
        }),
      ),
    );
    return anchor;
  }, [project.directions, project.selectedDirectionId]);

  const testFit = useCallback((kind: AssetKind, drift: boolean, seedOverride?: number): FitResult | null => {
    if (!project.anchor) return null;
    const seed = seedOverride ?? hashString(`${kind}|${drift ? 'drift' : 'fit'}|${Date.now()}`);
    const dna = drift ? driftDNA(project.anchor.dna, seed) : project.anchor.dna;
    const buffer = renderAsset(kind, dna, seed, { stage: 'final', phase: 0.15 });
    const candidate = computeSignature(buffer, dna.palette.outline);
    const result = compareSignatures(project.anchor.signature, candidate);
    result.drift = drift;
    const test: FitTest = {
      id: `test_${Date.now().toString(36)}`,
      kind,
      seed,
      score: result.score,
      drift,
      createdAt: Date.now(),
    };
    setProject((current) =>
      pushEvent(
        { ...current, tests: [test, ...current.tests].slice(0, 40), updatedAt: Date.now() },
        event('test', `${drift ? 'Drift test' : 'Style fit test'}: ${ASSET_LABELS[kind]}`, `Score ${result.score}/100`, { test, subscores: result.subscores }),
      ),
    );
    return result;
  }, [project.anchor]);

  const editAnchor = useCallback(() => {
    setProject((current) => pushEvent({ ...current, updatedAt: Date.now() }, event('anchor', 'Reopened the North Star', 'The anchor can be re-finalized with a new seed or direction.')));
  }, []);

  const newSession = useCallback(() => {
    setProject(createEmptyProject());
  }, []);

  const resetDemo = useCallback(() => {
    setProject(createInitialProject());
  }, []);

  const renameProject = useCallback((name: string) => {
    setProject((current) => ({ ...current, name, updatedAt: Date.now() }));
  }, []);

  const importProject = useCallback((incoming: ProjectState) => {
    if (incoming?.version === 1 && Array.isArray(incoming.directions)) {
      setProject(normalizeProject(incoming));
    }
  }, []);

  const setSelectedDirection = useCallback((id: string | null) => {
    setProject((current) => ({ ...current, selectedDirectionId: id, updatedAt: Date.now() }));
  }, []);

  const logEvent = useCallback((type: JourneyEventType, label: string, detail?: string) => {
    setProject((current) => pushEvent(current, event(type, label, detail)));
  }, []);

  const addInspiration = useCallback((asset: InspirationAsset) => {
    setProject((current) => {
      if (current.inspirations.some((item) => item.id === asset.id)) return current;
      const inspirations = [...current.inspirations, asset].slice(0, 4);
      const primaryInspirationId = current.primaryInspirationId ?? asset.id;
      return pushEvent(
        { ...current, inspirations, primaryInspirationId, updatedAt: Date.now() },
        event('inspiration', `Added reference: ${asset.name}`, `${asset.width}×${asset.height} / ${asset.read.keywords.slice(0, 3).join(', ')}`),
      );
    });
  }, []);

  const removeInspiration = useCallback((id: string) => {
    setProject((current) => {
      const inspirations = current.inspirations.filter((item) => item.id !== id);
      const primaryInspirationId = current.primaryInspirationId === id
        ? inspirations[0]?.id ?? null
        : current.primaryInspirationId;
      return pushEvent(
        { ...current, inspirations, primaryInspirationId, updatedAt: Date.now() },
        event('inspiration', 'Removed a reference image'),
      );
    });
  }, []);

  const clearInspirations = useCallback(() => {
    setProject((current) => pushEvent(
      { ...current, inspirations: [], primaryInspirationId: null, inspirationVision: null, updatedAt: Date.now() },
      event('inspiration', 'Cleared inspiration references'),
    ));
  }, []);

  const setPrimaryInspiration = useCallback((id: string) => {
    setProject((current) => {
      if (!current.inspirations.some((item) => item.id === id)) return current;
      return pushEvent(
        { ...current, primaryInspirationId: id, updatedAt: Date.now() },
        event('inspiration', 'Changed the primary reference', current.inspirations.find((item) => item.id === id)?.name),
      );
    });
  }, []);

  const updateInspiration = useCallback((id: string, patch: Partial<Pick<InspirationAsset, 'weight'>>) => {
    setProject((current) => ({
      ...current,
      inspirations: current.inspirations.map((item) => (item.id === id ? { ...item, ...patch } : item)),
      updatedAt: Date.now(),
    }));
  }, []);

  const updateInspirationSettings = useCallback((patch: Partial<InspirationSettings>) => {
    setProject((current) => ({
      ...current,
      inspirationSettings: {
        ...current.inspirationSettings,
        ...patch,
        features: patch.features
          ? { ...current.inspirationSettings.features, ...patch.features }
          : current.inspirationSettings.features,
      },
      updatedAt: Date.now(),
    }));
  }, []);

  const setInspirationVision = useCallback((vision: VisionRead | null) => {
    setProject((current) => pushEvent(
      { ...current, inspirationVision: vision, updatedAt: Date.now() },
      event(
        'inspiration',
        vision ? (vision.accepted ? 'Applied the AI voice read' : 'Read inspiration with vision AI') : 'Discarded the AI voice read',
        vision?.mood,
      ),
    ));
  }, []);

  return {
    project,
    selected,
    explore,
    selectDirection,
    refine,
    updateDNA,
    toggleLock,
    reroll,
    lockAnchor,
    testFit,
    editAnchor,
    newSession,
    resetDemo,
    renameProject,
    importProject,
    setSelectedDirection,
    logEvent,
    addInspiration,
    removeInspiration,
    clearInspirations,
    setPrimaryInspiration,
    updateInspiration,
    updateInspirationSettings,
    setInspirationVision,
  };
}

export function createDirectionFromPrompt(prompt: string, seed: number): Direction {
  const dna = createDNA(seed, prompt);
  return {
    id: `dir_${seed.toString(36)}`,
    name: generateDirectionName(seed, ['weird']),
    seed,
    dna,
    manifesto: makeManifesto(dna, [], []),
    keywords: [],
    antiGoals: [],
    deltas: [],
    createdAt: Date.now(),
  };
}
