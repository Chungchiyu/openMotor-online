import { useState } from 'react';
import type { SimulationResult } from '../physics/simResult';
import { AlertsTable } from './AlertsTable';
import { SummaryStats } from './SummaryStats';
import { ThrustChart, type YChannel } from './ThrustChart';
import { TimeScrubberPanel } from './TimeScrubberPanel';

interface Props {
  result: SimulationResult | null;
  running: boolean;
}

const allChannels: { value: YChannel; label: string }[] = [
  { value: 'pressure', label: 'Pressure' },
  { value: 'force', label: 'Thrust' },
  { value: 'kn', label: 'Kn' },
];

export function ResultsPanel({ result, running }: Props) {
  const [yChannels, setYChannels] = useState<YChannel[]>(['pressure', 'force']);
  const [currentTime, setCurrentTime] = useState<number | undefined>(undefined);

  const toggleChannel = (ch: YChannel) => {
    setYChannels((prev) => (prev.includes(ch) ? prev.filter((c) => c !== ch) : [...prev, ch]));
  };

  return (
    <div className="results-panel">
      <div className="channel-selector">
        {allChannels.map((c) => (
          <label key={c.value}>
            <input type="checkbox" checked={yChannels.includes(c.value)} onChange={() => toggleChannel(c.value)} />
            {c.label}
          </label>
        ))}
      </div>

      <ThrustChart result={result} yChannels={yChannels} currentTime={currentTime} />

      {running && <div className="running-banner">Running simulation…</div>}

      {result && (
        <>
          <TimeScrubberPanel result={result} onTimeChange={setCurrentTime} />
          <AlertsTable alerts={result.alerts} />
          {result.success && <SummaryStats result={result} />}
        </>
      )}
    </div>
  );
}
