import { useCallback, useEffect, useState } from 'react';
import { useProject } from './state/useProject';
import type { AssetKind, ProjectState } from './types';
import { JourneyRail } from './components/JourneyRail';
import { LabView } from './components/LabView';
import { InspirationPanel } from './components/InspirationPanel';
import { Inspector } from './components/Inspector';
import { DevelopView } from './components/DevelopView';
import { GuideView } from './components/GuideView';
import { Icon } from './components/Icon';
import { renderAsset } from './lib/render';
import { bufferToCanvas } from './lib/raster';
import {
  buildMotionSheet,
  buildStyleBoard,
  downloadBlob,
  downloadCanvas,
  exportStylePack,
  projectJson,
  slugify,
  styleGuideJson,
} from './lib/export';

type Screen = 'lab' | 'develop' | 'guide';

export default function App() {
  const actions = useProject();
  const { project, selected } = actions;
  const [screen, setScreen] = useState<Screen>(() => (project.anchor ? 'guide' : 'lab'));
  const [prompt, setPrompt] = useState(project.prompt);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setPrompt(project.prompt);
  }, [project.prompt]);

  useEffect(() => {
    if (screen === 'guide' && !project.anchor) setScreen('lab');
    if (screen === 'develop' && !selected) setScreen('lab');
  }, [project.anchor, screen, selected]);

  const flash = useCallback((message: string) => {
    setNotice(message);
    window.setTimeout(() => setNotice(null), 2800);
  }, []);

  const handleLock = (kind: AssetKind, seed: number) => {
    const anchor = actions.lockAnchor(kind, seed);
    if (anchor) {
      setScreen('guide');
      flash(`${anchor.name} locked as the North Star.`);
    }
  };

  const handleNewSession = () => {
    actions.newSession();
    setScreen('lab');
    setPrompt('');
  };

  const handleResetDemo = () => {
    actions.resetDemo();
    setScreen('lab');
  };

  const handleImport = (incoming: ProjectState) => {
    actions.importProject(incoming);
    setPrompt(incoming.prompt);
    setScreen(incoming.anchor ? 'guide' : 'lab');
    flash('Project imported. The journey is intact.');
  };

  const handleExportBoard = () => {
    if (!project.anchor) return;
    const canvas = buildStyleBoard(project, project.anchor, project.anchor.signature);
    downloadCanvas(canvas, `${slugify(project.anchor.name)}-style-guide.png`);
    actions.logEvent('export', 'Exported style guide board', project.anchor.name);
    flash('Style guide board exported.');
  };

  const handleExportAnchor = () => {
    if (!project.anchor) return;
    const buffer = renderAsset(project.anchor.kind, project.anchor.dna, project.anchor.seed, {
      stage: 'final',
      phase: 0.15,
    });
    downloadCanvas(bufferToCanvas(buffer, 4), `${slugify(project.anchor.name)}@4x.png`);
    actions.logEvent('export', 'Exported anchor sprite', project.anchor.name);
    flash('Anchor exported at 4x.');
  };

  const handleExportMotion = () => {
    if (!project.anchor) return;
    downloadCanvas(buildMotionSheet(project.anchor), `${slugify(project.anchor.name)}-motion.png`);
    actions.logEvent('export', 'Exported motion sheet', project.anchor.name);
    flash('Motion sheet exported.');
  };

  const handleExportGuide = () => {
    if (!project.anchor) return;
    const json = styleGuideJson(project, project.anchor, project.anchor.signature);
    downloadBlob(new Blob([json], { type: 'application/json' }), `${slugify(project.anchor.name)}-style-guide.json`);
    actions.logEvent('export', 'Exported style guide JSON', project.anchor.name);
    flash('Style guide JSON exported.');
  };

  const handleExportProject = () => {
    downloadBlob(new Blob([projectJson(project)], { type: 'application/json' }), `${slugify(project.name)}.isofoundry.json`);
    actions.logEvent('export', 'Exported project archive', project.name);
    flash('Project archive exported.');
  };

  const handleExportPack = async () => {
    if (!project.anchor || busy) return;
    setBusy(true);
    try {
      await exportStylePack(project, project.anchor, project.anchor.signature);
      actions.logEvent('export', 'Exported full style pack', project.anchor.name);
      flash('Style pack exported.');
    } catch (error) {
      console.error(error);
      flash('Export failed. Check the browser console.');
    } finally {
      setBusy(false);
    }
  };

  const showInspector = screen === 'lab';

  return (
    <div className="app">
      <header className="topbar">
        <button type="button" className="brand" onClick={() => setScreen('lab')}>
          <span className="brand__mark">
            <Icon name="diamond" size={21} />
          </span>
          <span className="brand__text">
            <strong>ISOFOUNDRY</strong>
            <small>ISOMETRIC STYLE LAB</small>
          </span>
        </button>

        <nav className="steps" aria-label="Workflow">
          <button type="button" className={screen === 'lab' ? 'is-active' : ''} onClick={() => setScreen('lab')}>
            <span>01</span> Style lab
          </button>
          <button
            type="button"
            className={screen === 'develop' ? 'is-active' : ''}
            disabled={!selected}
            onClick={() => setScreen('develop')}
          >
            <span>02</span> North Star
          </button>
          <button
            type="button"
            className={screen === 'guide' ? 'is-active' : ''}
            disabled={!project.anchor}
            onClick={() => setScreen('guide')}
          >
            <span>03</span> Style guide
          </button>
        </nav>

        <div className="topbar__right">
          <span className="local-badge">
            <span className="save-dot" /> LOCAL / v0.1
          </span>
          <button
            type="button"
            className="button button--ghost button--small"
            onClick={handleExportProject}
            title="Download the full project archive"
          >
            Project .json
          </button>
          <button
            type="button"
            className="button button--primary button--small"
            onClick={handleExportPack}
            disabled={!project.anchor || busy}
            title={project.anchor ? 'Export the full style pack' : 'Lock a North Star first'}
          >
            <Icon name="export" size={14} />
            {busy ? 'Packing…' : 'Export'}
          </button>
        </div>
      </header>

      <div className={`workspace ${showInspector ? '' : 'workspace--wide'}`}>
        <JourneyRail
          project={project}
          onRename={actions.renameProject}
          onNewSession={handleNewSession}
          onResetDemo={handleResetDemo}
          onImport={handleImport}
        />

        <main className="main">
          {screen === 'lab' && (
            <LabView
              prompt={prompt}
              setPrompt={setPrompt}
              directions={project.directions}
              selectedId={project.selectedDirectionId}
              selected={selected}
              locks={project.lockedTraits}
              hasInspiration={project.inspirations.length > 0}
              inspiration={(
                <InspirationPanel
                  project={project}
                  onAdd={actions.addInspiration}
                  onRemove={actions.removeInspiration}
                  onClear={actions.clearInspirations}
                  onPrimary={actions.setPrimaryInspiration}
                  onUpdateWeight={(id, weight) => actions.updateInspiration(id, { weight })}
                  onUpdateSettings={actions.updateInspirationSettings}
                  onSetVision={actions.setInspirationVision}
                />
              )}
              onExplore={() => actions.explore(prompt)}
              onSelect={actions.selectDirection}
            />
          )}
          {screen === 'develop' && selected && (
            <DevelopView direction={selected} onLock={handleLock} onBack={() => setScreen('lab')} />
          )}
          {screen === 'guide' && project.anchor && (
            <GuideView
              project={project}
              anchor={project.anchor}
              onEdit={() => {
                setScreen('develop');
                actions.editAnchor();
              }}
              onTest={actions.testFit}
              onExportBoard={handleExportBoard}
              onExportAnchor={handleExportAnchor}
              onExportMotion={handleExportMotion}
              onExportGuide={handleExportGuide}
              onExportPack={handleExportPack}
            />
          )}
        </main>

        {showInspector && (
          <Inspector
            selected={selected}
            locks={project.lockedTraits}
            onRefine={actions.refine}
            onToggleLock={actions.toggleLock}
            onUpdate={actions.updateDNA}
            onDevelop={() => setScreen('develop')}
            onReroll={actions.reroll}
          />
        )}
      </div>

      {notice && <div className="toast">{notice}</div>}
    </div>
  );
}
