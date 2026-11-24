"use client";

import { useState } from "react";
import { resizeImageDataUrl } from "@/lib/slice";
import {
  BODY_PLAN_LABELS,
  VIEW_IDS,
  VIEW_LABELS,
  type BodyPlan,
  type ViewId,
} from "@/lib/types";
import { useStudio } from "@/store/studio";

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("Could not read that image."));
    reader.readAsDataURL(file);
  });
}

export default function ImportModal({ onClose }: { onClose: () => void }) {
  const doc = useStudio((state) => state.doc);
  const setReference = useStudio((state) => state.setReference);
  const updateSpec = useStudio((state) => state.updateSpec);
  const setReferenceOpacity = useStudio((state) => state.setReferenceOpacity);
  const [dataUrl, setDataUrl] = useState(doc?.reference?.dataUrl ?? "");
  const [name, setName] = useState(doc?.reference?.name ?? "");
  const [bodyPlan, setBodyPlan] = useState<BodyPlan>(
    doc?.reference?.bodyPlan ?? doc?.spec.bodyPlan ?? "humanoid",
  );
  const [analyzing, setAnalyzing] = useState(false);
  const [note, setNote] = useState("");
  const [applyPlan, setApplyPlan] = useState(false);
  const [referenceView, setReferenceView] = useState<ViewId>(
    doc?.referenceView ?? doc?.activeView ?? "frontRight",
  );

  if (!doc) return null;

  async function analyze(image: string) {
    setAnalyzing(true);
    setNote("Reading the silhouette…");
    try {
      const response = await fetch("/api/agent/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageDataUrl: image }),
      });
      const payload = (await response.json()) as {
        bodyPlan?: BodyPlan;
        description?: string;
        error?: string;
      };
      if (!response.ok) throw new Error(payload.error || "Could not analyze image.");
      if (payload.bodyPlan) setBodyPlan(payload.bodyPlan);
      setNote(payload.description || "Body plan suggested.");
    } catch (error) {
      setNote(
        error instanceof Error
          ? error.message
          : "Could not analyze image. Choose a plan manually.",
      );
    } finally {
      setAnalyzing(false);
    }
  }

  async function chooseFile(file: File | null) {
    if (!file || !doc) return;
    try {
      const raw = await fileToDataUrl(file);
      const resized = await resizeImageDataUrl(raw, doc.width, doc.height);
      setDataUrl(resized);
      setName(file.name);
      void analyze(resized);
    } catch (error) {
      setNote(error instanceof Error ? error.message : "Could not read image.");
    }
  }

  function apply() {
    if (!dataUrl || !doc) return;
    setReference(dataUrl, name || "Imported reference", bodyPlan, referenceView);
    if (applyPlan) updateSpec({ bodyPlan });
    if (doc.reference) setReferenceOpacity(doc.reference.opacity);
    onClose();
  }

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true">
      <section className="modal import-modal">
        <header className="modal-head">
          <div>
            <div className="eyebrow">Reference + slicing</div>
            <h2>Import full character art.</h2>
            <p>
              Import one full-character view. It becomes a locked reference for
              that direction only; the other three views stay generated from the
              character spec. Slice regions into editable parts with the
              rectangle or lasso tool.
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

        <div className="import-grid">
          <label className="import-drop">
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp,image/gif"
              hidden
              onChange={(event) => void chooseFile(event.target.files?.[0] ?? null)}
            />
            {dataUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={dataUrl} alt="" />
            ) : (
              <span>
                <strong>Drop full character PNG</strong>
                <small>or click to choose</small>
              </span>
            )}
          </label>

          <div className="import-settings">
            <div className="field">
              <label htmlFor="reference-name">Reference name</label>
              <input
                id="reference-name"
                type="text"
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="concept.png"
              />
            </div>
            <div className="field">
              <label htmlFor="reference-view">Reference view</label>
              <select
                id="reference-view"
                value={referenceView}
                onChange={(event) => setReferenceView(event.target.value as ViewId)}
              >
                {VIEW_IDS.map((view) => (
                  <option key={view} value={view}>
                    {VIEW_LABELS[view]}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label htmlFor="reference-plan">Creature plan</label>
              <select
                id="reference-plan"
                value={bodyPlan}
                onChange={(event) => setBodyPlan(event.target.value as BodyPlan)}
              >
                {Object.entries(BODY_PLAN_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
            <label className="check-label">
              <input
                type="checkbox"
                checked={applyPlan}
                onChange={(event) => setApplyPlan(event.target.checked)}
              />
              Apply this plan to the generated character
            </label>
            <p className="panel-note">
              {analyzing
                ? "Analyzing image…"
                : note ||
                  "The imported PNG is a reference for one view. The body plan is suggested from the image and can be overridden."}
            </p>
          </div>
        </div>

        <div className="modal-actions">
          <div className="panel-note">
            Slicing tools: <strong>Rect</strong> and <strong>Lasso</strong> in the
            left rail. Each selection becomes a new part.
          </div>
          <div className="modal-action-buttons">
            <button type="button" className="button button-ghost" onClick={onClose}>
              Cancel
            </button>
            <button
              type="button"
              className="button button-accent"
              onClick={apply}
              disabled={!dataUrl}
            >
              Add reference
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
