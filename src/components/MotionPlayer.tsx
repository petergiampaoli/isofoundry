import { useEffect, useState } from 'react';
import type { AssetKind, StyleDNA } from '../types';
import { Icon } from './Icon';
import { SpriteCanvas } from './SpriteCanvas';

interface MotionPlayerProps {
  kind: AssetKind;
  dna: StyleDNA;
  seed: number;
  scale?: number;
  autoPlay?: boolean;
  compact?: boolean;
}

export function MotionPlayer({ kind, dna, seed, scale = 2, autoPlay = false, compact = false }: MotionPlayerProps) {
  const [frame, setFrame] = useState(0);
  const [playing, setPlaying] = useState(autoPlay);
  const frames = 4;

  useEffect(() => {
    if (!playing) return;
    const timer = window.setInterval(() => setFrame((current) => (current + 1) % frames), 150);
    return () => window.clearInterval(timer);
  }, [playing]);

  return (
    <div className={`motion ${compact ? 'motion--compact' : ''}`}>
      <div className="motion__stage">
        <SpriteCanvas
          kind={kind}
          dna={dna}
          seed={seed}
          phase={frame / frames}
          scale={scale}
          className="motion__sprite"
        />
        {!compact && <span className="motion__frame">0{frame + 1} / 04</span>}
      </div>
      <div className="motion__controls">
        <button
          type="button"
          className="motion__play"
          onClick={() => setPlaying((value) => !value)}
          aria-label={playing ? 'Pause motion study' : 'Play motion study'}
        >
          <Icon name={playing ? 'pause' : 'play'} size={12} />
        </button>
        <div className="motion__ticks" aria-hidden="true">
          {Array.from({ length: frames }, (_, index) => (
            <span key={index} className={index === frame ? 'is-active' : ''} />
          ))}
        </div>
        {!compact && <span className="motion__label">MOTION STUDY / 6 FPS</span>}
      </div>
    </div>
  );
}
