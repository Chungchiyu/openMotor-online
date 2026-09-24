/**
 * Regression test comparing the End Burner grain against golden values from running the actual
 * Python motorlib on openMotor's own bundled fixture (test/data/regression/endburner/motor.ric).
 */
import { describe, expect, it } from 'vitest';
import { Motor } from '../motor';
import type { MotorDesign } from '../types';
import refEndBurner from '../__fixtures__/ref_endburner.json';

function relClose(actual: number, expected: number, relTol: number, absTol = 1e-9): boolean {
  return Math.abs(actual - expected) <= Math.max(absTol, relTol * Math.abs(expected));
}

describe('End Burner motor matches Python reference (tight tolerance)', () => {
  const design = refEndBurner.motorDict as unknown as MotorDesign;
  const motor = new Motor(design);
  const result = motor.runSimulation();

  it('succeeds', () => {
    expect(result.success).toBe(true);
  });

  it('matches burn time, average force, ISP and propellant mass within 0.5%', () => {
    expect(relClose(result.getBurnTime(), refEndBurner.burnTime, 0.005)).toBe(true);
    expect(relClose(result.getAverageForce(), refEndBurner.averageForce, 0.005)).toBe(true);
    expect(relClose(result.getISP(), refEndBurner.isp, 0.005)).toBe(true);
    expect(relClose(result.getPropellantMass(), refEndBurner.propellantMass, 0.005)).toBe(true);
  });
});
