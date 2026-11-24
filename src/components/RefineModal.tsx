"use client";

import { useMemo, useState } from "react";
import { renderFrameToDataUrl } from "@/lib/render";
import { useStudio } from "@/store/studio";
import OptionPreview from "./OptionPreview";

export default function RefineModal({ onClose }: { onClose: () => void }) {
  const doc = useStudio((state) => state.doc);
  const refineOptions = useStudio((state) => state.refineOptions);
  const refining = useStudio((state) => state.refining);
  const refine = useStudio((state) => state.refine);
  const applyRefinement = useStudio((state) => state.applyRefinement);
  const clearRefineOptions = useStudio((state) => state.clearRefineOptions);
  const [prompt, setPrompt] = useState("");

  const currentImage = useMemo(() => {
    if (!doc) return "";
    const animation =
      doc.animations.find((entry) => entry.id === doc.currentAnimationId) ??
      doc.animations[0] ??
      null;
    return renderFrameToDataUrl(doc, animation?.frames[0] ?? null);
  }, [doc]);

  if (!doc) return null;

  async function generate() {
    if (!prompt.trim() || refining) return;
    await refine(prompt.trim(), currentImage);
  }

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true">
      <section className="modal refine-modal">
        <header className="modal-head">
          <div>
            <div className="eyebrow">Agent revision</div>
            <h2>Send the current art back.</h2>
            <p>
              The art director receives the current spec and a rendered PNG, then
              returns four revised directions.
            </p>
          </div>
          <button
            type="button"
            className="modal-close"
            onClick={() => {
              clearRefineOptions();
              onClose();
            }}
            aria-label="Close"
          >
            ×
          </button>
        </header>

        <div className="refine-current">
          {currentImage ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={currentImage} alt="" />
          ) : null}
          <div>
            <strong>{doc.name}</strong>
            <p>{doc.spec.description || "Current character base."}</p>
          </div>
        </div>

        <div className="modal-prompt-row">
          <textarea
            value={prompt}
            onChange={(event) => setPrompt(event.target.value)}
            rows={3}
            placeholder="Keep the silhouette, make the armor verdigris and add a torn banner…"
          />
          <button
            type="button"
            className="button button-accent"
            onClick={generate}
            disabled={refining || !prompt.trim()}
          >
            {refining ? "Reworking…" : "Generate 4 revisions"}
          </button>
        </div>

        {refineOptions.length > 0 ? (
          <div className="refine-options">
            {refineOptions.map((spec) => (
              <OptionPreview
                key={spec.id}
                spec={spec}
                compact
                onSelect={() => {
                  applyRefinement(spec);
                  onClose();
                }}
              />
            ))}
          </div>
        ) : (
          <div className="modal-empty">
            {refining
              ? "The agent is comparing the current render to your prompt…"
              : "Four revisions will appear here. Applying one keeps the current version in history."}
          </div>
        )}
      </section>
    </div>
  );
}
