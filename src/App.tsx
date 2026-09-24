import { useEffect, useRef, useState } from 'react';
import './App.css';
import { buildBurnSimFile, parseBurnSimFile } from './exporters/burnsim';
import { buildCsvFile } from './exporters/csv';
import { buildEngFile, type EngSettings } from './exporters/eng';
import { useHistory } from './history';
import { Motor, type SimProgress } from './physics/motor';
import type { SimulationResult } from './physics/simResult';
import { defaultMotorConfig, defaultNozzle, type MotorDesign } from './physics/types';
import {
  autosave,
  downloadDesign,
  downloadTextFile,
  loadAutosave,
  loadOpenRecordId,
  parseDesignFile,
  saveOpenRecordId,
} from './persistence';
import { exportMotorRic, importMotorRic } from './ric';
import { createDesignRecord, getDesignRecord, updateDesignRecord, type DesignRecord } from './storage/designStore';
import { migrateLegacyRecentFilesIfNeeded } from './storage/migrateLegacyRecentFiles';
import { AlertsModal } from './ui/AlertsModal';
import { EngExportDialog } from './ui/EngExportDialog';
import { FileManagerDialog } from './ui/FileManagerDialog';
import { MotorBuilder, type Selection } from './ui/MotorBuilder';
import { PreferencesDialog } from './ui/PreferencesDialog';
import { PropellantLibraryProvider } from './ui/PropellantLibraryContext';
import { ProgressDialog } from './ui/ProgressDialog';
import { ResultsPanel } from './ui/ResultsPanel';
import { ThemeToggle } from './ui/ThemeToggle';
import { ToolsMenu } from './ui/ToolsMenu';
import { UnitsProvider, useUnits } from './ui/UnitsContext';
import { useTheme } from './ui/useTheme';
import { APP_VERSION } from './version';

function blankDesign(): MotorDesign {
  return { grains: [], propellant: null, nozzle: defaultNozzle(), config: defaultMotorConfig() };
}

function AppInner() {
  const history = useHistory<MotorDesign>(() => loadAutosave() ?? blankDesign());
  const design = history.value;
  const { unitFor } = useUnits();
  const { theme, toggleTheme } = useTheme();

  const [selection, setSelection] = useState<Selection>(null);
  const [result, setResult] = useState<SimulationResult | null>(null);
  const [runProgress, setRunProgress] = useState<SimProgress | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showAbout, setShowAbout] = useState(false);
  const [showPreferences, setShowPreferences] = useState(false);
  const [showAlerts, setShowAlerts] = useState(false);
  const [showEngExport, setShowEngExport] = useState(false);
  const [showFileManager, setShowFileManager] = useState(false);
  const [openRecord, setOpenRecord] = useState<DesignRecord | null>(null);

  const cancelRef = useRef(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const burnsimInputRef = useRef<HTMLInputElement>(null);
  const ricInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    autosave(design);
  }, [design]);

  useEffect(() => {
    saveOpenRecordId(openRecord?.id ?? null);
  }, [openRecord]);

  // Reconnects to whichever File Manager record was open before a reload — the design content
  // itself already came back via autosave, so this only needs to restore the id/name link (and
  // silently drop it if that record was since deleted).
  useEffect(() => {
    void (async () => {
      await migrateLegacyRecentFilesIfNeeded();
      const savedId = loadOpenRecordId();
      if (!savedId) return;
      const record = await getDesignRecord(savedId);
      if (record) setOpenRecord(record);
    })();
  }, []);

  const updateDesign = (updater: (d: MotorDesign) => MotorDesign) => {
    history.set(updater);
  };

  const loadDesign = (next: MotorDesign, record: DesignRecord | null = null) => {
    history.reset(next);
    setSelection(null);
    setResult(null);
    setError(null);
    setOpenRecord(record);
  };

  const handleNew = () => {
    if (!window.confirm('Start a new, blank motor design? Unsaved changes will be lost.')) return;
    loadDesign(blankDesign());
  };

  const handleSaveAsNew = async () => {
    const name = window.prompt('Save design as:', openRecord?.name ?? 'motor');
    if (!name) return;
    const record = await createDesignRecord(name, design);
    setOpenRecord(record);
  };

  const handleSave = async () => {
    if (openRecord) {
      setOpenRecord(await updateDesignRecord(openRecord.id, { design }));
    } else {
      await handleSaveAsNew();
    }
  };

  const handleLoadClick = () => fileInputRef.current?.click();

  const handleFileSelected = async (file: File) => {
    try {
      const text = await file.text();
      const loaded = parseDesignFile(text);
      loadDesign(loaded);
    } catch {
      setError('Could not read that file — is it a valid openMotor Online design?');
    }
  };

  const handleFileManagerOpen = (record: DesignRecord) => {
    loadDesign(record.design, record);
    setShowFileManager(false);
  };

  const handleImportRicClick = () => ricInputRef.current?.click();

  const handleImportRicFile = async (file: File) => {
    try {
      const text = await file.text();
      const { design: imported, errors } = importMotorRic(text);
      loadDesign(imported);
      if (errors.length > 0) setError(errors.join(' '));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not read that .ric file.');
    }
  };

  const handleExportRic = () => {
    downloadTextFile(exportMotorRic(design), `${openRecord?.name ?? 'motor'}.ric`, 'application/x-yaml');
  };

  const handleImportBurnSimClick = () => burnsimInputRef.current?.click();

  const handleBurnSimFileSelected = async (file: File) => {
    try {
      const text = await file.text();
      const { design: imported, errors } = parseBurnSimFile(text, defaultMotorConfig(), defaultNozzle());
      loadDesign(imported);
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
              <button onClick={() => void handleSave()}>Save{openRecord ? ` (${openRecord.name})` : ''}</button>
              <button onClick={() => void handleSaveAsNew()}>Save As New…</button>
              <button onClick={() => setShowFileManager(true)}>File Manager…</button>
            </div>
            <div className="tools-dropdown-group">
              <div className="tools-dropdown-heading">Import</div>
              <button onClick={handleLoadClick}>Design File (.json)…</button>
              <button onClick={handleImportRicClick}>.ric File…</button>
              <button onClick={handleImportBurnSimClick}>BurnSim File…</button>
            </div>
            <div className="tools-dropdown-group">
              <div className="tools-dropdown-heading">Export</div>
              <button onClick={() => downloadDesign(design, 'motor.json')}>Design File (.json)</button>
              <button onClick={handleExportRic}>.ric File</button>
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
          <ThemeToggle theme={theme} onToggle={toggleTheme} />
          <button className="primary run-button" onClick={() => void handleRun()} disabled={runProgress !== null}>
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
        <input
          ref={ricInputRef}
          type="file"
          accept=".ric"
          style={{ display: 'none' }}
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void handleImportRicFile(file);
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

      {showFileManager && (
        <FileManagerDialog
          currentDesign={design}
          onClose={() => setShowFileManager(false)}
          onOpenDesign={handleFileManagerOpen}
          onSavedAsNew={setOpenRecord}
        />
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
