import { CategoryScale, Chart as ChartJS, LinearScale, LineElement, PointElement, Tooltip, type ChartOptions } from 'chart.js';
import { useMemo } from 'react';
import { Line } from 'react-chartjs-2';
import type { AreaProfilePoint } from '../physics/preview';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Tooltip);

interface Props {
  areaProfile: AreaProfilePoint[];
}

/**
 * Small preview chart of burning perimeter (the 2D cross-section's contour length) vs. regression
 * depth, computed directly from the grain's current properties — independent of any simulation
 * run. Matches what the original desktop app's "Area Graph" preview tab actually plots (despite
 * the name — see `AreaProfilePoint` in physics/preview.ts): the contour length at each of a series
 * of regression levels, not the propellant's remaining cross-sectional face area. For a BATES
 * grain this line rises as the core burns outward, since the original's plot does too.
 */
export function AreaGraph({ areaProfile }: Props) {
  const data = useMemo(
    () => ({
      labels: areaProfile.map((p) => (p.regDist * 1000).toFixed(2)),
      datasets: [
        {
          label: 'Burning perimeter (mm)',
          data: areaProfile.map((p) => p.perimeter * 1000),
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
      y: { title: { display: true, text: 'Burning perimeter (mm)' } },
    },
    plugins: { legend: { display: false } },
  };

  return (
    <div style={{ height: 220 }}>
      <Line data={data} options={options} />
    </div>
  );
}
