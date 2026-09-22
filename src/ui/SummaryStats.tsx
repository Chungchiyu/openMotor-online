import type { SimulationResult } from '../physics/simResult';

interface Props {
  result: SimulationResult;
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="stat">
      <span className="stat-label">{label}</span>
      <span className="stat-value">{value}</span>
    </div>
  );
}

export function SummaryStats({ result }: Props) {
  const portRatio = result.getPortRatio();
  return (
    <div className="summary-stats">
      <Stat label="Designation" value={result.getFullDesignation()} />
      <Stat label="Delivered ISP" value={`${result.getISP().toFixed(1)} s`} />
      <Stat label="Peak Pressure" value={`${(result.getMaxPressure() / 1e6).toFixed(2)} MPa`} />
      <Stat label="Peak Kn" value={result.getPeakKN().toFixed(1)} />
      <Stat label="Burn Time" value={`${result.getBurnTime().toFixed(2)} s`} />
      <Stat label="Total Impulse" value={`${result.getImpulse().toFixed(1)} Ns`} />
      <Stat label="Propellant Mass" value={`${(result.getPropellantMass() * 1000).toFixed(1)} g`} />
      <Stat label="Volume Loading" value={`${result.getVolumeLoading().toFixed(1)}%`} />
      <Stat label="Initial Kn" value={result.getInitialKN().toFixed(1)} />
      <Stat label="Average Pressure" value={`${(result.getAveragePressure() / 1e6).toFixed(2)} MPa`} />
      <Stat label="Port/Throat Ratio" value={portRatio === null ? '-' : portRatio.toFixed(2)} />
      <Stat label="Ideal Thrust Coeff." value={result.getIdealThrustCoefficient().toFixed(3)} />
      <Stat label="Delivered Thrust Coeff." value={result.getAdjustedThrustCoefficient().toFixed(3)} />
    </div>
  );
}
