"use client";

import { useState } from "react";
import {
  BODY_PLAN_LABELS,
  HAIR_STYLES,
  OUTFITS,
  PALETTE_ROLES,
  PATTERNS,
  ROLE_LABELS,
  WEAPONS,
  paletteArray,
  type BodyPlan,
  type CharacterDoc,
  type Transform,
} from "@/lib/types";
import { useStudio } from "@/store/studio";

function currentAnimation(stateDoc: CharacterDoc | null) {
  if (!stateDoc) return null;
  return (
    stateDoc.animations.find(
      (animation) => animation.id === stateDoc.currentAnimationId,
    ) ??
    stateDoc.animations[0] ??
    null
  );
}

function RangeRow({
  label,
  value,
  min,
  max,
  step,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (value: number) => void;
}) {
  return (
    <label className="range-row">
      <span>{label}</span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
      />
      <output>{Number(value.toFixed(2))}</output>
    </label>
  );
}

function FieldColor({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="field-color">
      <input type="color" value={value} onChange={(event) => onChange(event.target.value)} />
      <span>{label}</span>
    </label>
  );
}

const HUMANOID_PRESETS = [
  {
    name: "Goblin",
    build: { height: 0.94, width: 0.92, head: 1.16, torso: 0.95, arms: 0.92, legs: 0.96 },
    features: { ears: 2, hairStyle: "short" as const, outfit: "leather" as const },
  },
  {
    name: "Brute",
    build: { height: 1.08, width: 1.3, head: 0.9, torso: 1.26, arms: 1.24, legs: 0.9 },
    features: { horns: 2, hairStyle: "bald" as const, outfit: "armor" as const },
  },
  {
    name: "Imp",
    build: { height: 0.78, width: 0.86, head: 1.3, torso: 0.88, arms: 0.9, legs: 0.75 },
    features: { horns: 2, tail: 2, hairStyle: "mohawk" as const, outfit: "none" as const },
  },
  {
    name: "Skeleton",
    build: { height: 1.02, width: 0.78, head: 0.96, torso: 0.88, arms: 0.86, legs: 1.08 },
    features: { hairStyle: "bald" as const, outfit: "rags" as const },
  },
];

export function PartPanel() {
  const doc = useStudio((state) => state.doc);
  const selectedPartId = useStudio((state) => state.selectedPartId);
  const selectPart = useStudio((state) => state.selectPart);
  const togglePartVisible = useStudio((state) => state.togglePartVisible);
  const updatePartTransform = useStudio((state) => state.updatePartTransform);
  const resetPartTransform = useStudio((state) => state.resetPartTransform);
  const detachPart = useStudio((state) => state.detachPart);
  const attachPart = useStudio((state) => state.attachPart);
  const explodeParts = useStudio((state) => state.explodeParts);
  const assembleParts = useStudio((state) => state.assembleParts);
  const updateFrameTransform = useStudio((state) => state.updateFrameTransform);
  const deletePart = useStudio((state) => state.deletePart);
  const framePaint = useStudio((state) => state.framePaint);
  const clearFramePartPixels = useStudio((state) => state.clearFramePartPixels);
  const frameIndex = useStudio((state) => state.frameIndex);
  const [poseMode, setPoseMode] = useState(true);

  const animation = currentAnimation(doc);
  const frame = animation?.frames[frameIndex] ?? null;

  if (!doc) return null;
  const usePose = Boolean(animation) && poseMode;
  const part = doc.parts.find((entry) => entry.id === selectedPartId) ?? null;
  const parts = [...doc.parts].sort((a, b) => b.z - a.z);
  const delta = part && frame ? frame.transforms[part.id] ?? {} : {};
  const transform = part
    ? usePose
      ? {
          x: delta.x ?? 0,
          y: delta.y ?? 0,
          scale: delta.scale ?? 1,
          rotation: delta.rotation ?? 0,
          opacity: delta.opacity ?? 1,
        }
      : part.transform
    : null;

  function changeTransform(patch: Partial<Transform>) {
    if (!part) return;
    if (usePose && frame) {
      updateFrameTransform(part.id, patch);
    } else {
      updatePartTransform(part.id, patch);
    }
  }

  return (
    <section className="panel-section">
      <div className="panel-heading">
        <div>
          <div className="eyebrow">Parts</div>
          <h2>Rig</h2>
        </div>
        <span className="panel-count">{doc.parts.length}</span>
      </div>

      <div className="panel-row workbench-actions">
        <button type="button" className="mini-toggle" onClick={explodeParts}>
          Explode all
        </button>
        <button type="button" className="mini-toggle" onClick={assembleParts}>
          Assemble all
        </button>
      </div>

      <div className="part-list">
        {parts.map((entry) => (
          <div
            key={entry.id}
            className={`part-row${entry.id === selectedPartId ? " selected" : ""}`}
          >
            <button
              type="button"
              className="part-select"
              onClick={() => selectPart(entry.id)}
            >
              <span className={`part-swatch part-swatch-${entry.kind}`} />
              <span>
                <strong>{entry.name}</strong>
                <small>
                  {entry.kind === "imported" ? "imported" : "generated"} · z
                  {entry.z}
                </small>
              </span>
            </button>
            <div className="part-row-actions">
              <button
                type="button"
                className="part-icon"
                onClick={() => togglePartVisible(entry.id)}
                aria-label={entry.visible ? "Hide part" : "Show part"}
              >
                {entry.visible ? "◉" : "○"}
              </button>
              {entry.kind === "imported" ? (
                <button
                  type="button"
                  className="part-icon"
                  onClick={() => deletePart(entry.id)}
                  aria-label="Delete part"
                >
                  ×
                </button>
              ) : null}
            </div>
          </div>
        ))}
      </div>

      {part && transform ? (
        <div className="part-transform">
          <div className="panel-subhead">
            <strong>{part.name}</strong>
            {animation ? (
              <label className="check-label compact">
                <input
                  type="checkbox"
                  checked={poseMode}
                  onChange={(event) => setPoseMode(event.target.checked)}
                />
                Frame pose
              </label>
            ) : null}
          </div>
          <RangeRow
            label="X"
            value={transform.x}
            min={-32}
            max={32}
            step={1}
            onChange={(value) => changeTransform({ x: value })}
          />
          <RangeRow
            label="Y"
            value={transform.y}
            min={-32}
            max={32}
            step={1}
            onChange={(value) => changeTransform({ y: value })}
          />
          <RangeRow
            label="Scale"
            value={transform.scale}
            min={0.5}
            max={2}
            step={0.05}
            onChange={(value) => changeTransform({ scale: value })}
          />
          <RangeRow
            label="Rotate"
            value={transform.rotation}
            min={-180}
            max={180}
            step={1}
            onChange={(value) => changeTransform({ rotation: value })}
          />
          <RangeRow
            label="Opacity"
            value={transform.opacity}
            min={0}
            max={1}
            step={0.05}
            onChange={(value) => changeTransform({ opacity: value })}
          />
          <div className="panel-row">
            <span className="panel-note">
              pivot {Math.round(part.pivot.x)}, {Math.round(part.pivot.y)}
            </span>
            <button
              type="button"
              className="mini-toggle"
              onClick={() => {
                if (usePose && frame) {
                  updateFrameTransform(part.id, {
                    x: 0,
                    y: 0,
                    scale: 1,
                    rotation: 0,
                    opacity: 1,
                  });
                } else {
                  resetPartTransform(part.id);
                }
              }}
            >
              {usePose ? "Zero pose" : "Snap to joint"}
            </button>
          </div>
          <div className="panel-row">
            <button type="button" className="mini-toggle" onClick={() => detachPart(part.id)}>
              Detach
            </button>
            <button type="button" className="mini-toggle" onClick={() => attachPart(part.id)}>
              Attach
            </button>
            {framePaint && (
              <button
                type="button"
                className="mini-toggle"
                onClick={() => clearFramePartPixels(part.id)}
              >
                Clear frame paint
              </button>
            )}
          </div>
        </div>
      ) : (
        <p className="panel-note">Select a part to transform it.</p>
      )}
    </section>
  );
}

export function PalettePanel() {
  const doc = useStudio((state) => state.doc);
  const colorIndex = useStudio((state) => state.colorIndex);
  const setColorIndex = useStudio((state) => state.setColorIndex);
  const setPaletteColorAtIndex = useStudio((state) => state.setPaletteColorAtIndex);
  const addPaletteColor = useStudio((state) => state.addPaletteColor);
  const removePaletteColor = useStudio((state) => state.removePaletteColor);

  if (!doc) return null;
  const colors = paletteArray(doc.spec.palette);
  const extras = doc.spec.palette.extra ?? [];

  return (
    <section className="panel-section">
      <div className="panel-heading">
        <div>
          <div className="eyebrow">Palette</div>
          <h2>Color</h2>
        </div>
        <span className="panel-count">{colors.length}</span>
      </div>
      <div className="palette-grid">
        {PALETTE_ROLES.map((role, index) => (
          <label
            key={role}
            className={`palette-edit${index === colorIndex ? " selected" : ""}`}
            title={ROLE_LABELS[role]}
          >
            <input
              type="color"
              value={colors[index]}
              onChange={(event) =>
                setPaletteColorAtIndex(index, event.target.value)
              }
              onClick={() => setColorIndex(index)}
            />
            <span>{ROLE_LABELS[role]}</span>
          </label>
        ))}
      </div>

      <div className="panel-subhead palette-subhead">
        <strong>Custom colors</strong>
        <span className="panel-note">{extras.length}/32</span>
      </div>
      <div className="palette-grid palette-extra-grid">
        {extras.map((color, extraIndex) => {
          const index = PALETTE_ROLES.length + extraIndex;
          return (
            <div
              key={`${index}-${color}`}
              className={`palette-edit palette-edit-extra${index === colorIndex ? " selected" : ""}`}
              title={`Custom color ${extraIndex + 1}`}
            >
              <input
                type="color"
                value={color}
                onChange={(event) => setPaletteColorAtIndex(index, event.target.value)}
                onClick={() => setColorIndex(index)}
              />
              <button
                type="button"
                onClick={() => removePaletteColor(index)}
                aria-label={`Remove custom color ${extraIndex + 1}`}
                title="Remove unused custom color"
              >
                ×
              </button>
            </div>
          );
        })}
        {extras.length < 32 && (
          <button type="button" className="palette-add" onClick={() => addPaletteColor()}>
            + color
          </button>
        )}
      </div>

      <p className="panel-note">
        Active swatch <strong>index {colorIndex}</strong>. Click a swatch to draw
        with it, then edit the color. Used custom colors cannot be removed until
        their pixels are recolored.
      </p>
    </section>
  );
}

export function SpecPanel({ onOpenImport }: { onOpenImport: () => void }) {
  const doc = useStudio((state) => state.doc);
  const updateSpec = useStudio((state) => state.updateSpec);
  const setPaletteColor = useStudio((state) => state.setPaletteColor);
  const setCanvasSize = useStudio((state) => state.setCanvasSize);
  const setReferenceOpacity = useStudio((state) => state.setReferenceOpacity);
  const toggleReference = useStudio((state) => state.toggleReference);
  const [width, setWidth] = useState(doc?.width ?? 64);
  const [height, setHeight] = useState(doc?.height ?? 64);
  const [scaleArt, setScaleArt] = useState(false);

  if (!doc) return null;
  const spec = doc.spec;

  return (
    <section className="panel-section">
      <div className="panel-heading">
        <div>
          <div className="eyebrow">Body plan</div>
          <h2>Shape</h2>
        </div>
        <span className="plan-badge">{BODY_PLAN_LABELS[spec.bodyPlan]}</span>
      </div>

      <div className="field">
        <label htmlFor="body-plan">Creature plan</label>
        <select
          id="body-plan"
          value={spec.bodyPlan}
          onChange={(event) =>
            updateSpec({ bodyPlan: event.target.value as BodyPlan })
          }
        >
          {Object.entries(BODY_PLAN_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </div>

      {spec.bodyPlan === "humanoid" && (
        <div className="body-preset-row">
          {HUMANOID_PRESETS.map((preset) => (
            <button
              key={preset.name}
              type="button"
              className="mini-toggle"
              onClick={() =>
                updateSpec({
                  build: { ...spec.build, ...preset.build },
                  features: { ...spec.features, ...preset.features },
                })
              }
            >
              {preset.name}
            </button>
          ))}
        </div>
      )}

      <div className="field-color-grid">
        <FieldColor
          label="Skin"
          value={spec.palette.skin}
          onChange={(color) => setPaletteColor("skin", color)}
        />
        <FieldColor
          label="Skin shade"
          value={spec.palette.skinShadow}
          onChange={(color) => setPaletteColor("skinShadow", color)}
        />
      </div>

      <div className="spec-sliders">
        <RangeRow
          label="Height"
          value={spec.build.height}
          min={0.65}
          max={1.35}
          step={0.01}
          onChange={(value) =>
            updateSpec({ build: { ...spec.build, height: value } })
          }
        />
        <RangeRow
          label="Width"
          value={spec.build.width}
          min={0.65}
          max={1.35}
          step={0.01}
          onChange={(value) =>
            updateSpec({ build: { ...spec.build, width: value } })
          }
        />
        <RangeRow
          label="Head"
          value={spec.build.head}
          min={0.65}
          max={1.45}
          step={0.01}
          onChange={(value) =>
            updateSpec({ build: { ...spec.build, head: value } })
          }
        />
        <RangeRow
          label="Torso"
          value={spec.build.torso}
          min={0.65}
          max={1.45}
          step={0.01}
          onChange={(value) =>
            updateSpec({ build: { ...spec.build, torso: value } })
          }
        />
        <RangeRow
          label="Arms"
          value={spec.build.arms}
          min={0.6}
          max={1.4}
          step={0.01}
          onChange={(value) =>
            updateSpec({ build: { ...spec.build, arms: value } })
          }
        />
        <RangeRow
          label="Legs"
          value={spec.build.legs}
          min={0.6}
          max={1.4}
          step={0.01}
          onChange={(value) =>
            updateSpec({ build: { ...spec.build, legs: value } })
          }
        />
      </div>

      <div className="form-grid">
        <label className="field">
          <span>Horns</span>
          <select
            value={spec.features.horns}
            onChange={(event) =>
              updateSpec({
                features: { ...spec.features, horns: Number(event.target.value) },
              })
            }
          >
            {[0, 1, 2, 3].map((value) => (
              <option key={value} value={value}>
                {value === 0 ? "None" : value}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>Ears</span>
          <select
            value={spec.features.ears}
            onChange={(event) =>
              updateSpec({
                features: { ...spec.features, ears: Number(event.target.value) },
              })
            }
          >
            {[0, 1, 2, 3].map((value) => (
              <option key={value} value={value}>
                {value === 0 ? "None" : value}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>Eyes</span>
          <select
            value={spec.features.eyes}
            onChange={(event) =>
              updateSpec({
                features: { ...spec.features, eyes: Number(event.target.value) },
              })
            }
          >
            {[1, 2, 3, 4].map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>Mouth</span>
          <select
            value={spec.features.mouth}
            onChange={(event) =>
              updateSpec({
                features: { ...spec.features, mouth: Number(event.target.value) },
              })
            }
          >
            {[0, 1, 2, 3].map((value) => (
              <option key={value} value={value}>
                {value === 0 ? "None" : value}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>Weapon</span>
          <select
            value={spec.features.weapon}
            onChange={(event) =>
              updateSpec({
                features: {
                  ...spec.features,
                  weapon: event.target.value as typeof spec.features.weapon,
                },
              })
            }
          >
            {WEAPONS.map((weapon) => (
              <option key={weapon} value={weapon}>
                {weapon}
              </option>
            ))}
          </select>
        </label>
        {spec.bodyPlan === "humanoid" && (
          <label className="field">
            <span>Hair style</span>
            <select
              value={spec.features.hairStyle}
              onChange={(event) =>
                updateSpec({
                  features: {
                    ...spec.features,
                    hairStyle: event.target.value as typeof spec.features.hairStyle,
                  },
                })
              }
            >
              {HAIR_STYLES.map((style) => (
                <option key={style} value={style}>
                  {style}
                </option>
              ))}
            </select>
          </label>
        )}
        <label className="field">
          <span>Clothing</span>
          <select
            value={spec.features.outfit}
            onChange={(event) =>
              updateSpec({
                features: {
                  ...spec.features,
                  outfit: event.target.value as typeof spec.features.outfit,
                },
              })
            }
          >
            {OUTFITS.map((outfit) => (
              <option key={outfit} value={outfit}>
                {outfit}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>Pattern</span>
          <select
            value={spec.features.pattern}
            onChange={(event) =>
              updateSpec({
                features: {
                  ...spec.features,
                  pattern: event.target.value as typeof spec.features.pattern,
                },
              })
            }
          >
            {PATTERNS.map((pattern) => (
              <option key={pattern} value={pattern}>
                {pattern}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>Tail</span>
          <select
            value={spec.features.tail}
            onChange={(event) =>
              updateSpec({
                features: { ...spec.features, tail: Number(event.target.value) },
              })
            }
          >
            {[0, 1, 2, 3].map((value) => (
              <option key={value} value={value}>
                {value === 0 ? "None" : value}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>Wings</span>
          <select
            value={spec.features.wings}
            onChange={(event) =>
              updateSpec({
                features: { ...spec.features, wings: Number(event.target.value) },
              })
            }
          >
            {[0, 1, 2, 3].map((value) => (
              <option key={value} value={value}>
                {value === 0 ? "None" : value}
              </option>
            ))}
          </select>
        </label>
      </div>

      {spec.bodyPlan === "humanoid" && (
        <div className="field-color-grid">
          <FieldColor
            label="Hair"
            value={spec.palette.primary}
            onChange={(color) => setPaletteColor("primary", color)}
          />
          <FieldColor
            label="Hair shade"
            value={spec.palette.primaryShadow}
            onChange={(color) => setPaletteColor("primaryShadow", color)}
          />
        </div>
      )}

      <div className="field-color-grid">
        <FieldColor
          label="Cloth"
          value={spec.palette.secondary}
          onChange={(color) => setPaletteColor("secondary", color)}
        />
        <FieldColor
          label="Cloth shade"
          value={spec.palette.secondaryShadow}
          onChange={(color) => setPaletteColor("secondaryShadow", color)}
        />
        <FieldColor
          label="Trim"
          value={spec.palette.accent}
          onChange={(color) => setPaletteColor("accent", color)}
        />
        <FieldColor
          label="Metal"
          value={spec.palette.metal}
          onChange={(color) => setPaletteColor("metal", color)}
        />
      </div>

      <div className="canvas-size-row">
        <label className="field">
          <span>Canvas W</span>
          <input
            type="number"
            min={16}
            max={256}
            value={width}
            onChange={(event) => setWidth(Number(event.target.value))}
          />
        </label>
        <label className="field">
          <span>Canvas H</span>
          <input
            type="number"
            min={16}
            max={256}
            value={height}
            onChange={(event) => setHeight(Number(event.target.value))}
          />
        </label>
        <label className="check-label compact">
          <input
            type="checkbox"
            checked={scaleArt}
            onChange={(event) => setScaleArt(event.target.checked)}
          />
          Scale art
        </label>
        <button
          type="button"
          className="mini-toggle"
          onClick={() =>
            setCanvasSize(
              Math.max(16, Math.min(256, width)),
              Math.max(16, Math.min(256, height)),
              scaleArt,
            )
          }
        >
          Resize
        </button>
      </div>

      <div className="reference-panel">
        <div className="panel-subhead">
          <strong>Reference</strong>
          <button type="button" className="mini-toggle" onClick={onOpenImport}>
            {doc.reference ? "Replace PNG" : "Import PNG"}
          </button>
        </div>
        {doc.reference ? (
          <>
            <div className="reference-preview">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={doc.reference.dataUrl} alt="" />
              <div>
                <strong>{doc.reference.name}</strong>
                <small>{doc.reference.bodyPlan ?? "plan not set"}</small>
              </div>
            </div>
            <RangeRow
              label="Opacity"
              value={doc.reference.opacity}
              min={0}
              max={1}
              step={0.05}
              onChange={setReferenceOpacity}
            />
            <label className="check-label compact">
              <input
                type="checkbox"
                checked={doc.reference.visible}
                onChange={toggleReference}
              />
              Show reference
            </label>
          </>
        ) : (
          <p className="panel-note">
            Import a full character PNG, then use the slice tools to split it into
            parts.
          </p>
        )}
      </div>
    </section>
  );
}
