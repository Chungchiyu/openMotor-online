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
import type { MultiValueChannel, SimulationResult, SingleValueChannel } from '../physics/simResult';

ChartJS.register(LinearScale, PointElement, LineElement, Title, Tooltip, Legend);

export type ChannelKey = SingleValueChannel | MultiValueChannel;
export type XChannelKey = 'time' | 'regression' | 'web';

export const singleValueChannelMeta: Record<SingleValueChannel, { label: string; unit: string }> = {
  time: { label: 'Time', unit: 's' },
  kn: { label: 'Kn', unit: '' },
  pressure: { label: 'Chamber Pressure', unit: 'Pa' },
  force: { label: 'Thrust', unit: 'N' },
  volumeLoading: { label: 'Volume Loading', unit: '%' },
  exitPressure: { label: 'Nozzle Exit Pressure', unit: 'Pa' },
  dThroat: { label: 'Change in Throat Diameter', unit: 'm' },
};

export const multiValueChannelMeta: Record<MultiValueChannel, { label: string; unit: string }> = {
  mass: { label: 'Propellant Mass', unit: 'kg' },
  massFlow: { label: 'Mass Flow', unit: 'kg/s' },
  massFlux: { label: 'Mass Flux', unit: 'kg/(m²·s)' },
  regression: { label: 'Regression Depth', unit: 'm' },
  web: { label: 'Web', unit: 'm' },
  machNumber: { label: 'Core Mach Number', unit: '' },
};

const isMultiValue = (ch: ChannelKey): ch is MultiValueChannel => ch in multiValueChannelMeta;

const palette = ['#b91c1c', '#1d4ed8', '#15803d', '#a16207', '#7c3aed', '#0891b2', '#be185d', '#4d7c0f'];

interface Props {
  result: SimulationResult | null;
  xChannel: XChannelKey;
  yChannels: ChannelKey[];
  selectedGrains: number[];
}

function getXSeries(result: SimulationResult, xChannel: XChannelKey, selectedGrains: number[]): number[] {
  if (xChannel === 'time') return result.channels.time;
  const grainIdx = selectedGrains[0] ?? 0;
  return result.multiChannels[xChannel].map((frame) => frame[grainIdx] ?? 0);
}

export function ThrustChart({ result, xChannel, yChannels, selectedGrains }: Props) {
  const data = useMemo(() => {
    if (!result) return { datasets: [] as object[] };
    const xSeries = getXSeries(result, xChannel, selectedGrains);
    const datasets: object[] = [];
    let colorIdx = 0;

    for (const ch of yChannels) {
      if (isMultiValue(ch)) {
        const grains = selectedGrains.length > 0 ? selectedGrains : [0];
        for (const g of grains) {
          const color = palette[colorIdx % palette.length];
          colorIdx++;
          datasets.push({
            label: `${multiValueChannelMeta[ch].label} (G${g + 1})`,
            data: xSeries.map((x, i) => ({ x, y: result.multiChannels[ch][i]?.[g] ?? 0 })),
            borderColor: color,
            backgroundColor: color,
            pointRadius: 0,
            borderWidth: 2,
            yAxisID: ch,
          });
        }
      } else {
        const color = palette[colorIdx % palette.length];
        colorIdx++;
        datasets.push({
          label: singleValueChannelMeta[ch].label,
          data: xSeries.map((x, i) => ({ x, y: result.channels[ch][i] })),
          borderColor: color,
          backgroundColor: color,
          pointRadius: 0,
          borderWidth: 2,
          yAxisID: ch,
        });
      }
    }

    return { datasets };
  }, [result, xChannel, yChannels, selectedGrains]);

  const options: ChartOptions<'line'> = useMemo(() => {
    const xLabel = xChannel === 'time' ? 'Time (s)' : multiValueChannelMeta[xChannel].label;
    const scales: ChartOptions<'line'>['scales'] = {
      x: {
        type: 'linear',
        title: { display: true, text: xLabel },
      },
    };
    const seenAxes = new Set<string>();
    yChannels.forEach((ch) => {
      if (seenAxes.has(ch)) return;
      seenAxes.add(ch);
      const meta = isMultiValue(ch) ? multiValueChannelMeta[ch] : singleValueChannelMeta[ch];
      const position = seenAxes.size === 1 ? 'left' : 'right';
      scales[ch] = {
        type: 'linear',
        position,
        title: { display: true, text: meta.unit ? `${meta.label} (${meta.unit})` : meta.label },
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
  }, [xChannel, yChannels]);

  if (!result) {
    return <div className="chart-placeholder">Run the simulation to see results.</div>;
  }

  return (
    <div style={{ height: 320 }}>
      <Line data={data as never} options={options} />
    </div>
  );
}
