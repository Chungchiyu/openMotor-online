/**
 * Regression test comparing the Custom Grain against golden values from running the actual Python
 * motorlib on openMotor's own bundled fixture (test/data/regression/custom/motor.ric — a 200-point
 * hand-drawn polygon core, not a simple shape). See src/physics/__fixtures__/ref_customgrain.json
 * for how it was generated: the Python file's `points` + `dxfUnit: in` were converted to plain
 * meters up front, matching this port's CustomGrainProperties (no per-grain unit field — see
 * src/ric/motor.ts).
 *
 * 1% tolerance, not Star's 0.05%: a sanity check against an equivalent BATES core (a circle
 * approximated by a 360-point custom polygon) matches within ~0.3%, confirming the rasterizer
 * itself isn't the source of the gap — this fixture's 200-point outline has several sharp
 * concave notches, and FMM error is known to amplify near such caustics/corners (same structural
 * cause already documented for the star grain's own, smaller residual error).
 */
import { describe, expect, it } from 'vitest';
import { Motor } from '../motor';
import type { MotorDesign } from '../types';
import refCustom from '../__fixtures__/ref_customgrain.json';

function relClose(actual: number, expected: number, relTol: number, absTol = 1e-9): boolean {
  return Math.abs(actual - expected) <= Math.max(absTol, relTol * Math.abs(expected));
}

describe('Custom Grain motor matches Python reference', () => {
  const design = refCustom.motorDict as unknown as MotorDesign;
  const motor = new Motor(design);
  const result = motor.runSimulation();

  it('succeeds', () => {
    expect(result.success).toBe(true);
  });

  it('matches burn time, average force, ISP and propellant mass within 1%', () => {
    expect(relClose(result.getBurnTime(), refCustom.burnTime, 0.01)).toBe(true);
    expect(relClose(result.getAverageForce(), refCustom.averageForce, 0.01)).toBe(true);
    expect(relClose(result.getISP(), refCustom.isp, 0.01)).toBe(true);
    expect(relClose(result.getPropellantMass(), refCustom.propellantMass, 0.01)).toBe(true);
  });
});
