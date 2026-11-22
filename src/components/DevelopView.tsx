import { useMemo, useState } from 'react';
import type { AssetKind, Direction, Stage } from '../types';
import { ASSET_LABELS } from '../types';
import { hashString } from '../lib/rng';
import { probeSeed } from '../lib/render';
import { Icon } from './Icon';
import { MotionPlayer } from './MotionPlayer';
import { SpriteCanvas } from './SpriteCanvas';

interface DevelopViewProps {
  direction: Direction;
  onLock: (kind: AssetKind, seed: number) => void;
  onBack: () => void;
}

const KINDS: AssetKind[] = ['character', 'enemy', 'tree', 'stone', 'building', 'crystal', 'object', 'terrain'];
const STAGES: Array<{ key: Stage; label: string; note: string }> = [
  { key: 'sketch', label: 'Sketch', note: 'silhouette + massing' },
  { key: 'refine', label: 'Refine', note: 'materials + light' },
  { key: 'final', label: 'Final', note: 'polish + outline' },
];

export function DevelopView({ direction, onLock, onBack }: DevelopViewProps) {
  const [kind, setKind] = useState<AssetKind>('character');
  const [variant, setVariant] = useState(0);
  const [stage, setStage] = useState<Stage>('final');
  const [guides, setGuides] = useState(false);

  const seeds = useMemo(
    () => Array.from({ length: 4 }, (_, index) => hashString(`${direction.id}|${kind}|${index}|anchor`)),
    [direction.id, kind],
  );
  const seed = seeds[variant];
  const subjectSeed = probeSeed(kind);

  return (
    <div className="develop">
      <header className="view-header">
        <div>
          <button type="button" className="back-link" onClick={onBack}>
            <span>←</span> Style lab
          </button>
          <div className="eyebrow">02 / North Star</div>
          <h1>Develop the anchor.</h1>
          <p>
            One asset carries the voice into everything else. Choose the subject that best reveals the
            direction, then push it through sketch, refine, and final.
          </p>
        </div>
        <div className="view-header__side">
          <span className="pill">{direction.name}</span>
          <span className="muted">PRIMARY VIEW / SE / 1 OF 1</span>
        </div>
      </header>

      <div className="develop__grid">
        <section className="artboard-panel">
          <div className="artboard-panel__top">
            <div className="stage-tabs">
              {STAGES.map((item) => (
                <button
                  key={item.key}
                  type="button"
                  className={stage === item.key ? 'is-active' : ''}
                  onClick={() => setStage(item.key)}
                >
                  <strong>{item.label}</strong>
                  <span>{item.note}</span>
                </button>
              ))}
            </div>
            <div className="artboard-panel__tools">
              <button
                type="button"
                className={`guide-toggle ${guides ? 'is-on' : ''}`}
                onClick={() => setGuides((value) => !value)}
                title="Toggle golden-ratio composition guides"
              >
                φ
              </button>
              <span className="artboard-panel__view">SE</span>
            </div>
          </div>

          <div className="artboard">
            <div className="artboard__grid" aria-hidden="true" />
            {guides && (
              <div className="artboard__phi" aria-hidden="true">
                <i className="v" style={{ left: '38.2%' }} />
                <i className="v" style={{ left: '61.8%' }} />
                <i className="h" style={{ top: '38.2%' }} />
                <i className="h" style={{ top: '61.8%' }} />
                <b>φ</b>
              </div>
            )}
            <SpriteCanvas
              kind={kind}
              dna={direction.dna}
              seed={seed}
              stage={stage}
              scale={3.1}
              className="artboard__sprite"
            />
            <div className="artboard__caption">
              <span>{ASSET_LABELS[kind]}</span>
              <span>
                {STAGES.find((item) => item.key === stage)?.label} / seed {seed}
              </span>
            </div>
          </div>

          <div className="artifact-strip">
            <div>
              <span className="eyebrow">Variant</span>
              <div className="variant-grid">
                {seeds.map((variantSeed, index) => (
                  <button
                    key={variantSeed}
                    type="button"
                    className={`variant ${variant === index ? 'is-active' : ''}`}
                    onClick={() => setVariant(index)}
                    aria-label={`Choose variant ${index + 1}`}
                  >
                    <SpriteCanvas kind={kind} dna={direction.dna} seed={variantSeed} scale={0.92} />
                    <span>0{index + 1}</span>
                  </button>
                ))}
              </div>
            </div>
            <div className="motion-card">
              <div className="motion-card__head">
                <span className="eyebrow">Motion study</span>
                <span className="muted">4 frames / 6 fps</span>
              </div>
              <MotionPlayer kind={kind} dna={direction.dna} seed={seed} scale={1.2} autoPlay />
            </div>
          </div>
        </section>

        <aside className="develop__side">
          <section className="side-card">
            <div className="section-heading">
              <span>Choose a subject</span>
              <span className="muted">anything can anchor</span>
            </div>
            <div className="kind-grid">
              {KINDS.map((item) => (
                <button
                  key={item}
                  type="button"
                  className={`kind ${kind === item ? 'is-active' : ''}`}
                  onClick={() => {
                    setKind(item);
                    setVariant(0);
                  }}
                >
                  <SpriteCanvas kind={item} dna={direction.dna} seed={probeSeed(item)} scale={0.62} />
                  <span>{ASSET_LABELS[item]}</span>
                  {kind === item && <Icon name="check" size={12} />}
                </button>
              ))}
            </div>
            <p className="side-card__note">
              A character tests the most pipes — silhouette, materials, rig, and motion. A landmark or tree
              can carry the voice just as well.
            </p>
          </section>

          <section className="side-card">
            <div className="section-heading">
              <span>Anchor check</span>
              <span className="muted">gate to lock</span>
            </div>
            <ul className="check-list">
              <li>
                <Icon name="check" size={12} /> Primary isometric view selected
              </li>
              <li>
                <Icon name="check" size={12} /> Style DNA applied from {direction.name}
              </li>
              <li>
                <Icon name="check" size={12} /> Motion study attached
              </li>
              <li>
                <Icon name="check" size={12} /> Creation journey recorded
              </li>
            </ul>
            <div className="callout">
              <Icon name="sparkle" size={15} />
              <p>
                Locking computes the Style Signature. From that moment, every new asset is scored against
                this anchor.
              </p>
            </div>
            <button
              type="button"
              className="button button--primary button--wide"
              onClick={() => onLock(kind, seed)}
            >
              Lock as North Star <Icon name="arrow" size={15} />
            </button>
          </section>

          <section className="side-card side-card--quiet">
            <div className="section-heading">
              <span>View plan</span>
              <span className="muted">later</span>
            </div>
            <div className="view-plan">
              <span className="view-plan__item is-on">SE</span>
              <span className="view-plan__item">SW</span>
              <span className="view-plan__item">NE</span>
              <span className="view-plan__item">NW</span>
            </div>
            <p className="side-card__note">
              The anchor starts with one view. Once locked, the other isometric views and animation suite can
              be developed from the same rig.
            </p>
          </section>
        </aside>
      </div>
    </div>
  );
}
