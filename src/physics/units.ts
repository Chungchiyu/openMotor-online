/**
 * Unit conversion tables. All internal calculations are done in the base units used as the first
 * element of each row below (SI). Ported from motorlib/units.py.
 */

export const unitLabels: Record<string, string> = {
  m: 'Length',
  'm^3': 'Volume',
  'm/s': 'Velocity',
  N: 'Force',
  Ns: 'Impulse',
  Pa: 'Pressure',
  kg: 'Mass',
  'kg/m^3': 'Density',
  'kg/s': 'Mass Flow',
  'kg/(m^2*s)': 'Mass Flux',
  'm/(s*Pa^n)': 'Burn Rate Coefficient',
  '(m*Pa)/s': 'Nozzle Slag Coefficient',
  'm/(s*Pa)': 'Nozzle Erosion Coefficient',
};

type UnitConversion = [string, string, number];

const unitTable: UnitConversion[] = [
  ['m', 'cm', 100],
  ['m', 'mm', 1000],
  ['m', 'in', 39.37],
  ['m', 'ft', 3.28],

  ['m^3', 'cm^3', 100 ** 3],
  ['m^3', 'mm^3', 1000 ** 3],
  ['m^3', 'in^3', 39.37 ** 3],
  ['m^3', 'ft^3', 3.28 ** 3],

  ['m/s', 'cm/s', 100],
  ['m/s', 'mm/s', 1000],
  ['m/s', 'ft/s', 3.28],
  ['m/s', 'in/s', 39.37],

  ['N', 'lbf', 0.2248],

  ['Ns', 'lbfs', 0.2248],

  ['Pa', 'MPa', 1 / 1000000],
  ['Pa', 'psi', 1 / 6895],

  ['kg', 'g', 1000],
  ['kg', 'lb', 2.205],
  ['kg', 'oz', 2.205 * 16],

  ['kg/m^3', 'lb/in^3', 3.61273e-5],
  ['kg/m^3', 'g/cm^3', 0.001],

  ['kg/s', 'lb/s', 2.205],
  ['kg/s', 'g/s', 1000],

  ['kg/(m^2*s)', 'lb/(in^2*s)', 0.001422],

  ['(m*Pa)/s', '(m*MPa)/s', 1000000],
  ['(m*Pa)/s', '(in*psi)/s', 0.00571014715],

  ['m/(s*Pa)', 'thou/(s*psi)', 271447138],
  ['m/(s*Pa)', 'um/(s*mPa)', 1e9],

  ['m/(s*Pa^n)', 'in/(s*psi^n)', 39.37],
  ['m/(s*Pa^n)', 'mm/(s*Pa^n)', 1000],
];

// Base units that are unwieldy to edit directly always have a better conversion, so they're hidden
const internalOnlyUnits = ['m/(s*Pa^n)', 'm/(s*Pa)'];

export function getAllConversions(unit: string): string[] {
  const allConversions = [unit];
  for (const [from, to] of unitTable) {
    if (from === unit) allConversions.push(to);
    else if (to === unit) allConversions.push(from);
  }
  return allConversions.filter((u) => !internalOnlyUnits.includes(u));
}

export function getConversion(originUnit: string, destUnit: string): number {
  if (originUnit === destUnit) return 1;
  for (const [from, to, rate] of unitTable) {
    if (from === originUnit && to === destUnit) return rate;
    if (to === originUnit && from === destUnit) return 1 / rate;
  }
  throw new Error(`Cannot find conversion from <${originUnit}> to <${destUnit}>`);
}

export function convert(quantity: number, originUnit: string, destUnit: string): number {
  return quantity * getConversion(originUnit, destUnit);
}

export function convertAll(quantities: number[], originUnit: string, destUnit: string): number[] {
  const rate = getConversion(originUnit, destUnit);
  return quantities.map((q) => q * rate);
}

export function convFormat(quantity: number, originUnit: string, destUnit: string, places = 3): string {
  const rounded = Number(convert(quantity, originUnit, destUnit).toFixed(places));
  return `${rounded} ${destUnit}`;
}

/**
 * Converts a propellant's burn rate coefficient `a` (from `r = a * P^n`) between its canonical unit
 * (`m/(s*Pa^n)`) and a display unit, which the plain `convert()` above can't do: `a`'s unit has the
 * pressure term raised to the tab's own burn rate exponent `n`, so switching the pressure base from
 * Pa to psi scales by `(Pa->psi factor)^n` — not a fixed rate a `unitTable` row can express, since it
 * depends on which propellant tab is being shown. `mm/(s*Pa^n)` keeps the same pressure base, so
 * it's a plain length conversion and doesn't need `n` at all. Mirrors the split between the generic
 * per-field conversion and `PropellantTabEditor`'s override in
 * uilib/widgets/propellantTabEditor.py.
 */
export function convertBurnRateCoefficient(value: number, n: number, fromUnit: string, toUnit: string): number {
  const psiToPa = getConversion('psi', 'Pa'); // 6895: how many Pa in one psi
  const mToIn = getConversion('m', 'in');
  const mToMm = getConversion('m', 'mm');

  const toCanonical = (v: number, unit: string): number => {
    if (unit === 'm/(s*Pa^n)') return v;
    if (unit === 'mm/(s*Pa^n)') return v / mToMm;
    if (unit === 'in/(s*psi^n)') return v / mToIn / psiToPa ** n;
    throw new Error(`Unknown burn rate coefficient unit <${unit}>`);
  };
  const fromCanonical = (v: number, unit: string): number => {
    if (unit === 'm/(s*Pa^n)') return v;
    if (unit === 'mm/(s*Pa^n)') return v * mToMm;
    if (unit === 'in/(s*psi^n)') return v * mToIn * psiToPa ** n;
    throw new Error(`Unknown burn rate coefficient unit <${unit}>`);
  };

  return fromCanonical(toCanonical(value, fromUnit), toUnit);
}
