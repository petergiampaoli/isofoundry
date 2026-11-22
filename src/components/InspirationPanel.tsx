import { useEffect, useMemo, useRef, useState } from 'react';
import type {
  InspirationAsset,
  InspirationFeature,
  InspirationSettings,
  ProjectState,
  VisionRead,
} from '../types';
import { featureLabel, INSPIRATION_FEATURES, combineInspirations, readInspirationFile } from '../lib/inspiration';
import {
  loadVisionConfig,
  loadVisionKey,
  readWithVision,
  saveVisionConfig,
  saveVisionKey,
  type VisionConfig,
} from '../lib/vision';
import { Icon } from './Icon';
import { VisionSettings } from './VisionSettings';

interface InspirationPanelProps {
  project: ProjectState;
  onAdd: (asset: InspirationAsset) => void;
  onRemove: (id: string) => void;
  onClear: () => void;
  onPrimary: (id: string) => void;
  onUpdateWeight: (id: string, weight: number) => void;
  onUpdateSettings: (patch: Partial<InspirationSettings>) => void;
  onSetVision: (vision: VisionRead | null) => void;
}

function confidenceLabel(value: number): string {
  if (value > 0.7) return 'high';
  if (value > 0.5) return 'medium';
  return 'soft';
}

function isImageFile(file: File): boolean {
  return file.type.startsWith('image/') || /\.(png|jpe?g|webp|gif|avif)$/i.test(file.name);
}

export function InspirationPanel({
  project,
  onAdd,
  onRemove,
  onClear,
  onPrimary,
  onUpdateWeight,
  onUpdateSettings,
  onSetVision,
}: InspirationPanelProps) {
  const [dragging, setDragging] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [visionBusy, setVisionBusy] = useState(false);
  const [visionError, setVisionError] = useState<string | null>(null);
  const [visionConfig, setVisionConfig] = useState<VisionConfig>(() => loadVisionConfig());
  const [visionKey, setVisionKey] = useState(() => loadVisionKey().key);
  const [visionRemember, setVisionRemember] = useState(() => loadVisionKey().remember);
  const inputRef = useRef<HTMLInputElement>(null);

  const combined = useMemo(
    () => combineInspirations(project.inspirations, project.primaryInspirationId, project.inspirationSettings),
    [project.inspirations, project.primaryInspirationId, project.inspirationSettings],
  );
  const vision = project.inspirationVision;
  const settings = project.inspirationSettings;
  const selectedDirection = project.directions.find((direction) => direction.id === project.selectedDirectionId);
  const currentSourceIds = project.inspirations.map((asset) => asset.id).sort().join(',');
  const appliedSourceIds = selectedDirection?.inspiration?.sourceIds.slice().sort().join(',') ?? '';
  const referenceApplied = Boolean(selectedDirection?.inspiration) && currentSourceIds === appliedSourceIds;

  const handleFiles = async (files: FileList | File[]) => {
    if (busy) return;
    const images = Array.from(files).filter(isImageFile);
    if (images.length === 0) {
      setError('Choose a PNG, JPG, or WebP image.');
      return;
    }
    const remaining = Math.max(0, 4 - project.inspirations.length);
    if (remaining === 0) {
      setError('Four references is the limit. Remove one before adding another.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      for (const file of images.slice(0, remaining)) {
        const asset = await readInspirationFile(file);
        onAdd(asset);
      }
      if (project.inspirationVision) onSetVision(null);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'That image could not be read.');
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    const onPaste = (event: ClipboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target && ['INPUT', 'TEXTAREA'].includes(target.tagName)) return;
      const files = Array.from(event.clipboardData?.files ?? []);
      if (files.some(isImageFile)) {
        event.preventDefault();
        void handleFiles(files);
      }
    };
    document.addEventListener('paste', onPaste);
    return () => document.removeEventListener('paste', onPaste);
  }, [project.inspirations.length, project.inspirationVision]);

  const updateFeature = (feature: InspirationFeature) => {
    onUpdateSettings({
      features: { ...settings.features, [feature]: !settings.features[feature] },
    });
  };

  const openSettings = () => {
    setVisionConfig(loadVisionConfig());
    const stored = loadVisionKey();
    setVisionKey(stored.key);
    setVisionRemember(stored.remember);
    setSettingsOpen(true);
  };

  const startVisionRead = async () => {
    if (!visionConfig.model || !visionConfig.consent) {
      openSettings();
      setVisionError('Configure a model and confirm reference thumbnails may be sent.');
      return;
    }
    if (!combined) return;
    setVisionBusy(true);
    setVisionError(null);
    try {
      const read = await readWithVision({
        assets: project.inspirations,
        prompt: project.prompt,
        combined,
        config: visionConfig,
        apiKey: visionKey,
      });
      onSetVision(read);
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : 'The vision request failed.';
      setVisionError(message.includes('Failed to fetch')
        ? 'The provider could not be reached from the browser. Check the URL, CORS policy, and network.'
        : message);
    } finally {
      setVisionBusy(false);
    }
  };

  return (
    <section
      className={`inspiration ${dragging ? 'is-dragging' : ''}`}
      onDragOver={(event) => {
        event.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(event) => {
        event.preventDefault();
        setDragging(false);
        void handleFiles(event.dataTransfer.files);
      }}
    >
      <div className="inspiration__head">
        <div>
          <div className="eyebrow">Inspiration art</div>
          <h2>Let the reference lead.</h2>
          <p>
            Optional visual evidence for palette, form, finish, and voice. Analyzed locally; originals never leave
            the browser. Add up to four images, one primary.
          </p>
        </div>
        <button type="button" className="button button--ghost button--small" onClick={openSettings}>
          <Icon name="sparkle" size={13} /> AI settings
        </button>
      </div>

      {project.inspirations.length === 0 ? (
        <button
          type="button"
          className="inspiration__drop"
          onClick={() => inputRef.current?.click()}
          onPaste={(event) => {
            const files = Array.from(event.clipboardData.files);
            if (files.length > 0) {
              event.preventDefault();
              event.stopPropagation();
              void handleFiles(files);
            }
          }}
        >
          <span className="inspiration__drop-icon"><Icon name="plus" size={22} /></span>
          <strong>{busy ? 'Reading references…' : 'Drop inspiration art here'}</strong>
          <span>or paste / browse · PNG, JPG, WebP · up to 4 · stays on this device</span>
        </button>
      ) : (
        <div className="inspiration__body">
          <div className="ref-tray">
            {project.inspirations.map((asset) => {
              const isPrimary = asset.id === project.primaryInspirationId;
              return (
                <div key={asset.id} className={`ref-card ${isPrimary ? 'is-primary' : ''}`}>
                  <div className="ref-card__image">
                    <img src={asset.thumbnail} alt={asset.name} />
                    <button
                      type="button"
                      className={`ref-card__star ${isPrimary ? 'is-on' : ''}`}
                      onClick={() => {
                        onPrimary(asset.id);
                        if (project.inspirationVision) onSetVision(null);
                      }}
                      title={isPrimary ? 'Primary reference' : 'Make primary reference'}
                    >
                      {isPrimary ? '★' : '☆'}
                    </button>
                    <button
                      type="button"
                      className="ref-card__remove"
                      onClick={() => {
                        onRemove(asset.id);
                        if (project.inspirationVision) onSetVision(null);
                      }}
                      title="Remove reference"
                    >
                      <Icon name="close" size={10} />
                    </button>
                  </div>
                  <div className="ref-card__meta">
                    <span>{isPrimary ? 'PRIMARY' : 'SUPPORT'}</span>
                    {!isPrimary && (
                      <input
                        type="range"
                        min={0.1}
                        max={1}
                        step={0.05}
                        value={asset.weight}
                        onChange={(event) => onUpdateWeight(asset.id, Number(event.target.value))}
                        title={`Support weight ${Math.round(asset.weight * 100)}%`}
                      />
                    )}
                  </div>
                </div>
              );
            })}
            {project.inspirations.length < 4 && (
              <button
                type="button"
                className="ref-add"
                onClick={() => inputRef.current?.click()}
                title="Add reference"
              >
                <Icon name="plus" size={18} />
                <span>{busy ? 'Reading…' : 'Add'}</span>
              </button>
            )}
          </div>

          {combined && (
            <div className="read-panel">
              <div className="read-panel__top">
                <div>
                  <span className="eyebrow">Reference read</span>
                  <span className="read-confidence">
                    palette {confidenceLabel(combined.confidence.palette)} · finish {confidenceLabel(combined.confidence.finish)} · form {confidenceLabel(combined.confidence.form)}
                  </span>
                </div>
                <button
                  type="button"
                  className="text-button"
                  onClick={() => {
                    onUpdateSettings({ notes: '' });
                    onClear();
                  }}
                >
                  Clear all
                </button>
              </div>

              <div className="ref-palette">
                {combined.palette.map((color) => (
                  <span key={color} style={{ background: color }} title={color} />
                ))}
              </div>

              {project.directions.length > 0 && !referenceApplied && (
                <p className="ref-stale">
                  This read is not applied to the current four directions yet. Press
                  {' '}<strong>Explore with reference</strong>{' '}above to rebuild them with it.
                </p>
              )}

              <div className="read-tags">
                {combined.keywords.map((keyword) => (
                  <span key={keyword} className="tag">#{keyword}</span>
                ))}
              </div>

              <div className="read-metrics">
                <span>contrast <strong>{Math.round(combined.contrast * 100)}</strong></span>
                <span>chroma <strong>{Math.round(combined.chroma * 100)}</strong></span>
                <span>detail <strong>{Math.round(combined.detailEntropy * 100)}</strong></span>
                <span>texture <strong>{Math.round(combined.texture * 100)}</strong></span>
                <span>form <strong>{Math.round((1 - combined.angularity) * 100)}</strong></span>
              </div>

              <div className="feature-row">
                <span className="feature-row__label">Take</span>
                {INSPIRATION_FEATURES.map((feature) => (
                  <button
                    key={feature}
                    type="button"
                    className={`feature-chip ${settings.features[feature] ? 'is-on' : ''}`}
                    onClick={() => updateFeature(feature)}
                  >
                    {featureLabel(feature)}
                  </button>
                ))}
              </div>

              <label className="inspiration-slider">
                <span>Image influence <strong>{Math.round(settings.influence * 100)}%</strong></span>
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.05}
                  value={settings.influence}
                  onChange={(event) => onUpdateSettings({ influence: Number(event.target.value) })}
                />
              </label>
              <label className="inspiration-slider">
                <span>
                  Palette fidelity <strong>{Math.round(settings.paletteFidelity * 100)}%</strong>
                  <small>translated ↔ reference-built ramps</small>
                </span>
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.05}
                  value={settings.paletteFidelity}
                  onChange={(event) => onUpdateSettings({ paletteFidelity: Number(event.target.value) })}
                />
              </label>

              <textarea
                className="inspiration-notes"
                rows={2}
                value={settings.notes}
                onChange={(event) => onUpdateSettings({ notes: event.target.value })}
                placeholder="What draws you here? e.g. the dusty light and chunky silhouettes, not the subject."
              />

              <label className="check-row check-row--small">
                <input
                  type="checkbox"
                  checked={settings.includeInExport}
                  onChange={(event) => onUpdateSettings({ includeInExport: event.target.checked })}
                />
                <span>Include thumbnails and read data in exports</span>
              </label>

              <div className="ai-read">
                <div className="ai-read__head">
                  <div>
                    <span className="eyebrow">Optional vision AI</span>
                    <span className="ai-status">
                      {visionConfig.model ? `${visionConfig.model} · consent ${visionConfig.consent ? 'on' : 'off'}` : 'not configured'}
                    </span>
                  </div>
                  <button
                    type="button"
                    className="button button--ghost button--small"
                    onClick={startVisionRead}
                    disabled={visionBusy}
                  >
                    <Icon name="sparkle" size={12} />
                    {visionBusy ? 'Reading…' : vision ? 'Re-read with AI' : 'Read with AI'}
                  </button>
                </div>

                {visionError && <p className="inline-error">{visionError}</p>}

                {vision ? (
                  <div className={`ai-card ${vision.accepted ? 'is-accepted' : ''}`}>
                    <div className="ai-card__top">
                      <span>{vision.theme}</span>
                      <span>{Math.round(vision.confidence * 100)}% confidence</span>
                    </div>
                    <p className="ai-card__mood">{vision.mood}</p>
                    <div className="ai-card__grid">
                      <div>
                        <span>MOTIFS</span>
                        <p>{vision.motifs.join(' · ') || '—'}</p>
                      </div>
                      <div>
                        <span>MATERIALS</span>
                        <p>{vision.materials.join(' · ') || '—'}</p>
                      </div>
                      <div>
                        <span>MOTION</span>
                        <p>{vision.motionDescription}</p>
                      </div>
                    </div>
                    <p className="ai-card__manifesto">{vision.manifesto || vision.narrativeVoice}</p>
                    {vision.accepted && (
                      <p className="ai-card__hint">
                        Accepted. Press <strong>Explore with reference</strong> to rebuild the four directions
                        with this voice and motion.
                      </p>
                    )}
                    <div className="ai-card__actions">
                      <span>{vision.provider} / {vision.model}</span>
                      <button
                        type="button"
                        className={`button button--small ${vision.accepted ? 'button--ghost' : 'button--primary'}`}
                        onClick={() => onSetVision(vision.accepted ? null : { ...vision, accepted: true })}
                      >
                        {vision.accepted ? 'Discard AI voice' : 'Use AI voice + motion'}
                      </button>
                    </div>
                  </div>
                ) : (
                  <p className="ai-read__hint">
                    Sends small thumbnails and the local read to your configured provider. Nothing is sent until
                    you press the button. The local read remains the source of truth for palette and finish.
                  </p>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {error && <p className="inline-error">{error}</p>}
      {busy && project.inspirations.length === 0 && <p className="reading-line">Reading the reference…</p>}

      <input
        ref={inputRef}
        className="visually-hidden"
        type="file"
        accept="image/png,image/jpeg,image/webp,image/gif,image/avif"
        multiple
        onChange={(event) => {
          if (event.target.files) void handleFiles(event.target.files);
          event.target.value = '';
        }}
      />

      {settingsOpen && (
        <VisionSettings
          initialConfig={visionConfig}
          initialKey={visionKey}
          initialRemember={visionRemember}
          onClose={() => setSettingsOpen(false)}
          onSave={(config, key, remember) => {
            saveVisionConfig(config);
            saveVisionKey(key, remember);
            setVisionConfig(config);
            setVisionKey(key);
            setVisionRemember(remember);
            setSettingsOpen(false);
            setVisionError(null);
          }}
        />
      )}
    </section>
  );
}
