import type { Direction } from '../types';
import { PROBE_KINDS } from '../types';
import { probeSeed } from '../lib/render';
import { AxisBar } from './AxisBar';
import { Icon } from './Icon';
import { SpriteCanvas } from './SpriteCanvas';

interface DirectionCardProps {
  direction: Direction;
  index: number;
  selected: boolean;
  onSelect: () => void;
}

export function DirectionCard({ direction, index, selected, onSelect }: DirectionCardProps) {
  const swatches = Object.values(direction.dna.palette.ramps).map((ramp) => ramp[2]);
  return (
    <article className={`direction-card ${selected ? 'is-selected' : ''}`}>
      <header className="direction-card__header">
        <div className="direction-card__index">0{index + 1}</div>
        <div className="direction-card__title">
          <h3>{direction.name}</h3>
          <span>{direction.keywords.slice(0, 3).join(' / ') || 'open direction'}</span>
        </div>
        {selected && <span className="pill pill--accent">Selected</span>}
      </header>

      <p className="direction-card__manifesto">{direction.manifesto}</p>

      <div className="direction-card__probes">
        {PROBE_KINDS.map((kind) => (
          <figure key={kind} className="probe">
            <div className="probe__art">
              <SpriteCanvas kind={kind} dna={direction.dna} seed={probeSeed(kind)} scale={0.95} />
            </div>
            <figcaption>{kind}</figcaption>
          </figure>
        ))}
      </div>

      <div className="direction-card__swatches" aria-label="Direction palette">
        {swatches.map((color, swatchIndex) => (
          <span key={`${color}-${swatchIndex}`} style={{ background: color }} />
        ))}
      </div>

      <div className="direction-card__axes">
        <AxisBar label="Grounded" value={direction.dna.voice.grounded} compact />
        <AxisBar label="Ornate" value={direction.dna.voice.ornate} compact />
        <AxisBar label="Gritty" value={direction.dna.voice.gritty} compact />
        <AxisBar label="Springy" value={direction.dna.voice.springy} compact />
      </div>

      <div className="direction-card__footer">
        <div className="direction-card__seed">SEED {direction.seed.toString(16).toUpperCase()}</div>
        <button type="button" className={`select-button ${selected ? 'is-selected' : ''}`} onClick={onSelect}>
          {selected ? (
            <>
              <Icon name="check" size={13} /> In the studio
            </>
          ) : (
            <>
              Select direction <Icon name="arrow" size={13} />
            </>
          )}
        </button>
      </div>
    </article>
  );
}
