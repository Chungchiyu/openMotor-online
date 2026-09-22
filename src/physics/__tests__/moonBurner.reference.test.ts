/**
 * Regression test comparing the Moon Burner grain against golden values from running the actual
 * Python motorlib on openMotor's own bundled fixture (test/data/regression/moon/motor.ric). Same
 * FMM-approximation caveat as the star grain (see fmm.ts, contours.ts) applies here — Moon Burner
 * is also FmmGrain-based — so this uses the same loose tolerance as the star reference test.
 */
import { describe, expect, it } from 'vitest';
import { Motor } from '../motor';
import type { MotorDesign } from '../types';
import refMoon from '../__fixtures__/ref_moon.json';

function relClose(actual: number, expected: number, relTol: number, absTol = 1e-9): boolean {
  return Math.abs(actual - expected) <= Math.max(absTol, relTol * Math.abs(expected));
}

describe('Moon Burner motor matches Python reference (loose tolerance, FMM-based)', () => {
  const design = refMoon.motorDict as unknown as MotorDesign;
  const motor = new Motor(design);
  const result = motor.runSimulation();

  it('succeeds', () => {
    expect(result.success).toBe(true);
  });

  it('matches burn time, average force, ISP and propellant mass within 15%', () => {
    expect(relClose(result.getBurnTime(), refMoon.burnTime, 0.15)).toBe(true);
    expect(relClose(result.getAverageForce(), refMoon.averageForce, 0.15)).toBe(true);
    expect(relClose(result.getISP(), refMoon.isp, 0.15)).toBe(true);
    expect(relClose(result.getPropellantMass(), refMoon.propellantMass, 0.02)).toBe(true);
  });
});
