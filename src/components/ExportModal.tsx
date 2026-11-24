"use client";

import { useState } from "react";
import {
  exportFrameZip,
  exportGif,
  exportGodot,
  exportProject,
  exportSpriteSheet,
  exportStaticPng,
} from "@/lib/export";
import { useStudio } from "@/store/studio";

export default function ExportModal({ onClose }: { onClose: () => void }) {
  const doc = useStudio((state) => state.doc);
  const [busy, setBusy] = useState<string | null>(null);

  if (!doc) return null;
  const animation =
    doc.animations.find((entry) => entry.id === doc.currentAnimationId) ??
    doc.animations[0] ??
    null;

  async function run(label: string, task: () => Promise<void> | void) {
    setBusy(label);
    try {
      await task();
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true">
      <section className="modal export-modal">
        <header className="modal-head">
          <div>
            <div className="eyebrow">Export</div>
            <h2>Package the sprite.</h2>
            <p>
              PNG frames, sprite sheet, GIF, project JSON, and a Godot 4
              `SpriteFrames` bundle.
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

        <div className="export-grid">
          <button
            type="button"
            className="export-card"
            disabled={busy !== null}
            onClick={() => run("static", () => exportStaticPng(doc, 4))}
          >
            <span className="export-icon">PNG</span>
            <strong>Static character PNG</strong>
            <small>Transparent 4× base character image.</small>
          </button>

          <button
            type="button"
            className="export-card"
            disabled={!animation || busy !== null}
            onClick={() =>
              animation
                ? run("gif", () => exportGif(doc, animation))
                : undefined
            }
          >
            <span className="export-icon">GIF</span>
            <strong>Animated GIF</strong>
            <small>Transparent preview with loop or one-shot timing.</small>
          </button>

          <button
            type="button"
            className="export-card"
            disabled={!animation || busy !== null}
            onClick={() =>
              animation
                ? run("frames", () => exportFrameZip(doc, animation))
                : undefined
            }
          >
            <span className="export-icon">PNG</span>
            <strong>PNG frame sequence</strong>
            <small>One transparent PNG per frame in a zip.</small>
          </button>

          <button
            type="button"
            className="export-card"
            disabled={!animation || busy !== null}
            onClick={() =>
              animation
                ? run("sheet", () => exportSpriteSheet(doc, animation))
                : undefined
            }
          >
            <span className="export-icon">▦</span>
            <strong>Sprite sheet</strong>
            <small>Horizontal atlas plus JSON frame regions.</small>
          </button>

          <button
            type="button"
            className="export-card"
            disabled={busy !== null}
            onClick={() => run("godot", () => exportGodot(doc))}
          >
            <span className="export-icon">GD</span>
            <strong>Godot 4 bundle</strong>
            <small>`SpriteFrames` .tres, atlas PNG, and metadata.</small>
          </button>

          <button
            type="button"
            className="export-card"
            disabled={busy !== null}
            onClick={() => run("project", () => exportProject(doc))}
          >
            <span className="export-icon">JSON</span>
            <strong>Project file</strong>
            <small>Re-importable character and animation data.</small>
          </button>
        </div>

        <div className="modal-actions">
          <div className="panel-note">
            {animation
              ? `Current animation: ${animation.name} · ${animation.frames.length} frames · ${animation.fps} fps`
              : "No animation yet. Godot export will create a static idle frame."}
          </div>
          <button type="button" className="button button-ghost" onClick={onClose}>
            Close
          </button>
        </div>
        {busy ? <div className="export-progress">Preparing {busy}…</div> : null}
      </section>
    </div>
  );
}
