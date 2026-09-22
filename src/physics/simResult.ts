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

export type SingleValueChannel = 'time' | 'kn' | 'pressure' | 'force' | 'volumeLoading' | 'exitPressure' | 'dThroat';
export type MultiValueChannel = 'mass' | 'massFlow' | 'massFlux' | 'regression' | 'web' | 'machNumber';

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

  getPeakMassFlux(): number {
    return arrayMax(this.multiChannels.massFlux.map((frame) => arrayMax(frame)));
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
}

export function circleAreaOfThroat(throat: number): number {
  return geometry.circleArea(throat);
}
