import { useEffect, useRef, useState } from 'react';
import './App.css';
import { Motor } from './physics/motor';
import type { SimulationResult } from './physics/simResult';
import { defaultMotorConfig, defaultNozzle, type MotorDesign } from './physics/types';
import { autosave, downloadDesign, loadAutosave, parseDesignFile } from './persistence';
import { MotorBuilder, type Selection } from './ui/MotorBuilder';
import { ResultsPanel } from './ui/ResultsPanel';
import { UnitsProvider, useUnits, type LengthUnit } from './ui/UnitsContext';

function blankDesign(): MotorDesign {
  return { grains: [], propellant: null, nozzle: defaultNozzle(), config: defaultMotorConfig() };
}

function UnitPicker() {
  const { lengthUnit, setLengthUnit } = useUnits();
  return (
    <label className="unit-picker">
      Units
      <select value={lengthUnit} onChange={(e) => setLengthUnit(e.target.value as LengthUnit)}>
        <option value="mm">mm</option>
        <option value="cm">cm</option>
        <option value="in">in</option>
        <option value="m">m</option>
      </select>
    </label>
  );
}

function AppInner() {
  const [design, setDesign] = useState<MotorDesign>(() => loadAutosave() ?? blankDesign());
  const [selection, setSelection] = useState<Selection>(null);
  const [result, setResult] = useState<SimulationResult | null>(null);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showAbout, setShowAbout] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    autosave(design);
  }, [design]);

  const updateDesign = (updater: (d: MotorDesign) => MotorDesign) => {
    setDesign((d) => updater(d));
  };

  const closeMenus = () => {
    document.querySelectorAll<HTMLDetailsElement>('.menu-bar details[open]').forEach((d) => {
      d.removeAttribute('open');
    });
  };

  const handleNew = () => {
    closeMenus();
    if (!window.confirm('Start a new, blank motor design? Unsaved changes will be lost.')) return;
    setDesign(blankDesign());
    setSelection(null);
    setResult(null);
  };

  const handleSave = () => {
    closeMenus();
    downloadDesign(design, 'motor.json');
  };

  const handleLoadClick = () => {
    closeMenus();
    fileInputRef.current?.click();
  };

  const handleFileSelected = async (file: File) => {
    try {
      const text = await file.text();
      const loaded = parseDesignFile(text);
      setDesign(loaded);
      setSelection(null);
      setResult(null);
      setError(null);
    } catch {
      setError('Could not read that file — is it a valid openMotor Online design?');
    }
  };

  const handleRun = () => {
    closeMenus();
    setRunning(true);
    setError(null);
    // Let the "running" state paint before the (synchronous) simulation blocks the main thread.
    setTimeout(() => {
      try {
        const motor = new Motor(design);
        const simResult = motor.runSimulation();
        setResult(simResult);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Simulation failed');
        setResult(null);
      } finally {
        setRunning(false);
      }
    }, 10);
  };

  return (
    <div className="app">
      <nav className="menu-bar">
        <details>
          <summary>File</summary>
          <div className="menu-dropdown">
            <button onClick={handleNew}>New</button>
            <button onClick={handleSave}>Save</button>
            <button onClick={handleLoadClick}>Load…</button>
          </div>
        </details>
        <details>
          <summary>Simulate</summary>
          <div className="menu-dropdown">
            <button onClick={handleRun} disabled={running}>
              {running ? 'Running…' : 'Run Simulation'}
            </button>
          </div>
        </details>
        <details>
          <summary>Help</summary>
          <div className="menu-dropdown">
            <button
              onClick={() => {
                closeMenus();
                setShowAbout(true);
              }}
            >
              About
            </button>
          </div>
        </details>

        <span className="menu-bar-title">openMotor Online</span>

        <div className="menu-bar-right">
          <UnitPicker />
          <button className="primary" onClick={handleRun} disabled={running}>
            {running ? 'Running…' : 'Run Simulation'}
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
      </nav>

      {error && <div className="error-banner">{error}</div>}

      {showAbout && (
        <div className="about-dialog-backdrop" onClick={() => setShowAbout(false)}>
          <div className="about-dialog" onClick={(e) => e.stopPropagation()}>
            <h2>openMotor Online</h2>
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

      <main className="main-columns">
        <section className="left-column">
          <MotorBuilder design={design} selection={selection} onSelectionChange={setSelection} onDesignChange={updateDesign} />
        </section>
        <section className="right-column">
          <ResultsPanel result={result} running={running} />
        </section>
      </main>
    </div>
  );
}

function App() {
  return (
    <UnitsProvider>
      <AppInner />
    </UnitsProvider>
  );
}

export default App;
