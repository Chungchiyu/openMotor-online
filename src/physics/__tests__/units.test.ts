import { describe, expect, it } from 'vitest';
import { convertBurnRateCoefficient } from '../units';

describe('convertBurnRateCoefficient', () => {
  it('is a no-op when the units match', () => {
    expect(convertBurnRateCoefficient(1e-5, 0.3, 'm/(s*Pa^n)', 'm/(s*Pa^n)')).toBe(1e-5);
  });

  it('converts m/(s*Pa^n) -> mm/(s*Pa^n) as a plain x1000 (pressure base unchanged)', () => {
    expect(convertBurnRateCoefficient(1e-5, 0.3, 'm/(s*Pa^n)', 'mm/(s*Pa^n)')).toBeCloseTo(0.01, 12);
  });

  it('converts m/(s*Pa^n) -> in/(s*psi^n), scaling the pressure side by (Pa->psi)^n', () => {
    // Matches uilib/widgets/propellantTabEditor.py's loadProperties: canonical * 39.37 * 6895**n.
    const result = convertBurnRateCoefficient(1e-5, 0.3, 'm/(s*Pa^n)', 'in/(s*psi^n)');
    expect(result).toBeCloseTo(1e-5 * 39.37 * 6895 ** 0.3, 12);
  });

  it('round-trips through in/(s*psi^n) and back for a range of exponents', () => {
    for (const n of [0.1, 0.3, 0.5, 0.8]) {
      const a = 2.3e-5;
      const display = convertBurnRateCoefficient(a, n, 'm/(s*Pa^n)', 'in/(s*psi^n)');
      const back = convertBurnRateCoefficient(display, n, 'in/(s*psi^n)', 'm/(s*Pa^n)');
      expect(back).toBeCloseTo(a, 15);
    }
  });

  it('a higher n exaggerates the in/(s*psi^n) scaling relative to a lower n', () => {
    const low = convertBurnRateCoefficient(1e-5, 0.2, 'm/(s*Pa^n)', 'in/(s*psi^n)');
    const high = convertBurnRateCoefficient(1e-5, 0.6, 'm/(s*Pa^n)', 'in/(s*psi^n)');
    expect(high).toBeGreaterThan(low);
  });
});
