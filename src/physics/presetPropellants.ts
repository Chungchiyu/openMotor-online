/**
 * A small built-in propellant library. Full propellant CRUD (like the original desktop app's
 * propellant database editor) is out of scope for this MVP — see the design doc — so users pick
 * from these presets instead. Values are taken from openMotor's own bundled propellant defaults
 * and regression fixtures, not independently sourced.
 */
import type { PropellantConfig } from './types';

export const presetPropellants: PropellantConfig[] = [
  {
    name: 'Rocket Candy (KNSU)',
    density: 1750,
    tabs: [{ minPressure: 0, maxPressure: 1e7, a: 8.26e-6, n: 0.319, k: 1.131, t: 1720, m: 39.9 }],
  },
  {
    name: 'MIT - Cherry Limeade',
    density: 1680.0037644662068,
    tabs: [{ minPressure: 0, maxPressure: 6895000, a: 3.517054143255937e-5, n: 0.3273, k: 1.21, t: 3500, m: 23.67 }],
  },
  {
    name: 'MIT - Ocean Water',
    density: 1650,
    tabs: [{ minPressure: 0, maxPressure: 6895000, a: 1.467e-5, n: 0.382, k: 1.25, t: 3500, m: 23.67 }],
  },
];
