/**
 * Regression test for a real bug found in manual testing: entering millimeter-scale numbers into
 * the (at the time, unit-less) dimension fields silently created a motor ~1000x too large, which
 * needed ~1000x more simulation steps — and several `Math.max(...array)` spreads over the
 * per-timestep channel arrays (particularly the one in `shouldContinueSim`, called every loop
 * iteration) then threw `RangeError: Maximum call stack size exceeded` once the array got large
 * enough to exceed the JS engine's argument-spread limit. See the array reduction helpers in
 * arrayMath.ts for the fix.
 */
import { describe, expect, it } from 'vitest';
import { Motor } from '../motor';
import type { MotorDesign } from '../types';

function unitConfusedDesign(): MotorDesign {
  return {
    grains: [{ type: 'BATES', properties: { diameter: 75, length: 150, coreDiameter: 25, inhibitedEnds: 'Neither' } }],
    propellant: {
      name: 'MIT - Cherry Limeade',
      density: 1680.0037644662068,
      tabs: [{ minPressure: 0, maxPressure: 6895000, a: 3.517054143255937e-5, n: 0.3273, k: 1.21, t: 3500, m: 23.67 }],
    },
    nozzle: { throat: 10, exit: 25, efficiency: 0.9, divAngle: 15, convAngle: 45, throatLength: 0, slagCoeff: 0, erosionCoeff: 0 },
    config: {
      maxPressure: 7e6,
      maxMassFlux: 1406.96,
      maxMachNumber: 1,
      minPortThroat: 2,
      flowSeparationWarnPercent: 0.05,
      burnoutWebThres: 0.00025,
      burnoutThrustThres: 0.1,
      timestep: 0.03,
      ambPressure: 101325,
      mapDim: 400,
      sepPressureRatio: 0.4,
    },
  };
}

describe('a very long run (large per-step channel arrays)', () => {
  it('completes without crashing on the Math.max(...array) argument-spread limit', () => {
    const motor = new Motor(unitConfusedDesign());
    expect(() => motor.runSimulation()).not.toThrow();
  }, 30000);

  it('finishes in well under a second per 1000 steps (no O(n^2) blowup)', () => {
    const motor = new Motor(unitConfusedDesign());
    const start = Date.now();
    const result = motor.runSimulation();
    const elapsed = Date.now() - start;
    const perThousandSteps = (elapsed / result.channels.time.length) * 1000;
    expect(perThousandSteps).toBeLessThan(500);
  }, 30000);
});
