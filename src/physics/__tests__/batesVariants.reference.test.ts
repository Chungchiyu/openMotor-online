/**
 * Reference-value coverage for BATES code paths the other tests didn't exercise: every
 * `inhibitedEnds` setting (including two grains stacked with opposite inhibition, a common real
 * design), nonzero nozzle erosion/slag coefficients (throat diameter changing over the burn), and
 * both a very large and very small expansion ratio (stresses the exit-pressure root finder in
 * nozzle.ts differently than the other fixtures do). All match the Python reference to within
 * floating-point noise — see __fixtures__/ref_variant_*.json for how they were generated.
 */
import { describe, expect, it } from 'vitest';
import { Motor } from '../motor';
import type { MotorDesign } from '../types';
import refBoth from '../__fixtures__/ref_variant_inhib_both.json';
import refTop from '../__fixtures__/ref_variant_inhib_top.json';
import refBottom from '../__fixtures__/ref_variant_inhib_bottom.json';
import refStack from '../__fixtures__/ref_variant_inhib_stack.json';
import refErosion from '../__fixtures__/ref_variant_erosion.json';
import refSlag from '../__fixtures__/ref_variant_slag.json';
import refBig from '../__fixtures__/ref_variant_bigexpansion.json';
import refSmall from '../__fixtures__/ref_variant_smallexpansion.json';

function relClose(actual: number, expected: number, relTol: number, absTol = 1e-9): boolean {
  return Math.abs(actual - expected) <= Math.max(absTol, relTol * Math.abs(expected));
}

function check(name: string, ref: { motorDict: unknown; burnTime: number; averageForce: number; isp: number }) {
  it(name, () => {
    const motor = new Motor(ref.motorDict as MotorDesign);
    const result = motor.runSimulation();
    expect(result.success).toBe(true);
    // Tight tolerance (0.05%) — these are all-analytic BATES configurations, so unlike the FMM
    // grains there's no approximation to allow for; any real deviation should show up here.
    expect(relClose(result.getBurnTime(), ref.burnTime, 0.0005)).toBe(true);
    expect(relClose(result.getAverageForce(), ref.averageForce, 0.0005)).toBe(true);
    expect(relClose(result.getISP(), ref.isp, 0.0005)).toBe(true);
  });
}

describe('BATES variants match Python reference tightly', () => {
  check('inhibitedEnds: Both', refBoth);
  check('inhibitedEnds: Top', refTop);
  check('inhibitedEnds: Bottom', refBottom);
  check('two grains, opposite inhibition (Top + Bottom stacked)', refStack);
  check('nonzero throat erosion coefficient', refErosion);
  check('nonzero slag coefficient', refSlag);
  check('large expansion ratio', refBig);
  check('small expansion ratio', refSmall);
});
