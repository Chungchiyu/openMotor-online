import {
  CategoryScale,
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
import type { SimulationResult } from '../physics/simResult';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend);

export type YChannel = 'pressure' | 'force' | 'kn';

const channelMeta: Record<YChannel, { label: string; color: string; unit: string }> = {
  pressure: { label: 'Chamber Pressure', color: '#b91c1c', unit: 'Pa' },
  force: { label: 'Thrust', color: '#1d4ed8', unit: 'N' },
  kn: { label: 'Kn', color: '#15803d', unit: '' },
};

interface Props {
  result: SimulationResult | null;
  yChannels: YChannel[];
  currentTime?: number;
}

export function ThrustChart({ result, yChannels, currentTime }: Props) {
  const data = useMemo(() => {
    if (!result) return { labels: [], datasets: [] };
    const time = result.channels.time;
    return {
      labels: time.map((t) => t.toFixed(2)),
      datasets: yChannels.map((ch) => ({
        label: `${channelMeta[ch].label}${channelMeta[ch].unit ? ` (${channelMeta[ch].unit})` : ''}`,
        data: result.channels[ch],
        borderColor: channelMeta[ch].color,
        backgroundColor: channelMeta[ch].color,
        pointRadius: 0,
        borderWidth: 2,
        yAxisID: ch,
      })),
    };
  }, [result, yChannels]);

  const options: ChartOptions<'line'> = useMemo(() => {
    const scales: ChartOptions<'line'>['scales'] = {
      x: { title: { display: true, text: 'Time (s)' } },
    };
    yChannels.forEach((ch, i) => {
      scales[ch] = {
        type: 'linear',
        position: i === 0 ? 'left' : 'right',
        title: { display: true, text: channelMeta[ch].label },
        grid: { drawOnChartArea: i === 0 },
      };
    });
    return {
      responsive: true,
      maintainAspectRatio: false,
      animation: false,
      scales,
      plugins: { legend: { position: 'top' } },
    };
  }, [yChannels]);

  if (!result) {
    return <div className="chart-placeholder">Run the simulation to see results.</div>;
  }

  return (
    <div style={{ position: 'relative', height: 280 }}>
      <Line data={data} options={options} />
      {currentTime !== undefined && (
        <div
          className="chart-time-marker"
          style={{ left: `${(currentTime / (result.getBurnTime() || 1)) * 100}%` }}
        />
      )}
    </div>
  );
}
