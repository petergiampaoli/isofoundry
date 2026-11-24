"use client";

import { useState } from "react";
import {
  exportAllDirectionGifs,
  exportAllViewPngs,
  exportFrameZip,
  exportGif,
  exportGodot,
  exportProject,
  exportSpriteSheet,
  exportStaticPng,
  exportTurntableGif,
  exportViewSheetPng,
} from "@/lib/export";
import { VIEW_LABELS } from "@/lib/types";
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
            <h2>Package the character set.</h2>
            <p>
              Four isometric views, a 12-second turntable, directional animation
              clips, sprite sheets, and a Godot 4 `SpriteFrames` bundle.
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
            onClick={() => run("turntable", () => exportTurntableGif(doc))}
          >
            <span className="export-icon">GIF</span>
            <strong>12-second turntable</strong>
            <small>FR → FL → BL → BR, 3 seconds per view, looping.</small>
          </button>

          <button
            type="button"
            className="export-card"
            disabled={busy !== null}
            onClick={() => run("sheet", () => exportViewSheetPng(doc, 4))}
          >
            <span className="export-icon">▦</span>
            <strong>Four-view sheet</strong>
            <small>2×2 transparent sheet at 4× scale.</small>
          </button>

          <button
            type="button"
            className="export-card"
            disabled={busy !== null}
            onClick={() => run("views", () => exportAllViewPngs(doc, 4))}
          >
            <span className="export-icon">PNG</span>
            <strong>All view PNGs</strong>
            <small>One 4× transparent PNG per direction in a zip.</small>
          </button>

          <button
            type="button"
            className="export-card"
            disabled={busy !== null}
            onClick={() => run("static", () => exportStaticPng(doc, doc.activeView, 4))}
          >
            <span className="export-icon">PNG</span>
            <strong>Active view PNG</strong>
            <small>
              {VIEW_LABELS[doc.activeView]} at 4×. Use the view tabs to change it.
            </small>
          </button>

          <button
            type="button"
            className="export-card"
            disabled={!animation || busy !== null}
            onClick={() =>
              animation
                ? run("gif", () => exportGif(doc, animation, doc.activeView))
                : undefined
            }
          >
            <span className="export-icon">GIF</span>
            <strong>Animated GIF · active view</strong>
            <small>
              {VIEW_LABELS[doc.activeView]} with loop or one-shot timing.
            </small>
          </button>

          <button
            type="button"
            className="export-card"
            disabled={!animation || busy !== null}
            onClick={() =>
              animation
                ? run("directions", () => exportAllDirectionGifs(doc, animation))
                : undefined
            }
          >
            <span className="export-icon">GIF</span>
            <strong>Animated GIFs · all views</strong>
            <small>Four directional GIFs in a zip.</small>
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
            <strong>Directional frame sequence</strong>
            <small>PNG per frame, grouped into four view folders.</small>
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
            <strong>Directional sprite sheet</strong>
            <small>Four view rows plus JSON frame regions.</small>
          </button>

          <button
            type="button"
            className="export-card"
            disabled={busy !== null}
            onClick={() => run("godot", () => exportGodot(doc))}
          >
            <span className="export-icon">GD</span>
            <strong>Godot 4 bundle</strong>
            <small>
              `SpriteFrames` .tres with `idle_front_right`-style clips.
            </small>
          </button>

          <button
            type="button"
            className="export-card"
            disabled={busy !== null}
            onClick={() => run("project", () => exportProject(doc))}
          >
            <span className="export-icon">JSON</span>
            <strong>Project file</strong>
            <small>Re-importable four-view character and animation data.</small>
          </button>
        </div>

        <div className="modal-actions">
          <div className="panel-note">
            {animation
              ? `Current animation: ${animation.name} · ${animation.frames.length} frames · ${animation.fps} fps · editing ${VIEW_LABELS[doc.activeView]}`
              : "No animation yet. The turntable and view exports are available; Godot export will create a static directional idle."}
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
