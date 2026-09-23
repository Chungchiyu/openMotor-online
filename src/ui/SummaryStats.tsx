import type { SimulationResult } from '../physics/simResult';
import { convert } from '../physics/units';
import { useUnits } from './UnitsContext';

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

/**
 * Matches `mainWindow.py`'s `updateMotorStats` — same set of fields, in the same order, converted
 * to the user's preferred unit for that quantity (via `formatMotorStat`, `'{:.2f} {}'`) rather than
 * a fixed display unit. Two fields are unconditional strings in the original rather than a
 * converted number + unit (Designation, Volume Loading), and Port/Throat Ratio and Peak Mass Flux
 * both fall back to "-" for an end-burning grain with no port.
 */
export function SummaryStats({ result }: Props) {
  const { unitFor } = useUnits();

  // '{:.2f} {}'.format(convert(quantity, inUnit, convUnit), convUnit) — motorlib has no
  // conversion table entry for plain 's' or a dimensionless '', so those just format in place.
  const stat = (quantity: number, inUnit: string): string => {
    const outUnit = unitFor(inUnit);
    return `${convert(quantity, inUnit, outUnit).toFixed(2)}${outUnit ? ` ${outUnit}` : ''}`;
  };

  const portRatio = result.getPortRatio();
  const peakMassFluxLocation = result.getPeakMassFluxLocation();

  return (
    <div className="summary-stats">
      <Stat label="Designation" value={`${result.getDesignation()} (${(result.getImpulseClassPercentage() * 100).toFixed(0)}%)`} />
      <Stat label="Total Impulse" value={stat(result.getImpulse(), 'Ns')} />
      <Stat label="Delivered ISP" value={stat(result.getISP(), 's')} />
      <Stat label="Burn Time" value={stat(result.getBurnTime(), 's')} />
      <Stat label="Volume Loading" value={`${result.getVolumeLoading().toFixed(2)}%`} />
      <Stat label="Average Pressure" value={stat(result.getAveragePressure(), 'Pa')} />
      <Stat label="Peak Pressure" value={stat(result.getMaxPressure(), 'Pa')} />
      <Stat label="Initial Kn" value={stat(result.getInitialKN(), '')} />
      <Stat label="Peak Kn" value={stat(result.getPeakKN(), '')} />
      <Stat label="Ideal Thrust Coeff." value={stat(result.getIdealThrustCoefficient(), '')} />
      <Stat label="Propellant Mass" value={stat(result.getPropellantMass(), 'kg')} />
      <Stat label="Propellant Dimensions" value={`⌀ ${stat(result.getMaxPropellantDiameter(), 'm')} x ${stat(result.getPropellantLength(), 'm')}`} />
      <Stat label="Port/Throat Ratio" value={portRatio === null ? '-' : stat(portRatio, '')} />
      <Stat
        label="Peak Mass Flux"
        value={portRatio === null ? '-' : `${stat(result.getPeakMassFlux(), 'kg/(m^2*s)')} (G: ${(peakMassFluxLocation ?? -1) + 1})`}
      />
      <Stat label="Delivered Thrust Coeff." value={stat(result.getAdjustedThrustCoefficient(), '')} />
    </div>
  );
}
