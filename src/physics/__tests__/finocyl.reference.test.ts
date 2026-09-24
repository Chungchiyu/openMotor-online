/**
 * Regression test comparing the Finocyl grain against golden values from running the actual Python
 * motorlib. No bundled .ric fixture exists for Finocyl in the Python repo's regression test data,
 * so this reuses the star fixture's propellant/nozzle/config with a synthetic Finocyl grain (see
 * scratchpad gen_finocyl.py) — still a real run of the real Python engine, just not a bundled file.
 */
import { describe, expect, it } from 'vitest';
import { Motor } from '../motor';
import type { MotorDesign } from '../types';
import refFinocyl from '../__fixtures__/ref_finocyl.json';

function relClose(actual: number, expected: number, relTol: number, absTol = 1e-9): boolean {
  return Math.abs(actual - expected) <= Math.max(absTol, relTol * Math.abs(expected));
}

describe('Finocyl motor matches Python reference (tight tolerance)', () => {
  const design = refFinocyl.motorDict as unknown as MotorDesign;
  const motor = new Motor(design);
  const result = motor.runSimulation();

  it('succeeds', () => {
    expect(result.success).toBe(true);
  });

  it('matches burn time, average force, ISP and propellant mass within 0.5%', () => {
    expect(relClose(result.getBurnTime(), refFinocyl.burnTime, 0.005)).toBe(true);
    expect(relClose(result.getAverageForce(), refFinocyl.averageForce, 0.005)).toBe(true);
    expect(relClose(result.getISP(), refFinocyl.isp, 0.005)).toBe(true);
    expect(relClose(result.getPropellantMass(), refFinocyl.propellantMass, 0.005)).toBe(true);
  });
});
