/**
 * Exhaustive comparison against Python, across every one of openMotor's 20 built-in propellants
 * (same BATES grain + nozzle + real default config for all of them — see
 * __fixtures__/allprop/*.json for how these were generated), checking:
 *   - every single-value channel (time, kn, pressure, force, volumeLoading, exitPressure, dThroat)
 *     at every timestep, not just a few summary statistics
 *   - every multi-value channel (mass, massFlow, massFlux, regression, web, machNumber) at every
 *     timestep
 *   - every SimulationResult getter (burn time, ISP, designation, thrust coefficients, etc.)
 *   - alert count and success flag
 *
 * Tolerance is 1e-9 relative (with a tiny absolute floor for near-zero values). Measured directly
 * (by hand-tightening this constant and rerunning): every value across all 20 propellants agrees
 * with Python down to ~1e-12 relative before it starts failing — squarely in the range you'd
 * expect from float64 non-associativity accumulating over a few hundred chained operations, not
 * from an algorithmic difference. 1e-9 leaves headroom above that measured floor so the suite
 * isn't flaky across machines/engines, while still catching any real divergence by a wide margin.
 */
import { describe, expect, it } from 'vitest';
import { Motor } from '../motor';
import type { MultiValueChannel, SingleValueChannel } from '../simResult';
import type { MotorDesign } from '../types';

const fixtures = import.meta.glob('../__fixtures__/allprop/*.json', { eager: true }) as Record<
  string,
  {
    name: string;
    success: boolean;
    alerts: unknown[];
    channels: Record<SingleValueChannel, number[]>;
    multiChannels: Record<MultiValueChannel, number[][]>;
    burnTime: number;
    initialKN: number;
    peakKN: number;
    averagePressure: number;
    maxPressure: number;
    impulse: number;
    averageForce: number;
    designation: string;
    fullDesignation: string;
    isp: number;
    portRatio: number | null;
    propellantLength: number;
    maxPropellantDiameter: number;
    propellantMass: number;
    volumeLoading: number;
    idealThrustCoefficient: number;
    adjustedThrustCoefficient: number;
    motorDict: MotorDesign;
  }
>;

const TOL = 1e-9;
const ABS_FLOOR = 1e-9;

function assertClose(actual: number, expected: number, label: string) {
  const diff = Math.abs(actual - expected);
  const allowed = Math.max(ABS_FLOOR, TOL * Math.abs(expected));
  if (diff > allowed) {
    throw new Error(`${label}: expected ${expected}, got ${actual} (relative diff ${(diff / Math.abs(expected)) * 100}%)`);
  }
}

const singleChannels: SingleValueChannel[] = ['time', 'kn', 'pressure', 'force', 'volumeLoading', 'exitPressure', 'dThroat'];
const multiChannelKeys: MultiValueChannel[] = ['mass', 'massFlow', 'massFlux', 'regression', 'web', 'machNumber'];

const entries = Object.entries(fixtures).sort(([a], [b]) => a.localeCompare(b));

describe.each(entries)('propellant fixture %s', (_path, ref) => {
  const motor = new Motor(ref.motorDict);
  const result = motor.runSimulation();

  it(`${ref.name}: success flag and step count match`, () => {
    expect(result.success).toBe(ref.success);
    expect(result.channels.time.length).toBe(ref.channels.time.length);
  });

  it(`${ref.name}: alert count matches`, () => {
    expect(result.alerts.length).toBe(ref.alerts.length);
  });

  it(`${ref.name}: every single-value channel matches at every timestep`, () => {
    for (const ch of singleChannels) {
      const expectedArr = ref.channels[ch];
      const actualArr = result.channels[ch];
      for (let i = 0; i < expectedArr.length; i++) {
        assertClose(actualArr[i], expectedArr[i], `${ch}[${i}]`);
      }
    }
  });

  it(`${ref.name}: every multi-value channel matches at every timestep`, () => {
    for (const ch of multiChannelKeys) {
      const expectedArr = ref.multiChannels[ch];
      const actualArr = result.multiChannels[ch];
      for (let i = 0; i < expectedArr.length; i++) {
        for (let g = 0; g < expectedArr[i].length; g++) {
          assertClose(actualArr[i][g], expectedArr[i][g], `${ch}[${i}][${g}]`);
        }
      }
    }
  });

  it(`${ref.name}: every derived statistic matches`, () => {
    assertClose(result.getBurnTime(), ref.burnTime, 'burnTime');
    assertClose(result.getInitialKN(), ref.initialKN, 'initialKN');
    assertClose(result.getPeakKN(), ref.peakKN, 'peakKN');
    assertClose(result.getAveragePressure(), ref.averagePressure, 'averagePressure');
    assertClose(result.getMaxPressure(), ref.maxPressure, 'maxPressure');
    assertClose(result.getImpulse(), ref.impulse, 'impulse');
    assertClose(result.getAverageForce(), ref.averageForce, 'averageForce');
    assertClose(result.getISP(), ref.isp, 'isp');
    assertClose(result.getPropellantLength(), ref.propellantLength, 'propellantLength');
    assertClose(result.getMaxPropellantDiameter(), ref.maxPropellantDiameter, 'maxPropellantDiameter');
    assertClose(result.getPropellantMass(), ref.propellantMass, 'propellantMass');
    assertClose(result.getVolumeLoading(), ref.volumeLoading, 'volumeLoading');
    assertClose(result.getIdealThrustCoefficient(), ref.idealThrustCoefficient, 'idealThrustCoefficient');
    assertClose(result.getAdjustedThrustCoefficient(), ref.adjustedThrustCoefficient, 'adjustedThrustCoefficient');
    expect(result.getDesignation()).toBe(ref.designation);
    expect(result.getFullDesignation()).toBe(ref.fullDesignation);
    if (ref.portRatio === null) {
      expect(result.getPortRatio()).toBeNull();
    } else {
      assertClose(result.getPortRatio() ?? NaN, ref.portRatio, 'portRatio');
    }
  });
});
