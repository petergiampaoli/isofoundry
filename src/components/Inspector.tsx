import { useEffect, useState } from 'react';
import type { Direction, TraitKey } from '../types';
import { PROMPT_SUGGESTIONS } from '../lib/prompt';
import type { DNAPatch } from '../state/useProject';
import { AxisBar } from './AxisBar';
import { Icon } from './Icon';

interface InspectorProps {
  selected: Direction | null;
  locks: TraitKey[];
  onRefine: (prompt: string) => void;
  onToggleLock: (trait: TraitKey) => void;
  onUpdate: (patch: DNAPatch) => void;
  onDevelop: () => void;
  onReroll: () => void;
}

interface SliderProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  locked?: boolean;
  format?: (value: number) => string;
  onChange: (value: number) => void;
}

function Slider({ label, value, min, max, step = 0.01, locked, format, onChange }: SliderProps) {
  return (
    <label className={`slider ${locked ? 'is-locked' : ''}`}>
      <span className="slider__top">
        <span className="slider__label">
          {label}
          {locked && <Icon name="lock" size={10} />}
        </span>
        <span className="slider__value">{format ? format(value) : Math.round(value * 100)}</span>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
      />
    </label>
  );
}

const LOCK_LABELS: Array<{ key: TraitKey; label: string }> = [
  { key: 'palette', label: 'Palette' },
  { key: 'form', label: 'Form' },
  { key: 'detail', label: 'Detail' },
  { key: 'line', label: 'Line' },
  { key: 'motion', label: 'Motion' },
];

export function Inspector({
  selected,
  locks,
  onRefine,
  onToggleLock,
  onUpdate,
  onDevelop,
  onReroll,
}: InspectorProps) {
  const [refinePrompt, setRefinePrompt] = useState('');

  useEffect(() => {
    setRefinePrompt('');
  }, [selected?.id]);

  if (!selected) {
    return (
      <aside className="inspector inspector--empty">
        <div className="eyebrow">Studio notes</div>
        <h2>No direction selected</h2>
        <p>
          Explore a prompt, then choose one direction to open the live Style DNA. Every slider here is a
          constraint the asset engine will honour.
        </p>
        <div className="note-card">
          <Icon name="sparkle" size={15} />
          <div>
            <strong>Start with a feeling, not a genre.</strong>
            <p>Materials, weight, silhouette, and what to avoid are stronger prompts than “fantasy”.</p>
          </div>
        </div>
      </aside>
    );
  }

  const { dna } = selected;
  const isLocked = (trait: TraitKey) => locks.includes(trait);

  const submitRefine = (event: React.FormEvent) => {
    event.preventDefault();
    if (!refinePrompt.trim()) return;
    onRefine(refinePrompt);
    setRefinePrompt('');
  };

  return (
    <aside className="inspector">
      <div className="inspector__top">
        <div>
          <div className="eyebrow">Live style DNA</div>
          <h2>{selected.name}</h2>
          <p className="inspector__sub">{selected.keywords.slice(0, 4).join(' / ') || 'open direction'}</p>
        </div>
        <button type="button" className="icon-button" onClick={onReroll} title="Reroll this direction">
          <Icon name="refresh" size={15} />
        </button>
      </div>

      <div className="inspector__swatches">
        {Object.values(dna.palette.ramps).map((ramp, index) => (
          <span key={index} style={{ background: ramp[2] }} />
        ))}
      </div>

      <form className="refine" onSubmit={submitRefine}>
        <label htmlFor="refine-prompt">Art-direct this direction</label>
        <div className="refine__row">
          <input
            id="refine-prompt"
            value={refinePrompt}
            onChange={(event) => setRefinePrompt(event.target.value)}
            placeholder="warmer light, rounder forms, heavier motion…"
          />
          <button type="submit" className="refine__submit" title="Apply refinement">
            <Icon name="arrow" size={14} />
          </button>
        </div>
        <div className="suggestions">
          {PROMPT_SUGGESTIONS.slice(0, 3).map((suggestion) => (
            <button key={suggestion} type="button" onClick={() => onRefine(suggestion)}>
              {suggestion}
            </button>
          ))}
        </div>
      </form>

      <section className="lock-section">
        <div className="section-heading">
          <span>Prompt locks</span>
          <span className="muted">{locks.length ? `${locks.length} held` : 'all open'}</span>
        </div>
        <div className="lock-row">
          {LOCK_LABELS.map(({ key, label }) => (
            <button
              key={key}
              type="button"
              className={`lock-chip ${isLocked(key) ? 'is-on' : ''}`}
              onClick={() => onToggleLock(key)}
            >
              <Icon name={isLocked(key) ? 'lock' : 'unlock'} size={10} />
              {label}
            </button>
          ))}
        </div>
      </section>

      <section className="control-group">
        <div className="section-heading">
          <span>Palette</span>
          <span className="muted">{Math.round(dna.paletteParams.chroma * 100)}% chroma</span>
        </div>
        <Slider
          label="Base hue"
          value={dna.paletteParams.hue}
          min={0}
          max={360}
          step={1}
          locked={isLocked('palette')}
          format={(value) => `${Math.round(value)}°`}
          onChange={(value) => onUpdate({ paletteParams: { hue: value } })}
        />
        <Slider
          label="Accent hue"
          value={dna.paletteParams.accentHue}
          min={0}
          max={360}
          step={1}
          locked={isLocked('palette')}
          format={(value) => `${Math.round(value)}°`}
          onChange={(value) => onUpdate({ paletteParams: { accentHue: value } })}
        />
        <Slider
          label="Chroma"
          value={dna.paletteParams.chroma}
          min={0}
          max={1}
          locked={isLocked('palette')}
          format={(value) => `${Math.round(value * 100)}`}
          onChange={(value) => onUpdate({ paletteParams: { chroma: value } })}
        />
        <Slider
          label="Contrast"
          value={dna.paletteParams.contrast}
          min={0.15}
          max={0.95}
          locked={isLocked('palette')}
          format={(value) => `${Math.round(value * 100)}`}
          onChange={(value) => onUpdate({ paletteParams: { contrast: value } })}
        />
        <Slider
          label="Warmth"
          value={dna.paletteParams.warmth}
          min={-1}
          max={1}
          locked={isLocked('palette')}
          format={(value) => `${value > 0 ? '+' : ''}${value.toFixed(2)}`}
          onChange={(value) => onUpdate({ paletteParams: { warmth: value } })}
        />
      </section>

      <section className="control-group">
        <div className="section-heading">
          <span>Form</span>
          <span className="muted">{dna.height > 0.6 ? 'tall' : dna.chunkiness > 0.6 ? 'broad' : 'balanced'}</span>
        </div>
        <Slider
          label="Roundness"
          value={dna.roundness}
          min={0}
          max={1}
          locked={isLocked('form')}
          onChange={(value) => onUpdate({ roundness: value })}
        />
        <Slider
          label="Chunkiness"
          value={dna.chunkiness}
          min={0}
          max={1}
          locked={isLocked('form')}
          onChange={(value) => onUpdate({ chunkiness: value })}
        />
        <Slider
          label="Spikiness"
          value={dna.spikiness}
          min={0}
          max={1}
          locked={isLocked('form')}
          onChange={(value) => onUpdate({ spikiness: value })}
        />
        <Slider
          label="Height"
          value={dna.height}
          min={0}
          max={1}
          locked={isLocked('form')}
          onChange={(value) => onUpdate({ height: value })}
        />
        <Slider
          label="Head scale"
          value={dna.headScale}
          min={0}
          max={1}
          locked={isLocked('form')}
          onChange={(value) => onUpdate({ headScale: value })}
        />
        <Slider
          label="Golden bias"
          value={dna.golden ?? 0.618}
          min={0}
          max={1}
          locked={isLocked('form')}
          format={(value) => `φ ${Math.round(value * 100)}`}
          onChange={(value) => onUpdate({ golden: value })}
        />
      </section>

      <section className="control-group">
        <div className="section-heading">
          <span>Finish</span>
          <span className="muted">{dna.detail > 0.65 ? 'surface history' : 'legible'}</span>
        </div>
        <Slider
          label="Detail"
          value={dna.detail}
          min={0}
          max={1}
          locked={isLocked('detail')}
          onChange={(value) => onUpdate({ detail: value })}
        />
        <Slider
          label="Dither"
          value={dna.dither}
          min={0}
          max={1}
          locked={isLocked('detail')}
          onChange={(value) => onUpdate({ dither: value })}
        />
        <Slider
          label="Outline"
          value={dna.outline}
          min={0}
          max={1}
          locked={isLocked('line')}
          onChange={(value) => onUpdate({ outline: value })}
        />
      </section>

      <section className="control-group">
        <div className="section-heading">
          <span>Motion</span>
          <span className="muted">{dna.weight > 0.62 ? 'weighted' : 'light'}</span>
        </div>
        <Slider
          label="Weight"
          value={dna.weight}
          min={0}
          max={1}
          locked={isLocked('motion')}
          onChange={(value) => onUpdate({ weight: value })}
        />
        <Slider
          label="Bounce"
          value={dna.bounce}
          min={0}
          max={1}
          locked={isLocked('motion')}
          onChange={(value) => onUpdate({ bounce: value })}
        />
        <Slider
          label="Sway"
          value={dna.sway}
          min={0}
          max={1}
          locked={isLocked('motion')}
          onChange={(value) => onUpdate({ sway: value })}
        />
      </section>

      <section className="voice-section">
        <div className="section-heading">
          <span>Voice read</span>
          <span className="muted">derived</span>
        </div>
        <div className="voice-grid">
          <AxisBar label="Grounded" value={dna.voice.grounded} compact />
          <AxisBar label="Ornate" value={dna.voice.ornate} compact />
          <AxisBar label="Brutal" value={dna.voice.brutal} compact />
          <AxisBar label="Springy" value={dna.voice.springy} compact />
          <AxisBar label="Vivid" value={dna.voice.vivid} compact />
          <AxisBar label="Gritty" value={dna.voice.gritty} compact />
        </div>
      </section>

      <div className="inspector__cta">
        <button type="button" className="button button--primary button--wide" onClick={onDevelop}>
          Develop North Star <Icon name="arrow" size={15} />
        </button>
        <span>One asset. One view. The style anchor.</span>
      </div>
    </aside>
  );
}
