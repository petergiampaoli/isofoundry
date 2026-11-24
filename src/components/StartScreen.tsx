"use client";

import { useRef, useState } from "react";
import type { BodyPlan, CharacterDoc } from "@/lib/types";
import { useStudio } from "@/store/studio";
import OptionPreview from "./OptionPreview";

const EXAMPLES = [
  "A hulking pumpkin knight with a cracked iron helm and a cleaver",
  "A moss-covered forest warden with antlers and a staff",
  "A frost-bitten quadruped beast with crystal spines",
  "A violet slime monarch with too many eyes and a tiny crown",
  "A rusted clockwork soldier with a broken tower shield",
];

export default function StartScreen() {
  const prompt = useStudio((state) => state.prompt);
  const setPrompt = useStudio((state) => state.setPrompt);
  const options = useStudio((state) => state.options);
  const generating = useStudio((state) => state.generating);
  const generateOptions = useStudio((state) => state.generateOptions);
  const chooseOption = useStudio((state) => state.chooseOption);
  const openProject = useStudio((state) => state.openProject);
  const setError = useStudio((state) => state.setError);
  const warning = useStudio((state) => state.warning);
  const [localPrompt, setLocalPrompt] = useState(prompt);
  const [bodyPlan, setBodyPlan] = useState<"auto" | BodyPlan>("auto");
  const [mustHave, setMustHave] = useState("");
  const [avoid, setAvoid] = useState("");
  const projectInput = useRef<HTMLInputElement>(null);

  async function openProjectFile(file: File | null) {
    if (!file) return;
    try {
      const raw = await file.text();
      openProject(JSON.parse(raw) as CharacterDoc);
    } catch {
      setError("Could not read that project JSON.");
    } finally {
      if (projectInput.current) projectInput.current.value = "";
    }
  }

  function submit(event: React.FormEvent) {
    event.preventDefault();
    const next = localPrompt.trim();
    if (!next || generating) return;
    const structured = [
      next,
      mustHave.trim() ? `Must include: ${mustHave.trim()}.` : "",
      avoid.trim() ? `Avoid: ${avoid.trim()}.` : "",
    ].filter(Boolean).join("\n");
    setPrompt(structured);
    void generateOptions(structured, bodyPlan === "auto" ? undefined : bodyPlan);
  }

  return (
    <main className="start-screen">
      <header className="start-header">
        <div className="brand-lockup">
          <div className="brand-mark" aria-hidden>
            <span />
            <span />
            <span />
            <span />
          </div>
          <div>
            <div className="brand">ISOFOUNDRY</div>
            <div className="brand-sub">pixel character studio</div>
          </div>
        </div>
        <div className="start-header-actions">
          <div className="start-header-note">
            64 × 64 base · prompt to parts · animate · export
          </div>
          <label className="project-open">
            Open project
            <input
              ref={projectInput}
              type="file"
              accept=".json,application/json"
              hidden
              onChange={(event) =>
                void openProjectFile(event.target.files?.[0] ?? null)
              }
            />
          </label>
        </div>
      </header>

      <section className="prompt-hero">
        <div className="eyebrow">01 / Concept</div>
        <h1>
          Build a character
          <br />
          from a prompt.
        </h1>
        <p className="hero-copy">
          The initial prompt has the broadest agentic influence. It returns four
          editable base concepts. Choose one, then reshape the body, hair, clothing,
          colors, and pixels yourself. Animations come later, only when you ask.
        </p>

        <form className="prompt-form" onSubmit={submit}>
          <label className="sr-only" htmlFor="concept-prompt">
            Character concept
          </label>
          <textarea
            id="concept-prompt"
            value={localPrompt}
            onChange={(event) => setLocalPrompt(event.target.value)}
            placeholder="Describe a character: silhouette, materials, role, mood…"
            rows={3}
          />
          <div className="structured-prompt-row">
            <label className="field">
              <span>Body plan</span>
              <select
                value={bodyPlan}
                onChange={(event) => setBodyPlan(event.target.value as "auto" | BodyPlan)}
              >
                <option value="auto">Auto from prompt</option>
                <option value="humanoid">Humanoid</option>
                <option value="quadruped">Quadruped</option>
                <option value="blob">Blob</option>
              </select>
            </label>
            <label className="field">
              <span>Must include</span>
              <input
                value={mustHave}
                onChange={(event) => setMustHave(event.target.value)}
                placeholder="antlers, torn cloak, brass hooks"
              />
            </label>
            <label className="field">
              <span>Avoid</span>
              <input
                value={avoid}
                onChange={(event) => setAvoid(event.target.value)}
                placeholder="glossy armor, neon, cute"
              />
            </label>
          </div>
          <div className="prompt-actions">
            <div className="prompt-hint">
              Initial prompt = broadest agentic influence. No animations yet.
            </div>
            <button
              className="button button-accent"
              type="submit"
              disabled={generating || !localPrompt.trim()}
            >
              {generating ? "Forging concepts…" : "Generate 4 concepts"}
            </button>
          </div>
        </form>

        <div className="example-row">
          <span className="eyebrow">Try</span>
          {EXAMPLES.slice(0, 4).map((example) => (
            <button
              key={example}
              type="button"
              className="example-chip"
              onClick={() => setLocalPrompt(example)}
            >
              {example}
            </button>
          ))}
        </div>
      </section>

      {warning ? <div className="inline-warning">{warning}</div> : null}

      <section className="concept-section">
        <div className="section-heading">
          <div>
            <div className="eyebrow">02 / Choose a base</div>
            <h2>Four directions.</h2>
          </div>
          {options.length > 0 ? (
            <div className="section-heading-note">Select one to enter the studio</div>
          ) : null}
        </div>

        <div className="option-grid">
          {generating
            ? Array.from({ length: 4 }, (_, index) => (
                <div className="option-card option-skeleton" key={index}>
                  <div className="skeleton-preview">
                    <span style={{ animationDelay: `${index * 120}ms` }} />
                  </div>
                  <div className="skeleton-line" />
                  <div className="skeleton-line skeleton-line-short" />
                </div>
              ))
            : options.map((spec) => (
                <OptionPreview
                  key={spec.id}
                  spec={spec}
                  onSelect={() => chooseOption(spec)}
                />
              ))}
        </div>

        {!generating && options.length === 0 ? (
          <div className="empty-concepts">
            <div className="empty-pixel" aria-hidden>
              <span />
              <span />
              <span />
              <span />
            </div>
            <p>Your concepts will land here. Start with a prompt above.</p>
          </div>
        ) : null}
      </section>

      <footer className="start-footer">
        <span>Isofoundry / character studio</span>
        <span>4 concepts · 3 body plans · editable parts · agentic animation · Godot 4</span>
      </footer>
    </main>
  );
}
