interface Props {
  progress: number; // 0-1
  onCancel: () => void;
}

/** Shown while a simulation runs via `Motor.runSimulationChunked` — a real progress bar (not an
 * indeterminate spinner) with a Cancel button that actually interrupts the run, since the chunked
 * path yields to the event loop between batches of timesteps instead of blocking it start-to-finish.
 * Matches the original desktop app's SimulatingDialog. */
export function ProgressDialog({ progress, onCancel }: Props) {
  return (
    <div className="about-dialog-backdrop">
      <div className="progress-dialog">
        <h2>Running Simulation…</h2>
        <div className="progress-track">
          <div className="progress-fill" style={{ width: `${Math.round(progress * 100)}%` }} />
        </div>
        <div className="field-note">{Math.round(progress * 100)}%</div>
        <button onClick={onCancel}>Cancel</button>
      </div>
    </div>
  );
}
