"use client";

import { useEffect, useState } from "react";
import { renderSpecPreview } from "@/lib/render";
import { BODY_PLAN_LABELS, paletteArray, type CharacterSpec } from "@/lib/types";

export default function OptionPreview({
  spec,
  onSelect,
  compact = false,
}: {
  spec: CharacterSpec;
  onSelect?: () => void;
  compact?: boolean;
}) {
  const [src, setSrc] = useState("");

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setSrc(renderSpecPreview(spec, 64, 64));
    }, 0);
    return () => window.clearTimeout(timer);
  }, [spec]);

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
      </button>
      <div className="option-meta">
        <div className="eyebrow">{BODY_PLAN_LABELS[spec.bodyPlan]}</div>
        <h3>{spec.name}</h3>
        <p>{spec.description || "A new pixel character."}</p>
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
