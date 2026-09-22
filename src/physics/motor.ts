/**
 * The Motor class: holds a set of grains, a nozzle and a propellant, and runs the timestepped
 * internal ballistics simulation. Ported from motorlib/motor.py.
 */
import { atmosphericPressure, gasConstant } from './constants';
import * as geometry from './geometry';
import { buildGrain } from './grains';
import type { Grain } from './grains/base';
import { newtonRaphson } from './numerics';
import * as nozzleMod from './nozzle';
import * as propellantMod from './propellant';
import { SimulationResult } from './simResult';
import { SimAlertLevel, SimAlertType, type MotorDesign, type SimAlert } from './types';

export class Motor {
  design: MotorDesign;
  grains: Grain[];

  constructor(design: MotorDesign) {
    this.design = design;
    this.grains = design.grains.map(buildGrain);
  }

  calcBurningSurfaceArea(regDepth: number[]): number {
    const burnoutThres = this.design.config.burnoutWebThres;
    let total = 0;
    this.grains.forEach((grain, i) => {
      const reg = regDepth[i];
      if (grain.isWebLeft(reg, burnoutThres)) total += grain.getSurfaceAreaAtRegression(reg);
    });
    return total;
  }

  calcKN(regDepth: number[], dThroat: number): number {
    const burningSurfaceArea = this.calcBurningSurfaceArea(regDepth);
    const nozzleArea = nozzleMod.getThroatArea(this.design.nozzle, dThroat);
    return burningSurfaceArea / nozzleArea;
  }

  calcIdealPressure(regDepth: number[], dThroat: number, kn?: number): number {
    const effectiveKn = kn ?? this.calcKN(regDepth, dThroat);
    if (!this.design.propellant) throw new Error('Motor has no propellant set');
    return propellantMod.getPressureFromKn(this.design.propellant, effectiveKn);
  }

  calcForce(chamberPres: number, dThroat: number, exitPres?: number): number {
    if (!this.design.propellant) throw new Error('Motor has no propellant set');
    const { k: gamma } = propellantMod.getCombustionProperties(this.design.propellant, chamberPres);
    const ambPressure = this.design.config.ambPressure;
    const thrustCoeff = nozzleMod.getAdjustedThrustCoeff(this.design.nozzle, chamberPres, ambPressure, gamma, dThroat, exitPres);
    const thrust = thrustCoeff * nozzleMod.getThroatArea(this.design.nozzle, dThroat) * chamberPres;
    return Math.max(thrust, 0);
  }

  calcFreeVolume(regDepth: number[]): number {
    return this.grains.reduce((sum, g, i) => sum + g.getFreeVolume(regDepth[i]), 0);
  }

  calcTotalVolume(): number {
    return this.grains.reduce((sum, g) => sum + g.getGrainBoundingVolume(), 0);
  }

  calcMachNumber(chamberPres: number, massFlux: number): number {
    if (!this.design.propellant) throw new Error('Motor has no propellant set');
    if (chamberPres <= atmosphericPressure) return 0; // Mach calc gets weird at low chamber pressures
    const { k: gamma, t: T, m: molarMass } = propellantMod.getCombustionProperties(this.design.propellant, chamberPres);

    const machFunc = (M: number): number => {
      const A = chamberPres * ((gamma * molarMass) / (gasConstant * T)) ** 0.5;
      const B = 1 + ((gamma - 1) / 2) * M ** 2;
      const C = -(gamma + 1) / (2 * (gamma - 1));
      return A * M * B ** C - massFlux;
    };
    const machFuncDerivative = (M: number): number => {
      const A = chamberPres * ((gamma * molarMass) / gasConstant / T) ** 0.5;
      const B = 1 + ((gamma - 1) / 2) * M ** 2;
      const C = -(gamma + 1) / (2 * (gamma - 1));
      const dB_dM = (gamma - 1) * M;
      return A * (B ** C + M * C * B ** (C - 1) * dB_dM);
    };

    const maxMassFlux = machFunc(1) + massFlux;
    if (massFlux >= maxMassFlux) return 1; // Boom

    const x0 = (Math.asin(massFlux / maxMassFlux) * 2) / Math.PI;
    const M = newtonRaphson(machFunc, machFuncDerivative, x0);
    return Math.max(M, 0);
  }

  /**
   * Runs the timestepped simulation. `onProgress`, if given, is called with a 0-1 completion
   * fraction after each step; returning `true` cancels the simulation early (matching the Python
   * callback's cancel-on-true convention).
   */
  runSimulation(onProgress?: (progress: number) => boolean): SimulationResult {
    const { burnoutWebThres, burnoutThrustThres } = this.design.config;
    const dTime = this.design.config.timestep;

    const simRes = new SimulationResult(this.design, this.grains);

    if (this.grains.length === 0) {
      simRes.addAlert({ level: SimAlertLevel.ERROR, type: SimAlertType.CONSTRAINT, description: 'Motor must have at least one propellant grain', location: 'Motor' });
    }
    this.grains.forEach((grain, gid) => {
      grain.getGeometryErrors().forEach((alert) => {
        simRes.addAlert({ ...alert, location: `Grain ${gid + 1}` });
      });
    });
    nozzleMod.getGeometryErrors(this.design.nozzle).forEach((alert) => simRes.addAlert(alert));

    if (!this.design.propellant) {
      simRes.addAlert({ level: SimAlertLevel.ERROR, type: SimAlertType.CONSTRAINT, description: 'Motor must have a propellant set', location: 'Motor' });
    } else {
      propellantMod.getErrors(this.design.propellant).forEach((alert) => simRes.addAlert(alert));
    }

    if (simRes.getAlertsByLevel(SimAlertLevel.ERROR).length > 0) return simRes;

    const propellant = this.design.propellant!;
    const density = propellant.density;
    const motorVolume = this.calcTotalVolume();

    this.grains.forEach((grain) => grain.simulationSetup(this.design.config));

    let perGrainReg = this.grains.map(() => 0);

    simRes.channels.time.push(0);
    simRes.channels.kn.push(this.calcKN(perGrainReg, 0));
    simRes.channels.pressure.push(this.calcIdealPressure(perGrainReg, 0));
    simRes.channels.force.push(0);
    simRes.multiChannels.mass.push(this.grains.map((g) => g.getVolumeAtRegression(0) * density));
    simRes.channels.volumeLoading.push(100 * (1 - this.calcFreeVolume(perGrainReg) / motorVolume));
    simRes.multiChannels.massFlow.push(this.grains.map(() => 0));
    simRes.multiChannels.massFlux.push(this.grains.map(() => 0));
    simRes.multiChannels.regression.push(this.grains.map(() => 0));
    simRes.multiChannels.web.push(this.grains.map((g) => g.getWebLeft(0)));
    simRes.channels.exitPressure.push(0);
    simRes.channels.dThroat.push(0);
    simRes.multiChannels.machNumber.push(this.grains.map(() => 0));

    const lastGrain = this.grains[this.grains.length - 1];
    if (lastGrain) {
      const aftPort = lastGrain.getPortArea(0);
      const minAllowed = this.design.config.minPortThroat;
      const ratio = aftPort / geometry.circleArea(this.design.nozzle.throat);
      if (ratio < minAllowed) {
        simRes.addAlert({
          level: SimAlertLevel.WARNING,
          type: SimAlertType.CONSTRAINT,
          description: `Initial port/throat ratio of ${ratio.toFixed(3)} was less than ${minAllowed.toFixed(3)}`,
          location: 'N/A',
        });
      }
    }

    let iterationGuard = 0;
    const maxIterations = 200000; // Safety valve against runaway loops in the browser

    while (simRes.shouldContinueSim(burnoutThrustThres)) {
      if (++iterationGuard > maxIterations) {
        simRes.addAlert({ level: SimAlertLevel.ERROR, type: SimAlertType.VALUE, description: 'Simulation exceeded maximum iteration count', location: 'Motor' });
        break;
      }

      let massFlow = 0;
      const perGrainMass = this.grains.map(() => 0);
      const perGrainMassFlow = this.grains.map(() => 0);
      const perGrainMassFlux = this.grains.map(() => 0);
      const perGrainWeb = this.grains.map(() => 0);
      const nextReg = [...perGrainReg];

      this.grains.forEach((grain, gid) => {
        if (grain.getWebLeft(perGrainReg[gid]) > burnoutWebThres) {
          const lastPressure = simRes.channels.pressure[simRes.channels.pressure.length - 1];
          const reg = dTime * propellantMod.getBurnRate(propellant, lastPressure);
          perGrainMassFlux[gid] = grain.getPeakMassFlux(massFlow, dTime, perGrainReg[gid], reg, density);
          perGrainMass[gid] = grain.getVolumeAtRegression(perGrainReg[gid]) * density;
          const lastMass = simRes.multiChannels.mass[simRes.multiChannels.mass.length - 1][gid];
          massFlow += (lastMass - perGrainMass[gid]) / dTime;
          nextReg[gid] = perGrainReg[gid] + reg;
          perGrainWeb[gid] = grain.getWebLeft(nextReg[gid]);
        }
        perGrainMassFlow[gid] = massFlow;
      });
      perGrainReg = nextReg;

      simRes.multiChannels.regression.push([...perGrainReg]);
      simRes.multiChannels.web.push(perGrainWeb);
      simRes.channels.volumeLoading.push(100 * (1 - this.calcFreeVolume(perGrainReg) / motorVolume));
      simRes.multiChannels.mass.push(perGrainMass);
      simRes.multiChannels.massFlow.push(perGrainMassFlow);
      simRes.multiChannels.massFlux.push(perGrainMassFlux);

      const dThroat = simRes.channels.dThroat[simRes.channels.dThroat.length - 1];
      simRes.channels.kn.push(this.calcKN(perGrainReg, dThroat));

      const lastKn = simRes.channels.kn[simRes.channels.kn.length - 1];
      const pressure = this.calcIdealPressure(perGrainReg, dThroat, lastKn);
      simRes.channels.pressure.push(pressure);

      const perGrainMachNumber = perGrainMassFlux.map((flux) => this.calcMachNumber(pressure, flux));
      simRes.multiChannels.machNumber.push(perGrainMachNumber);

      const { k: gamma } = propellantMod.getCombustionProperties(propellant, pressure);
      const exitPressure = nozzleMod.getExitPressure(this.design.nozzle, gamma, pressure);
      simRes.channels.exitPressure.push(exitPressure);

      const lastPressure = simRes.channels.pressure[simRes.channels.pressure.length - 1];
      const force = this.calcForce(lastPressure, dThroat, exitPressure);
      simRes.channels.force.push(force);

      simRes.channels.time.push(simRes.channels.time[simRes.channels.time.length - 1] + dTime);

      let slagRate = 0;
      if (pressure !== 0) slagRate = (1 / pressure) * this.design.nozzle.slagCoeff;
      const erosionRate = pressure * this.design.nozzle.erosionCoeff;
      const change = dTime * (-2 * slagRate + 2 * erosionRate);
      simRes.channels.dThroat.push(dThroat + change);

      if (onProgress) {
        const progress = Math.max(...this.grains.map((g, gid) => g.getWebLeft(perGrainReg[gid]) / g.getWebLeft(0)));
        if (onProgress(1 - progress)) return simRes;
      }
    }

    simRes.success = true;

    if (simRes.getPeakMassFlux() > this.design.config.maxMassFlux) {
      simRes.addAlert({ level: SimAlertLevel.WARNING, type: SimAlertType.CONSTRAINT, description: 'Peak mass flux exceeded configured limit', location: 'Motor' });
    }
    if (simRes.getMaxPressure() > this.design.config.maxPressure) {
      simRes.addAlert({ level: SimAlertLevel.WARNING, type: SimAlertType.CONSTRAINT, description: 'Max pressure exceeded configured limit', location: 'Motor' });
    }
    if (simRes.getPeakMachNumber() >= 1.0) {
      simRes.addAlert({ level: SimAlertLevel.WARNING, type: SimAlertType.CONSTRAINT, description: 'Max core Mach number exceeded allowable subsonic limit (M>1.0)', location: 'Motor' });
    } else if (simRes.getPeakMachNumber() > this.design.config.maxMachNumber) {
      simRes.addAlert({ level: SimAlertLevel.WARNING, type: SimAlertType.CONSTRAINT, description: 'Max core Mach number exceeded configured limit', location: 'Motor' });
    }

    const belowThreshold = simRes.getPercentBelowThreshold('exitPressure', this.design.config.ambPressure * this.design.config.sepPressureRatio);
    if (belowThreshold > this.design.config.flowSeparationWarnPercent) {
      simRes.addAlert({ level: SimAlertLevel.WARNING, type: SimAlertType.VALUE, description: 'Low exit pressure, nozzle flow may separate', location: 'Nozzle' });
    }

    if (simRes.getAverageForce() < burnoutThrustThres) {
      simRes.addAlert({ level: SimAlertLevel.ERROR, type: SimAlertType.VALUE, description: 'Motor did not generate thrust. Check Kn, chamber pressure and expansion ratio.', location: 'Motor' });
    }

    for (const pressure of simRes.channels.pressure) {
      if (pressure > 0) {
        const errs = propellantMod.getPressureErrors(propellant, pressure);
        if (errs.length > 0) {
          simRes.addAlert(errs[0]);
          break;
        }
      }
    }

    return simRes;
  }
}

export function getGeometryErrors(motor: Motor): SimAlert[] {
  return motor.grains.flatMap((g) => g.getGeometryErrors());
}
