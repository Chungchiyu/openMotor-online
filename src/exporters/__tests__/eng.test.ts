/**
 * Regression test for the .eng exporter against a real RASP file produced by running openMotor's
 * own Python exporter logic on the bundled "simple" regression fixture.
 */
import { describe, expect, it } from 'vitest';
import { Motor } from '../../physics/motor';
import type { MotorDesign } from '../../physics/types';
import refSimple from '../../physics/__fixtures__/ref_simple.json';
import { buildEngFile } from '../eng';

// Python's str(round(80.0, 6)) prints "80.0" (floats always show a decimal point) where JS's
// String(80) prints "80" — same numeric value, and any RASP-format parser reads both as 80.0, so
// this is a cosmetic difference only, not reproduced here.
const expected = `L1065 80 300 P 2.171633 2.221633 Test
0 0.01
0.03 948.4751
0.06 953.4516
`;

describe('buildEngFile', () => {
  it('matches the Python exporter output (header line and first few data lines)', () => {
    const design = refSimple.motorDict as unknown as MotorDesign;
    const motor = new Motor(design);
    const result = motor.runSimulation();
    const eng = buildEngFile(result, { designation: result.getDesignation(), diameter: 0.08, length: 0.3, hardwareMass: 0.05, manufacturer: 'Test' });
    expect(eng.startsWith(expected)).toBe(true);
    expect(eng.endsWith('4.59 0\n;\n;\n')).toBe(true);
  });
});
