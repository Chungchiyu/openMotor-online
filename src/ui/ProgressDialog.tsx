interface Props {
  progress: number; // 0-1
  onCancel: () => void;
}

/**
 * Shown while a simulation runs via `Motor.runSimulationChunked` — a real progress bar with a
 * Cancel button that actually interrupts the run, since the chunked path yields to the event loop
 * between batches of timesteps instead of blocking it start-to-finish. Matches the original desktop
 * app's SimulatingDialog.
 *
 * `progress` reads exactly 0 both before the run starts and throughout validation + grain setup —
 * `runSimulationChunked` doesn't call `onProgress` again until the timestep loop's first step, and
 * for a Star/Moon Burner grain that setup step (building the fast-marching regression map and its
 * burn-area/perimeter tables) can itself take seconds as one synchronous block. A width-based fill
 * would just sit frozen at 0% for that whole stretch, indistinguishable from a hung tab. Below 0 a
 * CSS animation switches in instead — see `.progress-fill.indeterminate` in App.css for why that
 * keeps moving when a determinate bar couldn't.
 */
export function ProgressDialog({ progress, onCancel }: Props) {
  const indeterminate = progress <= 0;
  return (
    <div className="about-dialog-backdrop">
      <div className="progress-dialog">
        <h2>{indeterminate ? 'Preparing Simulation…' : 'Running Simulation…'}</h2>
        <div className="progress-track">
          {indeterminate ? (
            <div className="progress-fill indeterminate" />
          ) : (
            <div className="progress-fill" style={{ width: `${Math.round(progress * 100)}%` }} />
          )}
        </div>
        <div className="field-note">{indeterminate ? ' ' : `${Math.round(progress * 100)}%`}</div>
        <button onClick={onCancel}>Cancel</button>
      </div>
    </div>
  );
}
