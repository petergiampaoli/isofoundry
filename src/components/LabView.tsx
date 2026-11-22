import { useEffect, useRef } from 'react';
import type { Direction, TraitKey } from '../types';
import { DirectionCard } from './DirectionCard';
import { Icon } from './Icon';

interface LabViewProps {
  prompt: string;
  setPrompt: (value: string) => void;
  directions: Direction[];
  selectedId: string | null;
  selected: Direction | null;
  locks: TraitKey[];
  onExplore: () => void;
  onSelect: (id: string) => void;
}

const EXAMPLES = [
  'Damp northern keep, practical iron, moss-eaten stone, no glossy armor.',
  'A fairy tale gone feral. Warm lantern light, thorny silhouettes, quiet dread.',
  'Sun-bleached desert nomads, bone and brass, wind-worn cloth, clean shapes.',
];

export function LabView({
  prompt,
  setPrompt,
  directions,
  selectedId,
  selected,
  locks,
  onExplore,
  onSelect,
}: LabViewProps) {
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!prompt) inputRef.current?.focus();
  }, [prompt]);

  return (
    <div className="lab">
      <header className="lab__hero">
        <div className="eyebrow">01 / Style lab</div>
        <div className="lab__hero-row">
          <div>
            <h1>Find the voice.</h1>
            <p>
              Describe a feeling. Get four visual directions, each tested on a tree, a stone, and a person.
              Keep what resonates, lock what matters, then push the direction further.
            </p>
          </div>
          <div className="lab__hero-mark" aria-hidden="true">
            <span>SE</span>
            <Icon name="diamond" size={34} />
            <span>2:1</span>
          </div>
        </div>
      </header>

      <form
        className="composer"
        onSubmit={(event) => {
          event.preventDefault();
          onExplore();
        }}
      >
        <div className="composer__top">
          <label htmlFor="style-prompt">Art direction prompt</label>
          <span>PROMPT → 4 DIRECTIONS → LOCK → NORTH STAR</span>
        </div>
        <textarea
          id="style-prompt"
          ref={inputRef}
          value={prompt}
          onChange={(event) => setPrompt(event.target.value)}
          onKeyDown={(event) => {
            if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
              event.preventDefault();
              onExplore();
            }
          }}
          rows={3}
          placeholder="Moss-eaten stone, practical iron, wind-worn cloth. Grounded and tactile, with a quiet strangeness. No glossy armor."
        />
        <div className="composer__bottom">
          <div className="composer__examples">
            <span>TRY</span>
            {EXAMPLES.map((example, index) => (
              <button key={example} type="button" onClick={() => setPrompt(example)} title={example}>
                0{index + 1}
              </button>
            ))}
          </div>
          <button type="submit" className="button button--primary" disabled={!prompt.trim()}>
            <Icon name="sparkle" size={15} />
            Explore directions
            <kbd>⌘↵</kbd>
          </button>
        </div>
      </form>

      {selected && (
        <div className="art-director-read">
          <div className="art-director-read__head">
            <span className="pulse-dot" />
            <span>ART DIRECTOR READ</span>
            <span className="muted">what the prompt changed</span>
          </div>
          <div className="art-director-read__body">
            <div className="read-chips">
              {selected.deltas.slice(0, 3).map((delta) => (
                <span key={delta}>{delta}</span>
              ))}
            </div>
            <div className="read-meta">
              {selected.keywords.slice(0, 5).map((keyword) => (
                <span key={keyword} className="tag">#{keyword}</span>
              ))}
              {selected.antiGoals.map((goal) => (
                <span key={goal} className="tag tag--warn">no {goal}</span>
              ))}
              {locks.length > 0 && <span className="tag tag--lock">{locks.length} traits locked</span>}
            </div>
          </div>
        </div>
      )}

      <div className="section-bar">
        <div>
          <span className="eyebrow">Directions</span>
          <span className="section-bar__count">{directions.length.toString().padStart(2, '0')}</span>
        </div>
        <span className="muted">Calibration probes: tree / stone / person</span>
      </div>

      {directions.length > 0 ? (
        <div className="direction-grid">
          {directions.map((direction, index) => (
            <DirectionCard
              key={direction.id}
              direction={direction}
              index={index}
              selected={direction.id === selectedId}
              onSelect={() => onSelect(direction.id)}
            />
          ))}
        </div>
      ) : (
        <div className="empty-lab">
          <div className="empty-lab__mark">
            <Icon name="diamond" size={42} />
          </div>
          <h2>The first prompt is a starting position.</h2>
          <p>
            Style is found by iteration, not by a single magic phrase. Try a material, a mood, and one thing
            the world must never feel like.
          </p>
          <div className="empty-lab__examples">
            {EXAMPLES.map((example) => (
              <button key={example} type="button" onClick={() => setPrompt(example)}>
                {example}
                <Icon name="arrow" size={13} />
              </button>
            ))}
          </div>
        </div>
      )}

      <footer className="lab__footer">
        <span>STYLE DNA v0.1</span>
        <span>DETERMINISTIC ISO RENDERER</span>
        <span>NO IMAGE MODEL REQUIRED</span>
      </footer>
    </div>
  );
}
