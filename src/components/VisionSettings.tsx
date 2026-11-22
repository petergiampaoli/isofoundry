import { useState } from 'react';
import type { VisionConfig } from '../lib/vision';
import { Icon } from './Icon';

interface VisionSettingsProps {
  initialConfig: VisionConfig;
  initialKey: string;
  initialRemember: boolean;
  onClose: () => void;
  onSave: (config: VisionConfig, key: string, remember: boolean) => void;
}

export function VisionSettings({
  initialConfig,
  initialKey,
  initialRemember,
  onClose,
  onSave,
}: VisionSettingsProps) {
  const [baseUrl, setBaseUrl] = useState(initialConfig.baseUrl);
  const [model, setModel] = useState(initialConfig.model);
  const [apiKey, setApiKey] = useState(initialKey);
  const [consent, setConsent] = useState(initialConfig.consent);
  const [remember, setRemember] = useState(initialRemember);

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={onClose}>
      <div
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="vision-settings-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="modal__head">
          <div>
            <div className="eyebrow">Optional vision AI</div>
            <h2 id="vision-settings-title">Inspiration reader</h2>
            <p>OpenAI-compatible endpoints. Local CV still reads the palette and finish.</p>
          </div>
          <button type="button" className="icon-button" onClick={onClose} aria-label="Close AI settings">
            <Icon name="close" size={15} />
          </button>
        </header>

        <div className="modal__body">
          <label className="field">
            <span>Base URL</span>
            <input
              value={baseUrl}
              onChange={(event) => setBaseUrl(event.target.value)}
              placeholder="https://api.openai.com/v1"
              spellCheck={false}
            />
          </label>
          <label className="field">
            <span>Model</span>
            <input
              value={model}
              onChange={(event) => setModel(event.target.value)}
              placeholder="your vision-capable model"
              spellCheck={false}
            />
          </label>
          <label className="field">
            <span>API key <em>optional for local endpoints</em></span>
            <input
              type="password"
              value={apiKey}
              onChange={(event) => setApiKey(event.target.value)}
              placeholder="sk-…"
              autoComplete="off"
              spellCheck={false}
            />
          </label>

          <div className="modal__note">
            <Icon name="sparkle" size={14} />
            <p>
              The app sends only small reference thumbnails when you press <strong>Read with AI</strong>.
              The key stays in this browser, is not written to project exports, and is cleared from the
              session when you close the tab unless you opt in below.
            </p>
          </div>

          <label className="check-row">
            <input
              type="checkbox"
              checked={remember}
              onChange={(event) => setRemember(event.target.checked)}
            />
            <span>Remember the key on this device <small>localStorage warning</small></span>
          </label>
          <label className="check-row">
            <input
              type="checkbox"
              checked={consent}
              onChange={(event) => setConsent(event.target.checked)}
            />
            <span>I understand reference thumbnails will be sent to this provider when I request an AI read.</span>
          </label>
        </div>

        <footer className="modal__footer">
          <span className="muted">OpenAI, OpenRouter, LM Studio, Ollama, and compatible endpoints.</span>
          <div>
            <button type="button" className="button button--ghost" onClick={onClose}>Cancel</button>
            <button
              type="button"
              className="button button--primary"
              onClick={() => onSave({ baseUrl: baseUrl.trim(), model: model.trim(), consent }, apiKey.trim(), remember)}
            >
              Save settings
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
}
