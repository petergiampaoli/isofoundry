import { useRef } from 'react';
import type { JourneyEvent, JourneyEventType, ProjectState } from '../types';
import { Icon } from './Icon';

interface JourneyRailProps {
  project: ProjectState;
  onRename: (name: string) => void;
  onNewSession: () => void;
  onResetDemo: () => void;
  onImport: (project: ProjectState) => void;
}

const EVENT_MARK: Record<JourneyEventType, string> = {
  project: '◇',
  prompt: '✦',
  select: '→',
  refine: '↻',
  lock: '⌑',
  anchor: '◆',
  test: '≋',
  export: '↥',
  reset: '×',
};

function formatTime(value: number): string {
  return new Date(value).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export function JourneyRail({ project, onRename, onNewSession, onResetDemo, onImport }: JourneyRailProps) {
  const fileRef = useRef<HTMLInputElement>(null);

  const importFile = (file: File | undefined) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result));
        const incoming = parsed.project ?? parsed;
        if (incoming?.version === 1 && Array.isArray(incoming.directions)) onImport(incoming);
        else window.alert('That file is not an Isofoundry project.');
      } catch {
        window.alert('That file could not be read as an Isofoundry project.');
      }
    };
    reader.readAsText(file);
  };

  return (
    <aside className="rail">
      <div className="rail__top">
        <div className="eyebrow">Session</div>
        <input
          className="rail__name"
          value={project.name}
          onChange={(event) => onRename(event.target.value)}
          aria-label="Project name"
          spellCheck={false}
          maxLength={60}
        />
        <div className="rail__meta">
          <span className="save-dot" />
          Saved locally
        </div>
      </div>

      <div className="rail__progress">
        <div className={`rail-step ${project.directions.length ? 'is-done' : ''}`}>
          <span>01</span>
          <div>
            <strong>Style lab</strong>
            <small>{project.directions.length ? `${project.directions.length} directions` : 'waiting for prompt'}</small>
          </div>
        </div>
        <div className={`rail-step ${project.anchor ? 'is-done' : project.selectedDirectionId ? 'is-active' : ''}`}>
          <span>02</span>
          <div>
            <strong>North Star</strong>
            <small>{project.anchor ? project.anchor.name : 'choose an anchor'}</small>
          </div>
        </div>
        <div className={`rail-step ${project.anchor ? 'is-active' : ''}`}>
          <span>03</span>
          <div>
            <strong>Style guide</strong>
            <small>{project.anchor ? 'locked + exportable' : 'not locked yet'}</small>
          </div>
        </div>
      </div>

      <div className="rail__journey">
        <div className="section-heading">
          <span>Creation journey</span>
          <span className="muted">{project.events.length}</span>
        </div>
        <div className="timeline">
          {project.events.slice(0, 12).map((event: JourneyEvent, index) => (
            <div key={event.id} className={`timeline__item ${index === 0 ? 'is-latest' : ''}`}>
              <div className="timeline__mark">{EVENT_MARK[event.type]}</div>
              <div className="timeline__body">
                <div className="timeline__label">{event.label}</div>
                {event.detail && <p>{event.detail}</p>}
                <time>{formatTime(event.at)}</time>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="rail__bottom">
        <button type="button" className="rail-action" onClick={onNewSession}>
          <Icon name="plus" size={14} /> New session
        </button>
        <button type="button" className="rail-action" onClick={() => fileRef.current?.click()}>
          <Icon name="download" size={14} /> Import project
        </button>
        <button type="button" className="rail-action rail-action--quiet" onClick={onResetDemo}>
          <Icon name="refresh" size={14} /> Reset demo
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json"
          className="visually-hidden"
          onChange={(event) => {
            importFile(event.target.files?.[0]);
            event.target.value = '';
          }}
        />
        <p className="rail__note">
          Recipes, seeds, scores, and decisions are stored. The PNG is never the source of truth.
        </p>
      </div>
    </aside>
  );
}
