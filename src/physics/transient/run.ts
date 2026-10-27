/**
 * Runs a design with the transient model (chamber.ts) and fills a `SimulationResult` with the same
 * channels openMotor's simulation has, so the chart, grain table, statistics and exports all work
 * unchanged. Mirrors `Motor.runSimulationChunked`: same validation, grain setup and final checks,
 * yielding to the browser on a wall-clock timer so the progress dialog paints and Cancel works.
 */
import { yieldToEventLoop } from '../asyncUtils';
import { Motor, type SimProgress } from '../motor';
import type { SimulationResult } from '../simResult';
import { SimAlertLevel, SimAlertType, type MotorDesign } from '../types';
import { Chamber } from './chamber';
import { MotorlibGeometry } from './geometry';
import { effectiveTransientOptions, type TransientSettings } from './options';

/** Seconds between recorded samples: the integration step is ~1 ms, far finer than a chart needs. */
const RECORD_INTERVAL = 0.005;
const MAX_MS_BETWEEN_YIELDS = 40;

export async function runTransientChunked(
  design: MotorDesign,
  settings: TransientSettings,
  onProgress: (progress: SimProgress) => void,
  isCancelled: () => boolean,
): Promise<SimulationResult | null> {
  onProgress({ phase: 'setup', fraction: 0 });
  await yieldToEventLoop();
  if (isCancelled()) return null;

  const motor = new Motor(design);
  const simRes = motor.validateDesign();
  const o = effectiveTransientOptions(settings, design.nozzle, design.config.ambPressure);
  if (!(o.dt > 0) || !(o.tMax > 0)) {
    simRes.addAlert({ level: SimAlertLevel.ERROR, type: SimAlertType.VALUE, description: 'Transient model timestep and maximum time must be positive', location: 'Transient' });
  }
  if (motor.hasBlockingErrors(simRes)) return simRes;
  if (!(await motor.setupGrainsChunked(onProgress, isCancelled))) return null;

  let baseline: SimulationResult | null = null;
  if (settings.compareBaseline) {
    baseline = await motor.runSimulationChunked((p) => onProgress({ phase: 'run', fraction: p.phase === 'run' ? 0.2 * p.fraction : 0 }), isCancelled);
    if (!baseline) return null;
  }
  const runStart = baseline ? 0.2 : 0;

  const propellant = design.propellant!;
  const density = propellant.density;
  const grains = motor.grains;
  const geometry = new MotorlibGeometry(
    grains,
    design.grains.map((g) => JSON.stringify(g)),
    o.ecc,
  );
  const ch = new Chamber(propellant, geometry, design.nozzle, o);
  // p = m R T / V_free: a grain that fills its envelope (an end burner) leaves nothing to fill
  if (ch.vFree < 0.01 * ch.vChamber) {
    simRes.addAlert({
      level: SimAlertLevel.ERROR,
      type: SimAlertType.GEOMETRY,
      description: 'The transient model needs free volume in the chamber at ignition: set Extra Free Volume (nozzle convergence, gaps) to at least 1% of the grain envelope',
      location: 'Transient',
    });
    return simRes;
  }
  const extra = { nozzleMassFlow: [] as number[], litFraction: [] as number[] };
  const motorVolume = geometry.envelopeVolume();

  const record = () => {
    const states = grains.map((_, i) => geometry.state(i, ch.x[i]));
    const p = ch.p;
    simRes.channels.time.push(ch.t);
    simRes.channels.kn.push(ch.litArea / ch.at);
    simRes.channels.pressure.push(p);
    simRes.pushForce(ch.thrust());
    simRes.channels.volumeLoading.push(100 * (1 - (motorVolume - states.reduce((s, st) => s + st[2], 0)) / motorVolume));
    simRes.channels.exitPressure.push(ch.plug ? 0 : p * ch.exitPressureRatio());
    simRes.channels.dThroat.push(0);
    simRes.multiChannels.mass.push(states.map((st) => st[2] * density));
    simRes.multiChannels.regression.push(Array.from(ch.x));
    simRes.multiChannels.web.push(states.map((st) => st[3]));
    let upstream = 0;
    const massFlow: number[] = [];
    const massFlux: number[] = [];
    grains.forEach((g, i) => {
      upstream += ch.generation[i];
      massFlow.push(upstream);
      const port = g.getPortArea(ch.x[i]);
      massFlux.push(port !== null && port > 0 ? upstream / port : 0);
    });
    simRes.multiChannels.massFlow.push(massFlow);
    simRes.multiChannels.massFlux.push(massFlux);
    simRes.multiChannels.machNumber.push(massFlux.map((flux) => motor.calcMachNumber(p, flux)));
    extra.nozzleMassFlow.push(ch.mdot);
    extra.litFraction.push(ch.totalArea > 0 ? (100 * ch.litArea) / ch.totalArea : 0);
  };

  record();

  const stride = Math.max(1, Math.round(RECORD_INTERVAL / o.dt));
  let steps = 0;
  let lastYield = Date.now();
  while (!ch.done) {
    if (ch.t >= o.tMax) {
      simRes.addAlert({
        level: SimAlertLevel.WARNING,
        type: SimAlertType.VALUE,
        description: `Transient model stopped at the maximum time of ${o.tMax} s before the chamber blew down`,
        location: 'Transient',
      });
      break;
    }
    ch.step(o.dt);
    steps++;
    if (steps % stride === 0 || ch.done) record();
    if (Date.now() - lastYield >= MAX_MS_BETWEEN_YIELDS) {
      const burnt = ch.mProp0 > 0 ? 1 - ch.grainMasses().reduce((s, m) => s + m, 0) / ch.mProp0 : 1;
      onProgress({ phase: 'run', fraction: runStart + (1 - runStart) * burnt });
      // eslint-disable-next-line no-await-in-loop
      await yieldToEventLoop();
      if (isCancelled()) return null;
      lastYield = Date.now();
    }
  }
  if (simRes.channels.time[simRes.channels.time.length - 1] !== ch.t) record();

  motor.finalizeSimulation(simRes, propellant);
  simRes.transient = { channels: extra, baseline };
  onProgress({ phase: 'run', fraction: 1 });
  return simRes;
}
