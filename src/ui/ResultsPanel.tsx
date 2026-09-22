import { useState } from 'react';
import type { SimulationResult } from '../physics/simResult';
import { AlertsTable } from './AlertsTable';
import { SummaryStats } from './SummaryStats';
import {
  multiValueChannelMeta,
  singleValueChannelMeta,
  ThrustChart,
  type ChannelKey,
  type XChannelKey,
} from './ThrustChart';
import { TimeScrubberPanel } from './TimeScrubberPanel';

interface Props {
  result: SimulationResult | null;
  running: boolean;
}

const xOptions: { value: XChannelKey; label: string }[] = [
  { value: 'time', label: 'Time' },
  { value: 'regression', label: 'Regression Depth' },
  { value: 'web', label: 'Web' },
];

const yOptions: { value: ChannelKey; label: string }[] = [
  { value: 'kn', label: singleValueChannelMeta.kn.label },
  { value: 'pressure', label: singleValueChannelMeta.pressure.label },
  { value: 'force', label: singleValueChannelMeta.force.label },
  { value: 'mass', label: multiValueChannelMeta.mass.label },
  { value: 'volumeLoading', label: singleValueChannelMeta.volumeLoading.label },
  { value: 'massFlow', label: multiValueChannelMeta.massFlow.label },
  { value: 'massFlux', label: multiValueChannelMeta.massFlux.label },
  { value: 'regression', label: multiValueChannelMeta.regression.label },
  { value: 'web', label: multiValueChannelMeta.web.label },
  { value: 'exitPressure', label: singleValueChannelMeta.exitPressure.label },
  { value: 'dThroat', label: singleValueChannelMeta.dThroat.label },
  { value: 'machNumber', label: multiValueChannelMeta.machNumber.label },
];

type Tab = 'graph' | 'grains' | 'alerts';

export function ResultsPanel({ result, running }: Props) {
  const [tab, setTab] = useState<Tab>('graph');
  const [xChannel, setXChannel] = useState<XChannelKey>('time');
  const [yChannels, setYChannels] = useState<ChannelKey[]>(['kn', 'pressure', 'force']);
  const [selectedGrains, setSelectedGrains] = useState<number[] | null>(null); // null = all

  const toggleY = (ch: ChannelKey) => {
    setYChannels((prev) => (prev.includes(ch) ? prev.filter((c) => c !== ch) : [...prev, ch]));
  };

  const numGrains = result?.grains.length ?? 0;
  const effectiveGrains = selectedGrains ?? Array.from({ length: numGrains }, (_, i) => i);

  const toggleGrain = (i: number) => {
    setSelectedGrains((prev) => {
      const base = prev ?? Array.from({ length: numGrains }, (_, gi) => gi);
      return base.includes(i) ? base.filter((g) => g !== i) : [...base, i].sort();
    });
  };

  return (
    <div className="results-panel">
      <div className="results-panel-header">
        {running && <div className="running-banner">Running simulation…</div>}
        <div className="tab-bar">
          <button className={tab === 'graph' ? 'active' : ''} onClick={() => setTab('graph')}>
            Graph
          </button>
          <button className={tab === 'grains' ? 'active' : ''} onClick={() => setTab('grains')} disabled={!result}>
            Grains
          </button>
          <button className={tab === 'alerts' ? 'active' : ''} onClick={() => setTab('alerts')} disabled={!result}>
            Alerts {result && result.alerts.length > 0 ? `(${result.alerts.length})` : ''}
          </button>
        </div>
      </div>

      {/* Fills whatever space is left between the tab bar above and the (always-visible) summary
       * stats below — see .results-panel-body. Within the Graph tab, the axis fieldsets scroll
       * internally if they don't fit rather than pushing the stats off screen, and the chart
       * stretches to fill whatever's left of that space (see .graph-tab / ThrustChart). */}
      <div className="results-panel-body">
        {tab === 'graph' && (
          <div className="graph-tab">
            <div className="axis-controls">
              <fieldset>
                <legend>X Axis</legend>
                {xOptions.map((o) => (
                  <label key={o.value}>
                    <input type="radio" name="xaxis" checked={xChannel === o.value} onChange={() => setXChannel(o.value)} />
                    {o.label}
                  </label>
                ))}
              </fieldset>
              <fieldset>
                <legend>Y Axis</legend>
                {yOptions.map((o) => (
                  <label key={o.value}>
                    <input type="checkbox" checked={yChannels.includes(o.value)} onChange={() => toggleY(o.value)} />
                    {o.label}
                  </label>
                ))}
              </fieldset>
              {numGrains > 1 && (
                <fieldset>
                  <legend>Grains</legend>
                  {Array.from({ length: numGrains }, (_, i) => (
                    <label key={i}>
                      <input type="checkbox" checked={effectiveGrains.includes(i)} onChange={() => toggleGrain(i)} />
                      Grain {i + 1}
                    </label>
                  ))}
                </fieldset>
              )}
            </div>
            <div className="graph-tab-chart">
              <ThrustChart result={result} xChannel={xChannel} yChannels={yChannels} selectedGrains={effectiveGrains} />
            </div>
          </div>
        )}

        {tab === 'grains' && result && <TimeScrubberPanel result={result} />}

        {tab === 'alerts' && result && <AlertsTable alerts={result.alerts} />}

        {!result && tab !== 'graph' && <div className="chart-placeholder">Run the simulation to see results.</div>}
      </div>

      {result && result.success && (
        <div className="results-panel-footer">
          <SummaryStats result={result} />
        </div>
      )}
    </div>
  );
}
