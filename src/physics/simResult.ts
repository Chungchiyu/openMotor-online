/**
 * Simulation result container. Ported from motorlib/simResult.py — trimmed to the channels and
 * derived statistics the MVP UI actually surfaces.
 */
import { arrayMax } from './arrayMath';
import { standardGravity } from './constants';
import * as geometry from './geometry';
import type { Grain } from './grains/base';
import * as nozzleMod from './nozzle';
import { getCombustionProperties } from './propellant';
import { SimAlertLevel, type MotorDesign, type SimAlert } from './types';
import { convert as convertUnit } from './units';

export type SingleValueChannel = 'time' | 'kn' | 'pressure' | 'force' | 'volumeLoading' | 'exitPressure' | 'dThroat';
export type MultiValueChannel = 'mass' | 'massFlow' | 'massFlux' | 'regression' | 'web' | 'machNumber';

/** Display name + canonical (SI) unit for each channel — matches the `LogChannel(name, type, unit)`
 * definitions in motorlib/simResult.py's `SimulationResult.__init__` exactly. The single source of
 * truth for channel metadata; the chart and CSV export both read from here instead of duplicating it. */
export const singleValueChannelMeta: Record<SingleValueChannel, { label: string; unit: string }> = {
  time: { label: 'Time', unit: 's' },
  kn: { label: 'Kn', unit: '' },
  pressure: { label: 'Chamber Pressure', unit: 'Pa' },
  force: { label: 'Thrust', unit: 'N' },
  volumeLoading: { label: 'Volume Loading', unit: '%' },
  exitPressure: { label: 'Nozzle Exit Pressure', unit: 'Pa' },
  dThroat: { label: 'Change in Throat Diameter', unit: 'm' },
};

export const multiValueChannelMeta: Record<MultiValueChannel, { label: string; unit: string }> = {
  mass: { label: 'Propellant Mass', unit: 'kg' },
  massFlow: { label: 'Mass Flow', unit: 'kg/s' },
  massFlux: { label: 'Mass Flux', unit: 'kg/(m^2*s)' },
  regression: { label: 'Regression Depth', unit: 'm' },
  web: { label: 'Web', unit: 'm' },
  machNumber: { label: 'Core Mach Number', unit: '' },
};

// Matches the exact insertion order of the `channels` dict in motorlib/simResult.py's
// `SimulationResult.__init__` — Python 3.7+ dicts preserve insertion order, and this is what
// `getCSV`'s column order derives from, so it's reproduced here rather than just concatenating the
// single-value and multi-value channels in two separate blocks.
const csvChannelOrder: ({ kind: 'single'; key: SingleValueChannel } | { kind: 'multi'; key: MultiValueChannel })[] = [
  { kind: 'single', key: 'time' },
  { kind: 'single', key: 'kn' },
  { kind: 'single', key: 'pressure' },
  { kind: 'single', key: 'force' },
  { kind: 'multi', key: 'mass' },
  { kind: 'single', key: 'volumeLoading' },
  { kind: 'multi', key: 'massFlow' },
  { kind: 'multi', key: 'massFlux' },
  { kind: 'multi', key: 'regression' },
  { kind: 'multi', key: 'web' },
  { kind: 'single', key: 'exitPressure' },
  { kind: 'single', key: 'dThroat' },
  { kind: 'multi', key: 'machNumber' },
];

export class SimulationResult {
  design: MotorDesign;
  grains: Grain[];
  success = false;
  alerts: SimAlert[] = [];
  /** Tracks the max of `channels.force` incrementally as it's appended (via `pushForce`), so
   * `shouldContinueSim` — called once per simulation step — doesn't have to rescan the whole
   * force history every time (that made a long run O(n^2); see largeRun.test.ts). */
  private maxForceSoFar = -Infinity;

  channels: Record<SingleValueChannel, number[]> = {
    time: [],
    kn: [],
    pressure: [],
    force: [],
    volumeLoading: [],
    exitPressure: [],
    dThroat: [],
  };

  multiChannels: Record<MultiValueChannel, number[][]> = {
    mass: [],
    massFlow: [],
    massFlux: [],
    regression: [],
    web: [],
    machNumber: [],
  };

  constructor(design: MotorDesign, grains: Grain[]) {
    this.design = design;
    this.grains = grains;
  }

  addAlert(alert: SimAlert): void {
    this.alerts.push(alert);
  }

  /** Appends to `channels.force` and updates the running max used by `shouldContinueSim`. Motor's
   * simulation loop must use this instead of pushing to `channels.force` directly. */
  pushForce(value: number): void {
    this.channels.force.push(value);
    if (value > this.maxForceSoFar) this.maxForceSoFar = value;
  }

  getAlertsByLevel(level: SimAlertLevel): SimAlert[] {
    return this.alerts.filter((a) => a.level === level);
  }

  private last<T>(arr: T[]): T {
    return arr[arr.length - 1];
  }

  getBurnTime(): number {
    return this.last(this.channels.time);
  }

  getInitialKN(): number {
    return this.channels.kn[0];
  }

  getPeakKN(): number {
    return arrayMax(this.channels.kn);
  }

  getAveragePressure(): number {
    const data = this.channels.pressure;
    return data.reduce((a, b) => a + b, 0) / data.length;
  }

  getMaxPressure(): number {
    return arrayMax(this.channels.pressure);
  }

  getPercentBelowThreshold(channel: SingleValueChannel, threshold: number): number {
    const data = this.channels[channel];
    const count = data.filter((v) => v < threshold).length;
    return count / data.length;
  }

  getImpulse(stop?: number): number {
    let impulse = 0;
    let lastTime = 0;
    const times = stop === undefined ? this.channels.time : this.channels.time.slice(0, stop);
    const forces = stop === undefined ? this.channels.force : this.channels.force.slice(0, stop);
    for (let i = 0; i < times.length; i++) {
      impulse += forces[i] * (times[i] - lastTime);
      lastTime = times[i];
    }
    return impulse;
  }

  getAverageForce(): number {
    const data = this.channels.force;
    return data.reduce((a, b) => a + b, 0) / data.length;
  }

  getDesignation(): string {
    const imp = this.getImpulse();
    if (imp < 1.25) return 'N/A';
    let letters = '';
    let order = Math.floor(Math.log2(imp / 1.25)) + 1;
    const places = Math.floor(Math.log(order) / Math.log(26)) + 1;
    for (let place = 0; place < places; place++) {
      const remainder = order % 26;
      letters = String.fromCharCode(remainder + 64) + letters;
      order = Math.floor((order - remainder) / 26);
    }
    return `${letters}${this.getAverageForce().toFixed(0)}`;
  }

  getFullDesignation(): string {
    return `${this.getImpulse().toFixed(0)}${this.getDesignation()}`;
  }

  /** Returns how far through its impulse class (0-1) the motor's total impulse falls — e.g. a
   * motor right at the bottom of the "H" range returns ~0, one right at the top (just under the
   * "I" range) returns ~1. Paired with `getDesignation()` in the original's Motor Statistics panel
   * ("H128 (45%)" — see `mainWindow.py`'s `updateMotorStats`), which this app's `SummaryStats` had
   * been showing as `getFullDesignation()` instead (a different string meant for the graph title —
   * see `graphWidget.py`'s `saveImage` — not the stats panel). */
  getImpulseClassPercentage(): number {
    const impulse = this.getImpulse();
    if (impulse < 1.25) return 0;
    const minClassImpulse = 1.25 * 2 ** Math.floor(Math.log2(impulse / 1.25));
    return (impulse - minClassImpulse) / minClassImpulse;
  }

  getPeakMassFlux(): number {
    return arrayMax(this.multiChannels.massFlux.map((frame) => arrayMax(frame)));
  }

  /** Returns the (0-based) grain index where the peak mass flux occurred. */
  getPeakMassFluxLocation(): number | null {
    const value = this.getPeakMassFlux();
    for (const frame of this.multiChannels.massFlux) {
      const idx = frame.indexOf(value);
      if (idx !== -1) return idx;
    }
    return null;
  }

  getPeakMachNumber(): number {
    return arrayMax(this.multiChannels.machNumber.map((frame) => arrayMax(frame)));
  }

  getISP(index?: number): number {
    const propMass = index === undefined ? this.getPropellantMass() : this.getPropellantMass() - this.getPropellantMass(index);
    if (propMass === 0) return 0;
    return this.getImpulse(index) / (propMass * standardGravity);
  }

  getPortRatio(): number | null {
    const lastGrain = this.grains[this.grains.length - 1];
    if (!lastGrain) return null;
    const aftPort = lastGrain.getPortArea(0);
    return aftPort / geometry.circleArea(this.design.nozzle.throat);
  }

  getPropellantLength(): number {
    return this.design.grains.reduce((sum, g) => sum + g.properties.length, 0);
  }

  getMaxPropellantDiameter(): number {
    return arrayMax(this.design.grains.map((g) => g.properties.diameter));
  }

  getPropellantMass(index = 0): number {
    return this.multiChannels.mass[index].reduce((a, b) => a + b, 0);
  }

  getVolumeLoading(index = 0): number {
    return this.channels.volumeLoading[index];
  }

  getIdealThrustCoefficient(): number {
    if (!this.design.propellant) return 0;
    const chamberPres = this.getAveragePressure();
    const { k: gamma } = getCombustionProperties(this.design.propellant, chamberPres);
    return nozzleMod.getIdealThrustCoeff(this.design.nozzle, chamberPres, this.design.config.ambPressure, gamma, 0);
  }

  getAdjustedThrustCoefficient(): number {
    if (!this.design.propellant) return 0;
    const chamberPres = this.getAveragePressure();
    const { k: gamma } = getCombustionProperties(this.design.propellant, chamberPres);
    return nozzleMod.getAdjustedThrustCoeff(this.design.nozzle, chamberPres, this.design.config.ambPressure, gamma, 0);
  }

  shouldContinueSim(thrustThres: number): boolean {
    if (this.channels.time.length === 1) return true;
    return this.last(this.channels.force) > thrustThres * 0.01 * this.maxForceSoFar;
  }

  /**
   * Returns a CSV string of every channel's data, ported from motorlib/simResult.py's `getCSV`.
   * `unitFor` resolves a canonical unit to the user's preferred display unit (pass `(u) => u` to
   * keep everything in SI); `exclude`/`excludeGrains` name channels/grain indices to leave out.
   */
  getCSV(unitFor: (canonical: string) => string, exclude: string[] = [], excludeGrains: number[] = []): string {
    const outUnits: Record<string, string> = {};
    let header = '';

    for (const entry of csvChannelOrder) {
      if (exclude.includes(entry.key)) continue;
      if (entry.kind === 'single') {
        const meta = singleValueChannelMeta[entry.key];
        outUnits[entry.key] = unitFor(meta.unit);
        header += meta.label;
        if (outUnits[entry.key] !== '') header += `(${outUnits[entry.key]})`;
        header += ',';
      } else {
        const meta = multiValueChannelMeta[entry.key];
        outUnits[entry.key] = unitFor(meta.unit);
        const numGrains = this.multiChannels[entry.key][this.multiChannels[entry.key].length - 1]?.length ?? 0;
        for (let g = 1; g <= numGrains; g++) {
          if (excludeGrains.includes(g - 1)) continue;
          header += `${meta.label}(G${g}`;
          if (outUnits[entry.key] !== '') header += `;${outUnits[entry.key]}`;
          header += '),';
        }
      }
    }
    header = header.slice(0, -1) + '\n';

    const places = 5;
    let rows = '';
    for (let i = 0; i < this.channels.time.length; i++) {
      rows += `${round(this.channels.time[i], places)},`;
      for (const entry of csvChannelOrder) {
        if (exclude.includes(entry.key) || entry.key === 'time') continue;
        if (entry.kind === 'single') {
          const converted = convertUnit(this.channels[entry.key][i], singleValueChannelMeta[entry.key].unit, outUnits[entry.key]);
          rows += `${round(converted, places)},`;
        } else {
          const frame = this.multiChannels[entry.key][i] ?? [];
          frame.forEach((v, g) => {
            if (excludeGrains.includes(g)) return;
            const converted = convertUnit(v, multiValueChannelMeta[entry.key].unit, outUnits[entry.key]);
            rows += `${round(converted, places)},`;
          });
        }
      }
      rows = rows.slice(0, -1) + '\n';
    }

    return header + rows;
  }
}

function round(value: number, places: number): number {
  const factor = 10 ** places;
  return Math.round(value * factor) / factor;
}

export function circleAreaOfThroat(throat: number): number {
  return geometry.circleArea(throat);
}
