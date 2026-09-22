/**
 * Multi-tab propellants (a burn-rate/combustion table split across several pressure ranges, e.g.
 * Nakka - KNSB) weren't exercised by any other reference test — those all use single-tab
 * propellants. This checks the tab-selection logic in propellant.ts against a golden run of the
 * real Python motorlib using KNSB on the "simple" regression fixture's geometry.
 */
import { describe, expect, it } from 'vitest';
import { Motor } from '../motor';
import type { MotorDesign } from '../types';
import refKnsb from '../__fixtures__/ref_knsb.json';

function relClose(actual: number, expected: number, relTol: number, absTol = 1e-9): boolean {
  return Math.abs(actual - expected) <= Math.max(absTol, relTol * Math.abs(expected));
}

describe('multi-tab propellant (Nakka - KNSB) matches Python reference', () => {
  const design = refKnsb.motorDict as unknown as MotorDesign;
  const motor = new Motor(design);
  const result = motor.runSimulation();

  it('succeeds', () => {
    expect(result.success).toBe(true);
  });

  it('matches burn time, average force, ISP, propellant mass and peak pressure within 1%', () => {
    expect(relClose(result.getBurnTime(), refKnsb.burnTime, 0.01)).toBe(true);
    expect(relClose(result.getAverageForce(), refKnsb.averageForce, 0.01)).toBe(true);
    expect(relClose(result.getISP(), refKnsb.isp, 0.01)).toBe(true);
    expect(relClose(result.getPropellantMass(), refKnsb.propellantMass, 0.01)).toBe(true);
    expect(relClose(result.getMaxPressure(), refKnsb.maxPressure, 0.01)).toBe(true);
  });
});
