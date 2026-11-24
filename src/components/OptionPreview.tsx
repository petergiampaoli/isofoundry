"use client";

import { useEffect, useState } from "react";
import { renderSpecPreview } from "@/lib/render";
import {
  BODY_PLAN_LABELS,
  VIEW_COMPASS,
  VIEW_IDS,
  VIEW_LABELS,
  VIEW_SHORT_LABELS,
  TURNTABLE_LOOP_MS,
  TURNTABLE_VIEW_MS,
  paletteArray,
  type CharacterSpec,
} from "@/lib/types";

export default function OptionPreview({
  spec,
  onSelect,
  compact = false,
}: {
  spec: CharacterSpec;
  onSelect?: () => void;
  compact?: boolean;
}) {
  const [frames, setFrames] = useState<string[]>([]);
  const [frameIndex, setFrameIndex] = useState(0);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setFrames(VIEW_IDS.map((view) => renderSpecPreview(spec, view, 64, 64)));
      setFrameIndex(0);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [spec]);

  useEffect(() => {
    if (frames.length < 2) return;
    const timer = window.setInterval(() => {
      setFrameIndex((value) => (value + 1) % VIEW_IDS.length);
    }, TURNTABLE_VIEW_MS);
    return () => window.clearInterval(timer);
  }, [frames.length]);

  const src = frames[frameIndex] ?? "";

  return (
    <article className={`option-card${compact ? " option-card-compact" : ""}`}>
      <button
        className="option-preview-button"
        type="button"
        onClick={onSelect}
        disabled={!onSelect}
        aria-label={`Choose ${spec.name}`}
      >
        {src ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img className="option-preview" src={src} alt="" />
        ) : (
          <div className="option-preview option-preview-loading" />
        )}
        <span className="option-view-badge">
          {VIEW_SHORT_LABELS[VIEW_IDS[frameIndex]]} · {VIEW_LABELS[VIEW_IDS[frameIndex]]} · {VIEW_COMPASS[VIEW_IDS[frameIndex]]}
        </span>
        <span className="option-view-timer">
          {TURNTABLE_VIEW_MS / 1000}s / view · {TURNTABLE_LOOP_MS / 1000}s loop
        </span>
      </button>
      <div className="option-meta">
        <div className="eyebrow">{BODY_PLAN_LABELS[spec.bodyPlan]}</div>
        <h3>{spec.name}</h3>
        <p>{spec.description || "A new pixel character."}</p>
        <div className="option-view-dots" aria-hidden>
          {VIEW_IDS.map((view, index) => (
            <span
              key={view}
              className={index === frameIndex ? "active" : ""}
              title={VIEW_LABELS[view]}
            />
          ))}
        </div>
        <div className="option-view-strip" aria-label="Four character views">
          {frames.map((frame, index) => (
            <span
              key={VIEW_IDS[index]}
              className={index === frameIndex ? "active" : ""}
              title={`${VIEW_LABELS[VIEW_IDS[index]]} · ${
                TURNTABLE_VIEW_MS / 1000
              }s`}
            >
              {frame ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={frame} alt="" />
              ) : null}
            </span>
          ))}
        </div>
        <div className="palette-strip" aria-label="Palette">
          {paletteArray(spec.palette)
            .slice(0, 8)
            .map((color, index) => (
              <span
                key={`${color}-${index}`}
                className="palette-dot"
                style={{ background: color }}
              />
            ))}
        </div>
        {onSelect ? (
          <button className="button button-accent option-select" type="button" onClick={onSelect}>
            Use this base
          </button>
        ) : null}
      </div>
    </article>
  );
}
