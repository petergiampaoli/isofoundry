"use client";

import { useEffect, useState } from "react";
import { renderFrameToDataUrl } from "@/lib/render";
import type { AnimationFrame, CharacterDoc } from "@/lib/types";
import { useStudio } from "@/store/studio";

function FrameThumb({
  doc,
  frame,
  active,
  index,
  onClick,
}: {
  doc: CharacterDoc;
  frame: AnimationFrame;
  active: boolean;
  index: number;
  onClick: () => void;
}) {
  const [src, setSrc] = useState("");

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setSrc(renderFrameToDataUrl(doc, frame));
    }, 0);
    return () => window.clearTimeout(timer);
  }, [doc, frame]);

  return (
    <button
      type="button"
      className={`frame-thumb${active ? " active" : ""}`}
      onClick={onClick}
      aria-label={`Frame ${index + 1}`}
    >
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt="" />
      ) : (
        <span className="frame-thumb-blank" />
      )}
      <span className="frame-index">{index + 1}</span>
    </button>
  );
}

export default function Timeline({
  onOpenAnimation,
}: {
  onOpenAnimation: () => void;
}) {
  const doc = useStudio((state) => state.doc);
  const frameIndex = useStudio((state) => state.frameIndex);
  const playing = useStudio((state) => state.playing);
  const onionSkin = useStudio((state) => state.onionSkin);
  const framePaint = useStudio((state) => state.framePaint);
  const animating = useStudio((state) => state.animating);
  const setCurrentAnimation = useStudio((state) => state.setCurrentAnimation);
  const setFrameIndex = useStudio((state) => state.setFrameIndex);
  const setPlaying = useStudio((state) => state.setPlaying);
  const setOnionSkin = useStudio((state) => state.setOnionSkin);
  const setFramePaint = useStudio((state) => state.setFramePaint);
  const clearFramePartPixels = useStudio((state) => state.clearFramePartPixels);
  const addFrame = useStudio((state) => state.addFrame);
  const duplicateFrame = useStudio((state) => state.duplicateFrame);
  const deleteFrame = useStudio((state) => state.deleteFrame);
  const updateAnimationMeta = useStudio((state) => state.updateAnimationMeta);

  if (!doc) return null;
  const animation =
    doc.animations.find((entry) => entry.id === doc.currentAnimationId) ??
    doc.animations[0] ??
    null;
  const frame = animation?.frames[frameIndex] ?? null;

  if (!animation) {
    return (
      <section className="timeline timeline-empty">
        <div>
          <div className="eyebrow">Animation</div>
          <h3>No motion yet.</h3>
          <p>Generate a first pass, then edit the frames by hand.</p>
        </div>
        <button
          type="button"
          className="button button-accent"
          onClick={onOpenAnimation}
          disabled={animating}
        >
          {animating ? "Generating…" : "Animate this character"}
        </button>
      </section>
    );
  }

  return (
    <section className="timeline">
      <div className="timeline-head">
        <div className="timeline-animation-picker">
          <span className="eyebrow">Animation</span>
          <select
            value={animation.id}
            onChange={(event) => setCurrentAnimation(event.target.value)}
          >
            {doc.animations.map((entry) => (
              <option key={entry.id} value={entry.id}>
                {entry.name}
              </option>
            ))}
          </select>
        </div>

        <div className="timeline-controls">
          <button
            type="button"
            className="icon-button icon-button-dark"
            onClick={() => setPlaying(!playing)}
            aria-label={playing ? "Pause" : "Play"}
          >
            {playing ? "Ⅱ" : "▶"}
          </button>
          <button
            type="button"
            className="mini-toggle"
            onClick={() => setFrameIndex(Math.max(0, frameIndex - 1))}
          >
            Prev
          </button>
          <button
            type="button"
            className="mini-toggle"
            onClick={() =>
              setFrameIndex(Math.min(animation.frames.length - 1, frameIndex + 1))
            }
          >
            Next
          </button>
        </div>

        <div className="timeline-meta">
          <label>
            FPS
            <input
              type="number"
              min={1}
              max={30}
              value={animation.fps}
              onChange={(event) =>
                updateAnimationMeta({
                  fps: Math.max(1, Math.min(30, Number(event.target.value) || 1)),
                })
              }
            />
          </label>
          <label className="check-label">
            <input
              type="checkbox"
              checked={animation.loop}
              onChange={(event) =>
                updateAnimationMeta({ loop: event.target.checked })
              }
            />
            Loop
          </label>
          <label className="check-label">
            <input
              type="checkbox"
              checked={onionSkin}
              onChange={(event) => setOnionSkin(event.target.checked)}
            />
            Onion
          </label>
          <label className="check-label">
            <input
              type="checkbox"
              checked={framePaint}
              onChange={(event) => setFramePaint(event.target.checked)}
            />
            Paint frame
          </label>
        </div>

        <div className="timeline-actions">
          <button
            type="button"
            className="mini-toggle"
            onClick={() => clearFramePartPixels()}
            disabled={!frame?.pixels || Object.keys(frame.pixels).length === 0}
            title="Clear all pixel overrides on this frame"
          >
            Clear paint
          </button>
          <button type="button" className="mini-toggle" onClick={addFrame}>
            + Frame
          </button>
          <button type="button" className="mini-toggle" onClick={duplicateFrame}>
            Duplicate
          </button>
          <button
            type="button"
            className="mini-toggle"
            onClick={deleteFrame}
            disabled={animation.frames.length <= 1}
          >
            Delete
          </button>
          <button
            type="button"
            className="button button-ghost"
            onClick={onOpenAnimation}
            disabled={animating}
          >
            {animating ? "Generating…" : "New animation"}
          </button>
        </div>
      </div>

      <div className="frame-strip">
        {animation.frames.map((frame, index) => (
          <FrameThumb
            key={frame.id}
            doc={doc}
            frame={frame}
            active={index === frameIndex}
            index={index}
            onClick={() => setFrameIndex(index)}
          />
        ))}
      </div>
    </section>
  );
}
