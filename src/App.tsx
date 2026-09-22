import { useEffect, useRef, useState } from 'react';
import './App.css';
import { Motor } from './physics/motor';
import type { SimulationResult } from './physics/simResult';
import { defaultMotorConfig, defaultNozzle, type MotorDesign } from './physics/types';
import { autosave, downloadDesign, loadAutosave, parseDesignFile } from './persistence';
import { MotorBuilder, type Selection } from './ui/MotorBuilder';
import { ResultsPanel } from './ui/ResultsPanel';

function blankDesign(): MotorDesign {
  return { grains: [], propellant: null, nozzle: defaultNozzle(), config: defaultMotorConfig() };
}

function App() {
  const [design, setDesign] = useState<MotorDesign>(() => loadAutosave() ?? blankDesign());
  const [selection, setSelection] = useState<Selection>(null);
  const [result, setResult] = useState<SimulationResult | null>(null);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    autosave(design);
  }, [design]);

  const updateDesign = (updater: (d: MotorDesign) => MotorDesign) => {
    setDesign((d) => updater(d));
  };

  const handleNew = () => {
    if (!window.confirm('Start a new, blank motor design? Unsaved changes will be lost.')) return;
    setDesign(blankDesign());
    setSelection(null);
    setResult(null);
  };

  const handleSave = () => downloadDesign(design, 'motor.json');

  const handleLoadClick = () => fileInputRef.current?.click();

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
      <header className="toolbar">
        <h1>openMotor Online</h1>
        <div className="toolbar-actions">
          <button onClick={handleNew}>New</button>
          <button onClick={handleSave}>Save</button>
          <button onClick={handleLoadClick}>Load</button>
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
          <button className="primary" onClick={handleRun} disabled={running}>
            {running ? 'Running…' : 'Run Simulation'}
          </button>
        </div>
      </header>

      {error && <div className="error-banner">{error}</div>}

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

export default App;
