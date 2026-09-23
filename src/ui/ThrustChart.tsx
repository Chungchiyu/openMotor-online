import {
  Chart as ChartJS,
  Legend,
  LinearScale,
  LineElement,
  PointElement,
  Title,
  Tooltip,
  type ChartOptions,
} from 'chart.js';
import { useMemo } from 'react';
import { Line } from 'react-chartjs-2';
import {
  multiValueChannelMeta,
  singleValueChannelMeta,
  type MultiValueChannel,
  type SimulationResult,
  type SingleValueChannel,
} from '../physics/simResult';
import { convert } from '../physics/units';
import { useUnits } from './UnitsContext';

ChartJS.register(LinearScale, PointElement, LineElement, Title, Tooltip, Legend);

export type ChannelKey = SingleValueChannel | MultiValueChannel;
export type XChannelKey = 'time' | 'regression' | 'web';

// Re-exported so existing importers (ResultsPanel) don't need to know this moved to simResult.ts,
// which is the single source of truth for channel metadata (shared with getCSV).
export { multiValueChannelMeta, singleValueChannelMeta };

const isMultiValue = (ch: ChannelKey): ch is MultiValueChannel => ch in multiValueChannelMeta;

const palette = ['#b91c1c', '#1d4ed8', '#15803d', '#a16207', '#7c3aed', '#0891b2', '#be185d', '#4d7c0f'];

interface Props {
  result: SimulationResult | null;
  xChannel: XChannelKey;
  yChannels: ChannelKey[];
  selectedGrains: number[];
}

const xChannelUnit: Record<XChannelKey, string> = { time: 's', regression: 'm', web: 'm' };

function getXSeries(result: SimulationResult, xChannel: XChannelKey, selectedGrains: number[], toUnit: string): number[] {
  const fromUnit = xChannelUnit[xChannel];
  if (xChannel === 'time') return result.channels.time.map((v) => convert(v, fromUnit, toUnit));
  const grainIdx = selectedGrains[0] ?? 0;
  return result.multiChannels[xChannel].map((frame) => convert(frame[grainIdx] ?? 0, fromUnit, toUnit));
}

export function ThrustChart({ result, xChannel, yChannels, selectedGrains }: Props) {
  // `plotData` in the original (graphWidget.py) converts every channel — x axis and each y
  // channel — to the user's preferred unit for that channel's quantity type, not the canonical
  // (SI) unit the simulation stores it in; this chart used to always plot raw SI values.
  const { unitFor } = useUnits();
  const xUnit = unitFor(xChannelUnit[xChannel]);

  const data = useMemo(() => {
    if (!result) return { datasets: [] as object[] };
    const xSeries = getXSeries(result, xChannel, selectedGrains, xUnit);
    const datasets: object[] = [];
    let colorIdx = 0;

    for (const ch of yChannels) {
      if (isMultiValue(ch)) {
        const meta = multiValueChannelMeta[ch];
        const yUnit = unitFor(meta.unit);
        const grains = selectedGrains.length > 0 ? selectedGrains : [0];
        for (const g of grains) {
          const color = palette[colorIdx % palette.length];
          colorIdx++;
          datasets.push({
            label: `${meta.label} (G${g + 1})`,
            data: xSeries.map((x, i) => ({ x, y: convert(result.multiChannels[ch][i]?.[g] ?? 0, meta.unit, yUnit) })),
            borderColor: color,
            backgroundColor: color,
            pointRadius: 0,
            borderWidth: 2,
            yAxisID: ch,
          });
        }
      } else {
        const meta = singleValueChannelMeta[ch];
        const yUnit = unitFor(meta.unit);
        const color = palette[colorIdx % palette.length];
        colorIdx++;
        datasets.push({
          label: meta.label,
          data: xSeries.map((x, i) => ({ x, y: convert(result.channels[ch][i], meta.unit, yUnit) })),
          borderColor: color,
          backgroundColor: color,
          pointRadius: 0,
          borderWidth: 2,
          yAxisID: ch,
        });
      }
    }

    return { datasets };
  }, [result, xChannel, yChannels, selectedGrains, xUnit, unitFor]);

  const options: ChartOptions<'line'> = useMemo(() => {
    const xChannelLabel = xChannel === 'time' ? 'Time' : multiValueChannelMeta[xChannel].label;
    const scales: ChartOptions<'line'>['scales'] = {
      x: {
        type: 'linear',
        title: { display: true, text: xUnit ? `${xChannelLabel} (${xUnit})` : xChannelLabel },
      },
    };
    const seenAxes = new Set<string>();
    yChannels.forEach((ch) => {
      if (seenAxes.has(ch)) return;
      seenAxes.add(ch);
      const meta = isMultiValue(ch) ? multiValueChannelMeta[ch] : singleValueChannelMeta[ch];
      const yUnit = unitFor(meta.unit);
      const position = seenAxes.size === 1 ? 'left' : 'right';
      scales[ch] = {
        type: 'linear',
        position,
        title: { display: true, text: yUnit ? `${meta.label} (${yUnit})` : meta.label },
        grid: { drawOnChartArea: position === 'left' },
      };
    });
    return {
      responsive: true,
      maintainAspectRatio: false,
      animation: false,
      scales,
      plugins: { legend: { position: 'top' } },
    };
  }, [xChannel, xUnit, yChannels, unitFor]);

  if (!result) {
    return <div className="chart-placeholder">Run the simulation to see results.</div>;
  }

  return (
    <div style={{ height: '100%', minHeight: 280 }}>
      <Line data={data as never} options={options} />
    </div>
  );
}
