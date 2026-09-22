import { CategoryScale, Chart as ChartJS, LinearScale, LineElement, PointElement, Tooltip, type ChartOptions } from 'chart.js';
import { useMemo } from 'react';
import { Line } from 'react-chartjs-2';
import type { AreaProfilePoint } from '../physics/preview';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Tooltip);

interface Props {
  areaProfile: AreaProfilePoint[];
}

/** Small preview chart of face (burning) area vs. regression depth, computed directly from the
 * grain's current properties — independent of any simulation run. */
export function AreaGraph({ areaProfile }: Props) {
  const data = useMemo(
    () => ({
      labels: areaProfile.map((p) => (p.regDist * 1000).toFixed(2)),
      datasets: [
        {
          label: 'Face area (mm²)',
          data: areaProfile.map((p) => p.faceArea * 1e6),
          borderColor: '#a16207',
          backgroundColor: '#a16207',
          pointRadius: 0,
          borderWidth: 2,
        },
      ],
    }),
    [areaProfile],
  );

  const options: ChartOptions<'line'> = {
    responsive: true,
    maintainAspectRatio: false,
    animation: false,
    scales: {
      x: { title: { display: true, text: 'Regression depth (mm)' } },
      y: { title: { display: true, text: 'Face area (mm²)' } },
    },
    plugins: { legend: { display: false } },
  };

  return (
    <div style={{ height: 220 }}>
      <Line data={data} options={options} />
    </div>
  );
}
