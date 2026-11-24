"use client";

import { useState } from "react";
import { useStudio } from "@/store/studio";

const PRESETS = ["idle", "run", "jump", "attack", "death"];

export default function AnimationModal({ onClose }: { onClose: () => void }) {
  const animating = useStudio((state) => state.animating);
  const generateAnimation = useStudio((state) => state.generateAnimation);
  const warning = useStudio((state) => state.warning);
  const [prompt, setPrompt] = useState("");
  const [preset, setPreset] = useState("idle");

  async function generate() {
    if (animating) return;
    const request = prompt.trim() || `${preset} animation`;
    await generateAnimation(request, preset);
    onClose();
  }

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true">
      <section className="modal animation-modal">
        <header className="modal-head">
          <div>
            <div className="eyebrow">Animation first pass</div>
            <h2>Give it motion.</h2>
            <p>
              The agent blocks out part transforms and timing. Every frame stays
              editable in the timeline.
            </p>
          </div>
          <button
            type="button"
            className="modal-close"
            onClick={onClose}
            aria-label="Close"
          >
            ×
          </button>
        </header>

        <div className="preset-row">
          {PRESETS.map((entry) => (
            <button
              key={entry}
              type="button"
              className={`preset-chip${preset === entry ? " active" : ""}`}
              onClick={() => setPreset(entry)}
            >
              {entry}
            </button>
          ))}
        </div>

        <div className="field">
          <label htmlFor="animation-prompt">Direction prompt</label>
          <textarea
            id="animation-prompt"
            rows={4}
            value={prompt}
            onChange={(event) => setPrompt(event.target.value)}
            placeholder="A heavy six-frame overhead cleaver attack with a long windup and a two-frame impact hold."
          />
        </div>

        {warning ? <div className="inline-warning">{warning}</div> : null}

        <div className="modal-actions">
          <div className="panel-note">
            Preset: <strong>{preset}</strong>. The agent may adjust timing and
            amplitude to fit the character.
          </div>
          <div className="modal-action-buttons">
            <button type="button" className="button button-ghost" onClick={onClose}>
              Cancel
            </button>
            <button
              type="button"
              className="button button-accent"
              onClick={() => void generate()}
              disabled={animating}
            >
              {animating ? "Blocking out…" : "Generate first pass"}
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
