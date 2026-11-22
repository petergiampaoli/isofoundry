import { memo, useEffect, useMemo, useRef } from 'react';
import type { AssetKind, Stage, StyleDNA } from '../types';
import { renderAsset } from '../lib/render';

interface SpriteCanvasProps {
  kind: AssetKind;
  dna: StyleDNA;
  seed: number;
  stage?: Stage;
  phase?: number;
  scale?: number;
  className?: string;
  title?: string;
}

export const SpriteCanvas = memo(function SpriteCanvas({
  kind,
  dna,
  seed,
  stage = 'final',
  phase = 0,
  scale = 1,
  className,
  title,
}: SpriteCanvasProps) {
  const ref = useRef<HTMLCanvasElement>(null);
  const buffer = useMemo(
    () => renderAsset(kind, dna, seed, { stage, phase }),
    [kind, dna, seed, stage, phase],
  );

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.putImageData(buffer.toImageData(), 0, 0);
  }, [buffer]);

  return (
    <canvas
      ref={ref}
      width={96}
      height={96}
      className={className}
      title={title}
      style={{
        width: 96 * scale,
        height: 96 * scale,
        imageRendering: 'pixelated',
        display: 'block',
      }}
    />
  );
});
