"use client";

import { useState } from "react";
import { sliceReference } from "@/lib/slice";
import { BODY_PLAN_LABELS, type Point, type Tool } from "@/lib/types";
import { useStudio } from "@/store/studio";
import AnimationModal from "./AnimationModal";
import ExportModal from "./ExportModal";
import ImportModal from "./ImportModal";
import { PalettePanel, PartPanel, SpecPanel } from "./Panels";
import PixelCanvas from "./PixelCanvas";
import RefineModal from "./RefineModal";
import Timeline from "./Timeline";

const TOOLS: Array<{ id: Tool; icon: string; label: string }> = [
  { id: "select", icon: "↖", label: "Select" },
  { id: "pencil", icon: "✎", label: "Pencil" },
  { id: "eraser", icon: "⌫", label: "Eraser" },
  { id: "fill", icon: "▣", label: "Fill" },
  { id: "eyedropper", icon: "◉", label: "Pick color" },
  { id: "slice-rect", icon: "▭", label: "Rectangle slice" },
  { id: "slice-lasso", icon: "⌁", label: "Lasso slice" },
];

export default function Studio() {
  const doc = useStudio((state) => state.doc);
  const tool = useStudio((state) => state.tool);
  const setTool = useStudio((state) => state.setTool);
  const brushSize = useStudio((state) => state.brushSize);
  const setBrushSize = useStudio((state) => state.setBrushSize);
  const selectedPartId = useStudio((state) => state.selectedPartId);
  const versions = useStudio((state) => state.versions);
  const history = useStudio((state) => state.history);
  const future = useStudio((state) => state.future);
  const undo = useStudio((state) => state.undo);
  const redo = useStudio((state) => state.redo);
  const newProject = useStudio((state) => state.newProject);
  const revertVersion = useStudio((state) => state.revertVersion);
  const addImportedPart = useStudio((state) => state.addImportedPart);
  const setError = useStudio((state) => state.setError);
  const setStatus = useStudio((state) => state.setStatus);
  const [refineOpen, setRefineOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [animationOpen, setAnimationOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);

  if (!doc) return null;
  const selectedPart = doc.parts.find((part) => part.id === selectedPartId);
  const currentAnimation =
    doc.animations.find((entry) => entry.id === doc.currentAnimationId) ??
    doc.animations[0] ??
    null;

  async function handleSlice(points: Point[]) {
    if (!doc?.reference) {
      setError("Import a reference PNG before using the slice tools.");
      return;
    }
    setStatus("Slicing reference…");
    const result = await sliceReference(
      doc.reference.dataUrl,
      points,
      doc.width,
      doc.height,
      doc.spec.palette,
      `Sliced part ${doc.parts.filter((part) => part.kind === "imported").length + 1}`,
    );
    setStatus(null);
    if (!result) {
      setError("That selection did not contain any opaque pixels.");
      return;
    }
    addImportedPart({
      id: result.id,
      name: result.name,
      pixels: result.pixels,
      pivot: result.pivot,
    });
  }

  return (
    <div className="studio">
      <header className="studio-topbar">
        <button
          type="button"
          className="studio-brand"
          onClick={() => {
            if (window.confirm("Leave this character? It is autosaved.")) {
              newProject();
            }
          }}
          title="Start a new character"
        >
          <span className="studio-brand-mark" aria-hidden>
            IF
          </span>
          <span>ISOFOUNDRY</span>
        </button>

        <div className="studio-project">
          <strong>{doc.name}</strong>
          <span>
            {BODY_PLAN_LABELS[doc.spec.bodyPlan]} · {doc.width}×{doc.height}
          </span>
        </div>

        <div className="studio-top-actions">
          <div className="history-actions">
            <button
              type="button"
              className="mini-toggle"
              onClick={undo}
              disabled={history.length === 0}
              title="Undo"
            >
              ↶
            </button>
            <button
              type="button"
              className="mini-toggle"
              onClick={redo}
              disabled={future.length === 0}
              title="Redo"
            >
              ↷
            </button>
          </div>

          <select
            className="version-select"
            value=""
            onChange={(event) => {
              if (event.target.value) revertVersion(event.target.value);
            }}
            title="Restore a version"
          >
            <option value="">History ({versions.length})</option>
            {versions.map((version) => (
              <option key={version.id} value={version.id}>
                Restore · {version.label}
              </option>
            ))}
          </select>

          <button
            type="button"
            className="button button-ghost"
            onClick={() => setRefineOpen(true)}
          >
            Refine
          </button>
          <button
            type="button"
            className="button button-ghost"
            onClick={() => setImportOpen(true)}
          >
            Import PNG
          </button>
          <button
            type="button"
            className="button button-ghost"
            onClick={() => setAnimationOpen(true)}
            disabled={!doc}
          >
            Animate
          </button>
          <button
            type="button"
            className="button button-accent"
            onClick={() => setExportOpen(true)}
          >
            Export
          </button>
        </div>
      </header>

      <aside className="tool-rail">
        <div className="tool-rail-label">TOOLS</div>
        {TOOLS.map((entry) => (
          <button
            key={entry.id}
            type="button"
            className={`tool-button${tool === entry.id ? " active" : ""}`}
            onClick={() => setTool(entry.id)}
            title={entry.label}
          >
            <span>{entry.icon}</span>
            <small>{entry.label.split(" ")[0]}</small>
          </button>
        ))}

        <div className="tool-divider" />
        <div className="tool-rail-label">BRUSH</div>
        <div className="brush-sizes">
          {[1, 2, 3, 4].map((size) => (
            <button
              key={size}
              type="button"
              className={`brush-dot${brushSize === size ? " active" : ""}`}
              onClick={() => setBrushSize(size)}
              title={`${size}px brush`}
            >
              <span style={{ width: size * 3 + 2, height: size * 3 + 2 }} />
            </button>
          ))}
        </div>

        <div className="tool-divider" />
        <div className="tool-rail-label">SELECTED</div>
        <div className="rail-selected">
          <strong>{selectedPart?.name ?? "None"}</strong>
          <small>{selectedPart ? `z ${selectedPart.z}` : "Pick a part"}</small>
        </div>
      </aside>

      <main className="studio-canvas">
        <PixelCanvas onSlice={handleSlice} />
      </main>

      <aside className="studio-side">
        <PartPanel />
        <PalettePanel />
        <SpecPanel
          key={`${doc.width}x${doc.height}`}
          onOpenImport={() => setImportOpen(true)}
        />
      </aside>

      <div className="studio-timeline">
        <Timeline onOpenAnimation={() => setAnimationOpen(true)} />
        {currentAnimation ? (
          <div className="timeline-note">
            Frame transforms can be edited in the Parts panel with “Frame pose”
            enabled.
          </div>
        ) : null}
      </div>

      {refineOpen ? <RefineModal onClose={() => setRefineOpen(false)} /> : null}
      {importOpen ? <ImportModal onClose={() => setImportOpen(false)} /> : null}
      {animationOpen ? (
        <AnimationModal onClose={() => setAnimationOpen(false)} />
      ) : null}
      {exportOpen ? <ExportModal onClose={() => setExportOpen(false)} /> : null}
    </div>
  );
}
