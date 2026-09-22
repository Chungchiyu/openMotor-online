/**
 * A small built-in propellant library. Full propellant CRUD (like the original desktop app's
 * propellant database editor) is out of scope for this MVP — see the design doc — so users pick
 * from these presets instead.
 *
 * Values are copied verbatim from openMotor's own `uilib/defaults.py` (`DEFAULT_PROPELLANTS`),
 * mechanically extracted via a one-off script (not part of this app) rather than transcribed by
 * hand, after an earlier hand-entered "Rocket Candy (KNSU)" preset turned out to have a burn rate
 * coefficient off by ~12x and wrong combustion temperatures on two other presets — see git history
 * for that bug. Don't hand-edit these numbers; regenerate from the Python source instead.
 */
import type { PropellantConfig } from './types';

export const presetPropellants: PropellantConfig[] = [
  {
    name: "MIT - Cherry Limeade",
    density: 1670,
    tabs: [
      { minPressure: 0, maxPressure: 6895000, a: 0.00003517054143255937, n: 0.3273, k: 1.21, t: 2800, m: 23.67 },
    ],
  },
  {
    name: "MIT - Ocean Water",
    density: 1650,
    tabs: [
      { minPressure: 0, maxPressure: 6895000, a: 0.00001467, n: 0.382, k: 1.25, t: 2600, m: 23.67 },
    ],
  },
  {
    name: "Nakka - KNDX",
    density: 1785,
    tabs: [
      { minPressure: 103425, maxPressure: 779135, a: 0.0000017096289148678155, n: 0.619, k: 1.1308, t: 1625, m: 42.39 },
      { minPressure: 779135, maxPressure: 2571835, a: 0.008553459092346196, n: -0.009, k: 1.1308, t: 1625, m: 42.39 },
      { minPressure: 2571835, maxPressure: 5929700, a: 2.90330733578913e-7, n: 0.688, k: 1.1308, t: 1625, m: 42.39 },
      { minPressure: 5929700, maxPressure: 8501535, a: 0.1330457207587796, n: -0.148, k: 1.1308, t: 1625, m: 42.39 },
      { minPressure: 8501535, maxPressure: 11204375, a: 0.000010537671694797537, n: 0.444, k: 1.1308, t: 1625, m: 42.39 },
    ],
  },
  {
    name: "Nakka - KNSB",
    density: 1750,
    tabs: [
      { minPressure: 103425, maxPressure: 806715, a: 0.0000019253259619746373, n: 0.625, k: 1.1361, t: 1520, m: 39.9 },
      { minPressure: 806715, maxPressure: 1503110, a: 0.6656608561590813, n: -0.313, k: 1.1361, t: 1520, m: 39.9 },
      { minPressure: 1503110, maxPressure: 3792250, a: 0.009528121181782798, n: -0.0145, k: 1.1361, t: 1520, m: 39.9 },
      { minPressure: 3792250, maxPressure: 7032900, a: 0.000002709667768835332, n: 0.5245, k: 1.1361, t: 1520, m: 39.9 },
      { minPressure: 7032900, maxPressure: 10673460, a: 0.00417677261069904, n: 0.059, k: 1.1361, t: 1520, m: 39.9 },
    ],
  },
  {
    name: "Nakka - KNSU",
    density: 1800,
    tabs: [
      { minPressure: 0, maxPressure: 10342500, a: 0.00010073115141607291, n: 0.319, k: 1.133, t: 1720, m: 41.98 },
    ],
  },
  {
    name: "RCS - White Lightning",
    density: 1820.230130676801,
    tabs: [
      { minPressure: 0, maxPressure: 10342500, a: 0.000005710516747228669, n: 0.45, k: 1.243, t: 2339, m: 27.125 },
    ],
  },
  {
    name: "RCS - Blue Thunder",
    density: 1625.0868456817973,
    tabs: [
      { minPressure: 0, maxPressure: 10342500, a: 0.00006994600946367753, n: 0.321, k: 1.235, t: 2616.5, m: 22.959 },
    ],
  },
  {
    name: "RCS - Black Jack",
    density: 2085.95715705,
    tabs: [
      { minPressure: 0, maxPressure: 10342500, a: 0.00123560472, n: 0.056, k: 1.247, t: 1428.99, m: 30.561 },
    ],
  },
  {
    name: "RCS - Redline",
    density: 1729.9936613,
    tabs: [
      { minPressure: 0, maxPressure: 10342500, a: 0.00002969528, n: 0.366, k: 1.225, t: 2238.589, m: 26.502 },
    ],
  },
  {
    name: "RCS - Black Max",
    density: 2021.18619437,
    tabs: [
      { minPressure: 0, maxPressure: 10342500, a: 0.00001507051, n: 0.398, k: 1.275, t: 1462.331, m: 27.627 },
    ],
  },
  {
    name: "RCS - Warp 9",
    density: 1641.41798584,
    tabs: [
      { minPressure: 0, maxPressure: 10342500, a: 0.00024721816, n: 0.287, k: 1.229, t: 2780.64, m: 23.669 },
    ],
  },
  {
    name: "RCS - Mojave Green",
    density: 1807.77417632,
    tabs: [
      { minPressure: 0, maxPressure: 10342500, a: 0.00000813177, n: 0.462, k: 1.209, t: 2913.486, m: 29.784 },
    ],
  },
  {
    name: "RCS - Classic",
    density: 1646.95396556,
    tabs: [
      { minPressure: 0, maxPressure: 10342500, a: 0.00004444896, n: 0.323, k: 1.225, t: 2887.981, m: 24.145 },
    ],
  },
  {
    name: "RCS - Metalstorm",
    density: 1819.39973372,
    tabs: [
      { minPressure: 0, maxPressure: 10342500, a: 0.00000571052, n: 0.45, k: 1.21, t: 2558.168, m: 29.153 },
    ],
  },
  {
    name: "RCS - Metalstorm DM",
    density: 1697.88497895,
    tabs: [
      { minPressure: 0, maxPressure: 10342500, a: 0.00004643358, n: 0.334, k: 1.257, t: 1895.29, m: 23.262 },
    ],
  },
  {
    name: "RCS - Propellant X (K1103X)",
    density: 1746.60160045,
    tabs: [
      { minPressure: 0, maxPressure: 10342500, a: 0.00004614321, n: 0.358, k: 1.177, t: 3442.461, m: 27.704 },
    ],
  },
  {
    name: "RCS - Super Thunder",
    density: 1644.1859757,
    tabs: [
      { minPressure: 0, maxPressure: 10342500, a: 0.00027247858, n: 0.277, k: 1.223, t: 2737.657, m: 23.767 },
    ],
  },
  {
    name: "RCS - Slow White Lightning",
    density: 1815.8013469,
    tabs: [
      { minPressure: 0, maxPressure: 10342500, a: 0.00002147703, n: 0.346, k: 1.245, t: 2364.133, m: 27.022 },
    ],
  },
  {
    name: "RCS - New Blue Thunder",
    density: 1702.59056171,
    tabs: [
      { minPressure: 0, maxPressure: 10342500, a: 0.00001470602, n: 0.41, k: 1.203, t: 3184.414, m: 26.005 },
    ],
  },
  {
    name: "RCS - Slower White Lightning",
    density: 1815.8013469,
    tabs: [
      { minPressure: 0, maxPressure: 10342500, a: 0.00007994681, n: 0.244, k: 1.245, t: 2364.133, m: 27.022 },
    ],
  },
];
