import { useEffect, useRef, useState } from 'react';
import './App.css';
import { buildBurnSimFile, parseBurnSimFile } from './exporters/burnsim';
import { buildCsvFile } from './exporters/csv';
import { buildEngFile, type EngSettings } from './exporters/eng';
import { useHistory } from './history';
import { Motor, type SimProgress } from './physics/motor';
import type { SimulationResult } from './physics/simResult';
import { defaultMotorConfig, defaultNozzle, type MotorDesign } from './physics/types';
import { autosave, downloadDesign, downloadTextFile, loadAutosave, parseDesignFile } from './persistence';
import { addRecentFile, loadRecentFiles, type RecentFileEntry } from './recentFiles';
import { AlertsModal } from './ui/AlertsModal';
import { EngExportDialog } from './ui/EngExportDialog';
import { MotorBuilder, type Selection } from './ui/MotorBuilder';
import { PreferencesDialog } from './ui/PreferencesDialog';
import { PropellantLibraryProvider } from './ui/PropellantLibraryContext';
import { ProgressDialog } from './ui/ProgressDialog';
import { ResultsPanel } from './ui/ResultsPanel';
import { ToolsMenu } from './ui/ToolsMenu';
import { UnitsProvider, useUnits } from './ui/UnitsContext';
import { APP_VERSION } from './version';

function blankDesign(): MotorDesign {
  return { grains: [], propellant: null, nozzle: defaultNozzle(), config: defaultMotorConfig() };
}

function AppInner() {
  const history = useHistory<MotorDesign>(() => loadAutosave() ?? blankDesign());
  const design = history.value;
  const { unitFor } = useUnits();

  const [selection, setSelection] = useState<Selection>(null);
  const [result, setResult] = useState<SimulationResult | null>(null);
  const [runProgress, setRunProgress] = useState<SimProgress | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showAbout, setShowAbout] = useState(false);
  const [showPreferences, setShowPreferences] = useState(false);
  const [showAlerts, setShowAlerts] = useState(false);
  const [showEngExport, setShowEngExport] = useState(false);
  const [recentFiles, setRecentFiles] = useState<RecentFileEntry[]>(() => loadRecentFiles());

  const cancelRef = useRef(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const burnsimInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    autosave(design);
  }, [design]);

  const updateDesign = (updater: (d: MotorDesign) => MotorDesign) => {
    history.set(updater);
  };

  const loadDesign = (next: MotorDesign, name?: string) => {
    history.reset(next);
    setSelection(null);
    setResult(null);
    setError(null);
    if (name) {
      addRecentFile(name, next);
      setRecentFiles(loadRecentFiles());
    }
  };

  const handleNew = () => {
    if (!window.confirm('Start a new, blank motor design? Unsaved changes will be lost.')) return;
    loadDesign(blankDesign());
  };

  const handleSave = () => {
    downloadDesign(design, 'motor.json');
    addRecentFile('motor.json', design);
    setRecentFiles(loadRecentFiles());
  };

  const handleLoadClick = () => fileInputRef.current?.click();

  const handleFileSelected = async (file: File) => {
    try {
      const text = await file.text();
      const loaded = parseDesignFile(text);
      loadDesign(loaded, file.name);
    } catch {
      setError('Could not read that file — is it a valid openMotor Online design?');
    }
  };

  const handleOpenRecent = (entry: RecentFileEntry) => loadDesign(entry.design, entry.name);

  const handleImportBurnSimClick = () => burnsimInputRef.current?.click();

  const handleBurnSimFileSelected = async (file: File) => {
    try {
      const text = await file.text();
      const { design: imported, errors } = parseBurnSimFile(text, defaultMotorConfig(), defaultNozzle());
      loadDesign(imported, file.name);
      if (errors.length > 0) setError(errors.join(' '));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not read that BurnSim file.');
    }
  };

  const handleExportBurnSim = () => {
    if (!design.propellant) {
      setError('The current motor must have a propellant set to export as a BurnSim file.');
      return;
    }
    const { xml, skipped } = buildBurnSimFile(design);
    downloadTextFile(xml, 'motor.bsx', 'application/xml');
    if (skipped.length > 0) {
      setError(`Skipped grain(s) with no BurnSim equivalent: ${skipped.map((s) => `#${s.index} (${s.type})`).join(', ')}. The rest of the motor was exported.`);
    }
  };

  const handleExportCsv = () => {
    if (!result) {
      setError('Must run a simulation to export a .csv file.');
      return;
    }
    downloadTextFile(buildCsvFile(result, unitFor), 'motor.csv', 'text/csv');
  };

  const handleExportImage = () => {
    const canvas = document.querySelector<HTMLCanvasElement>('.graph-tab-chart canvas');
    if (!canvas) {
      setError('Open the Graph tab (with a completed simulation) to export it as an image.');
      return;
    }
    // The original only sets the plot's title (its full designation, e.g. "1297H128") when SAVING
    // the graph, not on the always-visible on-screen chart (see `graphWidget.py`'s `saveImage` vs
    // `showData`) — reproduced here by drawing it onto a copy of the canvas at export time only.
    const titled = document.createElement('canvas');
    const titleHeight = 32;
    titled.width = canvas.width;
    titled.height = canvas.height + titleHeight * (window.devicePixelRatio || 1);
    const ctx = titled.getContext('2d');
    if (ctx && result) {
      const dpr = window.devicePixelRatio || 1;
      ctx.fillStyle = getComputedStyle(document.body).backgroundColor || '#1a1a1a';
      ctx.fillRect(0, 0, titled.width, titled.height);
      ctx.fillStyle = getComputedStyle(document.body).color || '#eee';
      ctx.font = `${16 * dpr}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(result.getFullDesignation(), titled.width / 2, (titleHeight * dpr) / 2);
      ctx.drawImage(canvas, 0, titleHeight * dpr);
    }
    const url = (ctx ? titled : canvas).toDataURL('image/png');
    const a = document.createElement('a');
    a.href = url;
    a.download = 'motor-graph.png';
    a.click();
  };

  const handleExportEng = (settings: EngSettings) => {
    if (!result) return;
    downloadTextFile(buildEngFile(result, settings), 'motor.eng', 'text/plain');
    setShowEngExport(false);
  };

  const handleRun = async () => {
    setError(null);
    cancelRef.current = false;
    setRunProgress({ phase: 'setup', fraction: 0 });
    const motor = new Motor(design);
    try {
      const simResult = await motor.runSimulationChunked(
        (p) => setRunProgress(p),
        () => cancelRef.current,
      );
      if (simResult) {
        setResult(simResult);
        if (simResult.alerts.length > 0) setShowAlerts(true);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Simulation failed');
      setResult(null);
    } finally {
      setRunProgress(null);
    }
  };

  return (
    <div className="app">
      <nav className="menu-bar">
        <div className="menu-item">
          <span className="menu-label">File</span>
          <div className="menu-dropdown tools-dropdown">
            <div className="tools-dropdown-group">
              <button onClick={handleNew}>New</button>
              <button onClick={handleSave}>Save</button>
              <button onClick={handleLoadClick}>Load…</button>
            </div>
            <div className="tools-dropdown-group">
              <div className="tools-dropdown-heading">Open Recent</div>
              {recentFiles.length === 0 ? (
                <div className="recent-files-empty">No recent files</div>
              ) : (
                recentFiles.map((entry) => (
                  <button key={entry.name + entry.savedAt} onClick={() => handleOpenRecent(entry)}>
                    {entry.name}
                  </button>
                ))
              )}
            </div>
            <div className="tools-dropdown-group">
              <div className="tools-dropdown-heading">Import</div>
              <button onClick={handleImportBurnSimClick}>BurnSim File…</button>
            </div>
            <div className="tools-dropdown-group">
              <div className="tools-dropdown-heading">Export</div>
              <button onClick={handleExportCsv}>CSV File</button>
              <button onClick={() => setShowEngExport(true)} disabled={!result}>
                .eng File
              </button>
              <button onClick={handleExportBurnSim}>BurnSim File</button>
              <button onClick={handleExportImage}>Graph Image (PNG)</button>
            </div>
          </div>
        </div>

        <div className="menu-item">
          <span className="menu-label">Edit</span>
          <div className="menu-dropdown">
            <button onClick={history.undo} disabled={!history.canUndo}>
              Undo
            </button>
            <button onClick={history.redo} disabled={!history.canRedo}>
              Redo
            </button>
            <button onClick={() => setShowPreferences(true)}>Preferences…</button>
          </div>
        </div>

        <div className="menu-item">
          <span className="menu-label">Simulate</span>
          <div className="menu-dropdown">
            <button onClick={() => void handleRun()} disabled={runProgress !== null}>
              {runProgress !== null ? 'Running…' : 'Run Simulation'}
            </button>
          </div>
        </div>

        <ToolsMenu design={design} onApply={(next) => updateDesign(() => next)} />

        <div className="menu-item">
          <span className="menu-label">Help</span>
          <div className="menu-dropdown">
            <button onClick={() => setShowAbout(true)}>About</button>
          </div>
        </div>

        <span className="menu-bar-title">openMotor Online</span>

        <div className="menu-bar-right">
          <button className="primary" onClick={() => void handleRun()} disabled={runProgress !== null}>
            {runProgress !== null ? 'Running…' : 'Run Simulation'}
          </button>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept="application/json"
          style={{ display: 'none' }}
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void handleFileSelected(file);
            e.target.value = '';
          }}
        />
        <input
          ref={burnsimInputRef}
          type="file"
          accept=".bsx"
          style={{ display: 'none' }}
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void handleBurnSimFileSelected(file);
            e.target.value = '';
          }}
        />
      </nav>

      {error && <div className="error-banner">{error}</div>}

      {runProgress !== null && <ProgressDialog progress={runProgress} onCancel={() => (cancelRef.current = true)} />}

      {showAbout && (
        <div className="about-dialog-backdrop" onClick={() => setShowAbout(false)}>
          <div className="about-dialog" onClick={(e) => e.stopPropagation()}>
            <h2>openMotor Online</h2>
            <p className="field-note">Version {APP_VERSION}</p>
            <p>
              A client-side web port of{' '}
              <a href="https://github.com/reilleya/openMotor" target="_blank" rel="noreferrer">
                openMotor
              </a>
              , the open-source solid rocket motor internal ballistics simulator.
            </p>
            <button onClick={() => setShowAbout(false)}>Close</button>
          </div>
        </div>
      )}

      {showPreferences && <PreferencesDialog onClose={() => setShowPreferences(false)} />}
      {showAlerts && result && <AlertsModal alerts={result.alerts} onClose={() => setShowAlerts(false)} />}
      {showEngExport && result && (
        <EngExportDialog defaultDesignation={result.getDesignation()} onExport={handleExportEng} onClose={() => setShowEngExport(false)} />
      )}

      <main className="main-columns">
        <section className="left-column">
          <MotorBuilder design={design} selection={selection} onSelectionChange={setSelection} onDesignChange={updateDesign} />
        </section>
        <section className="right-column">
          <ResultsPanel result={result} running={runProgress !== null} />
        </section>
      </main>
    </div>
  );
}

function App() {
  return (
    <UnitsProvider>
      <PropellantLibraryProvider>
        <AppInner />
      </PropellantLibraryProvider>
    </UnitsProvider>
  );
}

export default App;
