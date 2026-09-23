import type { SimProgress } from '../physics/motor';

interface Props {
  progress: SimProgress;
  onCancel: () => void;
}

/**
 * Shown while a simulation runs via `Motor.runSimulationChunked` — a real progress bar with a
 * Cancel button that actually interrupts the run, since the chunked path yields to the event loop
 * (during both grain setup and the timestep loop) instead of blocking it start-to-finish. Matches
 * the original desktop app's SimulatingDialog.
 *
 * `progress.phase` is shown as a distinct label rather than folded into one 0-1 number together
 * with the timestep loop's progress: "50%" would mean two very different things depending on
 * whether it's mid-setup (building a Star/Moon Burner grain's burn-perimeter table, see
 * `FmmGrain.simulationSetupChunked`) or mid-burn, and setup duration doesn't scale with burn
 * duration, so there's no principled way to blend them into a single meaningful percentage.
 */
export function ProgressDialog({ progress, onCancel }: Props) {
  const pct = Math.round(progress.fraction * 100);
  return (
    <div className="about-dialog-backdrop">
      <div className="progress-dialog">
        <h2>{progress.phase === 'setup' ? 'Preparing Geometry…' : 'Running Simulation…'}</h2>
        <div className="progress-track">
          <div className="progress-fill" style={{ width: `${pct}%` }} />
        </div>
        <div className="field-note">{pct}%</div>
        <button onClick={onCancel}>Cancel</button>
      </div>
    </div>
  );
}
