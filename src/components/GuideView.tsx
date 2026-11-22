import { useMemo, useState } from 'react';
import type { Anchor, AssetKind, FitResult, ProjectState } from '../types';
import { ASSET_LABELS } from '../types';
import { driftDNA } from '../lib/dna';
import { combineInspirations } from '../lib/inspiration';
import { hashString } from '../lib/rng';
import { renderAsset } from '../lib/render';
import { compareSignatures, computeSignature } from '../lib/signature';
import { AxisBar } from './AxisBar';
import { Icon } from './Icon';
import { MotionPlayer } from './MotionPlayer';
import { SpriteCanvas } from './SpriteCanvas';

interface GuideViewProps {
  project: ProjectState;
  anchor: Anchor;
  onEdit: () => void;
  onTest: (kind: AssetKind, drift: boolean, seed?: number) => FitResult | null;
  onExportBoard: () => void;
  onExportAnchor: () => void;
  onExportMotion: () => void;
  onExportGuide: () => void;
  onExportPack: () => void;
}

const TEST_KINDS: AssetKind[] = ['character', 'enemy', 'tree', 'stone', 'building', 'crystal', 'object', 'terrain'];

interface Preview {
  seed: number;
  dna: Anchor['dna'];
  result: FitResult;
}

function makePreview(anchor: Anchor, kind: AssetKind, drift: boolean, nonce: number): Preview {
  const seed = hashString(`${anchor.id}|${kind}|${drift ? 'drift' : 'fit'}|${nonce}`);
  const dna = drift ? driftDNA(anchor.dna, seed) : anchor.dna;
  const signature = computeSignature(renderAsset(kind, dna, seed, { stage: 'final', phase: 0.15 }), dna.palette.outline);
  const result = compareSignatures(anchor.signature, signature);
  result.drift = drift;
  return { seed, dna, result };
}

function ScoreRing({ value, danger }: { value: number; danger?: boolean }) {
  const angle = Math.max(0, Math.min(100, value)) * 3.6;
  return (
    <div
      className={`score-ring ${danger ? 'score-ring--danger' : ''}`}
      style={{
        background: `conic-gradient(${danger ? '#e59a72' : '#c8ef6b'} ${angle}deg, #20262b ${angle}deg 360deg)`,
      }}
    >
      <div className="score-ring__inner">
        <strong>{value}</strong>
        <span>/100</span>
      </div>
    </div>
  );
}

export function GuideView({
  project,
  anchor,
  onEdit,
  onTest,
  onExportBoard,
  onExportAnchor,
  onExportMotion,
  onExportGuide,
  onExportPack,
}: GuideViewProps) {
  const [kind, setKind] = useState<AssetKind>('building');
  const [nonce, setNonce] = useState(0);
  const [logged, setLogged] = useState(false);

  const fitPreview = useMemo(() => makePreview(anchor, kind, false, nonce), [anchor, kind, nonce]);
  const driftPreview = useMemo(() => makePreview(anchor, kind, true, nonce), [anchor, kind, nonce]);

  const direction = project.directions.find((item) => item.id === anchor.directionId);
  const combined = useMemo(
    () => combineInspirations(project.inspirations, project.primaryInspirationId, project.inspirationSettings),
    [project.inspirations, project.primaryInspirationId, project.inspirationSettings],
  );
  const vision = project.inspirationVision;
  const anchorUsesReference = Boolean(
    direction?.inspiration
    || (anchor.dna.referencePalette?.length && (anchor.dna.paletteFidelity ?? 0) > 0),
  );
  const signature = anchor.signature;
  const metrics = [
    ['Value contrast', signature.stdL / 0.32],
    ['Edge density', signature.edgeDensity],
    ['Detail entropy', signature.detailEntropy],
    ['Silhouette', signature.silhouetteComplexity],
    ['Outline weight', signature.outlineRatio],
    ['Symmetry', signature.symmetry],
  ] as const;

  const runCheck = () => {
    setNonce((value) => value + 1);
    setLogged(false);
    window.setTimeout(() => {
      onTest(kind, false, hashString(`${anchor.id}|${kind}|fit|${nonce + 1}`));
      onTest(kind, true, hashString(`${anchor.id}|${kind}|drift|${nonce + 1}`));
      setLogged(true);
    }, 0);
  };

  return (
    <div className="guide">
      <header className="view-header guide__header">
        <div>
          <div className="eyebrow">03 / Style guide</div>
          <h1>{anchor.name}</h1>
          <p>
            The anchor is locked. Its palette, value structure, silhouette, and motion are now the test every
            new asset has to pass.
          </p>
          <div className="guide__meta">
            <span className="pill">{anchor.directionName}</span>
            <span className="pill pill--quiet">{ASSET_LABELS[anchor.kind]}</span>
            <span className="muted">SEED {anchor.seed} / STYLE DNA v1</span>
          </div>
        </div>
        <div className="view-header__actions">
          <button type="button" className="button button--ghost" onClick={onEdit}>
            <Icon name="refresh" size={14} /> Edit anchor
          </button>
          <button type="button" className="button button--primary" onClick={onExportPack}>
            <Icon name="export" size={14} /> Export style pack
          </button>
        </div>
      </header>

      <div className="guide__top">
        <section className="guide-anchor">
          <div className="guide-anchor__art">
            <div className="artboard__grid" aria-hidden="true" />
            <SpriteCanvas kind={anchor.kind} dna={anchor.dna} seed={anchor.seed} scale={4.1} className="artboard__sprite" />
            <span className="guide-anchor__view">PRIMARY / SE</span>
          </div>
          <div className="guide-anchor__bottom">
            <MotionPlayer kind={anchor.kind} dna={anchor.dna} seed={anchor.seed} scale={1.55} autoPlay />
            <div className="guide-anchor__stats">
              <div>
                <span>PALETTE</span>
                <strong>{anchor.dna.palette.ramps.stone.length * 9 + 1} swatches</strong>
              </div>
              <div>
                <span>DETAIL</span>
                <strong>{Math.round(anchor.dna.detail * 100)}%</strong>
              </div>
              <div>
                <span>OUTLINE</span>
                <strong>{Math.round(anchor.dna.outline * 100)}%</strong>
              </div>
              <div>
                <span>COMPOSITION</span>
                <strong>φ {Math.round((anchor.dna.golden ?? 0.618) * 100)}</strong>
              </div>
            </div>
          </div>
        </section>

        <section className="guide-voice">
          <div className="section-heading">
            <span>Voice</span>
            <span className="muted">locked direction</span>
          </div>
          <p className="guide-voice__manifesto">
            {direction?.manifesto ?? 'A locked visual direction, carried by the North Star asset.'}
          </p>
          <div className="voice-grid voice-grid--wide">
            <AxisBar label="Grounded" value={anchor.dna.voice.grounded} />
            <AxisBar label="Ornate" value={anchor.dna.voice.ornate} />
            <AxisBar label="Brutal" value={anchor.dna.voice.brutal} />
            <AxisBar label="Springy" value={anchor.dna.voice.springy} />
            <AxisBar label="Vivid" value={anchor.dna.voice.vivid} />
            <AxisBar label="Gritty" value={anchor.dna.voice.gritty} />
          </div>
          <div className="guide-voice__tags">
            {(direction?.keywords ?? []).slice(0, 12).map((keyword) => (
              <span key={keyword} className="tag">#{keyword}</span>
            ))}
            {(direction?.keywords.length ?? 0) > 12 && (
              <span className="tag">+{(direction?.keywords.length ?? 0) - 12}</span>
            )}
            {(direction?.antiGoals ?? []).map((goal) => (
              <span key={goal} className="tag tag--warn">no {goal}</span>
            ))}
          </div>
          <div className="rule-grid">
            <div>
              <span className="rule-grid__label">Hold</span>
              <ul>
                <li>Anchor palette and ramp order</li>
                <li>Screen-space light from top-left</li>
                <li>{Math.round(anchor.dna.detail * 100)}% detail budget</li>
                <li>{anchor.dna.weight > 0.6 ? 'Weighted' : 'Light'} motion with follow-through</li>
              </ul>
            </div>
            <div>
              <span className="rule-grid__label rule-grid__label--warn">Avoid</span>
              <ul>
                {(direction?.antiGoals.length ? direction.antiGoals : ['off-palette accents', 'anti-aliasing', 'camera-relative light']).map((goal) => (
                  <li key={goal}>{goal}</li>
                ))}
              </ul>
            </div>
          </div>
        </section>
      </div>

      {combined && anchorUsesReference && (
        <section className="panel influence-panel">
          <div className="section-heading">
            <span>Influences</span>
            <span className="muted">
              {project.inspirations.length} ref{project.inspirations.length === 1 ? '' : 's'} / influence {Math.round(project.inspirationSettings.influence * 100)}% / fidelity {Math.round(project.inspirationSettings.paletteFidelity * 100)}%
            </span>
          </div>
          <div className="influence-layout">
            <div className="influence-refs">
              {project.inspirations.map((asset) => (
                <figure key={asset.id} className={asset.id === project.primaryInspirationId ? 'is-primary' : ''}>
                  <img src={asset.thumbnail} alt={asset.name} />
                  <figcaption>
                    <span>{asset.id === project.primaryInspirationId ? 'PRIMARY' : 'SUPPORT'}</span>
                    <strong>{asset.name}</strong>
                  </figcaption>
                </figure>
              ))}
            </div>
            <div className="influence-read">
              <div className="ref-palette">
                {combined.palette.map((color) => (
                  <span key={color} style={{ background: color }} title={color} />
                ))}
              </div>
              <div className="read-tags">
                {combined.keywords.map((keyword) => (
                  <span key={keyword} className="tag">#{keyword}</span>
                ))}
              </div>
              {project.inspirationSettings.notes && (
                <p className="influence-note">“{project.inspirationSettings.notes}”</p>
              )}
              {vision?.accepted && (
                <div className="influence-ai">
                  <span className="eyebrow">AI voice</span>
                  <strong>{vision.theme}</strong>
                  <p>{vision.mood} {vision.motionDescription}</p>
                </div>
              )}
              {!vision?.accepted && (
                <p className="panel__note">
                  The reference led the selected visual traits; motion and narrative remain prompt-led.
                </p>
              )}
            </div>
          </div>
        </section>
      )}

      <div className="guide__middle">
        <section className="panel palette-panel">
          <div className="section-heading">
            <span>Palette</span>
            <span className="muted">OKLCH ramps / 5 stops</span>
          </div>
          <div className="palette-ramps">
            {Object.entries(anchor.dna.palette.ramps).map(([name, colors]) => (
              <div key={name} className="ramp-row">
                <span className="ramp-row__name">{name}</span>
                <div className="ramp-row__colors">
                  {colors.map((color) => (
                    <span key={color} style={{ background: color }} title={color} />
                  ))}
                </div>
              </div>
            ))}
          </div>
          {anchor.dna.referencePalette && (anchor.dna.paletteFidelity ?? 0) > 0 && (
            <div className="reference-palette-row">
              <span>REFERENCE PALETTE / {Math.round((anchor.dna.paletteFidelity ?? 0) * 100)}%</span>
              <div>
                {anchor.dna.referencePalette.map((color) => (
                  <span key={color} style={{ background: color }} title={color} />
                ))}
              </div>
            </div>
          )}
          <div className="palette-outline">
            <span>OUTLINE</span>
            <span style={{ background: anchor.dna.palette.outline }} />
            <span>{anchor.dna.palette.outline}</span>
          </div>
        </section>

        <section className="panel signature-panel">
          <div className="section-heading">
            <span>Style signature</span>
            <span className="muted">{signature.colorCount} colors / {signature.visiblePixels} px</span>
          </div>
          <div className="signature-metrics">
            {metrics.map(([label, value]) => (
              <AxisBar key={label} label={label} value={value} />
            ))}
          </div>
          <div className="top-colors">
            {signature.topColors.map((color) => (
              <span key={color} style={{ background: color }} title={color} />
            ))}
          </div>
          <p className="panel__note">
            Hue {Math.round(signature.dominantHue)}° · fill {Math.round(signature.fillRatio * 100)}% · symmetry{' '}
            {Math.round(signature.symmetry * 100)}%. These values drive the fit heuristic, not the final taste.
          </p>
        </section>
      </div>

      <section className="panel fit-panel">
        <div className="fit-panel__head">
          <div>
            <div className="section-heading">
              <span>Style fit lab</span>
              <span className="muted">heuristic drift check</span>
            </div>
            <p>
              Generate a contrasting asset with the locked DNA, then compare it to a deliberately drifted
              version. The score is an early warning, not a verdict.
            </p>
          </div>
          <div className="fit-panel__controls">
            <div className="kind-tabs">
              {TEST_KINDS.map((item) => (
                <button
                  key={item}
                  type="button"
                  className={kind === item ? 'is-active' : ''}
                  onClick={() => {
                    setKind(item);
                    setLogged(false);
                  }}
                >
                  {ASSET_LABELS[item]}
                </button>
              ))}
            </div>
            <button type="button" className="button button--ghost" onClick={runCheck}>
              <Icon name="refresh" size={13} /> Run check
            </button>
          </div>
        </div>

        <div className="fit-grid">
          <article className="fit-card">
            <div className="fit-card__art">
              <SpriteCanvas kind={kind} dna={fitPreview.dna} seed={fitPreview.seed} scale={1.6} />
            </div>
            <div className="fit-card__body">
              <span className="eyebrow">On-style</span>
              <h3>{ASSET_LABELS[kind]}</h3>
              <ScoreRing value={fitPreview.result.score} />
              <div className="fit-subscores">
                {(['palette', 'contrast', 'silhouette', 'detail'] as const).map((key) => (
                  <AxisBar key={key} label={key} value={fitPreview.result.subscores[key]} compact />
                ))}
              </div>
            </div>
          </article>

          <article className="fit-card fit-card--drift">
            <div className="fit-card__art">
              <SpriteCanvas kind={kind} dna={driftPreview.dna} seed={driftPreview.seed} scale={1.6} />
            </div>
            <div className="fit-card__body">
              <span className="eyebrow">Deliberate drift</span>
              <h3>{ASSET_LABELS[kind]} / wrong turn</h3>
              <ScoreRing value={driftPreview.result.score} danger />
              <div className="fit-subscores">
                {(['palette', 'contrast', 'silhouette', 'detail'] as const).map((key) => (
                  <AxisBar key={key} label={key} value={driftPreview.result.subscores[key]} compact />
                ))}
              </div>
            </div>
          </article>
        </div>
        <div className="fit-footer">
          <span className={logged ? 'fit-logged is-on' : 'fit-logged'}>
            <Icon name={logged ? 'check' : 'sparkle'} size={13} />
            {logged ? 'Fit checks written to the journey' : 'Preview only — run check to record it'}
          </span>
          <span className="muted">
            ANCHOR {anchor.name.toUpperCase()} · {anchor.seed}
          </span>
        </div>
      </section>

      <section className="panel export-panel">
        <div className="section-heading">
          <span>Export</span>
          <span className="muted">game-ready + archive</span>
        </div>
        <div className="export-grid">
          <button type="button" onClick={onExportPack}>
            <Icon name="export" size={18} />
            <strong>Style pack .zip</strong>
            <span>Anchor, frames, guide, palette, journey, Godot SpriteFrames</span>
          </button>
          <button type="button" onClick={onExportBoard}>
            <Icon name="download" size={18} />
            <strong>Style guide .png</strong>
            <span>Contact sheet for the art bible</span>
          </button>
          <button type="button" onClick={onExportAnchor}>
            <Icon name="download" size={18} />
            <strong>Anchor @4x .png</strong>
            <span>Transparent nearest-neighbour export</span>
          </button>
          <button type="button" onClick={onExportMotion}>
            <Icon name="download" size={18} />
            <strong>Motion sheet .png</strong>
            <span>Four-frame idle strip</span>
          </button>
          <button type="button" onClick={onExportGuide}>
            <Icon name="download" size={18} />
            <strong>Style guide .json</strong>
            <span>DNA, signature, palette, journey</span>
          </button>
        </div>
      </section>

      <footer className="lab__footer">
        <span>ISOFOUNDRY / NORTH STAR LOCKED</span>
        <span>{project.name.toUpperCase()}</span>
        <span>NEXT: VIEW PROMOTION + ANIMATION SUITE</span>
      </footer>
    </div>
  );
}
