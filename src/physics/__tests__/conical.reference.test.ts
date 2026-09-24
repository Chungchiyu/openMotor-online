/**
 * Regression test comparing the Conical grain against golden values from running the actual Python
 * motorlib. No bundled .ric fixture exists for Conical in the Python repo's regression test data,
 * so this reuses the moon fixture's propellant/nozzle/config with a synthetic Conical grain (see
 * scratchpad gen_conical.py) — still a real run of the real Python engine, just not a bundled file.
 */
import { describe, expect, it } from 'vitest';
import { Motor } from '../motor';
import type { MotorDesign } from '../types';
import refConical from '../__fixtures__/ref_conical.json';
import refConicalInverted from '../__fixtures__/ref_conical_inverted.json';

function relClose(actual: number, expected: number, relTol: number, absTol = 1e-9): boolean {
  return Math.abs(actual - expected) <= Math.max(absTol, relTol * Math.abs(expected));
}

describe('Conical motor matches Python reference (tight tolerance)', () => {
  const design = refConical.motorDict as unknown as MotorDesign;
  const motor = new Motor(design);
  const result = motor.runSimulation();

  it('succeeds', () => {
    expect(result.success).toBe(true);
  });

  it('matches burn time, average force, ISP and propellant mass within 0.5%', () => {
    expect(relClose(result.getBurnTime(), refConical.burnTime, 0.005)).toBe(true);
    expect(relClose(result.getAverageForce(), refConical.averageForce, 0.005)).toBe(true);
    expect(relClose(result.getISP(), refConical.isp, 0.005)).toBe(true);
    expect(relClose(result.getPropellantMass(), refConical.propellantMass, 0.005)).toBe(true);
  });
});

// The forward/aft-major branching and the "major end clamps at the wall" logic in getFrustumInfo
// only run for an inverted core (forward diameter > aft diameter) with one end inhibited — this
// exercises those branches specifically, rather than just the un-inverted, both-ends-open case above.
describe('Conical motor (inverted core, aft inhibited) matches Python reference (tight tolerance)', () => {
  const design = refConicalInverted.motorDict as unknown as MotorDesign;
  const motor = new Motor(design);
  const result = motor.runSimulation();

  it('succeeds', () => {
    expect(result.success).toBe(true);
  });

  it('matches burn time, average force, ISP and propellant mass within 0.5%', () => {
    expect(relClose(result.getBurnTime(), refConicalInverted.burnTime, 0.005)).toBe(true);
    expect(relClose(result.getAverageForce(), refConicalInverted.averageForce, 0.005)).toBe(true);
    expect(relClose(result.getISP(), refConicalInverted.isp, 0.005)).toBe(true);
    expect(relClose(result.getPropellantMass(), refConicalInverted.propellantMass, 0.005)).toBe(true);
  });
});
