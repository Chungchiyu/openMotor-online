/**
 * Regression test for the "Rocket Candy (KNSU)" preset bug: an earlier hand-entered version of
 * this preset had a burn rate coefficient (`a`) off by ~12x from openMotor's actual
 * `uilib/defaults.py` KNSU_PROPS, which produced drastically wrong pressure/thrust/burn time.
 * presetPropellants.ts is now generated mechanically from the Python source (see its header
 * comment) instead of hand-transcribed, but this pins the correct numeric behavior directly too.
 */
import { describe, expect, it } from 'vitest';
import { Motor } from '../motor';
import { presetPropellants } from '../presetPropellants';
import type { MotorDesign } from '../types';
import refKnsu from '../__fixtures__/ref_knsu.json';

function relClose(actual: number, expected: number, relTol: number, absTol = 1e-9): boolean {
  return Math.abs(actual - expected) <= Math.max(absTol, relTol * Math.abs(expected));
}

describe('Nakka - KNSU preset matches Python reference', () => {
  const knsu = presetPropellants.find((p) => p.name === 'Nakka - KNSU');

  it('is present in the preset list with the correct burn rate coefficient', () => {
    expect(knsu).toBeDefined();
    expect(knsu?.tabs[0].a).toBeCloseTo(0.00010073115141607291, 12);
  });

  it('matches burn time, average force, ISP, propellant mass and peak pressure within 1%', () => {
    const design = refKnsu.motorDict as unknown as MotorDesign;
    const motor = new Motor(design);
    const result = motor.runSimulation();

    expect(result.success).toBe(true);
    expect(relClose(result.getBurnTime(), refKnsu.burnTime, 0.01)).toBe(true);
    expect(relClose(result.getAverageForce(), refKnsu.averageForce, 0.01)).toBe(true);
    expect(relClose(result.getISP(), refKnsu.isp, 0.01)).toBe(true);
    expect(relClose(result.getPropellantMass(), refKnsu.propellantMass, 0.01)).toBe(true);
    expect(relClose(result.getMaxPressure(), refKnsu.maxPressure, 0.01)).toBe(true);
  });
});
