/**
 * Options of the transient internal-ballistics model and the toggles that switch its effects on and
 * off. Ported from sugar-ballistics (sbal/engine.py `Options`, `PRESETS`) as diver-sim uses it
 * (diver/transient.py `options_from_config`): the nozzle efficiency defaults to the design's own and
 * the ambient pressure is the config's.
 *
 * The model's options are grouped under four toggles. A toggle that is off puts its options back to
 * what reproduces openMotor, so with every toggle off the transient model is openMotor plus chamber
 * filling and blow-down (sbal's "openmotor" preset).
 */
import type { NozzleConfig } from '../types';

export type IgniterProfile = 'step' | 'decay';
export type IgnitionShape = 'linear' | 'smooth';

/** sbal.engine.Options, minus what this port leaves out (erosive burning — on hold in sbal — the
 * BATES-sector geometry, and the test-comparison sensor model). SI units. */
export interface TransientOptions {
  // losses / burn rate (calibration)
  /** x the propellant's c* at its table temperature t / 0.95 (sqrt(0.95) = openMotor's c*). */
  etaCstar: number;
  /** x openMotor's adjusted Cf (divergence, throat, skin losses). */
  etaNozzle: number;
  /** x the propellant's burn rate coefficient a. */
  burnRateScale: number;
  // ignition
  /** Pa: igniter mass flow = this x A_t / c* ... */
  igniterPressure: number;
  /** s ... for this long (step), or its decay time (decay). */
  igniterTime: number;
  igniterProfile: IgniterProfile;
  /** Pa gauge at which a nozzle plug blows out (0 = none). */
  plugBurst: number;
  /** s, flame spread over the core at pRef. */
  tauCore: number;
  /** s, flame spread over the segment ends. */
  tauEnd: number;
  /** The ends start igniting at this fraction of tauCore (1: core fully lit). */
  endStart: number;
  /** linear: lit fraction rises at a constant rate | smooth: normal CDF of ignition times. */
  ignitionShape: IgnitionShape;
  /** q: spread rate ~ (p / pRef)^q. */
  spreadExponent: number;
  /** m: > 0 scales tauCore and tauEnd by total grain length / this. */
  spreadRefLength: number;
  /** Pa, reference pressure of the spread rate. */
  pRef: number;
  // burn rate law
  /** > 0: the propellant's bands blended across each band edge over +- this in ln(p) (smooth r(p)). */
  bandBlend: number;
  // tail-off
  /** Spread of the burnout web, as a fraction of the web (normal, sigma = ecc / 2, at most 3 mm). */
  ecc: number;
  // integration
  /** s, integration step. */
  dt: number;
  /** s, the run stops here if the chamber has not blown down. */
  tMax: number;
  /** m^3 of free volume beyond the grain envelopes (nozzle convergence, gaps). */
  freeVolumeExtra: number;
}

export type TransientPreset = 'validated' | 'openmotor';

/** What a design stores: the master switch, one switch per effect, and the option values. */
export interface TransientSettings {
  enabled: boolean;
  /** Also run plain openMotor and draw it beside the transient result. */
  compareBaseline: boolean;
  /** Igniter, nozzle plug and flame spread (off: everything burns from t = 0, as openMotor). */
  ignition: boolean;
  /** Spread of the burnout web (off: every grain burns out at once, as openMotor). */
  tailOff: boolean;
  /** Smooth burn-rate law across the propellant's bands (off: openMotor's bands with their kinks). */
  smoothBurnRate: boolean;
  /** Use etaCstar, burnRateScale and etaNozzle from a static firing (off: openMotor's c*, the
   * propellant's a and the nozzle's own efficiency). */
  calibration: boolean;
  options: TransientOptions;
}

/** sbal.engine.Options defaults. */
export function defaultTransientOptions(): TransientOptions {
  return {
    etaCstar: Math.sqrt(0.95),
    etaNozzle: 1.0,
    burnRateScale: 1.0,
    igniterPressure: 0.3e6,
    igniterTime: 0.1,
    igniterProfile: 'step',
    plugBurst: 0,
    tauCore: 0.05,
    tauEnd: 0.05,
    endStart: 1.0,
    ignitionShape: 'linear',
    spreadExponent: 0,
    spreadRefLength: 0,
    pRef: 2e6,
    bandBlend: 0,
    ecc: 0,
    dt: 1e-3,
    tMax: 30,
    freeVolumeExtra: 0,
  };
}

/**
 * sbal's named option sets. "validated": medians of the leave-one-out fits on public sugar-motor
 * tests (sugar-ballistics reports/phase3.md; held-out pressure RMS 6.0 %, openMotor 18.8 %).
 * "openmotor": every effect off. The preset's eta_nozzle is left out, as diver-sim does: the
 * nozzle efficiency comes from the design unless calibrated.
 */
export function transientPreset(name: TransientPreset, current?: TransientSettings): TransientSettings {
  const options = defaultTransientOptions();
  const keep = { enabled: current?.enabled ?? true, compareBaseline: current?.compareBaseline ?? true };
  if (name === 'openmotor') {
    return { ...keep, ignition: false, tailOff: false, smoothBurnRate: false, calibration: false, options };
  }
  return {
    ...keep,
    ignition: true,
    tailOff: true,
    smoothBurnRate: false,
    calibration: false,
    options: { ...options, igniterPressure: 0.3e6, igniterTime: 0.1, spreadRefLength: 0.3, tauCore: 0.101, tauEnd: 0.04, ecc: 0.185 },
  };
}

/** Off by default, with the validated values ready for when it is switched on. */
export function defaultTransientSettings(): TransientSettings {
  return { ...transientPreset('validated'), enabled: false };
}

/** The options the model runs with: each toggle that is off puts its options back to openMotor's. */
export interface EffectiveTransientOptions extends TransientOptions {
  instantIgnition: boolean;
  /** Pa, ambient pressure (the config's). */
  pAmb: number;
}

export function effectiveTransientOptions(settings: TransientSettings, nozzle: NozzleConfig, ambPressure: number): EffectiveTransientOptions {
  const o = settings.options;
  const base = defaultTransientOptions();
  return {
    ...o,
    instantIgnition: !settings.ignition,
    ecc: settings.tailOff ? o.ecc : 0,
    bandBlend: settings.smoothBurnRate ? o.bandBlend : 0,
    etaCstar: settings.calibration ? o.etaCstar : base.etaCstar,
    burnRateScale: settings.calibration ? o.burnRateScale : base.burnRateScale,
    etaNozzle: settings.calibration ? o.etaNozzle : nozzle.efficiency,
    pAmb: ambPressure,
  };
}
