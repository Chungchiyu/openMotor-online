import { useMemo, useState } from 'react';
import type { PerforatedGrain } from '../physics/grains/base';
import { cloneGrain } from '../physics/grains';
import { computeGrainPreview, type GrainPreview } from '../physics/preview';
import type { SimulationResult } from '../physics/simResult';
import { GrainPreviewCanvas } from './GrainPreviewCanvas';

interface Props {
  result: SimulationResult;
}

/**
 * One time slider driving a table with one row per grain — each row its own small cross-section
 * thumbnail plus mass/mass flow/mass flux/web — all updating together as the slider moves.
 * Matches the original desktop app's grain results table (uilib/widgets/resultsWidget.py:
 * `grainTableFields = ('mass', 'massFlow', 'massFlux', 'web')`, one thumbnail per row), rather
 * than showing a single grain picked from a dropdown.
 */
export function TimeScrubberPanel({ result }: Props) {
  const numSteps = result.channels.time.length;
  const [stepIndex, setStepIndex] = useState(0);

  const previews = useMemo<(GrainPreview | null)[]>(
    () =>
      result.grains.map((g) => {
        try {
          // Preview generation mutates an FmmGrain's internal geometry cache (mapDim, coreMap, the
          // face-area/perimeter lookup tables) down to a small preview resolution. Doing that
          // directly on `g` — a grain the live SimulationResult still owns — would corrupt the
          // tables the simulation relies on (getPortArea -> getFaceArea would then throw once
          // they're gone); cloning first keeps the preview's mutation off to the side.
          return computeGrainPreview(cloneGrain(g) as PerforatedGrain);
        } catch {
          return null;
        }
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [result],
  );

  const time = result.channels.time[stepIndex] ?? 0;

  return (
    <div className="time-scrubber-panel">
      <div className="time-scrubber-header">
        <span>t = {time.toFixed(3)}s</span>
      </div>
      <input
        type="range"
        min={0}
        max={Math.max(numSteps - 1, 0)}
        value={stepIndex}
        onChange={(e) => setStepIndex(Number(e.target.value))}
        className="time-slider"
      />
      <table className="grains-results-table">
        <thead>
          <tr>
            <th>Grain</th>
            <th>Cross-section</th>
            <th>Mass</th>
            <th>Mass Flow</th>
            <th>Mass Flux</th>
            <th>Web Left</th>
          </tr>
        </thead>
        <tbody>
          {result.grains.map((grain, gid) => {
            const regression = result.multiChannels.regression[stepIndex]?.[gid] ?? 0;
            const mass = result.multiChannels.mass[stepIndex]?.[gid];
            const massFlow = result.multiChannels.massFlow[stepIndex]?.[gid];
            const massFlux = result.multiChannels.massFlux[stepIndex]?.[gid];
            const web = result.multiChannels.web[stepIndex]?.[gid];
            return (
              <tr key={gid}>
                <td>{gid + 1}</td>
                <td>
                  <GrainPreviewCanvas
                    preview={previews[gid]}
                    regDist={regression}
                    diameter={(grain as PerforatedGrain).diameter}
                    showContours={false}
                    size={72}
                  />
                </td>
                <td>{mass !== undefined ? `${(mass * 1000).toFixed(1)} g` : '-'}</td>
                <td>{massFlow !== undefined ? `${massFlow.toFixed(3)} kg/s` : '-'}</td>
                <td>{massFlux !== undefined ? `${massFlux.toFixed(1)} kg/(m²s)` : '-'}</td>
                <td>{web !== undefined ? `${(web * 1000).toFixed(2)} mm` : '-'}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
