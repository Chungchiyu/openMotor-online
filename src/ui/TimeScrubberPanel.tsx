import { useMemo, useState } from 'react';
import type { PerforatedGrain } from '../physics/grains/base';
import { computeGrainPreview } from '../physics/preview';
import type { SimulationResult } from '../physics/simResult';
import { GrainPreviewCanvas } from './GrainPreviewCanvas';

interface Props {
  result: SimulationResult;
}

export function TimeScrubberPanel({ result }: Props) {
  const numSteps = result.channels.time.length;
  const [grainIndex, setGrainIndex] = useState(0);
  const [stepIndex, setStepIndex] = useState(0);

  const grain = result.grains[grainIndex] as PerforatedGrain | undefined;
  const preview = useMemo(() => {
    if (!grain) return null;
    try {
      return computeGrainPreview(grain);
    } catch {
      return null;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [grain]);

  const time = result.channels.time[stepIndex] ?? 0;
  const regression = result.multiChannels.regression[stepIndex]?.[grainIndex] ?? 0;
  const wallWeb = grain?.wallWeb ?? 0;
  const highlightFraction = wallWeb === 0 ? 0 : Math.min(regression / wallWeb, 1);

  const mass = result.multiChannels.mass[stepIndex]?.[grainIndex];
  const massFlow = result.multiChannels.massFlow[stepIndex]?.[grainIndex];
  const massFlux = result.multiChannels.massFlux[stepIndex]?.[grainIndex];
  const web = result.multiChannels.web[stepIndex]?.[grainIndex];

  const handleStep = (value: number) => {
    setStepIndex(value);
  };

  return (
    <div className="time-scrubber-panel">
      <div className="time-scrubber-header">
        <span>t = {time.toFixed(3)}s</span>
        {result.grains.length > 1 && (
          <select value={grainIndex} onChange={(e) => setGrainIndex(Number(e.target.value))}>
            {result.grains.map((_, i) => (
              <option key={i} value={i}>
                Grain {i + 1}
              </option>
            ))}
          </select>
        )}
      </div>
      <input
        type="range"
        min={0}
        max={Math.max(numSteps - 1, 0)}
        value={stepIndex}
        onChange={(e) => handleStep(Number(e.target.value))}
        className="time-slider"
      />
      <div className="time-scrubber-body">
        <GrainPreviewCanvas preview={preview} highlightFraction={highlightFraction} size={160} />
        <table className="grain-snapshot-table">
          <tbody>
            <tr>
              <td>Mass</td>
              <td>{mass !== undefined ? `${(mass * 1000).toFixed(1)} g` : '-'}</td>
            </tr>
            <tr>
              <td>Mass Flow</td>
              <td>{massFlow !== undefined ? `${massFlow.toFixed(3)} kg/s` : '-'}</td>
            </tr>
            <tr>
              <td>Mass Flux</td>
              <td>{massFlux !== undefined ? `${massFlux.toFixed(1)} kg/(m²s)` : '-'}</td>
            </tr>
            <tr>
              <td>Web Left</td>
              <td>{web !== undefined ? `${(web * 1000).toFixed(2)} mm` : '-'}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
