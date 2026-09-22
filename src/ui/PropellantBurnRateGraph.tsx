import { CategoryScale, Chart as ChartJS, LinearScale, LineElement, PointElement, Tooltip, type ChartOptions } from 'chart.js';
import { useMemo } from 'react';
import { Line } from 'react-chartjs-2';
import { getBurnRate } from '../physics/propellant';
import type { PropellantConfig } from '../physics/types';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Tooltip);

interface Props {
  propellant: PropellantConfig;
}

/** Burn rate vs. chamber pressure for the propellant being edited — matching the original desktop
 * app's propellant preview graph (uilib/widgets/propellantPressureGraph.py), computed directly
 * from the propellant's own tabs rather than a simulation run. */
export function PropellantBurnRateGraph({ propellant }: Props) {
  const data = useMemo(() => {
    if (propellant.tabs.length === 0) return { datasets: [] };
    const minP = Math.min(...propellant.tabs.map((t) => t.minPressure));
    const maxP = Math.max(...propellant.tabs.map((t) => t.maxPressure));
    const points: { x: number; y: number }[] = [];
    const steps = 60;
    for (let i = 0; i <= steps; i++) {
      const p = minP + ((maxP - minP) * i) / steps;
      if (p <= 0) continue;
      points.push({ x: p / 1e6, y: getBurnRate(propellant, p) * 1000 });
    }
    return {
      datasets: [
        {
          label: 'Burn rate (mm/s)',
          data: points,
          borderColor: '#15803d',
          backgroundColor: '#15803d',
          pointRadius: 0,
          borderWidth: 2,
        },
      ],
    };
  }, [propellant]);

  const options: ChartOptions<'line'> = {
    responsive: true,
    maintainAspectRatio: false,
    animation: false,
    parsing: false,
    scales: {
      x: { type: 'linear', title: { display: true, text: 'Chamber Pressure (MPa)' } },
      y: { title: { display: true, text: 'Burn rate (mm/s)' } },
    },
    plugins: { legend: { display: false } },
  };

  return (
    <div style={{ height: 180 }}>
      <Line data={data as never} options={options} />
    </div>
  );
}
