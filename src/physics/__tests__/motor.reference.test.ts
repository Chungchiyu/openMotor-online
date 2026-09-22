/**
 * Regression tests comparing the TS physics engine against golden values produced by running the
 * actual Python openMotor source (motorlib) on the project's own bundled regression fixtures
 * (test/data/regression/{simple,star}/motor.ric from github.com/reilleya/openMotor). See
 * src/physics/__fixtures__ for the raw dumped reference JSON and how it was generated.
 *
 * BATES is fully analytic, so it's held to a tight tolerance. The star grain depends on our
 * hand-rolled fast marching method + marching squares standing in for skfmm + a Cython contour
 * routine, so it's held to a looser tolerance — see fmm.ts and contours.ts for why.
 */
import { describe, expect, it } from 'vitest';
import type { MotorDesign } from '../types';
import { Motor } from '../motor';
import refSimple from '../__fixtures__/ref_simple.json';
import refStar from '../__fixtures__/ref_star.json';

function relClose(actual: number, expected: number, relTol: number, absTol = 1e-9): boolean {
  return Math.abs(actual - expected) <= Math.max(absTol, relTol * Math.abs(expected));
}

describe('BATES motor matches Python reference (tight tolerance)', () => {
  const design = refSimple.motorDict as unknown as MotorDesign;
  const motor = new Motor(design);
  const result = motor.runSimulation();

  it('succeeds', () => {
    expect(result.success).toBe(true);
  });

  it('matches burn time, average force, ISP and propellant mass within 1%', () => {
    expect(relClose(result.getBurnTime(), refSimple.burnTime, 0.01)).toBe(true);
    expect(relClose(result.getAverageForce(), refSimple.averageForce, 0.01)).toBe(true);
    expect(relClose(result.getISP(), refSimple.isp, 0.01)).toBe(true);
    expect(relClose(result.getPropellantMass(), refSimple.propellantMass, 0.01)).toBe(true);
  });

  it('matches peak pressure and impulse within 1%', () => {
    expect(relClose(result.getMaxPressure(), refSimple.maxPressure, 0.01)).toBe(true);
    expect(relClose(result.getImpulse(), refSimple.impulse, 0.01)).toBe(true);
  });

  it('matches the initial Kn within 1%', () => {
    expect(relClose(result.getInitialKN(), refSimple.initialKN, 0.01)).toBe(true);
  });
});

describe('Star (FMM) motor matches Python reference (loose tolerance)', () => {
  const design = refStar.motorDict as unknown as MotorDesign;
  const motor = new Motor(design);
  const result = motor.runSimulation();

  it('succeeds', () => {
    expect(result.success).toBe(true);
  });

  it('matches burn time, average force, ISP and propellant mass within 15%', () => {
    expect(relClose(result.getBurnTime(), refStar.burnTime, 0.15)).toBe(true);
    expect(relClose(result.getAverageForce(), refStar.averageForce, 0.15)).toBe(true);
    expect(relClose(result.getISP(), refStar.isp, 0.15)).toBe(true);
    expect(relClose(result.getPropellantMass(), refStar.propellantMass, 0.02)).toBe(true);
  });
});
